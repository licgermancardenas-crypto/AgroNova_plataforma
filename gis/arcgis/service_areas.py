"""
AgroNova GIS-09 — Service Areas & Isochrones via ArcGIS REST API.

Service areas = polygons reachable within N minutes drive from a facility.
Isochrones    = same concept, used interchangeably here.

When ARCGIS_API_KEY is configured:
  → calls ArcGIS World Service Area REST endpoint

When not configured (local mode):
  → approximates with geodesic circles (Shapely + math).
    Assumes 80 km/h average speed on Argentine roads.

Outputs saved to data/gis_outputs/service_areas_{lat}_{lon}.geojson
and consolidated to data/gis_outputs/service_areas_all.geojson.
"""
from __future__ import annotations

import json
import logging
import math
from pathlib import Path
from typing import TypedDict

import requests

from . import config as cfg

log = logging.getLogger(__name__)

GIS_OUTPUTS = Path(__file__).parent.parent.parent / "data" / "gis_outputs"
GIS_OUTPUTS.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------

class ServiceAreaResult(TypedDict):
    facility_name: str
    lat:           float
    lon:           float
    breaks_min:    list[int]
    geojson:       dict          # FeatureCollection
    source:        str           # "arcgis" | "local"


# ---------------------------------------------------------------------------
# Local approximation — geodesic circle polygon
# ---------------------------------------------------------------------------

_AVG_SPEED_KMH  = 80.0
_EARTH_RADIUS_M = 6_371_000.0


def _km_to_deg_lat(km: float) -> float:
    return km / 111.32


def _km_to_deg_lon(km: float, lat: float) -> float:
    return km / (111.32 * math.cos(math.radians(lat)))


def _circle_polygon(
    lat: float, lon: float, radius_km: float, n_points: int = 36
) -> list[list[float]]:
    coords: list[list[float]] = []
    for i in range(n_points + 1):
        angle = 2 * math.pi * i / n_points
        dlat  = _km_to_deg_lat(radius_km) * math.sin(angle)
        dlon  = _km_to_deg_lon(radius_km, lat) * math.cos(angle)
        coords.append([lon + dlon, lat + dlat])
    return coords


def _local_service_area(
    lat: float,
    lon: float,
    breaks_min: list[int],
    facility_name: str,
) -> ServiceAreaResult:
    """Approximate service area as concentric circles."""
    features = []
    sorted_breaks = sorted(breaks_min, reverse=True)  # largest first (bottom layer)

    colors = {30: "#22C55E", 60: "#E8A020", 120: "#E03E3E"}

    for brk in sorted_breaks:
        radius_km = (_AVG_SPEED_KMH * brk / 60) * 0.65  # 0.65 = road-network factor
        polygon   = _circle_polygon(lat, lon, radius_km)
        features.append({
            "type": "Feature",
            "properties": {
                "facility":    facility_name,
                "break_min":   brk,
                "radius_km":   round(radius_km, 1),
                "color":       colors.get(brk, "#A3E635"),
                "source":      "local_approx",
            },
            "geometry": {
                "type":        "Polygon",
                "coordinates": [polygon],
            },
        })

    geojson: dict = {"type": "FeatureCollection", "features": features}
    return ServiceAreaResult(
        facility_name=facility_name,
        lat=lat,
        lon=lon,
        breaks_min=breaks_min,
        geojson=geojson,
        source="local",
    )


# ---------------------------------------------------------------------------
# ArcGIS service area
# ---------------------------------------------------------------------------

def _arcgis_service_area(
    lat: float,
    lon: float,
    breaks_min: list[int],
    facility_name: str,
) -> ServiceAreaResult:
    facility_featureset = {
        "type": "FeatureSet",
        "spatialReference": {"wkid": 4326},
        "features": [{
            "geometry": {"x": lon, "y": lat},
            "attributes": {"Name": facility_name, "FacilityID": 1},
        }],
    }

    breaks_str = " ".join(str(b) for b in sorted(breaks_min))

    params = {
        "facilities":         json.dumps(facility_featureset),
        "defaultBreaks":      breaks_str,
        "travelMode":         json.dumps({"type": "AUTOMOBILE"}),
        "outputType":         "esriNAOutputPolygon",
        "overlapPolygons":    "false",
        "returnPolygons":     "true",
        "f":                  "json",
        **cfg.auth_params(),
    }

    try:
        resp = requests.post(
            cfg.SERVICE_AREA_URL,
            data=params,
            timeout=cfg.DEFAULT_TIMEOUT_S,
        )
        resp.raise_for_status()
        data = resp.json()

        if "error" in data:
            log.warning("ArcGIS service area error: %s — local fallback", data["error"])
            return _local_service_area(lat, lon, breaks_min, facility_name)

        sa_features_raw = data.get("saPolygons", {}).get("features", [])
        if not sa_features_raw:
            return _local_service_area(lat, lon, breaks_min, facility_name)

        features = []
        colors   = {30: "#22C55E", 60: "#E8A020", 120: "#E03E3E"}
        for feat in sa_features_raw:
            attrs  = feat.get("attributes", {})
            brk    = int(attrs.get("ToBreak", 0))
            # Convert Esri ring format → GeoJSON
            rings  = feat.get("geometry", {}).get("rings", [])
            geom   = {"type": "Polygon", "coordinates": rings} if rings else None
            features.append({
                "type": "Feature",
                "properties": {
                    "facility":  facility_name,
                    "break_min": brk,
                    "color":     colors.get(brk, "#A3E635"),
                    "source":    "arcgis",
                },
                "geometry": geom,
            })

        return ServiceAreaResult(
            facility_name=facility_name,
            lat=lat, lon=lon,
            breaks_min=breaks_min,
            geojson={"type": "FeatureCollection", "features": features},
            source="arcgis",
        )

    except requests.RequestException as exc:
        log.error("ArcGIS service area request failed: %s — local fallback", exc)
        return _local_service_area(lat, lon, breaks_min, facility_name)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def compute_service_area(
    lat:           float,
    lon:           float,
    breaks_min:    list[int] | None = None,
    facility_name: str              = "Facility",
    save:          bool             = True,
) -> ServiceAreaResult:
    """
    Compute service area polygons for a facility.

    Args:
        lat, lon:      Facility coordinates (WGS-84).
        breaks_min:    Drive-time breaks in minutes (default: [30, 60, 120]).
        facility_name: Label for the facility.
        save:          If True, write result to data/gis_outputs/.

    Returns:
        ServiceAreaResult with GeoJSON FeatureCollection.
    """
    breaks = breaks_min or cfg.SERVICE_AREA_BREAKS_MIN

    if cfg.is_configured():
        result = _arcgis_service_area(lat, lon, breaks, facility_name)
    else:
        result = _local_service_area(lat, lon, breaks, facility_name)

    if save:
        _save(result)

    return result


def compute_isochrone(
    lat:           float,
    lon:           float,
    breaks_min:    list[int] | None = None,
    facility_name: str              = "Facility",
    save:          bool             = True,
) -> ServiceAreaResult:
    """Alias for compute_service_area — isochrones use the same endpoint."""
    return compute_service_area(lat, lon, breaks_min, facility_name, save)


def compute_batch(
    facilities: list[dict],
    breaks_min: list[int] | None = None,
) -> list[ServiceAreaResult]:
    """
    Compute service areas for multiple facilities.

    Args:
        facilities: List of dicts with keys: lat, lon, name.
        breaks_min: Shared break values for all facilities.

    Returns:
        List of ServiceAreaResult.
    """
    results = []
    for f in facilities:
        r = compute_service_area(
            lat=f["lat"],
            lon=f["lon"],
            breaks_min=breaks_min,
            facility_name=f.get("name", f"Facility_{f['lat']}_{f['lon']}"),
            save=True,
        )
        results.append(r)

    # Consolidated output
    all_features: list[dict] = []
    for r in results:
        all_features.extend(r["geojson"]["features"])

    consolidated = {"type": "FeatureCollection", "features": all_features}
    out_path = GIS_OUTPUTS / "service_areas_all.geojson"
    out_path.write_text(json.dumps(consolidated, ensure_ascii=False), encoding="utf-8")
    log.info("Saved consolidated service areas → %s", out_path)

    return results


# ---------------------------------------------------------------------------
# Save helper
# ---------------------------------------------------------------------------

def _save(result: ServiceAreaResult) -> Path:
    safe_name = result["facility_name"].replace(" ", "_").replace("/", "-")
    fname = f"service_area_{safe_name}_{result['lat']}_{result['lon']}.geojson"
    out_path = GIS_OUTPUTS / fname
    out_path.write_text(
        json.dumps(result["geojson"], ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    log.info("Saved service area → %s  (source=%s)", out_path, result["source"])
    return out_path


# ---------------------------------------------------------------------------
# Default facilities (AgroNova sucursales)
# ---------------------------------------------------------------------------

AGRONOVA_FACILITIES = [
    {"name": "Sucursal Buenos Aires", "lat": -34.603, "lon": -58.381},
    {"name": "Sucursal Rosario",      "lat": -32.947, "lon": -60.639},
    {"name": "Sucursal Córdoba",      "lat": -31.413, "lon": -64.181},
    {"name": "Sucursal Tucumán",      "lat": -26.808, "lon": -65.218},
    {"name": "Sucursal Mendoza",      "lat": -32.889, "lon": -68.846},
]


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import sys
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    breaks = [30, 60, 120]

    # Req-5: compute service areas for Rosario with 30/60/120 min breaks
    print("\n=== Rosario Service Area (Req-5 test) ===")
    result = compute_service_area(
        lat=-32.947, lon=-60.639,
        breaks_min=breaks,
        facility_name="Puerto Rosario",
    )
    print(f"Source: {result['source']}")
    print(f"Features: {len(result['geojson']['features'])}")
    for feat in result["geojson"]["features"]:
        p = feat["properties"]
        print(f"  {p['break_min']} min  radius~{p.get('radius_km','?')} km  color={p['color']}")

    # All sucursales
    if "--all" in sys.argv:
        print("\n=== All AgroNova Sucursales ===")
        all_results = compute_batch(AGRONOVA_FACILITIES, breaks_min=breaks)
        print(f"Generated {len(all_results)} facility service areas")
        print("Consolidated -> data/gis_outputs/service_areas_all.geojson")

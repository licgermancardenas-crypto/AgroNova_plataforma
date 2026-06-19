"""
AgroNova GIS-09 — Routing via ArcGIS World Route Service.

Computes optimized routes between waypoints with travel time,
distance, and turn-by-turn directions.

When ARCGIS_API_KEY is not set, returns a straight-line
approximation using the Haversine formula.
"""
from __future__ import annotations

import json
import logging
import math
from typing import TypedDict

import requests

from . import config as cfg

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------

class Waypoint(TypedDict):
    name: str
    lat:  float
    lon:  float


class RouteSegment(TypedDict):
    from_name:      str
    to_name:        str
    distance_km:    float
    duration_min:   float
    source:         str          # "arcgis" | "local"


class RouteResult(TypedDict):
    waypoints:      list[Waypoint]
    total_km:       float
    total_min:      float
    segments:       list[RouteSegment]
    geometry:       dict | None  # GeoJSON LineString or None in local mode
    source:         str


# ---------------------------------------------------------------------------
# Haversine (local mode)
# ---------------------------------------------------------------------------

def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi  = math.radians(lat2 - lat1)
    dlam  = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


_AVG_SPEED_KMH = 80.0   # representative average for Argentine roads


def _local_route(waypoints: list[Waypoint]) -> RouteResult:
    """Straight-line route approximation (offline mode)."""
    segments: list[RouteSegment] = []
    total_km = 0.0

    for i in range(len(waypoints) - 1):
        a, b = waypoints[i], waypoints[i + 1]
        km = _haversine_km(a["lat"], a["lon"], b["lat"], b["lon"])
        mn = (km / _AVG_SPEED_KMH) * 60
        total_km += km
        segments.append(RouteSegment(
            from_name=a["name"],
            to_name=b["name"],
            distance_km=round(km, 2),
            duration_min=round(mn, 1),
            source="local",
        ))

    return RouteResult(
        waypoints=waypoints,
        total_km=round(total_km, 2),
        total_min=round(sum(s["duration_min"] for s in segments), 1),
        segments=segments,
        geometry=None,
        source="local",
    )


# ---------------------------------------------------------------------------
# ArcGIS route
# ---------------------------------------------------------------------------

def route(waypoints: list[Waypoint]) -> RouteResult:
    """
    Compute a route between two or more waypoints.

    Args:
        waypoints: List of dicts with name/lat/lon.

    Returns:
        RouteResult with distance, time, and segments.
    """
    if len(waypoints) < 2:
        raise ValueError("At least 2 waypoints required.")

    if not cfg.is_configured():
        log.debug("ArcGIS not configured — local route approximation")
        return _local_route(waypoints)

    stops_features = {
        "type": "FeatureSet",
        "features": [
            {
                "geometry": {"x": w["lon"], "y": w["lat"]},
                "attributes": {"Name": w["name"], "SEQUENCE": i + 1},
            }
            for i, w in enumerate(waypoints)
        ],
    }

    params = {
        "stops":            json.dumps(stops_features),
        "returnRoutes":     "true",
        "returnDirections": "false",
        "outputLines":      "esriNAOutputLineTrueShapeWithMeasure",
        "f":                "json",
        **cfg.auth_params(),
    }

    try:
        resp = requests.post(
            cfg.ROUTING_URL,
            data=params,
            timeout=cfg.DEFAULT_TIMEOUT_S,
        )
        resp.raise_for_status()
        data = resp.json()

        if "error" in data:
            log.warning("ArcGIS routing error: %s — local fallback", data["error"])
            return _local_route(waypoints)

        routes_featureset = data.get("routes", {}).get("features", [])
        if not routes_featureset:
            return _local_route(waypoints)

        total_km  = 0.0
        total_min = 0.0
        segments: list[RouteSegment] = []

        for feat in routes_featureset:
            attrs = feat.get("attributes", {})
            km  = float(attrs.get("Total_Kilometers", 0))
            mn  = float(attrs.get("Total_TravelTime", 0))
            total_km  += km
            total_min += mn
            # Build per-segment from waypoint pairs (simplified)
            segments.append(RouteSegment(
                from_name=waypoints[0]["name"],
                to_name=waypoints[-1]["name"],
                distance_km=round(km, 2),
                duration_min=round(mn, 1),
                source="arcgis",
            ))

        geometry = None
        if routes_featureset:
            raw_geom = routes_featureset[0].get("geometry")
            if raw_geom and "paths" in raw_geom:
                geometry = {
                    "type": "LineString",
                    "coordinates": [
                        [pt[0], pt[1]] for pt in raw_geom["paths"][0]
                    ],
                }

        return RouteResult(
            waypoints=waypoints,
            total_km=round(total_km, 2),
            total_min=round(total_min, 1),
            segments=segments,
            geometry=geometry,
            source="arcgis",
        )

    except requests.RequestException as exc:
        log.error("ArcGIS route request failed: %s — local fallback", exc)
        return _local_route(waypoints)


# ---------------------------------------------------------------------------
# CLI test
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import json as _json
    result = route([
        {"name": "Buenos Aires", "lat": -34.603, "lon": -58.381},
        {"name": "Rosario",      "lat": -32.947, "lon": -60.639},
        {"name": "Córdoba",      "lat": -31.413, "lon": -64.181},
    ])
    print(_json.dumps(result, ensure_ascii=False, indent=2))

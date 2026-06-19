"""
AgroNova GIS-09 — Geocoding via ArcGIS World Geocoder.

When ARCGIS_API_KEY is not set, falls back to the static
PROVINCE_CAPITAL dictionary from geo_utils (offline mode).

Usage:
    from gis.arcgis.geocoding import geocode
    result = geocode("Rosario, Santa Fe")
    # {"address": "Rosario, Santa Fe", "lat": -32.947, "lon": -60.639,
    #   "score": 100, "source": "arcgis"}
"""
from __future__ import annotations

import logging
from typing import TypedDict

import requests

from . import config as cfg
from .. import geo_utils as gu

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Return type
# ---------------------------------------------------------------------------

class GeocodeResult(TypedDict):
    address: str
    lat:     float
    lon:     float
    score:   float          # 0-100; 100 = exact match
    source:  str            # "arcgis" | "local"


# ---------------------------------------------------------------------------
# Province fallback lookup (offline mode)
# ---------------------------------------------------------------------------

_PROVINCE_ALIASES: dict[str, str] = {
    # Normalise common spellings to INDEC names
    "buenos aires":       "Buenos Aires",
    "caba":               "Ciudad Autónoma de Buenos Aires",
    "capital federal":    "Ciudad Autónoma de Buenos Aires",
    "cba":                "Córdoba",
    "cordoba":            "Córdoba",
    "sante fe":           "Santa Fe",
    "santa fe":           "Santa Fe",
    "mendoza":            "Mendoza",
    "tucuman":            "Tucumán",
    "tucumán":            "Tucumán",
    "salta":              "Salta",
    "misiones":           "Misiones",
    "entre rios":         "Entre Ríos",
    "entre ríos":         "Entre Ríos",
    "corrientes":         "Corrientes",
    "chaco":              "Chaco",
    "santiago del estero":"Santiago del Estero",
    "jujuy":              "Jujuy",
    "rio negro":          "Río Negro",
    "río negro":          "Río Negro",
    "neuquen":            "Neuquén",
    "neuquén":            "Neuquén",
    "la rioja":           "La Rioja",
    "san juan":           "San Juan",
    "san luis":           "San Luis",
    "catamarca":          "Catamarca",
    "formosa":            "Formosa",
    "la pampa":           "La Pampa",
    "chubut":             "Chubut",
    "santa cruz":         "Santa Cruz",
    "tierra del fuego":   "Tierra del Fuego",
}

# Major cities mapped to lat/lon (extended for Req-4 test case)
_CITY_COORDS: dict[str, tuple[float, float]] = {
    "rosario":            (-32.9468, -60.6393),
    "buenos aires":       (-34.6037, -58.3816),
    "córdoba":            (-31.4135, -64.1810),
    "cordoba":            (-31.4135, -64.1810),
    "mendoza":            (-32.8895, -68.8458),
    "tucumán":            (-26.8083, -65.2176),
    "tucuman":            (-26.8083, -65.2176),
    "salta":              (-24.7859, -65.4117),
    "mar del plata":      (-38.0055, -57.5426),
    "san miguel de tucumán":(-26.8083, -65.2176),
    "posadas":            (-27.3671, -55.8962),
    "resistencia":        (-27.4606, -58.9869),
    "corrientes":         (-27.4696, -58.8306),
    "bahía blanca":       (-38.7183, -62.2663),
    "santa fe":           (-31.6333, -60.7000),
    "neuquén":            (-38.9516, -68.0591),
    "la plata":           (-34.9215, -57.9545),
    "san juan":           (-31.5375, -68.5364),
    "paraná":             (-31.7333, -60.5333),
    "formosa":            (-26.1775, -58.1781),
    "jujuy":              (-24.1858, -65.2995),
}


def _local_geocode(address: str) -> GeocodeResult:
    """Offline geocode: tries city dict then province centroids."""
    query = address.lower().strip()

    # Try city name first
    for city, (lat, lon) in _CITY_COORDS.items():
        if city in query:
            return GeocodeResult(
                address=address, lat=lat, lon=lon, score=85.0, source="local"
            )

    # Try province centroid
    for alias, prov_name in _PROVINCE_ALIASES.items():
        if alias in query:
            cat = gu.PROVINCE_CATALOGUE.get(prov_name)
            if cat:
                return GeocodeResult(
                    address=address,
                    lat=cat["lat"],
                    lon=cat["lon"],
                    score=70.0,
                    source="local",
                )

    # Last resort: centroid of Argentina
    return GeocodeResult(
        address=address, lat=-34.0, lon=-64.0, score=0.0, source="local"
    )


def geocode(address: str) -> GeocodeResult:
    """
    Geocode an address string to lat/lon.

    Uses ArcGIS World Geocoder when ARCGIS_API_KEY is set,
    otherwise falls back to offline lookup.

    Args:
        address: Free-text address, e.g. "Rosario, Santa Fe"

    Returns:
        GeocodeResult dict with lat, lon, score, source.
    """
    if not cfg.is_configured():
        log.debug("ArcGIS not configured — local geocode for %r", address)
        return _local_geocode(address)

    params = {
        "SingleLine": address,
        "f":           "json",
        "maxLocations": 1,
        "countryCode":  cfg.DEFAULT_COUNTRY,
        "langCode":     cfg.DEFAULT_LANGUAGE,
        "outFields":    "Match_addr,Score",
        **cfg.auth_params(),
    }

    try:
        resp = requests.get(
            cfg.GEOCODE_URL,
            params=params,
            timeout=cfg.DEFAULT_TIMEOUT_S,
        )
        resp.raise_for_status()
        data = resp.json()

        candidates = data.get("candidates", [])
        if not candidates:
            log.warning("No candidates returned for %r — local fallback", address)
            return _local_geocode(address)

        best = candidates[0]
        loc  = best.get("location", {})
        return GeocodeResult(
            address=best.get("address", address),
            lat=float(loc.get("y", -34.0)),
            lon=float(loc.get("x", -64.0)),
            score=float(best.get("score", 0)),
            source="arcgis",
        )

    except requests.RequestException as exc:
        log.error("ArcGIS geocode request failed: %s — local fallback", exc)
        return _local_geocode(address)


def batch_geocode(addresses: list[str]) -> list[GeocodeResult]:
    """Geocode a list of addresses sequentially."""
    return [geocode(a) for a in addresses]


# ---------------------------------------------------------------------------
# CLI test (python -m gis.arcgis.geocoding)
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import json
    test_cases = [
        "Rosario, Santa Fe",
        "Buenos Aires",
        "Mendoza",
        "San Miguel de Tucumán",
        "Bahía Blanca, Buenos Aires",
    ]
    for addr in test_cases:
        r = geocode(addr)
        print(json.dumps(r, ensure_ascii=False))

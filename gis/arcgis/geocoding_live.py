"""
AgroNova GIS-14 — geocoding_live.py

High-level geocoding API matching the GIS-14 contract.

Functions:
    geocode_address(address)   → GeocodeResult  (forward geocoding)
    reverse_geocode(lat, lon)  → GeocodeResult  (reverse geocoding)

Both use ArcGIS World Geocoder when ARCGIS_API_KEY is configured,
falling back to local lookup tables silently otherwise.
"""
from __future__ import annotations

import logging

import requests

from . import config as cfg
from .geocoding import GeocodeResult, _CITY_COORDS, geocode

log = logging.getLogger(__name__)

_REVERSE_URL = (
    "https://geocode.arcgis.com/arcgis/rest/services"
    "/World/GeocodeServer/reverseGeocode"
)


# ---------------------------------------------------------------------------
# Forward geocoding (alias with consistent naming)
# ---------------------------------------------------------------------------

def geocode_address(address: str) -> GeocodeResult:
    """
    Forward geocode: address string → lat/lon.

    Args:
        address: Free-text, e.g. "Rosario, Santa Fe, Argentina"

    Returns:
        GeocodeResult with lat, lon, score, source.
    """
    return geocode(address)


# ---------------------------------------------------------------------------
# Reverse geocoding
# ---------------------------------------------------------------------------

def _reverse_local(lat: float, lon: float) -> GeocodeResult:
    """Find nearest known city by Euclidean distance (offline mode)."""
    best_name = f"{lat:.4f}, {lon:.4f}"
    best_dist = float("inf")
    for city, (clat, clon) in _CITY_COORDS.items():
        d = (lat - clat) ** 2 + (lon - clon) ** 2
        if d < best_dist:
            best_dist = d
            best_name = city.title()
    return GeocodeResult(
        address=f"{best_name}, Argentina",
        lat=lat,
        lon=lon,
        score=50.0,
        source="local",
    )


def reverse_geocode(lat: float, lon: float) -> GeocodeResult:
    """
    Reverse geocode: lat/lon → nearest address.

    Uses ArcGIS reverseGeocode when ARCGIS_API_KEY is set,
    otherwise returns nearest city from local table.

    Args:
        lat: Latitude (WGS-84).
        lon: Longitude (WGS-84).

    Returns:
        GeocodeResult with address, lat, lon, score, source.
    """
    if not cfg.is_configured():
        log.debug("ArcGIS not configured — local reverse geocode for %s,%s", lat, lon)
        return _reverse_local(lat, lon)

    params = {
        "location": f"{lon},{lat}",
        "f":        "json",
        "langCode": cfg.DEFAULT_LANGUAGE,
        **cfg.auth_params(),
    }

    try:
        resp = requests.get(
            _REVERSE_URL,
            params=params,
            timeout=cfg.DEFAULT_TIMEOUT_S,
        )
        resp.raise_for_status()
        data = resp.json()

        if "error" in data:
            log.warning("ArcGIS reverseGeocode error: %s", data["error"])
            return _reverse_local(lat, lon)

        addr_obj = data.get("address", {})
        label    = (
            addr_obj.get("LongLabel")
            or addr_obj.get("Match_addr")
            or f"{lat}, {lon}"
        )
        loc = data.get("location", {})
        return GeocodeResult(
            address=label,
            lat=float(loc.get("y", lat)),
            lon=float(loc.get("x", lon)),
            score=90.0,
            source="arcgis",
        )

    except requests.RequestException as exc:
        log.error("ArcGIS reverseGeocode request failed: %s — local fallback", exc)
        return _reverse_local(lat, lon)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import json
    print("=== Forward geocode ===")
    print(json.dumps(geocode_address("Mendoza, Argentina"), ensure_ascii=False))
    print("\n=== Reverse geocode ===")
    print(json.dumps(reverse_geocode(-32.947, -60.639), ensure_ascii=False))

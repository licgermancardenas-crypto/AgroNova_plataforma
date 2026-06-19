"""
AgroNova GIS-09 — ArcGIS REST API configuration.

Reads credentials from environment variables.
Falls back to LOCAL mode silently if not configured.
"""
from __future__ import annotations

import os

# ---------------------------------------------------------------------------
# Env vars
# ---------------------------------------------------------------------------
ARCGIS_API_KEY:  str | None = os.environ.get("ARCGIS_API_KEY")
ARCGIS_BASE_URL: str        = os.environ.get(
    "ARCGIS_BASE_URL",
    "https://geocode.arcgis.com/arcgis/rest/services",
)

# ---------------------------------------------------------------------------
# Service endpoints (relative to ARCGIS_BASE_URL or absolute)
# ---------------------------------------------------------------------------
GEOCODE_URL = (
    "https://geocode.arcgis.com/arcgis/rest/services"
    "/World/GeocodeServer/findAddressCandidates"
)
SERVICE_AREA_URL = (
    "https://route.arcgis.com/arcgis/rest/services"
    "/World/ServiceAreas/NAServer/ServiceArea_World/solveServiceArea"
)
ROUTING_URL = (
    "https://route.arcgis.com/arcgis/rest/services"
    "/World/Route/NAServer/Route_World/solve"
)

# ---------------------------------------------------------------------------
# Defaults
# ---------------------------------------------------------------------------
DEFAULT_TIMEOUT_S  = 15
DEFAULT_COUNTRY    = "ARG"
DEFAULT_LANGUAGE   = "es"
SERVICE_AREA_BREAKS_MIN = [30, 60, 120]   # minutes

# ---------------------------------------------------------------------------
# Mode helpers
# ---------------------------------------------------------------------------

def is_configured() -> bool:
    """True when an API key is present."""
    return bool(ARCGIS_API_KEY)


def mode() -> str:
    return "arcgis" if is_configured() else "local"


def auth_params() -> dict:
    """Returns token params or empty dict (local mode)."""
    if ARCGIS_API_KEY:
        return {"token": ARCGIS_API_KEY}
    return {}

"""
AgroNova GIS-14 — service_areas_live.py

Live service area generation for AgroNova sucursales.

Uses ArcGIS World Service Area API when ARCGIS_API_KEY is configured;
falls back to geodesic circle approximation otherwise.

Public API:
    generate_service_areas()  — compute for all sucursales, return results
    refresh_all()             — regenerate + save + return summary dict
    get_status()              — quick status dict (no computation, no I/O)
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path

from . import config as cfg
from .service_areas import (
    AGRONOVA_FACILITIES,
    GIS_OUTPUTS,
    ServiceAreaResult,
    compute_batch,
)

log = logging.getLogger(__name__)

BREAKS_MIN: list[int] = cfg.SERVICE_AREA_BREAKS_MIN   # [30, 60, 120]
ALL_SA_PATH: Path     = GIS_OUTPUTS / "service_areas_all.geojson"


# ---------------------------------------------------------------------------
# Public functions
# ---------------------------------------------------------------------------

def generate_service_areas(
    facilities: list[dict] | None = None,
    breaks_min: list[int] | None = None,
) -> list[ServiceAreaResult]:
    """
    Compute service areas for all (or provided) AgroNova sucursales.

    Args:
        facilities: List of {"name", "lat", "lon"} dicts.
                    Defaults to AGRONOVA_FACILITIES (5 sucursales).
        breaks_min: Drive-time breaks in minutes.
                    Defaults to [30, 60, 120].

    Returns:
        List of ServiceAreaResult, one per facility.
        Results are also persisted to data/gis_outputs/.
    """
    facs  = facilities or AGRONOVA_FACILITIES
    brks  = breaks_min or BREAKS_MIN
    log.info(
        "Generating service areas: %d facilities × %s min breaks (mode=%s)",
        len(facs), brks, cfg.mode(),
    )
    return compute_batch(facilities=facs, breaks_min=brks)


def refresh_all() -> dict:
    """
    Regenerate and save service areas for all AgroNova sucursales.

    Returns a summary dict suitable for an API response or logging.

    Returns:
        {
            "facilities":   int,
            "polygons":     int,
            "source":       "arcgis" | "local",
            "breaks_min":   [30, 60, 120],
            "output_path":  str,
            "timestamp":    str (ISO 8601, UTC),
        }
    """
    results       = generate_service_areas()
    total_polygons = sum(len(r["geojson"]["features"]) for r in results)
    source        = results[0]["source"] if results else "local"

    summary = {
        "facilities":  len(results),
        "polygons":    total_polygons,
        "source":      source,
        "breaks_min":  BREAKS_MIN,
        "output_path": str(ALL_SA_PATH),
        "timestamp":   datetime.now(timezone.utc).isoformat(),
    }
    log.info("Service area refresh complete: %s", summary)
    return summary


def get_status() -> dict:
    """
    Return current status without triggering any computation.

    Reads metadata from the consolidated GeoJSON file on disk.

    Returns:
        {
            "configured":     bool,
            "mode":           "arcgis" | "local",
            "output_exists":  bool,
            "polygon_count":  int,
            "facility_count": int,
            "breaks_min":     [...],
            "last_modified":  str | None  (ISO 8601, UTC),
        }
    """
    polygon_count  = 0
    last_modified: str | None = None

    if ALL_SA_PATH.exists():
        try:
            data          = json.loads(ALL_SA_PATH.read_text(encoding="utf-8"))
            polygon_count = len(data.get("features", []))
            mtime         = ALL_SA_PATH.stat().st_mtime
            last_modified = datetime.fromtimestamp(mtime, tz=timezone.utc).isoformat()
        except Exception as exc:        # noqa: BLE001
            log.warning("Could not read %s: %s", ALL_SA_PATH, exc)

    return {
        "configured":     cfg.is_configured(),
        "mode":           cfg.mode(),
        "output_exists":  ALL_SA_PATH.exists(),
        "polygon_count":  polygon_count,
        "facility_count": len(AGRONOVA_FACILITIES),
        "breaks_min":     BREAKS_MIN,
        "last_modified":  last_modified,
    }


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import sys
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    if "--status" in sys.argv:
        import json as _json
        print(_json.dumps(get_status(), indent=2))
    elif "--refresh" in sys.argv:
        import json as _json
        summary = refresh_all()
        print(_json.dumps(summary, indent=2))
    else:
        print("Usage: python -m gis.arcgis.service_areas_live [--status|--refresh]")
        print("\nCurrent status:")
        import json as _json
        print(_json.dumps(get_status(), indent=2))

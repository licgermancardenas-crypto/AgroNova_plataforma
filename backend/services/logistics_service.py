"""
costs/risk read GIS-06's pre-generated outputs (gis/generate_analytics.py).
routes calls gis.routing_engine.cliente_routing_assignment() live — it's a
pure pandas computation over the (small) client/branch/depot tables, not
wired into generate_analytics.py's output files, so there's nothing to read
from disk for it.
"""
from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from gis.routing_engine import cliente_routing_assignment  # noqa: E402

from backend.services.gis_service import _read_json  # noqa: E402
from backend.core.config import get_settings

settings = get_settings()


def get_routes() -> dict:
    return cliente_routing_assignment()


def get_risk() -> dict:
    return _read_json(settings.gis_outputs_dir / "route_risk.json")


def get_costs() -> dict:
    return _read_json(settings.gis_outputs_dir / "transport_costs.json")

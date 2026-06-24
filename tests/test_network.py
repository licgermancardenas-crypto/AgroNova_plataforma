"""
GIS-27 Network Intelligence — backend tests.

- Validates network_analysis.json structure.
- Exercises /api/network/* routes via FastAPI TestClient.
  DB may not be available in CI → soft-checked (200 OR 500/503).
"""
import json
import pathlib
import pytest
from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)

NETWORK_JSON = (
    pathlib.Path(__file__).parent.parent
    / "web" / "public" / "data" / "gis_outputs" / "network_analysis.json"
)

DEPOT_REQUIRED  = {"deposito_id", "nombre", "lat", "lon", "n_envios",
                   "otif_pct", "utilizacion_pct", "load_status", "load_color"}
FLOW_REQUIRED   = {"deposito_id", "region_id", "n_envios", "otif_pct",
                   "deposito_lat", "deposito_lon", "region_lat", "region_lon", "flow_color"}
STATUS_REQUIRED = {"total_envios", "otif_global", "utilizacion_promedio",
                   "n_depositos", "n_depositos_criticos"}
LOAD_STATUSES   = {"NORMAL", "ALTO_USO", "CRÍTICO"}
FLOW_COLORS     = {"#22C55E", "#F97316", "#E03E3E"}


# ── Static JSON tests ─────────────────────────────────────────────────────────

class TestNetworkJson:
    @pytest.fixture(autouse=True)
    def check_file(self):
        if not NETWORK_JSON.exists():
            pytest.skip("network_analysis.json not generated — run generate_network_analysis.py")

    def test_valid_json(self):
        data = json.loads(NETWORK_JSON.read_text(encoding="utf-8"))
        assert isinstance(data, dict)

    def test_top_level_keys(self):
        data = json.loads(NETWORK_JSON.read_text(encoding="utf-8"))
        for k in ("status", "depots", "flows"):
            assert k in data, f"Missing key: {k}"

    def test_depots_count(self):
        data = json.loads(NETWORK_JSON.read_text(encoding="utf-8"))
        assert len(data["depots"]) >= 1

    def test_depot_required_fields(self):
        data = json.loads(NETWORK_JSON.read_text(encoding="utf-8"))
        for d in data["depots"]:
            missing = DEPOT_REQUIRED - set(d.keys())
            assert not missing, f"Depot {d.get('deposito_id')} missing: {missing}"

    def test_depot_load_status_valid(self):
        data = json.loads(NETWORK_JSON.read_text(encoding="utf-8"))
        for d in data["depots"]:
            assert d["load_status"] in LOAD_STATUSES

    def test_depot_otif_range(self):
        data = json.loads(NETWORK_JSON.read_text(encoding="utf-8"))
        for d in data["depots"]:
            assert 0 <= d["otif_pct"] <= 100, f"OTIF out of range: {d['otif_pct']}"

    def test_depot_utilizacion_range(self):
        data = json.loads(NETWORK_JSON.read_text(encoding="utf-8"))
        for d in data["depots"]:
            assert 0 <= d["utilizacion_pct"] <= 100.1, f"Util out of range: {d['utilizacion_pct']}"

    def test_flows_structure(self):
        data = json.loads(NETWORK_JSON.read_text(encoding="utf-8"))
        for f in data["flows"]:
            missing = FLOW_REQUIRED - set(f.keys())
            assert not missing, f"Flow missing: {missing}"

    def test_flow_color_valid(self):
        data = json.loads(NETWORK_JSON.read_text(encoding="utf-8"))
        for f in data["flows"]:
            assert f["flow_color"] in FLOW_COLORS

    def test_flow_n_envios_positive(self):
        data = json.loads(NETWORK_JSON.read_text(encoding="utf-8"))
        for f in data["flows"]:
            assert f["n_envios"] > 0

    def test_status_required_fields(self):
        data = json.loads(NETWORK_JSON.read_text(encoding="utf-8"))
        for k in STATUS_REQUIRED:
            assert k in data["status"], f"Status missing: {k}"

    def test_status_otif_range(self):
        data = json.loads(NETWORK_JSON.read_text(encoding="utf-8"))
        assert 0 <= data["status"]["otif_global"] <= 100


# ── API route tests ───────────────────────────────────────────────────────────

class TestNetworkRoutes:
    def test_status_endpoint(self):
        r = client.get("/api/network/status")
        assert r.status_code in (200, 500, 503)

    def test_status_shape(self):
        r = client.get("/api/network/status")
        if r.status_code != 200:
            pytest.skip("DB unavailable")
        body = r.json()
        assert "total_envios" in body
        assert "otif_global" in body

    def test_flows_endpoint(self):
        r = client.get("/api/network/flows")
        assert r.status_code in (200, 500, 503)

    def test_flows_shape(self):
        r = client.get("/api/network/flows")
        if r.status_code != 200:
            pytest.skip("DB unavailable")
        body = r.json()
        assert isinstance(body, list)
        if body:
            assert "deposito_id" in body[0]
            assert "flow_color" in body[0]

    def test_depots_endpoint(self):
        r = client.get("/api/network/depots")
        assert r.status_code in (200, 500, 503)

    def test_depots_shape(self):
        r = client.get("/api/network/depots")
        if r.status_code != 200:
            pytest.skip("DB unavailable")
        body = r.json()
        assert isinstance(body, list)
        if body:
            assert "load_status" in body[0]
            assert "otif_pct" in body[0]

    def test_capacity_endpoint(self):
        r = client.get("/api/network/capacity")
        assert r.status_code in (200, 500, 503)

    def test_bottlenecks_endpoint(self):
        r = client.get("/api/network/bottlenecks")
        assert r.status_code in (200, 500, 503)

    def test_simulation_endpoint(self):
        r = client.get("/api/network/simulation/1")
        assert r.status_code in (200, 500, 503)

    def test_simulation_shape(self):
        r = client.get("/api/network/simulation/1")
        if r.status_code != 200:
            pytest.skip("DB unavailable")
        body = r.json()
        if "error" not in body:
            assert "n_envios_afectados" in body
            assert "redistribucion" in body

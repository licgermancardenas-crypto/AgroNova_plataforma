"""
GIS-26 Territory Optimization — backend tests.

- Validates territory_analysis.json structure (pre-generated from Neon).
- Exercises /api/territory/* routes via FastAPI TestClient.
  DB may not be available in CI → soft-checked (200 OR 500/503).
"""
import json
import pathlib
import pytest
from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)

TERRITORY_JSON = (
    pathlib.Path(__file__).parent.parent
    / "web" / "public" / "data" / "gis_outputs" / "territory_analysis.json"
)

BRANCH_REQUIRED = {"sucursal_id", "nombre", "lat", "lng", "n_clientes",
                   "revenue_total", "otif_avg", "avg_distance_km",
                   "load_status", "load_color"}

CONFLICT_REQUIRED = {"cliente_id", "current_id", "nearest_id",
                     "current_dist_km", "nearest_dist_km", "improvement_pct",
                     "lat", "lon"}

LOAD_STATUSES = {"NORMAL", "ALTA_CARGA", "SATURADA"}
LOAD_COLORS   = {"#22C55E", "#F97316", "#E03E3E"}


# ── Static JSON tests ─────────────────────────────────────────────────────────

class TestTerritoryJson:
    @pytest.fixture(autouse=True)
    def check_file(self):
        if not TERRITORY_JSON.exists():
            pytest.skip("territory_analysis.json not generated — run generate_territory_analysis.py")

    def test_valid_json(self):
        data = json.loads(TERRITORY_JSON.read_text(encoding="utf-8"))
        assert isinstance(data, dict)

    def test_top_level_keys(self):
        data = json.loads(TERRITORY_JSON.read_text(encoding="utf-8"))
        assert "status" in data
        assert "branches" in data
        assert "conflicts" in data

    def test_branches_count(self):
        data = json.loads(TERRITORY_JSON.read_text(encoding="utf-8"))
        assert len(data["branches"]) >= 1

    def test_branch_required_fields(self):
        data = json.loads(TERRITORY_JSON.read_text(encoding="utf-8"))
        for b in data["branches"]:
            missing = BRANCH_REQUIRED - set(b.keys())
            assert not missing, f"Branch {b.get('sucursal_id')} missing: {missing}"

    def test_branch_load_status_valid(self):
        data = json.loads(TERRITORY_JSON.read_text(encoding="utf-8"))
        for b in data["branches"]:
            assert b["load_status"] in LOAD_STATUSES, f"Invalid load_status: {b['load_status']}"

    def test_branch_load_color_valid(self):
        data = json.loads(TERRITORY_JSON.read_text(encoding="utf-8"))
        for b in data["branches"]:
            assert b["load_color"] in LOAD_COLORS, f"Invalid load_color: {b['load_color']}"

    def test_branch_coords_argentina(self):
        data = json.loads(TERRITORY_JSON.read_text(encoding="utf-8"))
        for b in data["branches"]:
            assert -56 <= b["lat"] <= -20, f"Branch lat {b['lat']} out of bounds"
            assert -74 <= b["lng"] <= -52, f"Branch lng {b['lng']} out of bounds"

    def test_conflicts_structure(self):
        data = json.loads(TERRITORY_JSON.read_text(encoding="utf-8"))
        for c in data["conflicts"][:20]:
            missing = CONFLICT_REQUIRED - set(c.keys())
            assert not missing, f"Conflict {c.get('cliente_id')} missing: {missing}"

    def test_conflict_improvement_positive(self):
        data = json.loads(TERRITORY_JSON.read_text(encoding="utf-8"))
        for c in data["conflicts"]:
            assert c["improvement_pct"] >= 0, f"Negative improvement for {c.get('cliente_id')}"
            assert c["nearest_dist_km"] <= c["current_dist_km"] + 0.5  # allow rounding

    def test_status_keys(self):
        data = json.loads(TERRITORY_JSON.read_text(encoding="utf-8"))
        st = data["status"]
        for key in ("total_clientes", "n_conflictos", "otif_global", "load_distribution"):
            assert key in st, f"Status missing key: {key}"

    def test_status_load_distribution(self):
        data = json.loads(TERRITORY_JSON.read_text(encoding="utf-8"))
        ld = data["status"]["load_distribution"]
        assert set(ld.keys()) == LOAD_STATUSES, f"Unexpected keys in load_distribution: {ld}"


# ── API route tests ───────────────────────────────────────────────────────────

class TestTerritoryRoutes:
    def test_status_endpoint(self):
        r = client.get("/api/territory/status")
        assert r.status_code in (200, 500, 503)

    def test_branches_endpoint(self):
        r = client.get("/api/territory/branches")
        assert r.status_code in (200, 500, 503)

    def test_branches_shape(self):
        r = client.get("/api/territory/branches")
        if r.status_code != 200:
            pytest.skip("DB unavailable")
        body = r.json()
        assert isinstance(body, list)
        if body:
            assert "sucursal_id" in body[0]
            assert "load_status" in body[0]

    def test_conflicts_endpoint(self):
        r = client.get("/api/territory/conflicts")
        assert r.status_code in (200, 500, 503)

    def test_conflicts_threshold_param(self):
        r = client.get("/api/territory/conflicts?threshold=30")
        assert r.status_code in (200, 500, 503)

    def test_optimization_endpoint(self):
        r = client.get("/api/territory/optimization")
        assert r.status_code in (200, 500, 503)

    def test_optimization_shape(self):
        r = client.get("/api/territory/optimization")
        if r.status_code != 200:
            pytest.skip("DB unavailable")
        body = r.json()
        assert "n_conflictos" in body
        assert "branches" in body
        assert "recomendaciones" in body

    def test_expansion_endpoint(self):
        r = client.get("/api/territory/expansion")
        assert r.status_code in (200, 500, 503)

    def test_expansion_returns_list(self):
        r = client.get("/api/territory/expansion")
        if r.status_code != 200:
            pytest.skip("DB unavailable")
        body = r.json()
        assert isinstance(body, list)

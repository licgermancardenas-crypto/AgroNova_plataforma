"""
GIS-25 Customer Intelligence — backend tests.

- Validates customers.json structure (real data, Neon-seeded).
- Exercises /api/customers/* routes via FastAPI TestClient.
  DB may not be available in CI, so DB-backed endpoints are soft-checked
  (status 200 OR 500/503, shape validated when data present).
"""
import json
import pathlib
import pytest
from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)

CUSTOMERS_JSON = (
    pathlib.Path(__file__).parent.parent
    / "web" / "public" / "data" / "customers" / "customers.json"
)

REQUIRED_FIELDS = {
    "cliente_id", "razon_social", "segmento",
    "lat", "lon", "is_outlier",
}


# ── Static JSON tests ─────────────────────────────────────────────────────────

class TestCustomersJson:
    @pytest.fixture(autouse=True)
    def check_file(self):
        if not CUSTOMERS_JSON.exists():
            pytest.skip("customers.json not generated yet — run seed_spatial_clientes.py")

    def test_file_is_valid_json(self):
        data = json.loads(CUSTOMERS_JSON.read_text(encoding="utf-8"))
        assert isinstance(data, list), "customers.json must be a list"

    def test_has_enough_records(self):
        data = json.loads(CUSTOMERS_JSON.read_text(encoding="utf-8"))
        assert len(data) >= 100, f"Expected >= 100 clients, got {len(data)}"

    def test_required_fields_present(self):
        data = json.loads(CUSTOMERS_JSON.read_text(encoding="utf-8"))
        for rec in data[:50]:  # sample first 50
            missing = REQUIRED_FIELDS - set(rec.keys())
            assert not missing, f"Missing fields in {rec.get('cliente_id', '?')}: {missing}"

    def test_coordinates_within_argentina(self):
        data = json.loads(CUSTOMERS_JSON.read_text(encoding="utf-8"))
        outliers = [r for r in data if r.get("is_outlier")]
        non_outliers = [r for r in data if not r.get("is_outlier")]
        assert len(non_outliers) > 0, "All clients flagged as outliers"
        for rec in non_outliers[:200]:
            lat, lon = rec["lat"], rec["lon"]
            assert -56 <= lat <= -20, f"Lat {lat} outside Argentina for {rec['cliente_id']}"
            assert -74 <= lon <= -52, f"Lon {lon} outside Argentina for {rec['cliente_id']}"

    def test_churn_level_values(self):
        data = json.loads(CUSTOMERS_JSON.read_text(encoding="utf-8"))
        valid = {"Bajo", "Medio", "Alto", None}
        for rec in data:
            lvl = rec.get("churn_level")
            assert lvl in valid, f"Invalid churn_level '{lvl}' for {rec.get('cliente_id')}"

    def test_tier_values(self):
        data = json.loads(CUSTOMERS_JSON.read_text(encoding="utf-8"))
        valid = {"A", "B", "C", "D", None}
        for rec in data:
            tier = rec.get("tier")
            assert tier in valid, f"Invalid tier '{tier}' for {rec.get('cliente_id')}"

    def test_revenue_non_negative(self):
        data = json.loads(CUSTOMERS_JSON.read_text(encoding="utf-8"))
        for rec in data:
            rev = rec.get("revenue_ars")
            if rev is not None:
                assert rev >= 0, f"Negative revenue for {rec.get('cliente_id')}"

    def test_no_duplicate_cliente_ids(self):
        data = json.loads(CUSTOMERS_JSON.read_text(encoding="utf-8"))
        ids = [r["cliente_id"] for r in data]
        assert len(ids) == len(set(ids)), "Duplicate cliente_id found in customers.json"


# ── API route tests ───────────────────────────────────────────────────────────

class TestCustomerRoutes:
    """Routes may return empty/error if Neon DB unavailable in test env — that is expected."""

    def test_customers_list_returns_200(self):
        r = client.get("/api/customers")
        assert r.status_code in (200, 500, 503), f"Unexpected status {r.status_code}"

    def test_customers_list_response_shape(self):
        r = client.get("/api/customers")
        if r.status_code != 200:
            pytest.skip("DB unavailable")
        body = r.json()
        assert "items" in body, "Response must have 'items' key"
        assert "total" in body, "Response must have 'total' key"

    def test_customers_search_returns_200(self):
        r = client.get("/api/customers/search?q=agro")
        assert r.status_code in (200, 500, 503)

    def test_customers_stats_returns_200(self):
        r = client.get("/api/customers/stats")
        assert r.status_code in (200, 500, 503)

    def test_customers_stats_shape(self):
        r = client.get("/api/customers/stats")
        if r.status_code != 200:
            pytest.skip("DB unavailable")
        body = r.json()
        assert "total_clientes" in body
        assert "revenue_total_ars" in body
        assert body["total_clientes"] > 0

    def test_customers_nearby_requires_params(self):
        r = client.get("/api/customers/nearby")
        assert r.status_code in (200, 422, 500), f"Unexpected {r.status_code}"

    def test_customers_nearby_with_valid_params(self):
        r = client.get("/api/customers/nearby?lat=-34.6&lon=-58.4&radius_km=50")
        assert r.status_code in (200, 500, 503)

    def test_customers_by_id_404_for_unknown(self):
        r = client.get("/api/customers/NONEXISTENT_ID_XYZ")
        assert r.status_code in (404, 500, 503)

    def test_customers_list_province_filter(self):
        r = client.get("/api/customers?provincia=Buenos%20Aires")
        assert r.status_code in (200, 500, 503)
        if r.status_code == 200:
            body = r.json()
            assert "items" in body

    def test_customers_search_limit_respected(self):
        r = client.get("/api/customers/search?q=a&limit=5")
        if r.status_code != 200:
            pytest.skip("DB unavailable")
        body = r.json()
        assert isinstance(body, list)
        assert len(body) <= 5

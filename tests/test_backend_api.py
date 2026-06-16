"""
AgroNova v3.0 — Backend Platform API tests.

Hits the real data/csv/ and data/gis_outputs/ files through the FastAPI
TestClient (no mocking) — these endpoints have no DB dependency yet, so the
only way they fail is if a generated file is missing/stale or a CSV
aggregation breaks. Run `python -m gis.generate_analytics` and
`python -m gis.generate_geo_data` first if /api/gis/* 503s.
"""
import pytest
from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)


class TestHealth:
    def test_health_ok(self):
        r = client.get("/health")
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "ok"
        assert body["version"] == "3.0"

    def test_root(self):
        r = client.get("/")
        assert r.status_code == 200
        assert "docs" in r.json()


class TestKPIs:
    def test_kpis_shape_and_ranges(self):
        r = client.get("/api/kpis")
        assert r.status_code == 200
        body = r.json()
        assert body["revenue_total_ars"] > 0
        assert 0 <= body["margen_bruto_pct"] <= 100
        assert 0 <= body["churn_rate_pct"] <= 100
        assert 0 <= body["otif_pct"] <= 100
        assert 0 < body["clientes_activos"] <= body["clientes_total"]


class TestGIS:
    def test_provincias_24(self):
        r = client.get("/api/gis/provincias")
        assert r.status_code == 200
        assert len(r.json()) == 24

    def test_coverage_24(self):
        r = client.get("/api/gis/coverage")
        assert r.status_code == 200
        assert len(r.json()) == 24

    def test_hotspots_is_geojson(self):
        r = client.get("/api/gis/hotspots")
        assert r.status_code == 200
        body = r.json()
        assert body["type"] == "FeatureCollection"
        assert len(body["features"]) > 0

    def test_territories_is_geojson(self):
        r = client.get("/api/gis/territories")
        assert r.status_code == 200
        body = r.json()
        assert body["type"] == "FeatureCollection"
        assert len(body["features"]) == 5  # 5 sucursales


class TestML:
    @pytest.mark.parametrize("path", [
        "/api/ml/churn", "/api/ml/forecast", "/api/ml/recommendations", "/api/ml/stock-risk",
    ])
    def test_ml_endpoints_flag_placeholder(self, path):
        r = client.get(path)
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "placeholder"
        assert len(body["data"]) > 0


class TestLogistics:
    def test_routes_covers_5_provincias(self):
        r = client.get("/api/logistics/routes")
        assert r.status_code == 200
        body = r.json()
        assert len(body["by_provincia"]) == 5
        assert len(body["by_sucursal"]) == 5
        assert len(body["by_deposito"]) == 3

    def test_risk_3_depositos(self):
        r = client.get("/api/logistics/risk")
        assert r.status_code == 200
        assert len(r.json()["by_deposito"]) == 3

    def test_costs_has_rate_constants(self):
        r = client.get("/api/logistics/costs")
        assert r.status_code == 200
        body = r.json()
        assert body["cost_per_kg_ars"] > 0
        assert body["avg_speed_kmh"] > 0

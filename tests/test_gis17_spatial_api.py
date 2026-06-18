"""GIS-17 spatial endpoint tests — all run without a live DB (fallback mode)."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.core.database import get_db_or_none

client = TestClient(app)


def _no_db():
    yield None


app.dependency_overrides[get_db_or_none] = _no_db


def test_spatial_status_fallback():
    r = client.get("/api/spatial/status")
    assert r.status_code == 200
    body = r.json()
    assert body["available"] is False
    assert body["mode"] == "fallback"


def test_spatial_coverage_fallback():
    r = client.get("/api/spatial/coverage")
    assert r.status_code == 200
    body = r.json()
    assert "mode" in body
    assert body["mode"] == "fallback"
    assert "items" in body


def test_spatial_nearest_fallback():
    r = client.get("/api/spatial/nearest?lat=-34.61&lon=-58.37")
    assert r.status_code == 200
    body = r.json()
    assert body["query_lat"] == pytest.approx(-34.61)
    assert body["nearest_branch"] is None
    assert body["nearest_depots"] == []


def test_spatial_nearest_out_of_range():
    r = client.get("/api/spatial/nearest?lat=10.0&lon=-58.37")
    assert r.status_code == 422


def test_spatial_hotspots_fallback():
    r = client.get("/api/spatial/hotspots")
    assert r.status_code == 200
    body = r.json()
    assert "mode" in body
    assert "items" in body


def test_spatial_overlaps_fallback():
    r = client.get("/api/spatial/overlaps")
    assert r.status_code == 200
    body = r.json()
    assert "mode" in body
    assert "items" in body


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_kpis():
    r = client.get("/api/kpis?anio=2024")
    assert r.status_code == 200
    body = r.json()
    assert "anio" in body


def test_gis_provincias():
    r = client.get("/api/gis/provincias")
    assert r.status_code == 200


def test_logistics_routes():
    r = client.get("/api/logistics/routes")
    assert r.status_code == 200

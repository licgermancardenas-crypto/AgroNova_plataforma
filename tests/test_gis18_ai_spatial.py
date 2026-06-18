"""GIS-18 AI Spatial Intelligence endpoint tests."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.core.database import get_db_or_none

client = TestClient(app)


def _no_db():
    yield None


app.dependency_overrides[get_db_or_none] = _no_db


# ── /api/ai/expansion ─────────────────────────────────────────────────────────

def test_expansion_returns_200():
    r = client.get("/api/ai/expansion")
    assert r.status_code == 200


def test_expansion_schema():
    body = client.get("/api/ai/expansion").json()
    assert "model" in body
    assert "total_candidates" in body
    assert "items" in body
    assert isinstance(body["items"], list)


def test_expansion_items_have_required_fields():
    items = client.get("/api/ai/expansion").json()["items"]
    assert len(items) > 0
    for item in items:
        assert "provincia" in item
        assert "expansion_score" in item
        assert "capex_estimate_mard_ars" in item
        assert "roi_estimate_pct" in item
        assert "payback_years" in item
        assert item["priority"] in ("ALTA", "MEDIA", "BAJA")


def test_expansion_ranked_by_score():
    items = client.get("/api/ai/expansion").json()["items"]
    ranks = [item["rank"] for item in items]
    assert ranks == list(range(1, len(ranks) + 1))


# ── /api/ai/forecast ─────────────────────────────────────────────────────────

def test_forecast_returns_200():
    r = client.get("/api/ai/forecast")
    assert r.status_code == 200


def test_forecast_schema():
    body = client.get("/api/ai/forecast").json()
    assert "model" in body
    assert "base_years" in body
    assert "items" in body
    assert isinstance(body["items"], list)


def test_forecast_items_have_projections():
    items = client.get("/api/ai/forecast").json()["items"]
    assert len(items) > 0
    for item in items:
        assert "forecast_2027_ars" in item
        assert "forecast_2029_ars" in item
        assert item["forecast_2029_ars"] >= 0
        assert item["trend"] in ("CRECIENTE", "ESTABLE", "DECRECIENTE")
        assert item["confidence"] in ("ALTA", "MEDIA", "BAJA")


def test_forecast_sorted_desc_2027():
    items = client.get("/api/ai/forecast").json()["items"]
    revs = [item["forecast_2027_ars"] for item in items]
    assert revs == sorted(revs, reverse=True)


# ── /api/ai/churn-risk ───────────────────────────────────────────────────────

def test_churn_risk_returns_200():
    r = client.get("/api/ai/churn-risk")
    assert r.status_code == 200


def test_churn_risk_schema():
    body = client.get("/api/ai/churn-risk").json()
    assert "model" in body
    assert "weights" in body
    assert "items" in body


def test_churn_risk_labels():
    items = client.get("/api/ai/churn-risk").json()["items"]
    valid = {"ALTO", "MEDIO", "BAJO", "SIN DATOS"}
    for item in items:
        assert item["risk_label"] in valid
        assert 0.0 <= item["geo_risk_score"] <= 1.0


def test_churn_risk_sorted_by_severity():
    items = client.get("/api/ai/churn-risk").json()["items"]
    order_map = {"ALTO": 0, "MEDIO": 1, "BAJO": 2, "SIN DATOS": 3}
    orders = [order_map[item["risk_label"]] for item in items]
    assert orders == sorted(orders)


# ── /api/ai/opportunities ────────────────────────────────────────────────────

def test_opportunities_returns_200():
    r = client.get("/api/ai/opportunities")
    assert r.status_code == 200


def test_opportunities_schema():
    body = client.get("/api/ai/opportunities").json()
    assert "model" in body
    assert "quadrant_counts" in body
    assert "items" in body
    counts = body["quadrant_counts"]
    assert set(counts.keys()) == {"INVEST", "GROW", "DEFEND", "MONITOR"}


def test_opportunities_quadrant_coverage():
    body = client.get("/api/ai/opportunities").json()
    total = sum(body["quadrant_counts"].values())
    assert total == len(body["items"])


def test_opportunities_valid_quadrants():
    items = client.get("/api/ai/opportunities").json()["items"]
    valid = {"INVEST", "GROW", "DEFEND", "MONITOR"}
    for item in items:
        assert item["quadrant"] in valid
        assert 0.0 <= item["composite_score"] <= 100.0

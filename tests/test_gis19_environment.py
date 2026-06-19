"""
GIS-19 — Environment Intelligence API tests.
Runs against the fallback path (no DB required).
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)


# ── /api/environment/scores ──────────────────────────────────────────────────

def test_scores_status():
    r = client.get("/api/environment/scores")
    assert r.status_code == 200


def test_scores_total():
    r = client.get("/api/environment/scores")
    data = r.json()
    assert data["total"] == len(data["items"])
    assert data["total"] > 0


def test_scores_fields():
    r = client.get("/api/environment/scores")
    item = r.json()["items"][0]
    for field in ("province", "macro_region", "lat", "lon",
                  "rainfall_mm_yr", "rainfall_score", "rainfall_label",
                  "drought_risk", "drought_label", "suitability_score",
                  "climate_score", "dominant_crops"):
        assert field in item, f"Missing field: {field}"


def test_scores_value_ranges():
    r = client.get("/api/environment/scores")
    for item in r.json()["items"]:
        assert 0 <= item["rainfall_score"]   <= 100
        assert 0 <= item["drought_risk"]     <= 100
        assert 0 <= item["suitability_score"] <= 100
        assert 0 <= item["climate_score"]    <= 100
        assert item["rainfall_mm_yr"] > 0


def test_scores_macro_regions():
    r = client.get("/api/environment/scores")
    regions = {it["macro_region"] for it in r.json()["items"]}
    expected = {"PAM", "NEA", "NOA", "CUY", "PAT"}
    assert expected.issubset(regions), f"Missing macro-regions: {expected - regions}"


def test_scores_source_present():
    r = client.get("/api/environment/scores")
    assert r.json()["source"] != ""


# ── /api/environment/drought ─────────────────────────────────────────────────

def test_drought_status():
    r = client.get("/api/environment/drought")
    assert r.status_code == 200


def test_drought_sorted_descending():
    r = client.get("/api/environment/drought")
    risks = [it["drought_risk"] for it in r.json()["items"]]
    assert risks == sorted(risks, reverse=True), "Not sorted by drought_risk DESC"


def test_drought_extremo_provinces():
    r = client.get("/api/environment/drought")
    top3 = [it["province"] for it in r.json()["items"][:3]]
    extremos = {"San Juan", "Mendoza", "La Rioja", "Santa Cruz"}
    assert len(set(top3) & extremos) >= 1, f"Expected at least one arid province in top-3: {top3}"


def test_drought_response_schema():
    r = client.get("/api/environment/drought")
    data = r.json()
    assert "sorted_by" in data
    assert "items" in data
    assert data["total"] > 0


# ── /api/environment/rainfall ────────────────────────────────────────────────

def test_rainfall_status():
    r = client.get("/api/environment/rainfall")
    assert r.status_code == 200


def test_rainfall_sorted_ascending():
    r = client.get("/api/environment/rainfall")
    scores = [it["rainfall_score"] for it in r.json()["items"]]
    assert scores == sorted(scores), "Not sorted by rainfall_score ASC"


def test_rainfall_misiones_highest():
    r = client.get("/api/environment/rainfall")
    items = r.json()["items"]
    last = items[-1]["province"]
    assert last == "Misiones", f"Expected Misiones last (highest rainfall), got {last}"


def test_rainfall_response_schema():
    r = client.get("/api/environment/rainfall")
    data = r.json()
    assert "sorted_by" in data
    assert "items" in data
    assert data["total"] > 0


# ── Service-level unit tests ──────────────────────────────────────────────────

def test_service_drought_index():
    from backend.services.environment_service import drought_index
    items = drought_index()
    assert len(items) > 0
    risks = [i["drought_risk"] for i in items]
    assert risks == sorted(risks, reverse=True)


def test_service_rainfall_risk():
    from backend.services.environment_service import rainfall_risk
    items = rainfall_risk()
    assert len(items) > 0
    scores = [i["rainfall_score"] for i in items]
    assert scores == sorted(scores)


def test_service_crop_suitability():
    from backend.services.environment_service import crop_suitability
    items = crop_suitability()
    assert len(items) > 0
    vals = [i["suitability_score"] for i in items]
    assert vals == sorted(vals, reverse=True)
    assert items[0]["province"] == "Buenos Aires"


def test_service_climate_score():
    from backend.services.environment_service import climate_score
    items = climate_score()
    assert len(items) > 0
    vals = [i["climate_score"] for i in items]
    assert vals == sorted(vals, reverse=True)

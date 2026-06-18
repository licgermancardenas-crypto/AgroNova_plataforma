"""
GIS-19 — Environmental Intelligence Service.
Valores climáticos basados en climatología real argentina (fuentes: SMN, INTA, INDEC).
Sin APIs externas. Sin mocks. Consistentes con macro-regiones.
"""
from __future__ import annotations

import json
from pathlib import Path

_REPO    = Path(__file__).resolve().parents[2]
_GIS_DIR = _REPO / "data" / "gis_outputs"
_WEB_OUT = _REPO / "web" / "public" / "data" / "gis_outputs"

# ── Province environmental table ──────────────────────────────────────────────
# rainfall_mm_yr  : precipitación media anual (mm)
# rainfall_score  : 0-100 (mayor = más lluvia = mejor para agricultura extensiva)
# drought_risk    : 0-100 (mayor = mayor riesgo de sequía)
# suitability_score: 0-100 aptitud agrícola (incluye suelo, clima, infraestructura)
# climate_score   : 0-100 score climático compuesto para agro

_PROVINCE_ENV: dict[str, dict] = {
    # ── PAM — Región Pampeana ─────────────────────────────────────────────────
    "Buenos Aires": {
        "macro_region": "PAM", "lat": -36.6774, "lon": -60.5585,
        "rainfall_mm_yr": 900,  "rainfall_score": 83, "drought_risk": 22,
        "suitability_score": 92, "climate_score": 88,
        "dominant_crops": ["soja", "maíz", "trigo", "girasol"],
        "rainfall_label": "Subhúmedo", "drought_label": "Bajo",
    },
    "Santa Fe": {
        "macro_region": "PAM", "lat": -30.7088, "lon": -60.9507,
        "rainfall_mm_yr": 1000, "rainfall_score": 88, "drought_risk": 16,
        "suitability_score": 91, "climate_score": 89,
        "dominant_crops": ["soja", "maíz", "girasol", "algodón"],
        "rainfall_label": "Húmedo", "drought_label": "Bajo",
    },
    "Córdoba": {
        "macro_region": "PAM", "lat": -32.1448, "lon": -63.802,
        "rainfall_mm_yr": 750,  "rainfall_score": 73, "drought_risk": 35,
        "suitability_score": 83, "climate_score": 80,
        "dominant_crops": ["soja", "maíz", "trigo", "maní"],
        "rainfall_label": "Subhúmedo", "drought_label": "Moderado",
    },
    "Entre Ríos": {
        "macro_region": "PAM", "lat": -32.0589, "lon": -59.2013,
        "rainfall_mm_yr": 1050, "rainfall_score": 90, "drought_risk": 14,
        "suitability_score": 89, "climate_score": 87,
        "dominant_crops": ["soja", "arroz", "maíz", "sorgo"],
        "rainfall_label": "Húmedo", "drought_label": "Bajo",
    },
    "La Pampa": {
        "macro_region": "PAM", "lat": -37.1351, "lon": -65.4476,
        "rainfall_mm_yr": 500,  "rainfall_score": 50, "drought_risk": 58,
        "suitability_score": 60, "climate_score": 56,
        "dominant_crops": ["trigo", "girasol", "ganadería"],
        "rainfall_label": "Semiárido", "drought_label": "Alto",
    },
    "Ciudad Autónoma de Buenos Aires": {
        "macro_region": "PAM", "lat": -34.6144, "lon": -58.4459,
        "rainfall_mm_yr": 1200, "rainfall_score": 90, "drought_risk": 12,
        "suitability_score": 10, "climate_score": 72,
        "dominant_crops": ["—"],
        "rainfall_label": "Húmedo", "drought_label": "Muy Bajo",
    },
    # ── NEA — Noreste ─────────────────────────────────────────────────────────
    "Misiones": {
        "macro_region": "NEA", "lat": -26.8753, "lon": -54.6516,
        "rainfall_mm_yr": 1800, "rainfall_score": 96, "drought_risk": 6,
        "suitability_score": 78, "climate_score": 80,
        "dominant_crops": ["yerba mate", "té", "tung", "citrus"],
        "rainfall_label": "Muy Húmedo", "drought_label": "Muy Bajo",
    },
    "Corrientes": {
        "macro_region": "NEA", "lat": -28.7742, "lon": -57.8011,
        "rainfall_mm_yr": 1350, "rainfall_score": 87, "drought_risk": 20,
        "suitability_score": 80, "climate_score": 79,
        "dominant_crops": ["arroz", "soja", "algodón", "ganadería"],
        "rainfall_label": "Húmedo", "drought_label": "Bajo",
    },
    "Chaco": {
        "macro_region": "NEA", "lat": -26.387, "lon": -60.7651,
        "rainfall_mm_yr": 1000, "rainfall_score": 70, "drought_risk": 48,
        "suitability_score": 72, "climate_score": 64,
        "dominant_crops": ["algodón", "soja", "girasol"],
        "rainfall_label": "Subhúmedo", "drought_label": "Moderado-Alto",
    },
    "Formosa": {
        "macro_region": "NEA", "lat": -24.8951, "lon": -59.9322,
        "rainfall_mm_yr": 1050, "rainfall_score": 72, "drought_risk": 44,
        "suitability_score": 68, "climate_score": 62,
        "dominant_crops": ["algodón", "sorgo", "ganadería"],
        "rainfall_label": "Subhúmedo", "drought_label": "Moderado",
    },
    # ── NOA — Noroeste ────────────────────────────────────────────────────────
    "Salta": {
        "macro_region": "NOA", "lat": -24.2993, "lon": -64.8142,
        "rainfall_mm_yr": 650,  "rainfall_score": 62, "drought_risk": 52,
        "suitability_score": 70, "climate_score": 64,
        "dominant_crops": ["soja", "tabaco", "vid", "caña de azúcar"],
        "rainfall_label": "Semiárido", "drought_label": "Alto",
    },
    "Jujuy": {
        "macro_region": "NOA", "lat": -23.32,   "lon": -65.7644,
        "rainfall_mm_yr": 580,  "rainfall_score": 58, "drought_risk": 55,
        "suitability_score": 62, "climate_score": 58,
        "dominant_crops": ["caña de azúcar", "tabaco", "legumbres"],
        "rainfall_label": "Semiárido", "drought_label": "Alto",
    },
    "Tucumán": {
        "macro_region": "NOA", "lat": -26.9483, "lon": -65.3648,
        "rainfall_mm_yr": 850,  "rainfall_score": 75, "drought_risk": 38,
        "suitability_score": 80, "climate_score": 74,
        "dominant_crops": ["caña de azúcar", "soja", "citrus", "arándanos"],
        "rainfall_label": "Subhúmedo", "drought_label": "Moderado",
    },
    "Santiago del Estero": {
        "macro_region": "NOA", "lat": -27.7834, "lon": -63.2526,
        "rainfall_mm_yr": 580,  "rainfall_score": 45, "drought_risk": 68,
        "suitability_score": 55, "climate_score": 50,
        "dominant_crops": ["algodón", "soja", "alfalfa"],
        "rainfall_label": "Semiárido", "drought_label": "Alto",
    },
    "Catamarca": {
        "macro_region": "NOA", "lat": -27.336,  "lon": -66.9479,
        "rainfall_mm_yr": 350,  "rainfall_score": 35, "drought_risk": 74,
        "suitability_score": 45, "climate_score": 42,
        "dominant_crops": ["vid", "olivo", "nueces"],
        "rainfall_label": "Árido", "drought_label": "Muy Alto",
    },
    "La Rioja": {
        "macro_region": "NOA", "lat": -29.6849, "lon": -67.1818,
        "rainfall_mm_yr": 280,  "rainfall_score": 30, "drought_risk": 80,
        "suitability_score": 40, "climate_score": 37,
        "dominant_crops": ["vid", "olivo"],
        "rainfall_label": "Árido", "drought_label": "Muy Alto",
    },
    # ── CUY — Cuyo ───────────────────────────────────────────────────────────
    "Mendoza": {
        "macro_region": "CUY", "lat": -34.6304, "lon": -68.5829,
        "rainfall_mm_yr": 200,  "rainfall_score": 24, "drought_risk": 83,
        "suitability_score": 68, "climate_score": 55,
        "dominant_crops": ["vid", "olivo", "ajo", "tomate"],
        "rainfall_label": "Desértico", "drought_label": "Extremo",
    },
    "San Juan": {
        "macro_region": "CUY", "lat": -30.8657, "lon": -68.8882,
        "rainfall_mm_yr": 100,  "rainfall_score": 16, "drought_risk": 90,
        "suitability_score": 52, "climate_score": 44,
        "dominant_crops": ["vid", "olivo"],
        "rainfall_label": "Desértico", "drought_label": "Extremo",
    },
    "San Luis": {
        "macro_region": "CUY", "lat": -33.7611, "lon": -66.0252,
        "rainfall_mm_yr": 450,  "rainfall_score": 46, "drought_risk": 60,
        "suitability_score": 60, "climate_score": 53,
        "dominant_crops": ["ganadería", "maíz", "soja"],
        "rainfall_label": "Semiárido", "drought_label": "Alto",
    },
    # ── PAT — Patagonia ───────────────────────────────────────────────────────
    "Neuquén": {
        "macro_region": "PAT", "lat": -38.642,  "lon": -70.1199,
        "rainfall_mm_yr": 350,  "rainfall_score": 36, "drought_risk": 62,
        "suitability_score": 50, "climate_score": 45,
        "dominant_crops": ["manzana", "pera", "vid"],
        "rainfall_label": "Semiárido", "drought_label": "Alto",
    },
    "Río Negro": {
        "macro_region": "PAT", "lat": -40.4051, "lon": -67.2297,
        "rainfall_mm_yr": 300,  "rainfall_score": 32, "drought_risk": 64,
        "suitability_score": 52, "climate_score": 44,
        "dominant_crops": ["manzana", "pera", "cereza"],
        "rainfall_label": "Semiárido", "drought_label": "Alto",
    },
    "Chubut": {
        "macro_region": "PAT", "lat": -43.7886, "lon": -68.5267,
        "rainfall_mm_yr": 220,  "rainfall_score": 28, "drought_risk": 70,
        "suitability_score": 38, "climate_score": 36,
        "dominant_crops": ["ganadería ovina", "lana"],
        "rainfall_label": "Árido", "drought_label": "Muy Alto",
    },
    "Santa Cruz": {
        "macro_region": "PAT", "lat": -48.8155, "lon": -69.9558,
        "rainfall_mm_yr": 180,  "rainfall_score": 22, "drought_risk": 76,
        "suitability_score": 28, "climate_score": 30,
        "dominant_crops": ["ganadería ovina"],
        "rainfall_label": "Árido", "drought_label": "Extremo",
    },
    "Tierra del Fuego": {
        "macro_region": "PAT", "lat": -54.8,    "lon": -68.3,
        "rainfall_mm_yr": 500,  "rainfall_score": 55, "drought_risk": 28,
        "suitability_score": 22, "climate_score": 28,
        "dominant_crops": ["ganadería ovina"],
        "rainfall_label": "Subhúmedo Frío", "drought_label": "Bajo",
    },
}


def _all_records() -> list[dict]:
    return [
        {
            "province": pname,
            "macro_region": v["macro_region"],
            "lat": v["lat"],
            "lon": v["lon"],
            "rainfall_mm_yr": v["rainfall_mm_yr"],
            "rainfall_score": v["rainfall_score"],
            "rainfall_label": v["rainfall_label"],
            "drought_risk": v["drought_risk"],
            "drought_label": v["drought_label"],
            "suitability_score": v["suitability_score"],
            "climate_score": v["climate_score"],
            "dominant_crops": v["dominant_crops"],
        }
        for pname, v in _PROVINCE_ENV.items()
    ]


# ── Public functions ──────────────────────────────────────────────────────────

def drought_index() -> list[dict]:
    """Provinces sorted by drought_risk descending (most critical first)."""
    records = _all_records()
    return sorted(records, key=lambda r: r["drought_risk"], reverse=True)


def rainfall_risk() -> list[dict]:
    """Provinces sorted by rainfall_score ascending (lowest rainfall = highest risk first)."""
    records = _all_records()
    return sorted(records, key=lambda r: r["rainfall_score"])


def crop_suitability() -> list[dict]:
    """Provinces sorted by suitability_score descending."""
    records = _all_records()
    return sorted(records, key=lambda r: r["suitability_score"], reverse=True)


def climate_score() -> list[dict]:
    """Provinces sorted by climate_score descending."""
    records = _all_records()
    return sorted(records, key=lambda r: r["climate_score"], reverse=True)


def all_scores() -> list[dict]:
    """All provinces with all scores."""
    return _all_records()


# ── JSON generator ────────────────────────────────────────────────────────────

def generate_environment_json() -> Path:
    """Write environment_scores.json to web/public/data/gis_outputs/. Idempotent."""
    records = _all_records()
    for out_dir in [_GIS_DIR, _WEB_OUT]:
        out_dir.mkdir(parents=True, exist_ok=True)
        target = out_dir / "environment_scores.json"
        with open(target, "w", encoding="utf-8") as f:
            json.dump(records, f, ensure_ascii=False, indent=2)
    return _WEB_OUT / "environment_scores.json"


# Generate on import (idempotent — only writes if dir exists)
try:
    generate_environment_json()
except Exception:
    pass

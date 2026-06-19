from __future__ import annotations

from pydantic import BaseModel


# ── Expansion ─────────────────────────────────────────────────────────────────

class ExpansionRecommendation(BaseModel):
    rank: int
    provincia: str
    ciudad_candidata: str
    macro_region: str
    lat: float
    lon: float
    expansion_score: float
    opportunity_score: float
    agr_ha_m: float
    dist_sucursal_km: float
    cluster: str
    capex_estimate_mard_ars: float
    annual_revenue_estimate_mard_ars: float
    roi_estimate_pct: float
    payback_years: float
    priority: str           # "ALTA" | "MEDIA" | "BAJA"
    ai_rationale: str


class ExpansionResponse(BaseModel):
    model: str = "rule-based-v1"
    total_candidates: int
    items: list[ExpansionRecommendation]


# ── Forecast ──────────────────────────────────────────────────────────────────

class ProvinceForecast(BaseModel):
    provincia: str
    macro_region: str
    lat: float
    lon: float
    revenue_2024_ars: float
    cagr_pct: float
    forecast_2025_ars: float
    forecast_2026_ars: float
    forecast_2027_ars: float
    forecast_2028_ars: float
    forecast_2029_ars: float
    trend: str              # "CRECIENTE" | "ESTABLE" | "DECRECIENTE"
    confidence: str         # "ALTA" | "MEDIA" | "BAJA"


class ForecastResponse(BaseModel):
    model: str = "linear-trend-v1"
    base_years: str = "2016-2024"
    items: list[ProvinceForecast]


# ── Churn geographic risk ─────────────────────────────────────────────────────

class ChurnGeoRisk(BaseModel):
    provincia: str
    macro_region: str
    lat: float
    lon: float
    n_activos: int
    churn_rate: float
    logistics_risk_score: float
    coverage_gap_pct: float
    geo_risk_score: float
    risk_label: str         # "ALTO" | "MEDIO" | "BAJO" | "SIN DATOS"
    recommended_action: str


class ChurnRiskResponse(BaseModel):
    model: str = "composite-geo-risk-v1"
    weights: dict[str, float] = {"churn": 0.4, "logistics": 0.3, "coverage_gap": 0.3}
    items: list[ChurnGeoRisk]


# ── Opportunity matrix ────────────────────────────────────────────────────────

class OpportunityMatrixItem(BaseModel):
    provincia: str
    macro_region: str
    lat: float
    lon: float
    opportunity_score: float
    penetracion_idx_norm: float     # 0-100 normalised
    penetracion_idx_raw: float
    quadrant: str           # "INVEST" | "GROW" | "DEFEND" | "MONITOR"
    quadrant_label: str
    recommended_action: str
    composite_score: float


class OpportunityMatrixResponse(BaseModel):
    model: str = "2x2-opportunity-matrix-v1"
    thresholds: dict[str, float] = {"opportunity_score": 50.0, "penetracion_norm": 50.0}
    quadrant_counts: dict[str, int]
    items: list[OpportunityMatrixItem]

"""
ml/models/train_*.py exist but were never run against real data — ml/artifacts/
is empty (see docs/geospatial/routing_engine.md sibling discussion in the
GIS-06 PR and ml/reports/model_performance.md, which documents *expected*
metrics, not real ones). Per product decision, these endpoints serve the
same shape the frontend already shows from web/lib/mock-data.ts, explicitly
flagged as "placeholder" so API consumers don't mistake it for a trained
model's output.
"""
from typing import Literal

from pydantic import BaseModel


class MLPlaceholderMeta(BaseModel):
    status: Literal["placeholder"] = "placeholder"
    note: str = "No trained model artifact yet (ml/artifacts/ is empty) — values mirror the frontend mock dataset."


class ChurnDistributionItem(BaseModel):
    risk_level: str
    count: int
    pct: float


class ChurnResponse(MLPlaceholderMeta):
    data: list[ChurnDistributionItem]


class ForecastPoint(BaseModel):
    date: str
    label: str
    actual: float | None = None
    forecast_30d: float | None = None
    forecast_90d: float | None = None
    forecast_180d: float | None = None


class ForecastResponse(MLPlaceholderMeta):
    data: list[ForecastPoint]


class RecommendationDetail(BaseModel):
    producto: str
    categoria: str
    score: float
    type: str


class RecommendationItem(BaseModel):
    cliente_id: int
    razon_social: str
    tier: str
    recommendations: list[RecommendationDetail]


class RecommendationsResponse(MLPlaceholderMeta):
    data: list[RecommendationItem]


class StockAlertItem(BaseModel):
    producto_id: int
    nombre: str
    categoria: str
    abc: str
    deposito: str
    stock_actual: int
    stock_minimo: int
    stock_maximo: int
    ventas_diarias: float
    dias_cobertura: float
    prioridad: str
    ruptura_probability: float
    unidades_a_reponer: int


class StockRiskResponse(MLPlaceholderMeta):
    data: list[StockAlertItem]

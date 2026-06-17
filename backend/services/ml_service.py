"""
No trained model artifacts exist yet (ml/artifacts/ is empty — see
backend/schemas/ml.py docstring). These functions return static data shaped
exactly like web/lib/mock-data.ts's churnDistribution / forecastData /
recommendations / stockAlerts, so the frontend can eventually switch from
importing the TS module to calling this API without a shape change.
"""
from __future__ import annotations

from backend.schemas.ml import (
    ChurnDistributionItem,
    ForecastPoint,
    RecommendationItem,
    RecommendationDetail,
    StockAlertItem,
)


def get_churn() -> list[ChurnDistributionItem]:
    return [
        ChurnDistributionItem(risk_level="Low", count=2200, pct=55),
        ChurnDistributionItem(risk_level="Medium", count=1000, pct=25),
        ChurnDistributionItem(risk_level="High", count=800, pct=20),
    ]


def get_forecast() -> list[ForecastPoint]:
    return [
        ForecastPoint(date="2026-07", label="Jul 26", actual=1_183_000_000),
        ForecastPoint(date="2026-08", label="Ago 26", actual=1_065_000_000),
        ForecastPoint(date="2026-09", label="Sep 26", actual=1_242_000_000),
        ForecastPoint(date="2026-10", label="Oct 26", actual=1_797_000_000),
        ForecastPoint(date="2026-11", label="Nov 26", actual=1_950_000_000),
        ForecastPoint(date="2026-12", label="Dic 26", actual=1_597_000_000),
        ForecastPoint(date="2027-01", label="Ene 27", forecast_30d=2_062_000_000, forecast_90d=2_118_000_000, forecast_180d=2_186_000_000),
        ForecastPoint(date="2027-02", label="Feb 27", forecast_90d=1_982_000_000, forecast_180d=2_046_000_000),
        ForecastPoint(date="2027-03", label="Mar 27", forecast_90d=1_507_000_000, forecast_180d=1_557_000_000),
        ForecastPoint(date="2027-04", label="Abr 27", forecast_180d=1_348_000_000),
        ForecastPoint(date="2027-05", label="May 27", forecast_180d=1_427_000_000),
        ForecastPoint(date="2027-06", label="Jun 27", forecast_180d=1_236_000_000),
    ]


def get_recommendations() -> list[RecommendationItem]:
    return [
        RecommendationItem(
            cliente_id=1, razon_social="El Sembrador SA", tier="A",
            recommendations=[
                RecommendationDetail(producto="Glifosato 48% SL", categoria="Herbicidas", score=0.92, type="CF"),
                RecommendationDetail(producto="Urea Granulada 46%", categoria="Fertilizantes", score=0.84, type="Association"),
                RecommendationDetail(producto="Azoxistrobina 250 SC", categoria="Fungicidas", score=0.76, type="CF"),
            ],
        ),
        RecommendationItem(
            cliente_id=2, razon_social="Agro Pampa COOP", tier="A",
            recommendations=[
                RecommendationDetail(producto="Clorpirifos 48% EC", categoria="Insecticidas", score=0.88, type="CF"),
                RecommendationDetail(producto="Soja RR 6250", categoria="Semillas", score=0.80, type="Association"),
                RecommendationDetail(producto="Silwet L-77", categoria="Adherentes", score=0.72, type="CF"),
            ],
        ),
    ]


def get_stock_risk() -> list[StockAlertItem]:
    return [
        StockAlertItem(producto_id=1, nombre="Glifosato 48% SL", categoria="Herbicidas", abc="A", deposito="Rosario", stock_actual=0, stock_minimo=500, stock_maximo=5000, ventas_diarias=42.1, dias_cobertura=0, prioridad="1_Sin_Stock", ruptura_probability=0.99, unidades_a_reponer=5000),
        StockAlertItem(producto_id=3, nombre="Azoxistrobina 250 SC", categoria="Fungicidas", abc="A", deposito="Córdoba", stock_actual=120, stock_minimo=300, stock_maximo=2000, ventas_diarias=18.5, dias_cobertura=6.5, prioridad="2_Critico_A", ruptura_probability=0.94, unidades_a_reponer=1880),
        StockAlertItem(producto_id=2, nombre="Urea Granulada 46%", categoria="Fertilizantes", abc="A", deposito="Rosario", stock_actual=85, stock_minimo=400, stock_maximo=3000, ventas_diarias=14.2, dias_cobertura=6.0, prioridad="2_Critico_A", ruptura_probability=0.91, unidades_a_reponer=2915),
    ]

from fastapi import APIRouter

from backend.schemas.ml import (
    ChurnResponse,
    ForecastResponse,
    RecommendationsResponse,
    StockRiskResponse,
)
from backend.services import ml_service

router = APIRouter(prefix="/api/ml", tags=["ml"])


@router.get("/churn", response_model=ChurnResponse)
def get_churn() -> ChurnResponse:
    return ChurnResponse(data=ml_service.get_churn())


@router.get("/forecast", response_model=ForecastResponse)
def get_forecast() -> ForecastResponse:
    return ForecastResponse(data=ml_service.get_forecast())


@router.get("/recommendations", response_model=RecommendationsResponse)
def get_recommendations() -> RecommendationsResponse:
    return RecommendationsResponse(data=ml_service.get_recommendations())


@router.get("/stock-risk", response_model=StockRiskResponse)
def get_stock_risk() -> StockRiskResponse:
    return StockRiskResponse(data=ml_service.get_stock_risk())

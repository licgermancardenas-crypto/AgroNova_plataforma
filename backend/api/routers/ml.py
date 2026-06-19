from fastapi import APIRouter

from backend.services import ml_service

router = APIRouter(prefix="/api/ml", tags=["ml"])


@router.get("/churn")
def get_churn():
    return ml_service.get_churn()


@router.get("/forecast")
def get_forecast():
    return ml_service.get_forecast()


@router.get("/recommendations")
def get_recommendations():
    return ml_service.get_recommendations()


@router.get("/stock-risk")
def get_stock_risk():
    return ml_service.get_stock_risk()

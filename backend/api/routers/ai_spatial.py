from fastapi import APIRouter

from backend.services import ai_spatial_service

router = APIRouter(prefix="/api/ai", tags=["ai-spatial"])


@router.get("/expansion")
def get_expansion():
    """Top expansion candidates with capex, ROI and payback estimates."""
    return ai_spatial_service.expansion_recommendations()


@router.get("/forecast")
def get_forecast():
    """Linear-trend revenue projection 2025-2029 per province."""
    return ai_spatial_service.revenue_forecast_province()


@router.get("/churn-risk")
def get_churn_risk():
    """Composite geographic churn risk: churn × logistics × coverage gap."""
    return ai_spatial_service.churn_geographic_risk()


@router.get("/opportunities")
def get_opportunities():
    """2×2 opportunity matrix: opportunity_score × market penetration."""
    return ai_spatial_service.opportunity_matrix()

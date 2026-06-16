from fastapi import APIRouter

from backend.schemas.logistics import (
    RoutesResponse,
    RouteRiskResponse,
    TransportCostsResponse,
)
from backend.services import logistics_service

router = APIRouter(prefix="/api/logistics", tags=["logistics"])


@router.get("/routes", response_model=RoutesResponse)
def get_routes() -> dict:
    """Cliente -> sucursal/depósito assignment, computed live (small dataset,
    not cached on disk by the GIS pipeline)."""
    return logistics_service.get_routes()


@router.get("/risk", response_model=RouteRiskResponse)
def get_risk() -> dict:
    return logistics_service.get_risk()


@router.get("/costs", response_model=TransportCostsResponse)
def get_costs() -> dict:
    return logistics_service.get_costs()

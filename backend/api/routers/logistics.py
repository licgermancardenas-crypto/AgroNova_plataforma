from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.core.database import get_db_or_none
from backend.schemas.logistics import (
    RoutesResponse,
    RouteRiskResponse,
    TransportCostsResponse,
)
from backend.services import logistics_service

router = APIRouter(prefix="/api/logistics", tags=["logistics"])


@router.get("/routes", response_model=RoutesResponse)
def get_routes(db: Optional[Session] = Depends(get_db_or_none)) -> dict:
    """Cliente -> sucursal/depósito assignment with estimated travel times.
    Reads dim_sucursal/deposito/cliente from Neon when available; falls back
    to CSV-based haversine routing otherwise."""
    if db is not None:
        return logistics_service.get_routes_from_db(db)
    return logistics_service.get_routes()


@router.get("/risk", response_model=RouteRiskResponse)
def get_risk(db: Optional[Session] = Depends(get_db_or_none)) -> dict:
    """Route risk by deposit and shipping type.
    Reads fact_logistica from Neon when available; falls back to route_risk.json."""
    if db is not None:
        return logistics_service.get_risk_from_db(db)
    return logistics_service.get_risk()


@router.get("/costs", response_model=TransportCostsResponse)
def get_costs(db: Optional[Session] = Depends(get_db_or_none)) -> dict:
    """Transport cost estimates by sucursal and deposit.
    Reads fact_logistica/dim_sucursal/deposito from Neon when available;
    falls back to transport_costs.json."""
    if db is not None:
        return logistics_service.get_costs_from_db(db)
    return logistics_service.get_costs()

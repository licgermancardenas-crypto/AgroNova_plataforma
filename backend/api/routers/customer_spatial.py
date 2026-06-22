from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.core.database import get_db
from backend.schemas.customer_spatial import (
    CustomerGeo, CustomerDetail, CustomerStats,
    CustomersResponse, NearbyResponse,
)
from backend.services.customer_spatial_service import CustomerSpatialService

router = APIRouter(prefix="/api/customers", tags=["customers"])


def _svc(db: Session = Depends(get_db)) -> CustomerSpatialService:
    return CustomerSpatialService(db)


@router.get("", response_model=CustomersResponse, summary="All active clients")
def list_customers(
    provincia: str | None = Query(None),
    segmento:  str | None = Query(None),
    tier:      str | None = Query(None),
    churn:     str | None = Query(None, description="Bajo | Medio | Alto"),
    svc: CustomerSpatialService = Depends(_svc),
):
    return svc.list_customers(
        provincia=provincia, segmento=segmento, tier=tier, churn_lvl=churn
    )


@router.get("/search", response_model=list[CustomerGeo], summary="Search clients")
def search_customers(
    q:         str        = Query("", description="razon_social / CUIT / ciudad"),
    provincia: str | None = Query(None),
    ciudad:    str | None = Query(None),
    segmento:  str | None = Query(None),
    limit:     int        = Query(50, le=200),
    svc: CustomerSpatialService = Depends(_svc),
):
    return svc.search_customers(q=q, provincia=provincia, ciudad=ciudad,
                                 segmento=segmento, limit=limit)


@router.get("/nearby", response_model=NearbyResponse, summary="Clients within radius")
def get_nearby(
    lat:       float = Query(..., description="Latitude"),
    lon:       float = Query(..., description="Longitude"),
    radius_km: float = Query(50.0, le=500.0, description="Search radius in km"),
    svc: CustomerSpatialService = Depends(_svc),
):
    return svc.get_nearby(lat=lat, lon=lon, radius_km=radius_km)


@router.get("/stats", response_model=CustomerStats, summary="Aggregate customer statistics")
def get_stats(svc: CustomerSpatialService = Depends(_svc)):
    return svc.get_stats()


@router.get("/{cliente_id}", response_model=CustomerDetail, summary="Single client detail")
def get_customer(
    cliente_id: str,
    svc: CustomerSpatialService = Depends(_svc),
):
    result = svc.get_customer(cliente_id)
    if not result:
        raise HTTPException(status_code=404, detail=f"Client {cliente_id} not found")
    return result

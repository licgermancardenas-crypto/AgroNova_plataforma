from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.core.database import get_db_or_none
from backend.schemas.common import GeoJSONFeatureCollection
from backend.schemas.gis import CoverageItem, ProvinciaKPI
from backend.services import gis_service

router = APIRouter(prefix="/api/gis", tags=["gis"])


@router.get("/provincias", response_model=list[ProvinciaKPI])
def get_provincias(db: Optional[Session] = Depends(get_db_or_none)) -> list[dict]:
    """24 Argentine provinces with KPIs. Hybrid when DB is available: geographic
    metadata always from province_kpis.json; financial fields overridden from
    Neon for the 5 commercially active provinces."""
    if db is not None:
        return gis_service.get_provincias_from_db(db)
    return gis_service.get_provincias()


@router.get("/hotspots", response_model=GeoJSONFeatureCollection)
def get_hotspots() -> dict:
    return gis_service.get_hotspots()


@router.get("/coverage", response_model=list[CoverageItem])
def get_coverage() -> list[dict]:
    return gis_service.get_coverage()


@router.get("/territories", response_model=GeoJSONFeatureCollection)
def get_territories() -> dict:
    return gis_service.get_territories()

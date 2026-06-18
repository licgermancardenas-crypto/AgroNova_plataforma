from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.core.database import get_db_or_none
from backend.services import gis_service

router = APIRouter(prefix="/api/gis", tags=["gis"])


@router.get("/provincias")
def get_provincias(db: Session | None = Depends(get_db_or_none)):
    return gis_service.get_provincias(db)


@router.get("/hotspots")
def get_hotspots(db: Session | None = Depends(get_db_or_none)):
    return gis_service.get_hotspots(db)


@router.get("/coverage")
def get_coverage(db: Session | None = Depends(get_db_or_none)):
    return gis_service.get_coverage(db)


@router.get("/territories")
def get_territories(db: Session | None = Depends(get_db_or_none)):
    return gis_service.get_territories(db)

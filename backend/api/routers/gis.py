from fastapi import APIRouter

from backend.schemas.common import GeoJSONFeatureCollection
from backend.schemas.gis import CoverageItem, ProvinciaKPI
from backend.services import gis_service

router = APIRouter(prefix="/api/gis", tags=["gis"])


@router.get("/provincias", response_model=list[ProvinciaKPI])
def get_provincias() -> list[dict]:
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

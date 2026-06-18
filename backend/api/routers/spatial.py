from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.core.database import get_db_or_none
from backend.repositories.spatial_repository import SpatialRepository
from backend.services import spatial_service

router = APIRouter(prefix="/api/spatial", tags=["spatial"])


@router.get("/status")
def spatial_status(db: Session | None = Depends(get_db_or_none)):
    return spatial_service.get_postgis_status(db)


@router.get("/coverage")
def coverage(
    radius_km: float = Query(default=150.0, ge=1.0, le=1000.0),
    db: Session | None = Depends(get_db_or_none),
):
    return spatial_service.coverage_analysis_db(db, radius_km)


@router.get("/nearest")
def nearest(
    lat: float = Query(..., ge=-56.0, le=-21.0, description="Latitud WGS84"),
    lon: float = Query(..., ge=-74.0, le=-53.0, description="Longitud WGS84"),
    db: Session | None = Depends(get_db_or_none),
):
    if db is None:
        return {"query_lat": lat, "query_lon": lon, "nearest_branch": None, "nearest_depots": []}
    repo = SpatialRepository(db)
    version = repo.postgis_version()
    if version is None:
        return {"query_lat": lat, "query_lon": lon, "nearest_branch": None, "nearest_depots": []}
    branch = repo.nearest_branch(lat, lon)
    depots = repo.nearest_depot(lat, lon, limit=3)
    return {
        "query_lat": lat,
        "query_lon": lon,
        "nearest_branch": branch,
        "nearest_depots": depots,
    }


@router.get("/hotspots")
def hotspots(db: Session | None = Depends(get_db_or_none)):
    if db is None:
        return {"mode": "fallback", "items": []}
    repo = SpatialRepository(db)
    version = repo.postgis_version()
    if version is None:
        return {"mode": "fallback", "items": []}
    items = repo.hotspot_intersections()
    return {"mode": "postgis" if items else "fallback", "items": items}


@router.get("/overlaps")
def overlaps(db: Session | None = Depends(get_db_or_none)):
    return spatial_service.territorial_overlap_db(db)

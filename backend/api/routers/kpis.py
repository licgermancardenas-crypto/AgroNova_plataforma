from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.core.database import get_db_or_none
from backend.services import kpis_service

router = APIRouter(prefix="/api/kpis", tags=["kpis"])


@router.get("")
def get_kpis(
    anio: int = Query(default=2024, ge=2016, le=2030),
    db: Session | None = Depends(get_db_or_none),
):
    return kpis_service.get_kpis(anio, db)

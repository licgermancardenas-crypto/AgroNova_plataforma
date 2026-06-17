from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.core.database import get_db_or_none
from backend.schemas.kpis import KPIResponse
from backend.services.kpis_service import compute_kpis, compute_kpis_db

router = APIRouter(prefix="/api/kpis", tags=["kpis"])


@router.get("", response_model=KPIResponse)
def get_kpis(db: Optional[Session] = Depends(get_db_or_none)) -> KPIResponse:
    """Revenue, margin, active clients, churn rate and OTIF for the most
    recent full year — reads from Neon when DATABASE_URL is set, falls back
    to data/csv/ otherwise."""
    if db is not None:
        return compute_kpis_db(db)
    return compute_kpis()

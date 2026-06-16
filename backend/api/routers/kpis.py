from fastapi import APIRouter

from backend.schemas.kpis import KPIResponse
from backend.services.kpis_service import compute_kpis

router = APIRouter(prefix="/api/kpis", tags=["kpis"])


@router.get("", response_model=KPIResponse)
def get_kpis() -> KPIResponse:
    """Revenue, margin, active clients, churn rate and OTIF for the most
    recent full year in data/csv/Fact_Ventas.csv — computed on request."""
    return compute_kpis()

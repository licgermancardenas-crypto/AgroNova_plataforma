from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.core.database import get_db_or_none
from backend.services import logistics_service

router = APIRouter(prefix="/api/logistics", tags=["logistics"])


@router.get("/routes")
def get_routes(db: Session | None = Depends(get_db_or_none)):
    return logistics_service.get_routes(db)


@router.get("/risk")
def get_risk(db: Session | None = Depends(get_db_or_none)):
    return logistics_service.get_risk(db)


@router.get("/costs")
def get_costs(db: Session | None = Depends(get_db_or_none)):
    return logistics_service.get_costs(db)

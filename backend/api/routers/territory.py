from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.core.database import get_db
from backend.services.territory_service import TerritoryService

router = APIRouter(prefix="/api/territory", tags=["territory"])


def _svc(db: Session = Depends(get_db)) -> TerritoryService:
    return TerritoryService(db)


@router.get("/status")
def territory_status(svc: TerritoryService = Depends(_svc)):
    try:
        return svc.get_status()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get("/branches")
def territory_branches(svc: TerritoryService = Depends(_svc)):
    try:
        return svc.get_branches()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get("/conflicts")
def territory_conflicts(
    threshold: float = 20.0,
    svc: TerritoryService = Depends(_svc),
):
    try:
        return svc.get_conflicts(threshold_pct=threshold)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get("/optimization")
def territory_optimization(svc: TerritoryService = Depends(_svc)):
    try:
        return svc.get_optimization()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get("/expansion")
def territory_expansion(svc: TerritoryService = Depends(_svc)):
    try:
        return svc.get_expansion()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.core.database import get_db
from backend.services.network_service import NetworkService

router = APIRouter(prefix="/api/network", tags=["network"])


def _svc(db: Session = Depends(get_db)) -> NetworkService:
    return NetworkService(db)


@router.get("/status")
def network_status(svc: NetworkService = Depends(_svc)):
    try:
        return svc.get_status()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get("/flows")
def network_flows(svc: NetworkService = Depends(_svc)):
    try:
        return svc.get_flows()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get("/depots")
def network_depots(svc: NetworkService = Depends(_svc)):
    try:
        return svc.get_depots()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get("/capacity")
def network_capacity(svc: NetworkService = Depends(_svc)):
    try:
        return svc.get_capacity()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get("/bottlenecks")
def network_bottlenecks(svc: NetworkService = Depends(_svc)):
    try:
        return svc.get_bottlenecks()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get("/simulation/{deposito_id}")
def network_simulation(deposito_id: int, svc: NetworkService = Depends(_svc)):
    try:
        return svc.get_simulation(deposito_id)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

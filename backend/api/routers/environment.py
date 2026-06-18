from __future__ import annotations

from fastapi import APIRouter

from backend.schemas.environment import (
    DroughtRankingResponse,
    EnvironmentScoresResponse,
    ProvinceEnvironment,
    RainfallRankingResponse,
)
from backend.services import environment_service as svc

router = APIRouter(prefix="/api/environment", tags=["environment"])


@router.get("/scores", response_model=EnvironmentScoresResponse)
def get_environment_scores():
    items = svc.all_scores()
    return EnvironmentScoresResponse(
        total=len(items),
        items=[ProvinceEnvironment(**r) for r in items],
    )


@router.get("/drought", response_model=DroughtRankingResponse)
def get_drought_ranking():
    items = svc.drought_index()
    return DroughtRankingResponse(
        total=len(items),
        items=[ProvinceEnvironment(**r) for r in items],
    )


@router.get("/rainfall", response_model=RainfallRankingResponse)
def get_rainfall_ranking():
    items = svc.rainfall_risk()
    return RainfallRankingResponse(
        total=len(items),
        items=[ProvinceEnvironment(**r) for r in items],
    )

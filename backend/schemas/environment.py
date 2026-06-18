from __future__ import annotations

from pydantic import BaseModel


class ProvinceEnvironment(BaseModel):
    province: str
    macro_region: str
    lat: float
    lon: float
    rainfall_mm_yr: int
    rainfall_score: int          # 0-100
    rainfall_label: str
    drought_risk: int            # 0-100
    drought_label: str
    suitability_score: int       # 0-100
    climate_score: int           # 0-100
    dominant_crops: list[str]


class EnvironmentScoresResponse(BaseModel):
    total: int
    source: str = "SMN/INTA/climatología Argentina"
    items: list[ProvinceEnvironment]


class DroughtRankingResponse(BaseModel):
    total: int
    sorted_by: str = "drought_risk DESC"
    items: list[ProvinceEnvironment]


class RainfallRankingResponse(BaseModel):
    total: int
    sorted_by: str = "rainfall_score ASC (menor lluvia = mayor riesgo hídrico)"
    items: list[ProvinceEnvironment]

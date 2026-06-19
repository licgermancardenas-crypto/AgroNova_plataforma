from __future__ import annotations

from pydantic import BaseModel


class PostGISStatus(BaseModel):
    available: bool
    version: str | None = None
    tables_ready: dict[str, bool] = {}
    mode: str  # "postgis" | "fallback"


class ClientWithinRadius(BaseModel):
    cliente_id: str
    provincia: str
    lat: float
    lon: float
    distance_m: float


class CoverageDB(BaseModel):
    sucursal_id: int
    nombre: str
    provincia: str
    lat: float
    lon: float
    clientes_cubiertos: int
    radius_km: float


class NearestBranch(BaseModel):
    sucursal_id: int
    nombre: str
    provincia: str
    lat: float
    lon: float
    distance_km: float


class NearestDepot(BaseModel):
    deposito_id: int
    nombre: str
    sucursal_id: int
    lat: float
    lon: float
    distance_km: float


class HotspotIntersection(BaseModel):
    hotspot_id: int | None = None
    provincia: str
    score: float
    clientes_en_zona: int
    revenue_ars: float


class ProvinceOverlap(BaseModel):
    provincia_a: str
    provincia_b: str
    overlap_type: str
    sucursales_en_overlap: int


class NearestResponse(BaseModel):
    query_lat: float
    query_lon: float
    nearest_branch: NearestBranch | None
    nearest_depots: list[NearestDepot]


class CoverageResponse(BaseModel):
    mode: str
    items: list[CoverageDB]


class HotspotsResponse(BaseModel):
    mode: str
    items: list[HotspotIntersection]


class OverlapsResponse(BaseModel):
    mode: str
    items: list[ProvinceOverlap]

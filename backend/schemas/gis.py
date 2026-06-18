from pydantic import BaseModel


class ProvinciaKPI(BaseModel):
    nombre: str
    macro_region: str
    lat: float
    lon: float
    revenue_ars: float
    n_clientes: int
    n_activos: int
    margen_pct: float
    churn_score: float
    agr_ha_m: float
    gap_score: float
    otif_pct: float
    revenue_pct: float


class CoverageItem(BaseModel):
    provincia: str
    macro_region: str
    lat: float
    lon: float
    coverage_score: float
    active_ratio_pct: float
    min_dist_suc_km: float
    n_activos: int
    n_total: int
    coverage_label: str

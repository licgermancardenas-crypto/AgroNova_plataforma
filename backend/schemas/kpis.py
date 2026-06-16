from pydantic import BaseModel


class KPIResponse(BaseModel):
    anio: int
    revenue_total_ars: float
    margen_bruto_pct: float
    clientes_activos: int
    clientes_total: int
    churn_rate_pct: float
    otif_pct: float

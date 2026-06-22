from __future__ import annotations

from pydantic import BaseModel


class CustomerGeo(BaseModel):
    cliente_id:          str
    razon_social:        str
    segmento:            str
    ciclo_vida:          str | None
    provincia:           str | None
    ciudad:              str | None
    cuit:                str | None
    sucursal_id:         int | None
    tier:                str | None
    riesgo_crediticio:   str | None
    superficie_ha:       int | None
    lat:                 float
    lon:                 float
    is_outlier:          bool
    revenue_ars:         float | None
    margen_pct:          float | None
    ticket_promedio_ars: float | None
    n_compras:           int | None
    ultima_compra:       str | None
    otif_pct:            float | None
    churn_score:         float | None
    churn_level:         str | None


class CustomerDetail(CustomerGeo):
    """Extendido con data de ventas mensuales para mini charts."""
    revenue_mensual:     list[dict] = []   # [{mes, revenue_ars}]
    compras_trim:        list[dict] = []   # [{trimestre, n_compras}]
    nearest_branch:      dict | None = None


class CustomerStats(BaseModel):
    total_clientes:      int
    revenue_total_ars:   float
    revenue_promedio_ars: float
    ticket_promedio_ars: float
    clientes_alto_riesgo: int
    top_clientes:        list[dict]
    por_provincia:       list[dict]
    por_segmento:        list[dict]
    por_tier:            list[dict]
    churn_distribution:  dict


class CustomersResponse(BaseModel):
    total:    int
    items:    list[CustomerGeo]


class NearbyResponse(BaseModel):
    query_lat:  float
    query_lon:  float
    radius_km:  float
    total:      int
    items:      list[CustomerGeo]

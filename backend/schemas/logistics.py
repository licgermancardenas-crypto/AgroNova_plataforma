from pydantic import BaseModel


class RouteBySucursal(BaseModel):
    sucursal_id: int
    nombre: str
    n_clientes: int
    km_promedio: float
    km_maximo: float
    n_clientes_real: int
    tiempo_estimado_horas: float


class RouteByDeposito(BaseModel):
    deposito_id: int
    nombre: str
    n_clientes: int
    km_promedio: float
    km_maximo: float
    tiempo_estimado_horas: float


class RouteByProvincia(BaseModel):
    provincia: str
    sucursal_mas_cercana_id: int
    sucursal_mas_cercana: str
    distancia_sucursal_km: float
    tiempo_sucursal_horas: float
    deposito_mas_cercano_id: int | None
    deposito_mas_cercano: str | None
    distancia_deposito_km: float | None
    tiempo_deposito_horas: float | None


class RoutesResponse(BaseModel):
    by_sucursal: list[RouteBySucursal]
    by_deposito: list[RouteByDeposito]
    by_provincia: list[RouteByProvincia]


class RouteRiskByDeposito(BaseModel):
    deposito_id: int
    nombre: str
    sucursal_id: int | None
    n_envios: int
    pct_demorado: float
    pct_devuelto: float
    pct_entregado: float
    pct_en_transito: float
    dias_demora_prom: float
    incidencia_score: float
    risk_level: str


class RouteRiskByTipoEnvio(BaseModel):
    tipo_envio: str
    n_envios: int
    pct_demorado: float
    pct_devuelto: float
    pct_entregado: float
    pct_en_transito: float
    dias_demora_prom: float
    incidencia_score: float
    risk_level: str


class RouteRiskResponse(BaseModel):
    by_deposito: list[RouteRiskByDeposito]
    by_tipo_envio: list[RouteRiskByTipoEnvio]


class TransportCostBySucursal(BaseModel):
    sucursal_id: int
    nombre: str
    n_clientes: int
    distancia_km: float
    peso_kg_envio_prom: float
    costo_estimado_ars: float
    tiempo_estimado_horas: float


class TransportCostByDeposito(BaseModel):
    deposito_id: int
    nombre: str
    n_clientes: int
    distancia_km: float
    peso_kg_envio_prom: float
    costo_estimado_ars: float
    tiempo_estimado_horas: float


class TransportCostsResponse(BaseModel):
    cost_per_kg_ars: float
    avg_speed_kmh: float
    by_sucursal: list[TransportCostBySucursal]
    by_deposito: list[TransportCostByDeposito]

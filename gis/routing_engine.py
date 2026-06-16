"""
AgroNova v2.0 — Routing & Logistics Optimization Engine (Sprint GIS-06)
Cliente -> sucursal/depósito más cercano con tiempo estimado (extiende
network_analysis.nearest_branch_assignment), y simulación de apertura de
4 sucursales nuevas (Salta, Chaco, Corrientes, Santiago del Estero).

Misma limitación de datos que el resto de la capa GIS: Dim_Cliente.csv no
tiene lat/lon por cliente, así que toda distancia usa el centroide de
provincia como proxy (ver network_analysis.py).
"""
from __future__ import annotations

from . import geo_utils as gu
from .cost_model import AVG_SPEED_KMH, cost_per_km_ars, envios_promedio_cliente_anio
from .expansion_analysis import expansion_index_by_province
from .geo_utils import PROVINCE_CAPITAL
from .logistics_analysis import _MAX_DIST_FACTOR
from .network_analysis import (
    _depositos,
    _provincias_activas,
    _sucursales,
    nearest_branch_assignment,
)

# Sprint GIS-06 names these 4 provinces explicitly — all 4 already have a
# capital mapped in geo_utils.PROVINCE_CAPITAL.
EXPANSION_PROVINCES = ["Salta", "Chaco", "Corrientes", "Santiago del Estero"]


def cliente_routing_assignment() -> dict:
    """
    nearest_branch_assignment() enriquecido con tiempo estimado (horas) por
    leg, usando cost_model.AVG_SPEED_KMH. Agrega también el detalle por
    provincia (no solo el agregado por sucursal/depósito).
    """
    base = nearest_branch_assignment()
    sucursales = _sucursales()
    depositos = _depositos()

    for row in base["by_sucursal"]:
        row["tiempo_estimado_horas"] = round(row["km_promedio"] / AVG_SPEED_KMH, 1)
    for row in base["by_deposito"]:
        row["tiempo_estimado_horas"] = round(row["km_promedio"] / AVG_SPEED_KMH, 1)

    by_provincia = []
    for p in _provincias_activas():
        nearest_suc = min(sucursales, key=lambda s: gu.haversine_km(p["lat"], p["lon"], s["lat"], s["lon"]))
        dist_suc = gu.haversine_km(p["lat"], p["lon"], nearest_suc["lat"], nearest_suc["lon"])
        nearest_dep = min(depositos, key=lambda d: gu.haversine_km(p["lat"], p["lon"], d["lat"], d["lon"]))
        dist_dep = gu.haversine_km(p["lat"], p["lon"], nearest_dep["lat"], nearest_dep["lon"])

        by_provincia.append({
            "provincia":                 p["nombre"],
            "sucursal_mas_cercana_id":   nearest_suc["sucursal_id"],
            "sucursal_mas_cercana":      nearest_suc["nombre"],
            "distancia_sucursal_km":     round(dist_suc, 1),
            "tiempo_sucursal_horas":     round(dist_suc / AVG_SPEED_KMH, 1),
            "deposito_mas_cercano_id":   nearest_dep["deposito_id"],
            "deposito_mas_cercano":      nearest_dep["nombre"],
            "distancia_deposito_km":     round(dist_dep, 1),
            "tiempo_deposito_horas":     round(dist_dep / AVG_SPEED_KMH, 1),
        })

    return {
        "by_sucursal":  base["by_sucursal"],
        "by_deposito":  base["by_deposito"],
        "by_provincia": by_provincia,
    }


def _nearest_sucursal(lat: float, lon: float) -> tuple[dict, float]:
    sucursales = _sucursales()
    nearest = min(sucursales, key=lambda s: gu.haversine_km(lat, lon, s["lat"], s["lon"]))
    return nearest, gu.haversine_km(lat, lon, nearest["lat"], nearest["lon"])


def _potential_client_density() -> float:
    """
    Clientes activos por millón de hectáreas agrícolas, promediado sobre las
    5 provincias comercialmente activas — el benchmark real usado para
    proyectar nuevos clientes en provincias sin presencia actual.
    """
    exp = expansion_index_by_province()
    active = exp[exp["n_activos"] > 0]
    total_activos = active["n_activos"].sum()
    total_agr_ha = active["agr_ha_m"].sum()
    return total_activos / total_agr_ha if total_agr_ha else 0.0


def simulate_expansion(provincias: list[str] = EXPANSION_PROVINCES) -> list[dict]:
    """
    Simula la apertura de una sucursal nueva en cada provincia de
    `provincias`. Todas calculadas, no medidas — AgroNova no tiene presencia
    real en estas 4 provincias hoy (0 clientes en Dim_Cliente.csv).

    ahorro_km / reduccion_tiempo_horas: distancia actual centroide-provincia
      -> sucursal más cercana, que se elimina al abrir sucursal local.
    mejora_proximidad_pts: delta en el componente de proximidad del Logistics
      Efficiency Score (25 pts, cap 700 km — logistics_analysis.py), NO una
      proyección literal de OTIF: la red real no muestra correlación
      distancia-OTIF (OTIF se mantiene ~88% parejo entre Rosario a 0 km y
      Río Cuarto a 159 km promedio — ver docs/geospatial/routing_engine.md).
    nuevos_clientes_potenciales: gap_score (hectáreas agrícolas sin cubrir,
      expansion_analysis.py) x densidad real de clientes/Mha de la red activa.
    reduccion_costos_ars_anual: ahorro_km x cost_per_km_ars (aproximado, ver
      cost_model.py) x envíos/año proyectados para esos nuevos clientes.
    """
    exp = expansion_index_by_province().set_index("provincia")
    density = _potential_client_density()
    envios_cliente_anio = envios_promedio_cliente_anio()
    cost_km = cost_per_km_ars()

    rows = []
    for provincia in provincias:
        if provincia not in exp.index:
            continue
        row = exp.loc[provincia]
        centroid = gu.province_centroid(provincia)
        nearest_suc, dist_actual = _nearest_sucursal(centroid[0], centroid[1])

        ahorro_km = round(dist_actual, 1)
        reduccion_tiempo_horas = round(ahorro_km / AVG_SPEED_KMH, 1)

        proximity_old = max(0.0, 1.0 - dist_actual / _MAX_DIST_FACTOR)
        proximity_new = 1.0  # post-apertura, distancia ~0 (sucursal local)
        mejora_proximidad_pts = round((proximity_new - proximity_old) * 25, 1)

        nuevos_clientes = round(float(row["gap_score"]) * density)
        envios_anio = round(nuevos_clientes * envios_cliente_anio)
        reduccion_costos_ars_anual = round(ahorro_km * cost_km * envios_anio, 0)

        rows.append({
            "provincia":                provincia,
            "ciudad_candidata":         PROVINCE_CAPITAL.get(provincia, provincia),
            "macro_region":             row["macro_region"],
            "sucursal_actual_mas_cercana": nearest_suc["nombre"],
            "ahorro_km":                ahorro_km,
            "reduccion_tiempo_horas":   reduccion_tiempo_horas,
            "mejora_proximidad_pts":    mejora_proximidad_pts,
            "nuevos_clientes_potenciales": nuevos_clientes,
            "envios_potenciales_anio":  envios_anio,
            "reduccion_costos_ars_anual": reduccion_costos_ars_anual,
            "agr_ha_m":                 float(row["agr_ha_m"]),
            "gap_score":                float(row["gap_score"]),
            "opportunity_score":        float(row["opportunity_score"]),
        })

    return sorted(rows, key=lambda r: r["reduccion_costos_ars_anual"], reverse=True)

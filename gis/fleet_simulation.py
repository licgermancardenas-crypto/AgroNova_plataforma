"""
AgroNova v2.0 — Fleet Simulation (Sprint GIS-06)
Simulates truck fleet sizing and depósito load per depósito, from real
Fact_Logística shipment volume. No fleet/truck-level data exists in the Data
Warehouse — AgroNova doesn't track individual vehicles — so this is a
simulation, not a measurement, built on two documented assumptions:

  TRUCK_CAPACITY_KG: net cargo capacity of a standard semi-trailer used for
    agro freight in Argentina (~28 t). Fact_Logística has no vehicle data to
    calibrate this from.
  VIAJES_POR_CAMION_DIA: a truck completes ~2 regional delivery routes/day on
    average. Sizing the fleet by envíos/día (a real, calibrated figure) rather
    than by weight: the average envío is only ~500 kg (see
    cost_model.avg_peso_kg_envio), far under one truck's weight capacity —
    fleet size here is constrained by delivery-stop count, not by tonnage.

DEPOSITO_DAYS_SPAN comes directly from Fact_Logística's real date range
(2016-01-01 .. 2026-12-31, 4018 days) — that part is measured, not assumed.
"""
from __future__ import annotations

import datetime
import math

from .cost_model import _log
from .network_analysis import DEPOSITO_SUCURSAL_MAP, _depositos

TRUCK_CAPACITY_KG = 28_000.0
VIAJES_POR_CAMION_DIA = 2.0


def simulate_fleet_by_deposito() -> list[dict]:
    """
    Per depósito: viajes diarios promedio (real, de Fact_Logística), camiones
    necesarios (simulado) y utilización de la flota resultante.
    """
    log = _log()
    nombre_for_dep = {d["deposito_id"]: d["nombre"] for d in _depositos()}
    suc_for_dep = dict(DEPOSITO_SUCURSAL_MAP)

    anio_min = int(str(log["fecha_despacho_id"].min())[:4])
    anio_max = int(str(log["fecha_despacho_id"].max())[:4])
    dias_operacion = (datetime.date(anio_max, 12, 31) - datetime.date(anio_min, 1, 1)).days + 1

    rows = []
    for dep_id, grp in log.groupby("deposito_origen_id"):
        n_envios = len(grp)
        peso_total_kg = float(grp["peso_kg"].sum())
        peso_dia_kg = peso_total_kg / dias_operacion
        viajes_diarios = n_envios / dias_operacion

        camiones_necesarios = max(1, math.ceil(viajes_diarios / VIAJES_POR_CAMION_DIA))
        capacidad_diaria_kg = camiones_necesarios * VIAJES_POR_CAMION_DIA * TRUCK_CAPACITY_KG
        utilizacion_pct = round(peso_dia_kg / capacidad_diaria_kg * 100, 2)

        rows.append({
            "deposito_id":           int(dep_id),
            "nombre":                nombre_for_dep.get(dep_id, f"Depósito {dep_id}"),
            "sucursal_id":           suc_for_dep.get(dep_id),
            "n_envios_total":        int(n_envios),
            "viajes_diarios_promedio": round(viajes_diarios, 2),
            "peso_diario_promedio_kg": round(peso_dia_kg, 1),
            "camiones_necesarios":   camiones_necesarios,
            "capacidad_diaria_kg":   round(capacidad_diaria_kg, 1),
            "utilizacion_pct":       utilizacion_pct,
        })

    return sorted(rows, key=lambda r: r["deposito_id"])


def depot_load() -> dict:
    """
    Carga de depósitos: turnover_ratio = peso_diario_promedio (ton) /
    capacidad_ton (almacenamiento estático del depósito, Dim_Depósito.csv).

    Mide cuántos días tardaría el throughput diario promedio en llenar la
    capacidad de almacenamiento — un proxy de saturación relativa. Con solo 3
    depósitos, "Saturado"/"Subutilizado" es un ranking relativo entre los 3
    (el de mayor turnover_ratio vs. el de menor), no un umbral absoluto de
    capacidad logística.
    """
    fleet = simulate_fleet_by_deposito()
    dep_info = {d["deposito_id"]: d for d in _depositos()}

    rows = []
    for f in fleet:
        info = dep_info.get(f["deposito_id"], {})
        capacidad_ton = float(info.get("capacidad_ton", 0) or 0)
        peso_dia_ton = f["peso_diario_promedio_kg"] / 1000
        turnover_ratio = round(peso_dia_ton / capacidad_ton, 6) if capacidad_ton else None
        dias_llenar_capacidad = round(capacidad_ton / peso_dia_ton, 1) if peso_dia_ton else None

        rows.append({
            "deposito_id":            f["deposito_id"],
            "nombre":                 f["nombre"],
            "sucursal_id":            f["sucursal_id"],
            "capacidad_ton":          capacidad_ton,
            "peso_diario_promedio_ton": round(peso_dia_ton, 2),
            "turnover_ratio":         turnover_ratio,
            "dias_para_llenar_capacidad": dias_llenar_capacidad,
            "utilizacion_flota_pct":  f["utilizacion_pct"],
        })

    ranked = sorted(
        [r for r in rows if r["turnover_ratio"] is not None],
        key=lambda r: r["turnover_ratio"], reverse=True,
    )
    n = len(ranked)
    for i, r in enumerate(ranked):
        if n <= 2:
            r["estado_carga"] = "Saturado (relativo)" if i == 0 else "Subutilizado (relativo)"
        else:
            r["estado_carga"] = (
                "Saturado (relativo)" if i == 0 else
                "Subutilizado (relativo)" if i == n - 1 else
                "Equilibrado"
            )

    return {"by_deposito": sorted(ranked, key=lambda r: r["deposito_id"])}

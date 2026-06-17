"""
AgroNova v2.0 — Cost Model (Sprint GIS-06)
Calibrated cost/time constants derived from Fact_Logística, used by
routing_engine.py and fleet_simulation.py to price and time-estimate routes
that don't exist yet (provincias sin sucursal, simulaciones de expansión).

Calibration notes:
  - COST_PER_KG_ARS is derived directly from real data: mean(costo_flete_ars /
    peso_kg) across the 200k Fact_Logística rows. The ratio is tight (8-35
    ARS/kg) — a reliable, weight-driven cost driver in this network.
  - AVG_SPEED_KMH is NOT derived from data. An implied-speed calibration was
    attempted (haversine distance between depósito and región-destino
    centroid, divided by dias_transito_real) and produced ~6 km/h — implausible
    for road freight. That's because dias_transito_real bakes in dispatch/
    consolidation lead time, not pure driving time, and "home region" legs
    (depósito delivering inside its own province) dominate the row count with
    a near-fixed ~1.16 day floor regardless of the (small) distance involved.
    AVG_SPEED_KMH is therefore a documented assumption (typical Argentine
    cargo-truck route average, mixing highway and rural/last-mile segments).
  - COST_PER_KM_ARS is derived from the same depósito↔región pairs (n=15),
    weighted by row count. It is noisier than COST_PER_KG_ARS (per-pair range
    17-89 ARS/km) because it inherits the same centroid-distance approximation
    — used only for relative/simulation purposes (expansion savings), not as
    an authoritative freight rate.
"""
from __future__ import annotations

from functools import lru_cache

from . import geo_utils as gu
from .network_analysis import DEPOSITO_SUCURSAL_MAP, _depositos

AVG_SPEED_KMH = 60.0

# region_destino_id -> provincia, reusing the canonical mapping already
# established for Fact_Logística in geo_utils.PROVINCE_REGION_ID.
_REGION_TO_PROVINCE: dict[int, str] = {v: k for k, v in gu.PROVINCE_REGION_ID.items()}


@lru_cache(maxsize=1)
def _log():
    """Fact_Logística (200k rows), read once and cached for this whole module."""
    return gu.load_logistica()


@lru_cache(maxsize=1)
def _logistica_route_pairs():
    """deposito_origen_id x region_destino_id aggregates, cached (200k-row read)."""
    log = _log()
    g = (
        log.groupby(["deposito_origen_id", "region_destino_id"])
        .agg(
            n=("logistica_id", "count"),
            dias_transito_prom=("dias_transito_real", "mean"),
            costo_prom=("costo_flete_ars", "mean"),
        )
        .reset_index()
    )
    return g


@lru_cache(maxsize=1)
def cost_per_kg_ars() -> float:
    """Mean(costo_flete_ars / peso_kg) across all Fact_Logística rows."""
    log = _log()
    return round(float((log["costo_flete_ars"] / log["peso_kg"]).mean()), 2)


@lru_cache(maxsize=1)
def avg_peso_kg_envio() -> float:
    """Mean shipment weight (kg) — used as the default payload for cost/time estimates."""
    log = _log()
    return round(float(log["peso_kg"].mean()), 1)


@lru_cache(maxsize=1)
def envios_promedio_cliente_anio() -> float:
    """
    Real, calibrated benchmark: Fact_Logística has exactly 200,000 rows across
    4,000 unique clientes over an 11-year span (2016-2026) — a perfectly
    uniform 50 envíos/cliente lifetime, i.e. ~4.55 envíos/cliente/año. Used to
    project shipment volume for clientes that don't exist yet (expansion sim).
    """
    log = _log()
    n_clientes = log["cliente_id"].nunique()
    n_anios = log["anio"].nunique()
    return round(len(log) / n_clientes / n_anios, 2)


@lru_cache(maxsize=1)
def cost_per_km_ars() -> float:
    """
    Weighted-average implied ARS/km across the 15 depósito x región_destino
    pairs (costo_flete_ars promedio / distancia haversine depósito-centroide
    de provincia). Approximate — see module docstring.
    """
    deps = {d["deposito_id"]: d for d in _depositos()}
    g = _logistica_route_pairs().copy()

    def _dist(row):
        d = deps[row["deposito_origen_id"]]
        prov = _REGION_TO_PROVINCE.get(row["region_destino_id"])
        centroid = gu.province_centroid(prov) if prov else None
        if centroid is None:
            return None
        return gu.haversine_km(d["lat"], d["lon"], centroid[0], centroid[1])

    g["distance_km"] = g.apply(_dist, axis=1)
    g = g.dropna(subset=["distance_km"])
    g = g[g["distance_km"] > 1.0]  # drop near-zero "home region" legs (undefined ARS/km)
    g["implied_cost_per_km"] = g["costo_prom"] / g["distance_km"]
    weighted = (g["implied_cost_per_km"] * g["n"]).sum() / g["n"].sum()
    return round(float(weighted), 2)


def estimate_transport(distance_km: float, peso_kg: float | None = None) -> dict:
    """
    Cost/time estimate for a route that has no Fact_Logística history yet
    (e.g. a province with zero clientes today).

    costo_estimado_ars uses COST_PER_KG_ARS (the robust, data-derived driver).
    tiempo_estimado_horas uses AVG_SPEED_KMH (documented assumption, see module
    docstring — real dias_transito_real does not correlate with distance in
    this network).
    """
    peso = peso_kg if peso_kg is not None else avg_peso_kg_envio()
    return {
        "distancia_km": round(distance_km, 1),
        "peso_kg": round(peso, 1),
        "costo_estimado_ars": round(peso * cost_per_kg_ars(), 1),
        "tiempo_estimado_horas": round(distance_km / AVG_SPEED_KMH, 1),
    }


def transport_costs_by_route() -> dict:
    """
    Costo y tiempo estimado por leg (provincia -> sucursal más cercana,
    provincia -> depósito más cercano), para las 5 provincias comercialmente
    activas. Reusa las distancias ya calculadas en
    network_analysis.distance_matrix() y les aplica estimate_transport()
    con el peso promedio real de un envío.
    """
    from .network_analysis import nearest_branch_assignment

    peso = avg_peso_kg_envio()
    assignment = nearest_branch_assignment()

    by_sucursal = []
    for row in assignment["by_sucursal"]:
        est = estimate_transport(row["km_promedio"], peso)
        by_sucursal.append({
            "sucursal_id":          row["sucursal_id"],
            "nombre":               row["nombre"],
            "n_clientes":           row["n_clientes"],
            "distancia_km":         est["distancia_km"],
            "peso_kg_envio_prom":   est["peso_kg"],
            "costo_estimado_ars":   est["costo_estimado_ars"],
            "tiempo_estimado_horas": est["tiempo_estimado_horas"],
        })

    by_deposito = []
    for row in assignment["by_deposito"]:
        est = estimate_transport(row["km_promedio"], peso)
        by_deposito.append({
            "deposito_id":          row["deposito_id"],
            "nombre":               row["nombre"],
            "n_clientes":           row["n_clientes"],
            "distancia_km":         est["distancia_km"],
            "peso_kg_envio_prom":   est["peso_kg"],
            "costo_estimado_ars":   est["costo_estimado_ars"],
            "tiempo_estimado_horas": est["tiempo_estimado_horas"],
        })

    return {
        "cost_per_kg_ars":  cost_per_kg_ars(),
        "avg_speed_kmh":    AVG_SPEED_KMH,
        "by_sucursal":      by_sucursal,
        "by_deposito":      by_deposito,
    }


def route_risk() -> dict:
    """
    Riesgo de ruta a partir de la distribución real de `estado` en
    Fact_Logística — por depósito de origen y por tipo de envío.

    incidencia_score = pct_demorado + 2 x pct_devuelto (un Devuelto pesa el
    doble que un Demorado: representa una entrega fallida, no solo tardía).
    Con solo 3 depósitos / 3 tipos de envío, el ranking es relativo (top =
    "Alto", bottom = "Bajo") — no hay volumen suficiente para umbrales
    absolutos con significancia estadística.
    """
    log = _log()
    suc_for_dep = dict(DEPOSITO_SUCURSAL_MAP)
    nombre_for_dep = {d["deposito_id"]: d["nombre"] for d in _depositos()}

    def _rank_risk(rows: list[dict]) -> list[dict]:
        ranked = sorted(rows, key=lambda r: r["incidencia_score"], reverse=True)
        n = len(ranked)
        for i, r in enumerate(ranked):
            if n <= 2:
                r["risk_level"] = "Alto" if i == 0 else "Bajo"
            else:
                r["risk_level"] = "Alto" if i == 0 else ("Bajo" if i == n - 1 else "Medio")
        return ranked

    by_deposito = []
    for dep_id, grp in log.groupby("deposito_origen_id"):
        n = len(grp)
        pct_demorado = round((grp["estado"] == "Demorado").sum() / n * 100, 2)
        pct_devuelto = round((grp["estado"] == "Devuelto").sum() / n * 100, 2)
        pct_entregado = round((grp["estado"] == "Entregado").sum() / n * 100, 2)
        pct_en_transito = round((grp["estado"] == "En tránsito").sum() / n * 100, 2)
        by_deposito.append({
            "deposito_id":       int(dep_id),
            "nombre":            nombre_for_dep.get(dep_id, f"Depósito {dep_id}"),
            "sucursal_id":       suc_for_dep.get(dep_id),
            "n_envios":          int(n),
            "pct_demorado":      pct_demorado,
            "pct_devuelto":      pct_devuelto,
            "pct_entregado":     pct_entregado,
            "pct_en_transito":   pct_en_transito,
            "dias_demora_prom":  round(float(grp["dias_demora"].mean()), 2),
            "incidencia_score":  round(pct_demorado + 2 * pct_devuelto, 2),
        })

    by_tipo_envio = []
    for tipo, grp in log.groupby("tipo_envio"):
        n = len(grp)
        pct_demorado = round((grp["estado"] == "Demorado").sum() / n * 100, 2)
        pct_devuelto = round((grp["estado"] == "Devuelto").sum() / n * 100, 2)
        pct_entregado = round((grp["estado"] == "Entregado").sum() / n * 100, 2)
        pct_en_transito = round((grp["estado"] == "En tránsito").sum() / n * 100, 2)
        by_tipo_envio.append({
            "tipo_envio":        tipo,
            "n_envios":          int(n),
            "pct_demorado":      pct_demorado,
            "pct_devuelto":      pct_devuelto,
            "pct_entregado":     pct_entregado,
            "pct_en_transito":   pct_en_transito,
            "dias_demora_prom":  round(float(grp["dias_demora"].mean()), 2),
            "incidencia_score":  round(pct_demorado + 2 * pct_devuelto, 2),
        })

    return {
        "by_deposito":   _rank_risk(by_deposito),
        "by_tipo_envio": _rank_risk(by_tipo_envio),
    }

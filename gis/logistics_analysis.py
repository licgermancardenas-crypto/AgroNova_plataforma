"""
AgroNova v2.0 — Logistics Analysis
Coverage radius distribution and Logistics Efficiency Score per sucursal.
"""
from __future__ import annotations

import pandas as pd

from . import geo_utils as gu
from .network_analysis import DEPOSITO_SUCURSAL_MAP, _provincias_activas, _sucursales

RADIUS_BUCKETS = [
    (0, 50, "0-50 km"),
    (50, 100, "50-100 km"),
    (100, 200, "100-200 km"),
    (200, float("inf"), "> 200 km"),
]

_MAX_DIST_FACTOR = 700.0   # km — same cap used in spatial_scores.coverage_score_by_province
_MAX_TRANSIT_DAYS = 10.0   # days — generous cap; observed network average is ~2.5-3.5 days
_FULL_CLIENT_LOAD = 1000   # clients served — scoring ceiling for the "served" component


def _bucket_for(km: float) -> str:
    for lo, hi, label in RADIUS_BUCKETS:
        if lo <= km < hi:
            return label
    return RADIUS_BUCKETS[-1][2]


def coverage_radius_distribution() -> dict:
    """
    Classifies each commercially active province's client base into distance
    buckets (0-50 / 50-100 / 100-200 / >200 km) based on distance from the
    province centroid (cliente proxy) to its nearest sucursal.
    """
    cli = gu.load_clientes()
    sucursales = _sucursales()
    prov_counts = cli.groupby("provincia_norm")["cliente_id"].count().to_dict()

    by_provincia = []
    bucket_totals: dict[str, int] = {label: 0 for _, _, label in RADIUS_BUCKETS}

    for p in _provincias_activas():
        n_clientes = int(prov_counts.get(p["nombre"], 0))
        if n_clientes == 0:
            continue
        dist = min(gu.haversine_km(p["lat"], p["lon"], s["lat"], s["lon"]) for s in sucursales)
        bucket = _bucket_for(dist)
        bucket_totals[bucket] += n_clientes
        by_provincia.append({
            "provincia":   p["nombre"],
            "macro_region": gu.get_macro_region(p["nombre"]),
            "distance_km": round(dist, 1),
            "bucket":      bucket,
            "n_clientes":  n_clientes,
        })

    total = sum(bucket_totals.values())
    national = [
        {
            "bucket":      label,
            "n_clientes":  bucket_totals[label],
            "pct":         round(bucket_totals[label] / total * 100, 1) if total else 0.0,
        }
        for _, _, label in RADIUS_BUCKETS
    ]

    return {
        "national":     national,
        "by_provincia": sorted(by_provincia, key=lambda r: r["distance_km"]),
    }


def logistics_efficiency_score() -> pd.DataFrame:
    """
    Logistics Efficiency Score (0-100) per sucursal.

    Formula (weighted sum):
      35 pts · otif_pct            (Fact_Logística, only sucursales with a depósito)
      25 pts · proximity_factor    = max(0, 1 - km_promedio_clientes / 700 km)
      20 pts · transit_factor      = max(0, 1 - dias_transito_real_prom / 10 días)
      20 pts · served_factor       = min(n_clientes_atendidos / 1000, 1)

    Sucursales without an associated depósito (Tandil, Paraná) have no
    Fact_Logística rows to compute OTIF/transit time from — they are returned
    with logistics_score = None and label "Sin Datos Logísticos" rather than
    a fabricated estimate.
    """
    from .network_analysis import nearest_branch_assignment

    log = gu.load_logistica()
    log_agg = (
        log.groupby("deposito_origen_id")
        .agg(otif_pct=("otif", "mean"), dias_transito_prom=("dias_transito_real", "mean"))
        .reset_index()
    )
    sucursal_id_for_deposito = {dep_id: suc_id for dep_id, suc_id in DEPOSITO_SUCURSAL_MAP.items()}
    log_agg["sucursal_id"] = log_agg["deposito_origen_id"].map(sucursal_id_for_deposito)
    log_by_sucursal = log_agg.set_index("sucursal_id")[["otif_pct", "dias_transito_prom"]].to_dict("index")

    served = {row["sucursal_id"]: row for row in nearest_branch_assignment()["by_sucursal"]}

    rows = []
    for s in _sucursales():
        sid = s["sucursal_id"]
        n_clientes  = served.get(sid, {}).get("n_clientes", 0)
        km_promedio = served.get(sid, {}).get("km_promedio", 0.0)
        log_data    = log_by_sucursal.get(sid)

        if log_data is None:
            rows.append({
                "sucursal_id":       sid,
                "nombre":            s["nombre"],
                "provincia":         s["provincia"],
                "n_clientes":        n_clientes,
                "km_promedio":       km_promedio,
                "otif_pct":          None,
                "dias_transito_prom": None,
                "logistics_score":   None,
                "logistics_label":   "Sin Datos Logísticos",
            })
            continue

        otif_pct  = round(log_data["otif_pct"] * 100, 1)
        transito  = round(log_data["dias_transito_prom"], 1)

        proximity_factor = max(0.0, 1.0 - km_promedio / _MAX_DIST_FACTOR)
        transit_factor   = max(0.0, 1.0 - transito / _MAX_TRANSIT_DAYS)
        served_factor    = min(n_clientes / _FULL_CLIENT_LOAD, 1.0)

        score = round(
            log_data["otif_pct"] * 35 +
            proximity_factor     * 25 +
            transit_factor       * 20 +
            served_factor        * 20,
            1,
        )

        rows.append({
            "sucursal_id":        sid,
            "nombre":             s["nombre"],
            "provincia":          s["provincia"],
            "n_clientes":         n_clientes,
            "km_promedio":        km_promedio,
            "otif_pct":           otif_pct,
            "dias_transito_prom": transito,
            "logistics_score":    score,
            "logistics_label":    (
                "Excelente" if score >= 80 else
                "Buena"     if score >= 60 else
                "Mejorable" if score >= 40 else
                "Crítica"
            ),
        })

    df = pd.DataFrame(rows).sort_values(
        "logistics_score", ascending=False, na_position="last"
    ).reset_index(drop=True)
    # Avoid NaN in numeric columns with mixed None/float (e.g. sucursales without
    # depósito data) — NaN serializes to invalid JSON ("NaN" is not valid JSON).
    return df.astype(object).where(df.notnull(), None)

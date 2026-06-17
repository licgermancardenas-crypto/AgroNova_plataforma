"""
AgroNova v2.0 — Spatial Scores
Coverage Score, Revenue Density and Churn Geographic by province.

All scores are normalized to 0-100. Higher = better (except churn_level which is categorical).
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import pandas as pd

from . import geo_utils as gu
from .coverage_analysis import DEFAULT_RADII
from . import spatial_analysis as sa

# Province area in km² (IGN official, rounded to km²)
PROVINCE_AREA_KM2: dict[str, float] = {
    "Buenos Aires":                     307_571,
    "Ciudad Autónoma de Buenos Aires":      203,
    "Santa Fe":                         133_007,
    "Córdoba":                          165_321,
    "Entre Ríos":                        78_781,
    "La Pampa":                         143_440,
    "Salta":                            155_488,
    "Tucumán":                           22_524,
    "Santiago del Estero":              136_351,
    "Jujuy":                             53_219,
    "Catamarca":                        102_602,
    "La Rioja":                          89_680,
    "Chaco":                             99_633,
    "Corrientes":                        88_199,
    "Misiones":                          29_801,
    "Formosa":                           72_066,
    "Mendoza":                          148_827,
    "San Juan":                          89_651,
    "San Luis":                          76_748,
    "Neuquén":                           94_078,
    "Río Negro":                        203_013,
    "Chubut":                           224_686,
    "Santa Cruz":                       243_943,
    "Tierra del Fuego":                  21_571,
}

CHURN_THRESHOLD_LOW    = 0.25
CHURN_THRESHOLD_MEDIUM = 0.35

_MAX_DIST_FACTOR = 700.0   # km — beyond this distance, proximity score = 0


def _load_sucursales_with_radii() -> list[dict]:
    suc_df = gu.load_sucursales()
    rows = []
    for _, s in suc_df.iterrows():
        rows.append({
            "sucursal_id": int(s["sucursal_id"]),
            "lat":         float(s["lat"]),
            "lon":         float(s["lon"]),
            "radio_km":    float(DEFAULT_RADII.get(int(s["sucursal_id"]), 400.0)),
        })
    return rows


def coverage_score_by_province() -> pd.DataFrame:
    """
    Coverage Score (0–100) per province.

    Formula (weighted sum, normalised to 100):
      40 pts · active_ratio        = n_activos / n_total
      30 pts · proximity_factor    = max(0, 1 – min_dist / 700 km)
      20 pts · penetration         = min(n_activos / 200, 1)
      10 pts · present             = 1 if province has any active clients, else 0

    Interpretation:
      80-100 → Cobertura Sólida
      60-79  → Cobertura Media
      40-59  → Cobertura Incipiente
      0-39   → Sin Cobertura / Gap
    """
    cli = gu.load_clientes()
    sucursales = _load_sucursales_with_radii()

    prov_stats = (
        cli.groupby("provincia_norm")
        .agg(n_total=("cliente_id", "count"), n_activos=("activo", "sum"))
        .reset_index()
    )

    rows = []
    for code, pdata in gu.PROVINCE_CATALOGUE.items():
        nombre = pdata["nombre"]
        lat, lon = pdata["lat"], pdata["lon"]
        norm = gu.normalize_province(nombre)

        stat = prov_stats[prov_stats["provincia_norm"] == norm]
        n_total   = int(stat["n_total"].sum())   if not stat.empty else 0
        n_activos = int(stat["n_activos"].sum()) if not stat.empty else 0

        distances = [gu.haversine_km(lat, lon, s["lat"], s["lon"]) for s in sucursales]
        min_dist  = min(distances) if distances else 9999.0

        # Component scores (each 0-1)
        active_ratio     = n_activos / max(n_total, 1)
        proximity_factor = max(0.0, 1.0 - min_dist / _MAX_DIST_FACTOR)
        penetration      = min(n_activos / 200.0, 1.0)
        present          = 1.0 if n_activos > 0 else 0.0

        score = round(
            active_ratio     * 40 +
            proximity_factor * 30 +
            penetration      * 20 +
            present          * 10,
            1,
        )

        rows.append({
            "provincia":          nombre,
            "macro_region":       gu.get_macro_region(nombre),
            "lat":                lat,
            "lon":                lon,
            "coverage_score":     score,
            "active_ratio_pct":   round(active_ratio * 100, 1),
            "min_dist_suc_km":    round(min_dist, 0),
            "n_activos":          n_activos,
            "n_total":            n_total,
            "coverage_label":     (
                "Sólida"       if score >= 80 else
                "Media"        if score >= 60 else
                "Incipiente"   if score >= 40 else
                "Sin Cobertura"
            ),
        })

    return (
        pd.DataFrame(rows)
        .sort_values("coverage_score", ascending=False)
        .reset_index(drop=True)
    )


def revenue_density_by_province() -> pd.DataFrame:
    """
    Revenue Density = Revenue ARS / Province Area km².

    Interpretation: higher → more commercial intensity per unit area.
    CABA is excluded from ranking due to urban distortion (≈200 km²).
    """
    rev = sa.revenue_by_province()

    rows = []
    for code, pdata in gu.PROVINCE_CATALOGUE.items():
        nombre = pdata["nombre"]
        norm   = gu.normalize_province(nombre)
        area   = PROVINCE_AREA_KM2.get(nombre, 1.0)

        rev_row = rev[rev["provincia_norm"] == norm]
        revenue = float(rev_row["revenue_ars"].sum()) if not rev_row.empty else 0.0

        density = revenue / area if area > 0 else 0.0

        rows.append({
            "provincia":          nombre,
            "macro_region":       gu.get_macro_region(nombre),
            "lat":                pdata["lat"],
            "lon":                pdata["lon"],
            "revenue_ars":        round(revenue, 0),
            "area_km2":           area,
            "revenue_density":    round(density, 2),   # ARS / km²
            "revenue_density_m":  round(density / 1_000_000, 4),  # M ARS / km²
        })

    df = pd.DataFrame(rows).sort_values("revenue_density", ascending=False).reset_index(drop=True)
    max_density = df["revenue_density"].max()
    df["density_score"] = (df["revenue_density"] / max(max_density, 1) * 100).round(1)
    return df


def churn_geographic_by_province() -> pd.DataFrame:
    """
    Churn risk grouped by province, across all 24 catalogue provinces.

    churn_rate = (n_churned + n_en_riesgo) / n_total
    Level:  Low    ← churn_rate <= 0.25
            Medium ← 0.25 < churn_rate <= 0.35
            High   ← churn_rate > 0.35
            Sin Datos ← province has zero client records (no commercial presence)
    """
    cli = gu.load_clientes()

    agg = (
        cli.groupby("provincia_norm")
        .agg(
            n_total      =("cliente_id", "count"),
            n_activos    =("activo",     "sum"),
            n_en_riesgo  =("ciclo_vida", lambda x: (x == "En Riesgo").sum()),
            n_churned    =("ciclo_vida", lambda x: (x == "Churned").sum()),
        )
        .reset_index()
        .set_index("provincia_norm")
    )

    rows = []
    for code, pdata in gu.PROVINCE_CATALOGUE.items():
        nombre = pdata["nombre"]
        norm   = gu.normalize_province(nombre)

        if norm in agg.index:
            n_total     = int(agg.loc[norm, "n_total"])
            n_activos   = int(agg.loc[norm, "n_activos"])
            n_en_riesgo = int(agg.loc[norm, "n_en_riesgo"])
            n_churned   = int(agg.loc[norm, "n_churned"])
            churn_rate  = round((n_churned + n_en_riesgo) / max(n_total, 1), 3)
            level = (
                "Low"    if churn_rate <= CHURN_THRESHOLD_LOW    else
                "Medium" if churn_rate <= CHURN_THRESHOLD_MEDIUM else
                "High"
            )
        else:
            n_total = n_activos = n_en_riesgo = n_churned = 0
            churn_rate = 0.0
            level = "Sin Datos"

        rows.append({
            "provincia":    nombre,
            "macro_region": gu.get_macro_region(nombre),
            "lat":          pdata["lat"],
            "lon":          pdata["lon"],
            "n_total":      n_total,
            "n_activos":    n_activos,
            "n_en_riesgo":  n_en_riesgo,
            "n_churned":    n_churned,
            "churn_rate":   churn_rate,
            "churn_score":  churn_rate,
            "churn_level":  level,
        })

    return pd.DataFrame(rows).sort_values("churn_rate", ascending=False).reset_index(drop=True)

"""
AgroNova v2.0 — Spatial Analysis
Revenue, clients and KPIs aggregated by province and macro-region.
All functions return DataFrames with centroid coordinates ready for frontend.
"""
from __future__ import annotations

import pandas as pd
from . import geo_utils as gu


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _centroid_df() -> pd.DataFrame:
    """Province centroid lookup table."""
    return pd.DataFrame([
        {"provincia_norm": gu.normalize_province(d["nombre"]), "lat": d["lat"], "lon": d["lon"]}
        for d in gu.PROVINCE_CATALOGUE.values()
    ])


def _ventas_with_province() -> pd.DataFrame:
    ventas   = gu.load_ventas()
    clientes = gu.load_clientes()[["cliente_id", "provincia_norm", "macro_region",
                                   "tier_cliente", "ciclo_vida"]]
    return ventas.merge(clientes, on="cliente_id", how="left")


# ---------------------------------------------------------------------------
# Revenue
# ---------------------------------------------------------------------------

def revenue_by_province(anio: int | None = None) -> pd.DataFrame:
    """
    Revenue, margin and unique-client count aggregated by province.
    Includes centroid coordinates for choropleth / marker rendering.

    Columns: provincia_norm, macro_region, n_clientes, revenue_ars,
             total_usd, margen_bruto_ars, margen_pct, agr_ha_m, lat, lon.
    """
    df = _ventas_with_province()
    if anio:
        df = df[df["anio"] == anio]

    agg = (
        df.groupby("provincia_norm")
        .agg(
            n_clientes     =("cliente_id", "nunique"),
            revenue_ars    =("total_ars",  "sum"),
            total_usd      =("total_usd",  "sum"),
            margen_bruto_ars=("margen_bruto_ars", "sum"),
            n_ventas       =("venta_id",   "count"),
        )
        .reset_index()
    )
    agg["margen_pct"]  = (agg["margen_bruto_ars"] / agg["revenue_ars"] * 100).round(2)
    agg["macro_region"] = agg["provincia_norm"].apply(gu.get_macro_region)
    agg["agr_ha_m"]    = agg["provincia_norm"].apply(lambda p: gu.PROVINCE_AGR_HA_M.get(p, 0))

    return agg.merge(_centroid_df(), on="provincia_norm", how="left")


def revenue_by_province_year() -> pd.DataFrame:
    """
    Revenue by province × year for temporal animation (slider 2016–2026).
    Columns: anio, provincia_norm, revenue_ars, n_clientes, lat, lon.
    """
    df = _ventas_with_province()
    agg = (
        df.groupby(["anio", "provincia_norm"])
        .agg(revenue_ars=("total_ars", "sum"), n_clientes=("cliente_id", "nunique"))
        .reset_index()
    )
    return agg.merge(_centroid_df(), on="provincia_norm", how="left")


# ---------------------------------------------------------------------------
# Clients
# ---------------------------------------------------------------------------

def clients_by_province() -> pd.DataFrame:
    """
    Client mix per province: total, active, tier breakdown, surface area.
    Columns: provincia_norm, macro_region, n_total, n_activos, tier_a,
             tier_b, tier_c, pct_activos, superficie_ha, agr_ha_m, lat, lon.
    """
    cli = gu.load_clientes()
    agg = (
        cli.groupby("provincia_norm")
        .agg(
            n_total      =("cliente_id",  "count"),
            n_activos    =("activo",       "sum"),
            tier_a       =("tier_cliente", lambda x: (x == "A").sum()),
            tier_b       =("tier_cliente", lambda x: (x == "B").sum()),
            tier_c       =("tier_cliente", lambda x: (x == "C").sum()),
            superficie_ha=("superficie_ha","sum"),
        )
        .reset_index()
    )
    agg["pct_activos"] = (agg["n_activos"] / agg["n_total"] * 100).round(1)
    agg["macro_region"] = agg["provincia_norm"].apply(gu.get_macro_region)
    agg["agr_ha_m"]     = agg["provincia_norm"].apply(lambda p: gu.PROVINCE_AGR_HA_M.get(p, 0))
    return agg.merge(_centroid_df(), on="provincia_norm", how="left")


# ---------------------------------------------------------------------------
# Regional KPIs
# ---------------------------------------------------------------------------

def regional_kpis(anio: int | None = None) -> pd.DataFrame:
    """
    KPIs aggregated by macro-region (PAM / NOA / NEA / CUY / PAT).

    Columns: macro_region, n_provincias, n_clientes, revenue_ars,
             total_usd, margen_pct, revenue_share_pct.
    """
    df = revenue_by_province(anio=anio)
    grp = (
        df.groupby("macro_region")
        .agg(
            n_provincias  =("provincia_norm", "count"),
            n_clientes    =("n_clientes",     "sum"),
            revenue_ars   =("revenue_ars",    "sum"),
            total_usd     =("total_usd",      "sum"),
            margen_bruto  =("margen_bruto_ars","sum"),
        )
        .reset_index()
    )
    total = grp["revenue_ars"].sum()
    grp["revenue_share_pct"] = (grp["revenue_ars"] / total * 100).round(1)
    grp["margen_pct"]        = (grp["margen_bruto"] / grp["revenue_ars"] * 100).round(2)
    return grp.sort_values("revenue_ars", ascending=False).reset_index(drop=True)


def logistica_otif_by_region() -> pd.DataFrame:
    """
    OTIF and transit time aggregated by destination region.
    Joins Fact_Logística → Dim_Región for regional label.
    """
    log = gu.load_logistica()
    reg = gu.load_regiones()[["region_id", "nombre_region"]]
    df  = log.merge(reg, left_on="region_destino_id", right_on="region_id", how="left")
    agg = (
        df.groupby("nombre_region")
        .agg(
            n_envios        =("logistica_id",    "count"),
            otif_pct        =("otif",            lambda x: round(x.mean() * 100, 1)),
            dias_transito   =("dias_transito_real","mean"),
            costo_flete_ars =("costo_flete_ars", "sum"),
        )
        .reset_index()
    )
    agg["dias_transito"] = agg["dias_transito"].round(1)
    return agg.sort_values("otif_pct")


# ---------------------------------------------------------------------------
# Gap & opportunity analysis
# ---------------------------------------------------------------------------

def territorial_gap_analysis() -> pd.DataFrame:
    """
    Provinces with high agricultural potential and low AgroNova penetration.
    gap_score = agr_ha_m / max(penetracion_idx, ε) — higher = bigger opportunity.

    Columns: provincia, macro_region, lat, lon, agr_ha_m, revenue_ars,
             penetracion_idx, gap_score, gap_rank.
    """
    rev        = revenue_by_province()
    rev_lookup = rev.set_index("provincia_norm")["revenue_ars"].to_dict()

    rows = []
    for d in gu.PROVINCE_CATALOGUE.values():
        nombre  = d["nombre"]
        agr_ha  = gu.PROVINCE_AGR_HA_M.get(nombre, 0)
        if agr_ha == 0:
            continue
        rev_ars = rev_lookup.get(nombre, 0.0)
        # Revenue per million hectares cultivable — proxy for penetration
        penetracion_idx = rev_ars / (agr_ha * 1_000_000) if agr_ha > 0 else 0
        rows.append({
            "provincia":       nombre,
            "macro_region":    gu.MACRO_REGION.get(nombre, "OTHER"),
            "lat":             d["lat"],
            "lon":             d["lon"],
            "agr_ha_m":        agr_ha,
            "revenue_ars":     rev_ars,
            "penetracion_idx": round(penetracion_idx, 4),
            "gap_score":       round(agr_ha / max(penetracion_idx, 1e-6), 2),
        })

    df = pd.DataFrame(rows).sort_values("gap_score", ascending=False).reset_index(drop=True)
    df["gap_rank"] = df.index + 1
    return df


def churn_risk_by_province() -> pd.DataFrame:
    """
    At-risk and churned clients grouped by province with revenue impact.
    Columns: provincia_norm, macro_region, n_en_riesgo, n_tier_a,
             revenue_en_riesgo, lat, lon.
    """
    cli = gu.load_clientes()
    ven = gu.load_ventas()

    rev_per_client = (
        ven.groupby("cliente_id")["total_ars"]
        .sum()
        .reset_index()
        .rename(columns={"total_ars": "revenue_ars"})
    )

    at_risk = cli[cli["ciclo_vida"].isin(["Churned", "En Riesgo"])].copy()
    at_risk = at_risk.merge(rev_per_client, on="cliente_id", how="left")

    agg = (
        at_risk.groupby("provincia_norm")
        .agg(
            n_en_riesgo      =("cliente_id",   "count"),
            n_tier_a         =("tier_cliente",  lambda x: (x == "A").sum()),
            revenue_en_riesgo=("revenue_ars",   "sum"),
        )
        .reset_index()
    )
    agg["macro_region"] = agg["provincia_norm"].apply(gu.get_macro_region)
    return agg.merge(_centroid_df(), on="provincia_norm", how="left")

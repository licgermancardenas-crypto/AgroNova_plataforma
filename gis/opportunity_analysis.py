"""
AgroNova v2.0 — Opportunity Analysis
Opportunity Score: combines agricultural potential, revenue gap and AgroNova penetration.

Score 0-100. Higher = greater commercial opportunity (untapped market).
"""
from __future__ import annotations

import pandas as pd

from . import geo_utils as gu
from . import spatial_analysis as sa


def opportunity_score_by_province() -> pd.DataFrame:
    """
    Opportunity Score (0–100) per province.

    Formula:
      45 pts · agr_potential    = agr_ha_m / max_agr_ha          (normalized 0-1)
      30 pts · revenue_gap      = 1 – revenue_ars / max_rev       (low rev = big gap)
      15 pts · client_gap       = 1 – n_activos / max_activos     (few clients = opportunity)
      10 pts · share_gap        = 1 – penetracion_idx / max_pen   (low share = gap)

    Assumptions:
      - agr_ha_m as proxy for addressable market size (MAGyP/INDEC estimates).
      - revenue_gap captures sectors where AgroNova has low presence.
      - penetracion_idx = revenue / (agr_ha_m * 1e6): revenue per cultivable hectare.

    Interpretation:
      80-100 → Alta Oportunidad
      60-79  → Oportunidad Moderada
      40-59  → Oportunidad Baja
      0-39   → Mercado Maduro / Sin Potencial Agrícola
    """
    rev = sa.revenue_by_province()
    cli = gu.load_clientes()

    cli_agg = (
        cli.groupby("provincia_norm")
        .agg(n_activos=("activo", "sum"), n_total=("cliente_id", "count"))
        .reset_index()
    )

    rows = []
    for code, pdata in gu.PROVINCE_CATALOGUE.items():
        nombre = pdata["nombre"]
        norm   = gu.normalize_province(nombre)
        agr_ha = gu.PROVINCE_AGR_HA_M.get(nombre, 0.0)

        rev_row = rev[rev["provincia_norm"] == norm]
        revenue = float(rev_row["revenue_ars"].sum()) if not rev_row.empty else 0.0

        cli_row    = cli_agg[cli_agg["provincia_norm"] == norm]
        n_activos  = int(cli_row["n_activos"].sum()) if not cli_row.empty else 0
        n_total    = int(cli_row["n_total"].sum())   if not cli_row.empty else 0

        pen_idx = revenue / (agr_ha * 1_000_000) if agr_ha > 0 else 0.0

        rows.append({
            "provincia":       nombre,
            "macro_region":    gu.get_macro_region(nombre),
            "lat":             pdata["lat"],
            "lon":             pdata["lon"],
            "agr_ha_m":        agr_ha,
            "revenue_ars":     revenue,
            "n_activos":       n_activos,
            "n_total":         n_total,
            "penetracion_idx": round(pen_idx, 4),
        })

    df = pd.DataFrame(rows)

    max_agr     = df["agr_ha_m"].max()
    max_rev     = df["revenue_ars"].max()
    max_activos = df["n_activos"].max()
    max_pen     = df["penetracion_idx"].max()

    # Component scores (each 0-1)
    df["agr_potential"]  = (df["agr_ha_m"] / max(max_agr, 1e-6)).clip(0, 1)
    df["revenue_gap"]    = (1 - df["revenue_ars"] / max(max_rev, 1e-6)).clip(0, 1)
    df["client_gap"]     = (1 - df["n_activos"]   / max(max_activos, 1e-6)).clip(0, 1)
    df["share_gap"]      = (1 - df["penetracion_idx"] / max(max_pen, 1e-6)).clip(0, 1)

    # Provinces with zero agricultural area get a zero score (no opportunity)
    df["opportunity_score"] = df.apply(
        lambda r: round(
            r["agr_potential"] * 45 +
            r["revenue_gap"]   * 30 +
            r["client_gap"]    * 15 +
            r["share_gap"]     * 10,
            1
        ) if r["agr_ha_m"] > 0 else 0.0,
        axis=1,
    )

    df["opportunity_label"] = df["opportunity_score"].apply(
        lambda s: (
            "Alta Oportunidad"      if s >= 80 else
            "Oportunidad Moderada"  if s >= 60 else
            "Oportunidad Baja"      if s >= 40 else
            "Mercado Maduro"
        )
    )

    # Drop internal component columns for the output
    return (
        df.drop(columns=["agr_potential", "revenue_gap", "client_gap", "share_gap"])
        .sort_values("opportunity_score", ascending=False)
        .reset_index(drop=True)
    )


def market_penetration_index() -> pd.DataFrame:
    """
    Revenue per cultivable hectare (ARS / ha).
    High → AgroNova well penetrated.
    Low  → large untapped potential.
    """
    rev = sa.revenue_by_province()
    rows = []
    for code, pdata in gu.PROVINCE_CATALOGUE.items():
        nombre = pdata["nombre"]
        norm   = gu.normalize_province(nombre)
        agr_ha = gu.PROVINCE_AGR_HA_M.get(nombre, 0.0)
        if agr_ha == 0:
            continue
        rev_row = rev[rev["provincia_norm"] == norm]
        revenue = float(rev_row["revenue_ars"].sum()) if not rev_row.empty else 0.0
        rows.append({
            "provincia":    nombre,
            "macro_region": gu.get_macro_region(nombre),
            "agr_ha_m":     agr_ha,
            "revenue_ars":  revenue,
            "ars_per_ha":   round(revenue / (agr_ha * 1_000_000), 2),
        })
    df = pd.DataFrame(rows).sort_values("ars_per_ha", ascending=False).reset_index(drop=True)
    max_val = df["ars_per_ha"].max()
    df["penetration_pct"] = (df["ars_per_ha"] / max(max_val, 1e-6) * 100).round(1)
    return df

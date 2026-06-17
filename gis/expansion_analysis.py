"""
AgroNova v2.0 — Expansion Analysis
Expansion Index: classify provinces by expansion priority for AgroNova.

Priority: Alta / Media / Baja
"""
from __future__ import annotations

import pandas as pd

from . import geo_utils as gu
from .opportunity_analysis import opportunity_score_by_province

# Note: territorial_gap_analysis() in spatial_analysis.py divides by a near-zero
# penetracion_idx when revenue_ars == 0, producing gap_score values in the millions.
# This module computes its own bounded gap metric instead (0 .. agr_ha_m).

# Thresholds for priority classification
PENETRATION_FULL_ACTIVOS = 200.0   # n_activos at which a province is "fully penetrated"

# ── Alta ── high agricultural potential + low current penetration
ALTA_MIN_AGR_HA_M   = 1.0    # million cultivable hectares
ALTA_MIN_GAP_SCORE  = 1.0    # bounded gap (0 .. agr_ha_m)
ALTA_MAX_ACTIVOS    = 150    # few active clients

# ── Media ── moderate criteria
MEDIA_MIN_AGR_HA_M  = 0.3
MEDIA_MIN_GAP_SCORE = 0.3
MEDIA_MAX_ACTIVOS   = 300


def expansion_index_by_province() -> pd.DataFrame:
    """
    Expansion Index per province: classifies each as Alta / Media / Baja priority.

    gap_score (bounded, 0 .. agr_ha_m) = agr_ha_m × (1 – min(n_activos / 200, 1))
      → high agricultural potential with few active clients = high gap.

    Criteria:
      Alta  → agr_ha_m ≥ 1.0  AND  gap_score ≥ 1.0  AND  n_activos ≤ 150
      Media → agr_ha_m ≥ 0.3  AND  (gap_score ≥ 0.3 OR n_activos ≤ 300)
      Baja  → all others (mature or geographically constrained)

    Additional columns:
      expansion_score: composite 0-100 (opportunity_score × gap_weight)
      rationale:       human-readable explanation
    """
    opp = opportunity_score_by_province().set_index("provincia")
    cli = gu.load_clientes()

    cli_agg = (
        cli.groupby("provincia_norm")
        .agg(n_activos=("activo", "sum"))
        .reset_index()
        .set_index("provincia_norm")
    )

    rows = []
    for code, pdata in gu.PROVINCE_CATALOGUE.items():
        nombre = pdata["nombre"]
        norm   = gu.normalize_province(nombre)
        agr_ha = gu.PROVINCE_AGR_HA_M.get(nombre, 0.0)

        opp_score = float(opp.loc[nombre, "opportunity_score"]) if nombre in opp.index else 0.0
        n_activos = int(cli_agg.loc[norm, "n_activos"]) if norm in cli_agg.index else 0

        penetration = min(n_activos / PENETRATION_FULL_ACTIVOS, 1.0)
        gap_score   = round(agr_ha * (1.0 - penetration), 2)

        # Priority classification
        if (agr_ha >= ALTA_MIN_AGR_HA_M and
                gap_score >= ALTA_MIN_GAP_SCORE and
                n_activos <= ALTA_MAX_ACTIVOS):
            priority = "Alta"
        elif (agr_ha >= MEDIA_MIN_AGR_HA_M and
              (gap_score >= MEDIA_MIN_GAP_SCORE or n_activos <= MEDIA_MAX_ACTIVOS)):
            priority = "Media"
        else:
            priority = "Baja"

        expansion_score = round(opp_score * min(gap_score / max(agr_ha, 1e-6), 1.0), 1)

        if priority == "Alta":
            rationale = f"Alto potencial agrícola ({agr_ha}M ha), baja penetración (gap {gap_score:.2f}M ha sin cubrir)"
        elif priority == "Media":
            rationale = f"Potencial moderado ({agr_ha}M ha), expansión viable"
        else:
            rationale = "Mercado maduro o potencial agrícola bajo"

        rows.append({
            "provincia":        nombre,
            "macro_region":     gu.get_macro_region(nombre),
            "lat":              pdata["lat"],
            "lon":              pdata["lon"],
            "agr_ha_m":         agr_ha,
            "gap_score":        round(gap_score, 2),
            "opportunity_score": opp_score,
            "expansion_score":  expansion_score,
            "expansion_priority": priority,
            "n_activos":        n_activos,
            "rationale":        rationale,
        })

    df = pd.DataFrame(rows)

    # Sort: Alta first, then by expansion_score desc
    priority_order = {"Alta": 0, "Media": 1, "Baja": 2}
    df["_priority_order"] = df["expansion_priority"].map(priority_order)
    df = df.sort_values(["_priority_order", "expansion_score"], ascending=[True, False])
    return df.drop(columns=["_priority_order"]).reset_index(drop=True)


def summary_by_priority() -> pd.DataFrame:
    """Aggregate stats by expansion priority level."""
    df = expansion_index_by_province()
    return (
        df.groupby("expansion_priority")
        .agg(
            n_provincias    =("provincia",        "count"),
            agr_ha_m_total  =("agr_ha_m",         "sum"),
            avg_gap_score   =("gap_score",        "mean"),
            avg_opp_score   =("opportunity_score","mean"),
        )
        .round(2)
        .reset_index()
    )

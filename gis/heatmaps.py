"""
AgroNova v2.0 — Heatmap Data Generators
Produces Leaflet.heat-compatible point arrays and province-level choropleth data.
All coordinate output in WGS-84 [lat, lon] order.
"""
from __future__ import annotations

import random
from typing import Literal

import pandas as pd
from . import geo_utils as gu
from .spatial_analysis import (
    clients_by_province,
    revenue_by_province,
    revenue_by_province_year,
)

# Jitter radius in degrees (~20 km) to simulate intra-province spread
_JITTER_DEG = 0.18
_SEED       = 42

# Tier intensity weights for heatmap
_TIER_WEIGHT: dict[str, float] = {"A": 1.0, "B": 0.7, "C": 0.4, "D": 0.2}


def _jitter(lat: float, lon: float, seed_offset: int = 0) -> tuple[float, float]:
    rng = random.Random(_SEED + seed_offset)
    return (
        lat + rng.uniform(-_JITTER_DEG, _JITTER_DEG),
        lon + rng.uniform(-_JITTER_DEG, _JITTER_DEG),
    )


# ---------------------------------------------------------------------------
# Client heatmap (point-cloud for Leaflet.heat)
# ---------------------------------------------------------------------------

def client_heatmap(
    tier_filter: list[str] | None = None,
    only_active: bool = False,
) -> list[list[float]]:
    """
    Return [lat, lon, intensity] rows for Leaflet.heat plugin.
    Each row represents one client placed at province centroid + random jitter.

    Args:
        tier_filter: e.g. ['A', 'B'] to show only high-value clients.
        only_active: exclude churned clients when True.

    Returns:
        List of [lat, lon, intensity] where intensity ∈ [0, 1].
    """
    clients = gu.load_clientes()
    if tier_filter:
        clients = clients[clients["tier_cliente"].isin(tier_filter)]
    if only_active:
        clients = clients[clients["activo"] == 1]

    points: list[list[float]] = []
    for i, (_, cli) in enumerate(clients.iterrows()):
        centroid = gu.province_centroid(cli["provincia"])
        if centroid is None:
            continue
        lat, lon   = _jitter(centroid[0], centroid[1], seed_offset=i)
        intensity  = _TIER_WEIGHT.get(cli.get("tier_cliente", "D"), 0.2)
        points.append([round(lat, 5), round(lon, 5), intensity])
    return points


def surface_weighted_heatmap() -> list[list[float]]:
    """
    Heatmap where each client point intensity is proportional to
    its cultivated surface area (superficie_ha) — reflects commercial weight.
    """
    clients = gu.load_clientes()
    max_ha  = clients["superficie_ha"].max() or 1.0

    points: list[list[float]] = []
    for i, (_, cli) in enumerate(clients.iterrows()):
        centroid = gu.province_centroid(cli["provincia"])
        if centroid is None:
            continue
        lat, lon  = _jitter(centroid[0], centroid[1], seed_offset=i)
        intensity = round(float(cli.get("superficie_ha", 0) or 0) / max_ha, 4)
        if intensity > 0:
            points.append([round(lat, 5), round(lon, 5), intensity])
    return points


# ---------------------------------------------------------------------------
# Revenue choropleth (province-level)
# ---------------------------------------------------------------------------

def revenue_heatmap(
    anio: int | None = None,
    normalize: bool = True,
) -> list[dict]:
    """
    Province-level revenue data for choropleth rendering.

    Returns list of dicts: {provincia, lat, lon, revenue_ars, macro_region, intensity}.
    intensity is revenue normalized to [0, 1] relative to the highest province.
    """
    df = revenue_by_province(anio=anio).dropna(subset=["lat", "lon"])
    if normalize and not df.empty:
        max_rev       = df["revenue_ars"].max()
        df["intensity"] = (df["revenue_ars"] / max_rev).round(4)
    else:
        df["intensity"] = 1.0

    return df[["provincia_norm", "lat", "lon", "revenue_ars", "macro_region", "intensity"]].to_dict("records")


def client_density_heatmap() -> list[dict]:
    """
    Client density: active clients per million cultivable hectares, by province.
    Useful for identifying under-served high-potential territories.
    """
    df = clients_by_province().dropna(subset=["lat", "lon"])
    df["density_per_mha"] = (
        df["n_activos"] / df["agr_ha_m"].replace(0, float("nan"))
    ).round(2)
    return (
        df[["provincia_norm", "macro_region", "lat", "lon",
            "n_activos", "agr_ha_m", "density_per_mha"]]
        .dropna(subset=["density_per_mha"])
        .to_dict("records")
    )


# ---------------------------------------------------------------------------
# Temporal animation (2016–2026)
# ---------------------------------------------------------------------------

def temporal_heatmap_series(
    metric: Literal["revenue", "clients"] = "revenue",
) -> dict[int, list[dict]]:
    """
    Annual heatmap frames for slider animation (2016–2026).

    Args:
        metric: 'revenue' or 'clients'.

    Returns:
        Dict keyed by year → list of {provincia, lat, lon, value, intensity}.
    """
    df = revenue_by_province_year().dropna(subset=["lat", "lon"])

    result: dict[int, list[dict]] = {}
    for anio, grp in df.groupby("anio"):
        col   = "revenue_ars" if metric == "revenue" else "n_clientes"
        max_v = grp[col].max() if not grp.empty else 1
        frames = [
            {
                "provincia": row["provincia_norm"],
                "lat":       float(row["lat"]),
                "lon":       float(row["lon"]),
                "value":     float(row[col]),
                "intensity": round(float(row[col]) / max_v, 4) if max_v > 0 else 0,
            }
            for _, row in grp.iterrows()
            if row[col] > 0
        ]
        result[int(anio)] = frames
    return result


# ---------------------------------------------------------------------------
# Logística heatmap
# ---------------------------------------------------------------------------

def logistics_delay_heatmap() -> list[dict]:
    """
    Average delivery delay per destination province centroid.
    Maps to destination region_id and enriches with region centroid.
    """
    log = gu.load_logistica()
    reg = gu.load_regiones()[["region_id", "nombre_region", "provincia_principal"]]
    df  = log.merge(reg, left_on="region_destino_id", right_on="region_id", how="left")

    agg = (
        df.groupby(["region_destino_id", "nombre_region", "provincia_principal"])
        .agg(
            avg_demora     =("dias_demora",    "mean"),
            pct_con_demora =("dias_demora",    lambda x: (x > 0).mean() * 100),
            otif_pct       =("otif",           lambda x: x.mean() * 100),
            n_envios       =("logistica_id",   "count"),
        )
        .reset_index()
    )
    agg["avg_demora"]      = agg["avg_demora"].round(2)
    agg["pct_con_demora"]  = agg["pct_con_demora"].round(1)
    agg["otif_pct"]        = agg["otif_pct"].round(1)

    # Attach centroids via primary province of the region
    def _centroid(prov_str: str) -> tuple[float | None, float | None]:
        first_prov = prov_str.split(",")[0].strip()
        c = gu.province_centroid(first_prov)
        return (c[0], c[1]) if c else (None, None)

    agg[["lat", "lon"]] = agg["provincia_principal"].apply(
        lambda p: pd.Series(_centroid(p))
    )
    return agg.dropna(subset=["lat", "lon"]).to_dict("records")

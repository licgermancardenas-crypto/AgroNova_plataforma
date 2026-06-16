"""
AgroNova v2.0 — Coverage Analysis
Sucursal radius coverage, gap detection, client-to-sucursal assignment.
"""
from __future__ import annotations

import math
import pandas as pd
from . import geo_utils as gu

# Default coverage radii (km) per sucursal — calibrated to PAM density
DEFAULT_RADII: dict[int, float] = {
    1: 400.0,  # Rosario   — PAM núcleo, densidad alta
    2: 350.0,  # Pergamino — Pampa Norte
    3: 300.0,  # Tandil    — Pampa Sur, densidad media
    4: 350.0,  # Río Cuarto — Centro Oeste
    5: 450.0,  # Paraná    — Mesopotamia, territorio amplio
}


def _sucursales() -> list[dict]:
    return gu.load_sucursales().to_dict("records")


# ---------------------------------------------------------------------------
# Sucursal-level coverage
# ---------------------------------------------------------------------------

def coverage_by_sucursal(radii: dict[int, float] | None = None) -> pd.DataFrame:
    """
    For each sucursal, list provinces within its coverage radius and
    approximate the covered area.

    Returns DataFrame: sucursal_id, nombre, lat, lon, radius_km,
                       provincias_in_radius, n_provincias, km2_covered_approx.
    """
    if radii is None:
        radii = DEFAULT_RADII

    rows = []
    for suc in _sucursales():
        sid   = suc["sucursal_id"]
        r_km  = radii.get(sid, 400.0)
        provs = [
            d["nombre"]
            for d in gu.PROVINCE_CATALOGUE.values()
            if gu.haversine_km(suc["lat"], suc["lon"], d["lat"], d["lon"]) <= r_km
        ]
        rows.append({
            "sucursal_id":           sid,
            "nombre":                suc["nombre"],
            "provincia_sucursal":    suc["provincia"],
            "lat":                   suc["lat"],
            "lon":                   suc["lon"],
            "radius_km":             r_km,
            "provincias_in_radius":  provs,
            "n_provincias":          len(provs),
            "km2_covered_approx":    round(math.pi * r_km ** 2, 0),
        })
    return pd.DataFrame(rows)


def nearest_sucursal(lat: float, lon: float) -> dict:
    """Return the closest sucursal to a given WGS-84 point."""
    best, best_dist = None, float("inf")
    for suc in _sucursales():
        dist = gu.haversine_km(lat, lon, suc["lat"], suc["lon"])
        if dist < best_dist:
            best_dist = dist
            best = {**suc, "distance_km": round(dist, 1)}
    return best  # type: ignore[return-value]


# ---------------------------------------------------------------------------
# Client-level coverage
# ---------------------------------------------------------------------------

def client_coverage_analysis(radii: dict[int, float] | None = None) -> pd.DataFrame:
    """
    Assign each client to its nearest sucursal and flag coverage gaps.

    Returns DataFrame: cliente_id, provincia, macro_region, tier_cliente,
                       nearest_sucursal_id, distance_km, in_coverage, coverage_gap.
    """
    if radii is None:
        radii = DEFAULT_RADII

    clientes   = gu.load_clientes()
    sucursales = _sucursales()
    rows = []

    for _, cli in clientes.iterrows():
        centroid = gu.province_centroid(cli["provincia"])
        if centroid is None:
            continue
        lat, lon = centroid

        best_id, best_dist = -1, float("inf")
        for suc in sucursales:
            dist = gu.haversine_km(lat, lon, suc["lat"], suc["lon"])
            if dist < best_dist:
                best_dist = dist
                best_id   = suc["sucursal_id"]

        rows.append({
            "cliente_id":          cli["cliente_id"],
            "provincia":           cli["provincia"],
            "macro_region":        cli.get("macro_region", "OTHER"),
            "tier_cliente":        cli.get("tier_cliente"),
            "activo":              cli.get("activo"),
            "nearest_sucursal_id": best_id,
            "distance_km":         round(best_dist, 1),
            "in_coverage":         best_dist <= radii.get(best_id, 400.0),
            "coverage_gap":        best_dist >  radii.get(best_id, 400.0),
        })

    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------
# Gap analysis
# ---------------------------------------------------------------------------

def coverage_gap_provinces() -> list[dict]:
    """
    Provinces with agricultural potential but zero active AgroNova clients.
    Sorted by agricultural area (proxy for market opportunity).
    """
    clientes     = gu.load_clientes()
    active_provs = set(clientes.loc[clientes["activo"] == 1, "provincia_norm"].unique())

    return sorted(
        [
            {
                "provincia":    d["nombre"],
                "macro_region": gu.MACRO_REGION.get(d["nombre"], "OTHER"),
                "lat":          d["lat"],
                "lon":          d["lon"],
                "agr_ha_m":     gu.PROVINCE_AGR_HA_M.get(d["nombre"], 0),
                "oportunidad":  "Alta" if gu.PROVINCE_AGR_HA_M.get(d["nombre"], 0) > 2.0 else "Media",
            }
            for d in gu.PROVINCE_CATALOGUE.values()
            if d["nombre"] not in active_provs and gu.PROVINCE_AGR_HA_M.get(d["nombre"], 0) > 0.1
        ],
        key=lambda x: x["agr_ha_m"],
        reverse=True,
    )


def sucursal_client_stats() -> pd.DataFrame:
    """
    Aggregate client stats per sucursal: counts, tiers, active ratio, surface area.
    """
    cli = gu.load_clientes()
    grp = cli.groupby("sucursal_id_asignada")

    stats = pd.DataFrame({
        "n_clientes":         grp.size(),
        "n_activos":          grp["activo"].sum(),
        "tier_a":             grp.apply(lambda x: (x["tier_cliente"] == "A").sum()),
        "tier_b":             grp.apply(lambda x: (x["tier_cliente"] == "B").sum()),
        "tier_c":             grp.apply(lambda x: (x["tier_cliente"] == "C").sum()),
        "superficie_ha_total": grp["superficie_ha"].sum(),
    }).reset_index().rename(columns={"sucursal_id_asignada": "sucursal_id"})

    stats["pct_activos"] = (stats["n_activos"] / stats["n_clientes"] * 100).round(1)
    return stats


def overlap_analysis(radii: dict[int, float] | None = None) -> pd.DataFrame:
    """
    Detect provinces covered by more than one sucursal radius (overlap zones).
    Overlap may indicate territory conflicts or redundant coverage.
    """
    if radii is None:
        radii = DEFAULT_RADII

    sucursales = _sucursales()
    rows = []
    for code, pdata in gu.PROVINCE_CATALOGUE.items():
        covering = [
            suc["sucursal_id"]
            for suc in sucursales
            if gu.haversine_km(pdata["lat"], pdata["lon"], suc["lat"], suc["lon"])
               <= radii.get(suc["sucursal_id"], 400.0)
        ]
        if len(covering) > 1:
            rows.append({
                "provincia":          pdata["nombre"],
                "lat":                pdata["lat"],
                "lon":                pdata["lon"],
                "sucursales_cubriendo": covering,
                "n_overlap":          len(covering),
            })
    return pd.DataFrame(rows)

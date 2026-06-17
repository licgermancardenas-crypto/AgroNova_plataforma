"""
AgroNova v2.0 — Territorial Clustering
KMeans clustering over province centroids to detect commercial clusters,
isolated zones, and candidate cities for network expansion.
"""
from __future__ import annotations

import pandas as pd
from sklearn.cluster import KMeans

from . import geo_utils as gu
from .geo_utils import PROVINCE_CAPITAL
from .network_analysis import _sucursales
from .expansion_analysis import expansion_index_by_province

N_CLUSTERS = 5
RANDOM_STATE = 42


def _nearest_sucursal_km(lat: float, lon: float) -> float:
    sucursales = _sucursales()
    return min(gu.haversine_km(lat, lon, s["lat"], s["lon"]) for s in sucursales)


def territorial_clusters() -> list[dict]:
    """
    KMeans (k=5) over the 24 province centroids (lat/lon), enriched with
    commercial presence (n_activos) and agricultural potential (agr_ha_m).

    Cluster label:
      "Cluster Comercial Activo"        — has active clients
      "Zona Aislada de Alto Potencial"  — no clients, combined agr_ha_m >= 3.0M ha
      "Zona Periférica de Bajo Potencial" — no clients, low agro potential

    Caveat: clustering operates on province centroids (24 points), not on
    individual client coordinates — Dim_Cliente.csv has no per-client lat/lon.
    """
    cli = gu.load_clientes()
    activos_por_prov = cli.groupby("provincia_norm")["activo"].sum().to_dict()

    provincias = list(gu.PROVINCE_CATALOGUE.values())
    coords = [[p["lat"], p["lon"]] for p in provincias]

    km = KMeans(n_clusters=N_CLUSTERS, random_state=RANDOM_STATE, n_init=10)
    labels = km.fit_predict(coords)

    clusters: dict[int, list[dict]] = {}
    for p, label in zip(provincias, labels):
        clusters.setdefault(int(label), []).append(p)

    out = []
    for cluster_id, provs in clusters.items():
        n_activos_total = sum(int(activos_por_prov.get(p["nombre"], 0)) for p in provs)
        agr_ha_total = sum(gu.PROVINCE_AGR_HA_M.get(p["nombre"], 0) for p in provs)
        center_lat = sum(p["lat"] for p in provs) / len(provs)
        center_lon = sum(p["lon"] for p in provs) / len(provs)
        avg_dist = sum(_nearest_sucursal_km(p["lat"], p["lon"]) for p in provs) / len(provs)

        if n_activos_total > 0:
            label_txt = "Cluster Comercial Activo"
        elif agr_ha_total >= 3.0:
            label_txt = "Zona Aislada de Alto Potencial"
        else:
            label_txt = "Zona Periférica de Bajo Potencial"

        out.append({
            "cluster_id":        cluster_id,
            "label":             label_txt,
            "provincias":        [p["nombre"] for p in provs],
            "n_provincias":      len(provs),
            "center_lat":        round(center_lat, 4),
            "center_lon":        round(center_lon, 4),
            "n_activos_total":   n_activos_total,
            "agr_ha_m_total":    round(agr_ha_total, 2),
            "avg_dist_sucursal_km": round(avg_dist, 1),
        })

    return sorted(out, key=lambda c: c["n_activos_total"], reverse=True)


def expansion_recommendations(top_n: int = 5) -> list[dict]:
    """
    Candidate cities for network expansion: the top-N "Alta prioridad"
    provinces from the Expansion Index (Sprint GIS-02), each mapped to its
    capital/principal city and justified with agro potential, opportunity
    score, gap score and distance to the nearest existing sucursal.
    """
    expansion = expansion_index_by_province()
    clusters  = territorial_clusters()
    prov_to_cluster = {
        p: c["label"] for c in clusters for p in c["provincias"]
    }

    candidates = (
        expansion[expansion["expansion_priority"] == "Alta"]
        .sort_values("expansion_score", ascending=False)
        .head(top_n)
    )

    recommendations = []
    for _, row in candidates.iterrows():
        provincia = row["provincia"]
        ciudad = PROVINCE_CAPITAL.get(provincia, provincia)
        dist_km = round(_nearest_sucursal_km(row["lat"], row["lon"]), 1)
        cluster_label = prov_to_cluster.get(provincia, "Sin Cluster")

        recommendations.append({
            "provincia":          provincia,
            "ciudad_candidata":   ciudad,
            "macro_region":       row["macro_region"],
            "lat":                row["lat"],
            "lon":                row["lon"],
            "agr_ha_m":           row["agr_ha_m"],
            "opportunity_score":  row["opportunity_score"],
            "gap_score":          row["gap_score"],
            "expansion_score":    row["expansion_score"],
            "dist_sucursal_mas_cercana_km": dist_km,
            "cluster":            cluster_label,
            "justificacion": (
                f"{ciudad} ({provincia}): {row['agr_ha_m']:.1f}M ha de potencial agrícola, "
                f"0 clientes activos, opportunity score {row['opportunity_score']:.1f}/100, "
                f"a {dist_km:.0f} km de la sucursal más cercana. "
                f"Pertenece a '{cluster_label}'."
            ),
        })

    return recommendations

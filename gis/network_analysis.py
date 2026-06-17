"""
AgroNova v2.0 — Network Analysis
Distance matrix and nearest-branch assignment across the commercial network.

Data limitation: Dim_Cliente.csv has no per-client lat/lon (only provincia/ciudad,
and "ciudad" is a synthetic label reused identically across provinces — not a real
geocode). Every client distance is therefore computed from its province centroid,
the same proxy used in Sprint GIS-02 (coverage_score.min_dist_suc_km). This means
all clients within a province share an identical distance to each sucursal/depósito.
"""
from __future__ import annotations

import pandas as pd

from . import geo_utils as gu

# Only 3 of the 5 sucursales have a depósito (Rosario, Pergamino, Río Cuarto).
DEPOSITO_SUCURSAL_MAP: dict[int, int] = {1: 1, 2: 2, 3: 4}


def _sucursales() -> list[dict]:
    return gu.load_sucursales().to_dict("records")


def _depositos() -> list[dict]:
    return gu.load_depositos().to_dict("records")


def _provincias_activas() -> list[dict]:
    """Provinces with real client presence (the 5 commercially active provinces)."""
    cli = gu.load_clientes()
    active_norms = set(cli["provincia_norm"].unique())
    return [d for d in gu.PROVINCE_CATALOGUE.values() if d["nombre"] in active_norms]


def distance_matrix() -> dict:
    """
    Haversine distance matrix (km) across the three network legs:
      provincia (cliente proxy) ↔ sucursal
      provincia (cliente proxy) ↔ depósito
      depósito  ↔ sucursal

    Only the 5 commercially active provinces are included (the other 19 have
    zero clients — see expansion_targets.json from Sprint GIS-02 for those).
    """
    sucursales = _sucursales()
    depositos  = _depositos()
    provincias = _provincias_activas()

    provincia_sucursal = [
        {
            "provincia":   p["nombre"],
            "sucursal_id": s["sucursal_id"],
            "sucursal":    s["nombre"],
            "distance_km": round(gu.haversine_km(p["lat"], p["lon"], s["lat"], s["lon"]), 1),
        }
        for p in provincias for s in sucursales
    ]

    provincia_deposito = [
        {
            "provincia":   p["nombre"],
            "deposito_id": d["deposito_id"],
            "deposito":    d["nombre"],
            "distance_km": round(gu.haversine_km(p["lat"], p["lon"], d["lat"], d["lon"]), 1),
        }
        for p in provincias for d in depositos
    ]

    deposito_sucursal = [
        {
            "deposito_id": d["deposito_id"],
            "deposito":    d["nombre"],
            "sucursal_id": s["sucursal_id"],
            "sucursal":    s["nombre"],
            "distance_km": round(gu.haversine_km(d["lat"], d["lon"], s["lat"], s["lon"]), 1),
        }
        for d in depositos for s in sucursales
    ]

    return {
        "provincia_sucursal": provincia_sucursal,
        "provincia_deposito": provincia_deposito,
        "deposito_sucursal":  deposito_sucursal,
    }


def nearest_branch_assignment() -> dict:
    """
    Assigns each commercially active province (cliente proxy) to its nearest
    sucursal and nearest depósito, then aggregates: clientes por sucursal/depósito,
    km promedio, distancia máxima.

    Each by_sucursal row also carries n_clientes_real (the actual count from
    Dim_Cliente.sucursal_id_asignada). The two numbers regularly diverge: a
    province's geographic centroid can be closer to a sucursal in a neighboring
    province than to the sucursal located inside its own borders (e.g. the
    Buenos Aires centroid sits 145 km from Tandil vs. 310 km from Pergamino,
    even though Pergamino serves real BA clients) — see distance_km cross-checks
    in docs/geospatial/network_intelligence.md. This gap is itself a useful
    signal: large divergence flags that pure-distance assignment does not match
    AgroNova's actual commercial territory split.
    """
    cli = gu.load_clientes()
    sucursales = _sucursales()
    depositos  = _depositos()

    real_counts = cli.groupby("sucursal_id_asignada")["cliente_id"].count().to_dict()
    prov_counts = cli.groupby("provincia_norm")["cliente_id"].count().to_dict()

    by_sucursal: dict[int, dict] = {
        s["sucursal_id"]: {"sucursal_id": s["sucursal_id"], "nombre": s["nombre"],
                            "n_clientes": 0, "distances": []}
        for s in sucursales
    }
    by_deposito: dict[int, dict] = {
        d["deposito_id"]: {"deposito_id": d["deposito_id"], "nombre": d["nombre"],
                            "n_clientes": 0, "distances": []}
        for d in depositos
    }

    for p in _provincias_activas():
        n_clientes = int(prov_counts.get(p["nombre"], 0))
        if n_clientes == 0:
            continue

        nearest_suc = min(sucursales, key=lambda s: gu.haversine_km(p["lat"], p["lon"], s["lat"], s["lon"]))
        dist_suc = gu.haversine_km(p["lat"], p["lon"], nearest_suc["lat"], nearest_suc["lon"])
        by_sucursal[nearest_suc["sucursal_id"]]["n_clientes"] += n_clientes
        by_sucursal[nearest_suc["sucursal_id"]]["distances"].extend([dist_suc] * n_clientes)

        nearest_dep = min(depositos, key=lambda d: gu.haversine_km(p["lat"], p["lon"], d["lat"], d["lon"]))
        dist_dep = gu.haversine_km(p["lat"], p["lon"], nearest_dep["lat"], nearest_dep["lon"])
        by_deposito[nearest_dep["deposito_id"]]["n_clientes"] += n_clientes
        by_deposito[nearest_dep["deposito_id"]]["distances"].extend([dist_dep] * n_clientes)

    def _finalize(rows: dict[int, dict]) -> list[dict]:
        out = []
        for row in rows.values():
            dists = row.pop("distances")
            row["km_promedio"] = round(sum(dists) / len(dists), 1) if dists else 0.0
            row["km_maximo"]   = round(max(dists), 1) if dists else 0.0
            out.append(row)
        return sorted(out, key=lambda r: r["n_clientes"], reverse=True)

    by_sucursal_rows = _finalize(by_sucursal)
    for row in by_sucursal_rows:
        row["n_clientes_real"] = int(real_counts.get(row["sucursal_id"], 0))

    return {
        "by_sucursal": by_sucursal_rows,
        "by_deposito": _finalize(by_deposito),
    }

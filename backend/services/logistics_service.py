"""
costs/risk read GIS-06's pre-generated outputs (gis/generate_analytics.py).
routes calls gis.routing_engine.cliente_routing_assignment() live — it's a
pure pandas computation over the (small) client/branch/depot tables, not
wired into generate_analytics.py's output files, so there's nothing to read
from disk for it.

DB variants (get_*_from_db) replace CSV/JSON reads with SQLAlchemy queries
while keeping the same haversine routing logic and JSON response shape.
"""
from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from sqlalchemy.orm import Session  # noqa: E402

from gis.routing_engine import cliente_routing_assignment  # noqa: E402
import gis.geo_utils as gu  # noqa: E402
from gis.cost_model import AVG_SPEED_KMH  # noqa: E402

from backend.repositories.logistica_repository import LogisticaRepository  # noqa: E402
from backend.repositories.routing_repository import RoutingRepository  # noqa: E402
from backend.services.gis_service import _read_json  # noqa: E402
from backend.core.config import get_settings

settings = get_settings()


# ---------------------------------------------------------------------------
# CSV / JSON reads (existing, unchanged)
# ---------------------------------------------------------------------------

def get_routes() -> dict:
    return cliente_routing_assignment()


def get_risk() -> dict:
    return _read_json(settings.gis_outputs_dir / "route_risk.json")


def get_costs() -> dict:
    return _read_json(settings.gis_outputs_dir / "transport_costs.json")


# ---------------------------------------------------------------------------
# DB-backed variants
# ---------------------------------------------------------------------------

def get_risk_from_db(db: Session) -> dict:
    lr = LogisticaRepository(db)
    return {
        "by_deposito": lr.risk_by_deposito(),
        "by_tipo_envio": lr.risk_by_tipo_envio(),
    }


def _haversine_assignment(
    prov_counts: dict[str, int],
    sucursales: list[dict],
    depositos: list[dict],
) -> tuple[dict[int, dict], dict[int, dict], list[dict]]:
    """Assign each active province to its nearest sucursal and deposito.

    Returns (by_suc_agg, by_dep_agg, active_provinces) where the *_agg
    dicts accumulate n_clientes and a list of per-client distances.
    """
    by_suc: dict[int, dict] = {
        s["sucursal_id"]: {
            "sucursal_id": s["sucursal_id"], "nombre": s["nombre"],
            "lat": s["lat"], "lon": s["lon"],
            "n_clientes": 0, "distances": [],
        }
        for s in sucursales
    }
    by_dep: dict[int, dict] = {
        d["deposito_id"]: {
            "deposito_id": d["deposito_id"], "nombre": d["nombre"],
            "lat": d["lat"], "lon": d["lon"],
            "n_clientes": 0, "distances": [],
        }
        for d in depositos
    }
    active_provinces: list[dict] = []

    for prov_name, n in prov_counts.items():
        centroid = gu.province_centroid(prov_name)
        if centroid is None or n == 0:
            continue
        lat, lon = centroid
        active_provinces.append({"nombre": prov_name, "lat": lat, "lon": lon})

        nearest_suc = min(sucursales, key=lambda s: gu.haversine_km(lat, lon, s["lat"], s["lon"]))
        dist_suc = gu.haversine_km(lat, lon, nearest_suc["lat"], nearest_suc["lon"])
        by_suc[nearest_suc["sucursal_id"]]["n_clientes"] += n
        by_suc[nearest_suc["sucursal_id"]]["distances"].extend([dist_suc] * n)

        nearest_dep = min(depositos, key=lambda d: gu.haversine_km(lat, lon, d["lat"], d["lon"]))
        dist_dep = gu.haversine_km(lat, lon, nearest_dep["lat"], nearest_dep["lon"])
        by_dep[nearest_dep["deposito_id"]]["n_clientes"] += n
        by_dep[nearest_dep["deposito_id"]]["distances"].extend([dist_dep] * n)

    return by_suc, by_dep, active_provinces


def get_costs_from_db(db: Session) -> dict:
    lr = LogisticaRepository(db)
    rr = RoutingRepository(db)

    cost_per_kg, avg_peso = lr.global_metrics()
    costo_estimado = round(avg_peso * cost_per_kg, 1)

    sucursales = rr.sucursales()
    depositos = rr.depositos()
    prov_counts = rr.provincia_counts()

    by_suc_agg, by_dep_agg, _ = _haversine_assignment(prov_counts, sucursales, depositos)

    by_sucursal = []
    for row in sorted(by_suc_agg.values(), key=lambda r: r["n_clientes"], reverse=True):
        dists = row["distances"]
        km = round(sum(dists) / len(dists), 1) if dists else 0.0
        by_sucursal.append({
            "sucursal_id": row["sucursal_id"],
            "nombre": row["nombre"],
            "n_clientes": row["n_clientes"],
            "distancia_km": km,
            "peso_kg_envio_prom": avg_peso,
            "costo_estimado_ars": costo_estimado,
            "tiempo_estimado_horas": round(km / AVG_SPEED_KMH, 1),
        })

    by_deposito = []
    for row in sorted(by_dep_agg.values(), key=lambda r: r["n_clientes"], reverse=True):
        dists = row["distances"]
        km = round(sum(dists) / len(dists), 1) if dists else 0.0
        by_deposito.append({
            "deposito_id": row["deposito_id"],
            "nombre": row["nombre"],
            "n_clientes": row["n_clientes"],
            "distancia_km": km,
            "peso_kg_envio_prom": avg_peso,
            "costo_estimado_ars": costo_estimado,
            "tiempo_estimado_horas": round(km / AVG_SPEED_KMH, 1),
        })

    return {
        "cost_per_kg_ars": cost_per_kg,
        "avg_speed_kmh": AVG_SPEED_KMH,
        "by_sucursal": by_sucursal,
        "by_deposito": by_deposito,
    }


def get_routes_from_db(db: Session) -> dict:
    rr = RoutingRepository(db)

    sucursales = rr.sucursales()
    depositos = rr.depositos()
    prov_counts = rr.provincia_counts()
    real_counts = rr.sucursal_real_counts()

    by_suc_agg, by_dep_agg, active_provinces = _haversine_assignment(
        prov_counts, sucursales, depositos
    )

    by_suc_rows = []
    for row in sorted(by_suc_agg.values(), key=lambda r: r["n_clientes"], reverse=True):
        dists = row["distances"]
        km = round(sum(dists) / len(dists), 1) if dists else 0.0
        by_suc_rows.append({
            "sucursal_id": row["sucursal_id"],
            "nombre": row["nombre"],
            "n_clientes": row["n_clientes"],
            "n_clientes_real": int(real_counts.get(row["sucursal_id"], 0)),
            "km_promedio": km,
            "km_maximo": round(max(dists), 1) if dists else 0.0,
            "tiempo_estimado_horas": round(km / AVG_SPEED_KMH, 1),
        })

    by_dep_rows = []
    for row in sorted(by_dep_agg.values(), key=lambda r: r["n_clientes"], reverse=True):
        dists = row["distances"]
        km = round(sum(dists) / len(dists), 1) if dists else 0.0
        by_dep_rows.append({
            "deposito_id": row["deposito_id"],
            "nombre": row["nombre"],
            "n_clientes": row["n_clientes"],
            "km_promedio": km,
            "km_maximo": round(max(dists), 1) if dists else 0.0,
            "tiempo_estimado_horas": round(km / AVG_SPEED_KMH, 1),
        })

    by_provincia = []
    for p in active_provinces:
        nearest_suc = min(sucursales, key=lambda s: gu.haversine_km(p["lat"], p["lon"], s["lat"], s["lon"]))
        dist_suc = gu.haversine_km(p["lat"], p["lon"], nearest_suc["lat"], nearest_suc["lon"])
        nearest_dep = min(depositos, key=lambda d: gu.haversine_km(p["lat"], p["lon"], d["lat"], d["lon"]))
        dist_dep = gu.haversine_km(p["lat"], p["lon"], nearest_dep["lat"], nearest_dep["lon"])
        by_provincia.append({
            "provincia": p["nombre"],
            "sucursal_mas_cercana_id": nearest_suc["sucursal_id"],
            "sucursal_mas_cercana": nearest_suc["nombre"],
            "distancia_sucursal_km": round(dist_suc, 1),
            "tiempo_sucursal_horas": round(dist_suc / AVG_SPEED_KMH, 1),
            "deposito_mas_cercano_id": nearest_dep["deposito_id"],
            "deposito_mas_cercano": nearest_dep["nombre"],
            "distancia_deposito_km": round(dist_dep, 1),
            "tiempo_deposito_horas": round(dist_dep / AVG_SPEED_KMH, 1),
        })

    return {
        "by_sucursal": by_suc_rows,
        "by_deposito": by_dep_rows,
        "by_provincia": by_provincia,
    }

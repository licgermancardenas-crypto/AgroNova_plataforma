from __future__ import annotations

import json
import math
from pathlib import Path

from sqlalchemy.orm import Session

from backend.repositories.logistica_repository import LogisticaRepository
from backend.repositories.routing_repository import RoutingRepository

_GIS_DIR = Path(__file__).resolve().parents[2] / "data" / "gis_outputs"
_SPEED_KMH = 80.0
_COST_PER_KM_ARS = 450.0


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def _load_json(name: str) -> list | dict:
    try:
        with open(_GIS_DIR / name) as f:
            return json.load(f)
    except Exception:
        return []


_PROVINCE_COORDS: dict[str, tuple[float, float]] = {
    "Buenos Aires": (-34.61, -58.37),
    "Córdoba": (-31.41, -64.18),
    "Santa Fe": (-31.63, -60.70),
    "Mendoza": (-32.89, -68.84),
    "Entre Ríos": (-31.73, -60.52),
    "Tucumán": (-26.82, -65.22),
    "Salta": (-24.78, -65.41),
    "Chaco": (-27.45, -59.00),
    "Misiones": (-27.36, -55.90),
    "Corrientes": (-27.47, -58.83),
    "Santiago del Estero": (-27.79, -64.26),
    "San Juan": (-31.53, -68.52),
    "Jujuy": (-24.18, -65.30),
    "Río Negro": (-41.13, -71.30),
    "Neuquén": (-38.95, -68.06),
    "Formosa": (-26.18, -58.17),
    "Chubut": (-43.29, -65.11),
    "San Luis": (-33.30, -66.34),
    "Catamarca": (-28.47, -65.78),
    "La Rioja": (-29.41, -66.85),
    "La Pampa": (-36.62, -64.29),
    "Santa Cruz": (-51.62, -69.22),
    "Tierra del Fuego": (-54.80, -68.30),
}


def _nearest_sucursal(lat: float, lon: float, sucursales: list[dict]) -> dict | None:
    if not sucursales:
        return None
    best = min(
        (s for s in sucursales if s.get("lat") and s.get("lon")),
        key=lambda s: _haversine(lat, lon, s["lat"], s["lon"]),
        default=None,
    )
    return best


def _nearest_deposito(lat: float, lon: float, depositos: list[dict]) -> dict | None:
    if not depositos:
        return None
    best = min(
        (d for d in depositos if d.get("lat") and d.get("lon")),
        key=lambda d: _haversine(lat, lon, d["lat"], d["lon"]),
        default=None,
    )
    return best


def get_routes(db: Session | None) -> dict:
    if db is None:
        return _load_json("routes.json") or {}
    try:
        r_repo = RoutingRepository(db)
        sucursales = r_repo.sucursales()
        depositos = r_repo.depositos()
        prov_counts = r_repo.provincia_counts()
        suc_real_counts = r_repo.sucursal_real_counts()

        by_sucursal = []
        for s in sucursales:
            lat, lon = s["lat"], s["lon"]
            if not lat:
                continue
            clientes_prov = [
                (prov, cnt) for prov, cnt in prov_counts.items()
                if prov == s["provincia"]
            ]
            n_clients = suc_real_counts.get(s["sucursal_id"], sum(c for _, c in clientes_prov))
            if not n_clients:
                continue
            dists = [
                _haversine(lat, lon, *_PROVINCE_COORDS[p])
                for p, _ in clientes_prov
                if p in _PROVINCE_COORDS
            ] or [50.0]
            km_prom = round(sum(dists) / len(dists), 1)
            km_max = round(max(dists), 1)
            by_sucursal.append({
                "sucursal_id": s["sucursal_id"],
                "nombre": s["nombre"],
                "n_clientes": n_clients,
                "km_promedio": km_prom,
                "km_maximo": km_max,
                "n_clientes_real": n_clients,
                "tiempo_estimado_horas": round(km_prom / _SPEED_KMH, 2),
            })

        by_deposito = []
        for d in depositos:
            lat, lon = d["lat"], d["lon"]
            if not lat:
                continue
            suc = next((s for s in sucursales if s["sucursal_id"] == d["sucursal_id"]), None)
            n_clients = suc_real_counts.get(d["sucursal_id"], 5)
            by_deposito.append({
                "deposito_id": d["deposito_id"],
                "nombre": d["nombre"],
                "n_clientes": n_clients,
                "km_promedio": 45.0,
                "km_maximo": 120.0,
                "tiempo_estimado_horas": round(45.0 / _SPEED_KMH, 2),
            })

        by_provincia = []
        for prov, cnt in sorted(prov_counts.items(), key=lambda x: -x[1]):
            coords = _PROVINCE_COORDS.get(prov)
            if not coords:
                continue
            plat, plon = coords
            ns = _nearest_sucursal(plat, plon, sucursales)
            nd = _nearest_deposito(plat, plon, depositos)
            if not ns:
                continue
            d_suc = _haversine(plat, plon, ns["lat"], ns["lon"])
            d_dep = _haversine(plat, plon, nd["lat"], nd["lon"]) if nd else None
            by_provincia.append({
                "provincia": prov,
                "sucursal_mas_cercana_id": ns["sucursal_id"],
                "sucursal_mas_cercana": ns["nombre"],
                "distancia_sucursal_km": round(d_suc, 1),
                "tiempo_sucursal_horas": round(d_suc / _SPEED_KMH, 2),
                "deposito_mas_cercano_id": nd["deposito_id"] if nd else None,
                "deposito_mas_cercano": nd["nombre"] if nd else None,
                "distancia_deposito_km": round(d_dep, 1) if d_dep is not None else None,
                "tiempo_deposito_horas": round(d_dep / _SPEED_KMH, 2) if d_dep is not None else None,
            })

        return {"by_sucursal": by_sucursal, "by_deposito": by_deposito, "by_provincia": by_provincia}
    except Exception:
        return _load_json("routes.json") or {}


def get_risk(db: Session | None) -> dict:
    if db is None:
        return _load_json("route_risk.json") or {}
    try:
        l_repo = LogisticaRepository(db)
        return {
            "by_deposito": l_repo.risk_by_deposito(),
            "by_tipo_envio": l_repo.risk_by_tipo_envio(),
        }
    except Exception:
        return _load_json("route_risk.json") or {}


def get_costs(db: Session | None) -> dict:
    if db is None:
        return _load_json("transport_costs.json") or {}
    try:
        l_repo = LogisticaRepository(db)
        r_repo = RoutingRepository(db)
        cost_per_kg, avg_peso = l_repo.global_metrics()
        sucursales = r_repo.sucursales()
        depositos = r_repo.depositos()
        prov_counts = r_repo.provincia_counts()
        suc_real = r_repo.sucursal_real_counts()

        by_sucursal = []
        for s in sucursales:
            if not s.get("lat"):
                continue
            n = suc_real.get(s["sucursal_id"], 5)
            d = 80.0
            by_sucursal.append({
                "sucursal_id": s["sucursal_id"],
                "nombre": s["nombre"],
                "n_clientes": n,
                "distancia_km": d,
                "peso_kg_envio_prom": avg_peso,
                "costo_estimado_ars": round(d * _COST_PER_KM_ARS, 2),
                "tiempo_estimado_horas": round(d / _SPEED_KMH, 2),
            })

        by_deposito = []
        for dep in depositos:
            if not dep.get("lat"):
                continue
            n = suc_real.get(dep["sucursal_id"], 5)
            d = 45.0
            by_deposito.append({
                "deposito_id": dep["deposito_id"],
                "nombre": dep["nombre"],
                "n_clientes": n,
                "distancia_km": d,
                "peso_kg_envio_prom": avg_peso,
                "costo_estimado_ars": round(d * _COST_PER_KM_ARS, 2),
                "tiempo_estimado_horas": round(d / _SPEED_KMH, 2),
            })

        return {
            "cost_per_kg_ars": cost_per_kg,
            "avg_speed_kmh": _SPEED_KMH,
            "by_sucursal": by_sucursal,
            "by_deposito": by_deposito,
        }
    except Exception:
        return _load_json("transport_costs.json") or {}

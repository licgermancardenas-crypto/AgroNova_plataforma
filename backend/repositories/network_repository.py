from __future__ import annotations

import math
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.core.database import DB_SCHEMA

_S = DB_SCHEMA

# ── helpers ────────────────────────────────────────────────────────────────────

def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


class NetworkRepository:
    def __init__(self, db: Session):
        self.db = db

    # ── 1. Depots with live metrics ────────────────────────────────────────────

    def get_depots(self) -> list[dict]:
        """
        Aggregate per-depot KPIs from fact_logistica + fact_inventario + dim_deposito.
        OTIF = shipments delivered on-time (estado='Entregado' AND dias_demora=0).
        Utilization = stock_actual / stock_maximo from fact_inventario (latest snapshot).
        """
        sql = text(f"""
            WITH logistica_agg AS (
                SELECT
                    fl.deposito_origen_id,
                    COUNT(*)                                                AS n_envios,
                    SUM(fl.peso_kg)                                         AS peso_total_kg,
                    SUM(fl.costo_flete_ars)                                 AS costo_flete_total,
                    AVG(fl.dias_demora)                                     AS dias_demora_prom,
                    AVG(fl.dias_transito_base)                              AS dias_transito_base_prom,
                    100.0 * SUM(CASE WHEN fl.estado='Entregado' AND fl.dias_demora=0 THEN 1 ELSE 0 END)
                        / NULLIF(COUNT(*), 0)                               AS otif_pct,
                    100.0 * SUM(CASE WHEN fl.estado='Demorado'   THEN 1 ELSE 0 END)
                        / NULLIF(COUNT(*), 0)                               AS pct_demorado,
                    100.0 * SUM(CASE WHEN fl.estado='Devuelto'   THEN 1 ELSE 0 END)
                        / NULLIF(COUNT(*), 0)                               AS pct_devuelto,
                    100.0 * SUM(CASE WHEN fl.estado='Entregado'  THEN 1 ELSE 0 END)
                        / NULLIF(COUNT(*), 0)                               AS pct_entregado,
                    100.0 * SUM(CASE WHEN fl.estado='En tránsito' THEN 1 ELSE 0 END)
                        / NULLIF(COUNT(*), 0)                               AS pct_transito
                FROM {_S}.fact_logistica fl
                GROUP BY fl.deposito_origen_id
            ),
            inv_agg AS (
                SELECT
                    fi.deposito_id,
                    SUM(fi.stock_actual)                                    AS stock_actual,
                    SUM(fi.stock_maximo)                                    AS stock_maximo,
                    SUM(fi.valor_stock_ars)                                 AS valor_stock_ars
                FROM {_S}.fact_inventario fi
                WHERE fi.fecha_id = (SELECT MAX(fecha_id) FROM {_S}.fact_inventario)
                GROUP BY fi.deposito_id
            )
            SELECT
                dd.deposito_id,
                dd.nombre,
                dd.sucursal_id,
                ds.nombre                                                   AS sucursal_nombre,
                ds.lat                                                      AS sucursal_lat,
                ds.lon                                                      AS sucursal_lon,
                COALESCE(CAST(dd.lat  AS numeric), ds.lat)                 AS lat,
                COALESCE(CAST(dd.lon  AS numeric), ds.lon)                 AS lon,
                dd.capacidad_ton,
                dd.tipo,
                dd.estado,
                COALESCE(la.n_envios,          0)                          AS n_envios,
                COALESCE(la.peso_total_kg,     0)                          AS peso_total_kg,
                COALESCE(la.costo_flete_total,  0)                          AS costo_flete_total,
                COALESCE(la.dias_demora_prom,   0)                          AS dias_demora_prom,
                COALESCE(la.dias_transito_base_prom, 0)                    AS dias_transito_base_prom,
                COALESCE(la.otif_pct,          0)                          AS otif_pct,
                COALESCE(la.pct_demorado,      0)                          AS pct_demorado,
                COALESCE(la.pct_devuelto,      0)                          AS pct_devuelto,
                COALESCE(la.pct_entregado,     0)                          AS pct_entregado,
                COALESCE(la.pct_transito,      0)                          AS pct_transito,
                COALESCE(ia.stock_actual,      0)                          AS stock_actual,
                COALESCE(ia.stock_maximo,      0)                          AS stock_maximo,
                COALESCE(ia.valor_stock_ars,   0)                          AS valor_stock_ars,
                CASE WHEN COALESCE(ia.stock_maximo, 0) > 0
                    THEN ia.stock_actual * 100.0 / ia.stock_maximo
                    ELSE 0 END                                              AS utilizacion_pct
            FROM {_S}.dim_deposito dd
            JOIN {_S}.dim_sucursal ds ON ds.sucursal_id = dd.sucursal_id
            LEFT JOIN logistica_agg la ON la.deposito_origen_id = dd.deposito_id
            LEFT JOIN inv_agg ia       ON ia.deposito_id = dd.deposito_id
            WHERE dd.estado = 'Operativo'
            ORDER BY dd.deposito_id
        """)
        rows = self.db.execute(sql).all()

        def _f(v, d=2): return round(float(v), d) if v is not None else 0.0

        result = []
        for r in rows:
            # Distance sucursal → deposito
            dist_km = 0.0
            if r.lat and r.lon and r.sucursal_lat and r.sucursal_lon:
                dist_km = round(_haversine(
                    float(r.lat), float(r.lon),
                    float(r.sucursal_lat), float(r.sucursal_lon)
                ), 1)
            result.append({
                "deposito_id":           int(r.deposito_id),
                "nombre":                r.nombre,
                "sucursal_id":           int(r.sucursal_id),
                "sucursal_nombre":       r.sucursal_nombre,
                "lat":                   _f(r.lat, 5),
                "lon":                   _f(r.lon, 5),
                "sucursal_lat":          _f(r.sucursal_lat, 5),
                "sucursal_lon":          _f(r.sucursal_lon, 5),
                "dist_sucursal_km":      dist_km,
                "capacidad_ton":         int(r.capacidad_ton or 0),
                "tipo":                  r.tipo,
                "n_envios":              int(r.n_envios or 0),
                "peso_total_kg":         _f(r.peso_total_kg, 0),
                "costo_flete_total":     _f(r.costo_flete_total, 0),
                "dias_demora_prom":      _f(r.dias_demora_prom),
                "dias_transito_base_prom": _f(r.dias_transito_base_prom),
                "otif_pct":              _f(r.otif_pct),
                "pct_demorado":          _f(r.pct_demorado),
                "pct_devuelto":          _f(r.pct_devuelto),
                "pct_entregado":         _f(r.pct_entregado),
                "pct_transito":          _f(r.pct_transito),
                "stock_actual":          _f(r.stock_actual, 0),
                "stock_maximo":          _f(r.stock_maximo, 0),
                "valor_stock_ars":       _f(r.valor_stock_ars, 0),
                "utilizacion_pct":       _f(r.utilizacion_pct),
            })
        return result

    # ── 2. Flow matrix: depot → region ─────────────────────────────────────────

    def get_flows(self) -> list[dict]:
        """
        Aggregate flows from fact_logistica grouped by deposito_origen × region_destino.
        Includes depot and region coordinates for map arcs.
        """
        sql = text(f"""
            SELECT
                fl.deposito_origen_id,
                dd.nombre                                                    AS deposito_nombre,
                COALESCE(CAST(dd.lat AS numeric), ds.lat)                   AS deposito_lat,
                COALESCE(CAST(dd.lon AS numeric), ds.lon)                   AS deposito_lon,
                dd.sucursal_id,
                fl.region_destino_id,
                dr.nombre_region,
                dr.provincia_principal                                       AS region_provincia,
                COUNT(*)                                                    AS n_envios,
                SUM(fl.peso_kg)                                             AS peso_total_kg,
                SUM(fl.costo_flete_ars)                                     AS costo_flete,
                AVG(fl.dias_demora)                                         AS dias_demora_prom,
                100.0 * SUM(CASE WHEN fl.estado='Entregado' AND fl.dias_demora=0 THEN 1 ELSE 0 END)
                    / NULLIF(COUNT(*), 0)                                   AS otif_pct,
                100.0 * SUM(CASE WHEN fl.estado='Demorado' THEN 1 ELSE 0 END)
                    / NULLIF(COUNT(*), 0)                                   AS pct_demorado
            FROM {_S}.fact_logistica fl
            JOIN {_S}.dim_deposito dd ON dd.deposito_id = fl.deposito_origen_id
            JOIN {_S}.dim_sucursal ds ON ds.sucursal_id = dd.sucursal_id
            JOIN {_S}.dim_region   dr ON dr.region_id   = fl.region_destino_id
            GROUP BY
                fl.deposito_origen_id, dd.nombre, dd.lat, dd.lon, dd.sucursal_id, ds.lat, ds.lon,
                fl.region_destino_id, dr.nombre_region, dr.provincia_principal
            ORDER BY n_envios DESC
        """)
        rows = self.db.execute(sql).all()

        def _f(v, d=2): return round(float(v), d) if v is not None else 0.0

        # Province centroid lookup (same as logistics_service)
        _PROV_COORDS = {
            "Buenos Aires": (-34.61, -58.37), "Córdoba": (-31.41, -64.18),
            "Santa Fe": (-31.63, -60.70),     "Mendoza": (-32.89, -68.84),
            "Entre Ríos": (-31.73, -60.52),   "Tucumán": (-26.82, -65.22),
            "Salta": (-24.78, -65.41),         "Chaco": (-27.45, -59.00),
            "Misiones": (-27.36, -55.90),      "Corrientes": (-27.47, -58.83),
            "Santiago del Estero": (-27.79, -64.26), "San Juan": (-31.53, -68.52),
            "Jujuy": (-24.18, -65.30),         "Río Negro": (-41.13, -71.30),
            "Neuquén": (-38.95, -68.06),       "Formosa": (-26.18, -58.17),
            "Chubut": (-43.29, -65.11),        "San Luis": (-33.30, -66.34),
            "Catamarca": (-28.47, -65.78),     "La Rioja": (-29.41, -66.85),
            "La Pampa": (-36.62, -64.29),      "Santa Cruz": (-51.62, -69.22),
        }

        result = []
        for r in rows:
            # Use region's principal province to get destination coordinates
            coords = _PROV_COORDS.get(r.region_provincia, (-33.0, -65.0))
            otif = _f(r.otif_pct)
            flow_color = "#22C55E" if otif >= 90 else "#F97316" if otif >= 75 else "#E03E3E"
            result.append({
                "deposito_id":     int(r.deposito_origen_id),
                "deposito_nombre": r.deposito_nombre,
                "deposito_lat":    _f(r.deposito_lat, 5),
                "deposito_lon":    _f(r.deposito_lon, 5),
                "sucursal_id":     int(r.sucursal_id),
                "region_id":       int(r.region_destino_id),
                "region_nombre":   r.nombre_region,
                "region_provincia":r.region_provincia,
                "region_lat":      coords[0],
                "region_lon":      coords[1],
                "n_envios":        int(r.n_envios or 0),
                "peso_total_kg":   _f(r.peso_total_kg, 0),
                "costo_flete":     _f(r.costo_flete, 0),
                "dias_demora_prom":_f(r.dias_demora_prom),
                "otif_pct":        otif,
                "pct_demorado":    _f(r.pct_demorado),
                "flow_color":      flow_color,
            })
        return result

    # ── 3. Status summary (computed from depot data) ───────────────────────────

    def get_status_summary(self, depots: list[dict], flows: list[dict]) -> dict:
        if not depots:
            return {}

        total_envios      = sum(d["n_envios"]         for d in depots)
        peso_total        = sum(d["peso_total_kg"]     for d in depots)
        costo_total       = sum(d["costo_flete_total"] for d in depots)
        cap_total         = sum(d["capacidad_ton"]      for d in depots)
        stock_actual_sum  = sum(d["stock_actual"]        for d in depots)
        stock_max_sum     = sum(d["stock_maximo"]        for d in depots)
        valor_stock       = sum(d["valor_stock_ars"]     for d in depots)
        capacidad_libre   = sum(d["capacidad_ton"] * max(0, 1 - d.get("utilizacion_pct", 0) / 100)
                                for d in depots)

        # Weighted OTIF by envíos
        w_otif = (
            sum(d["otif_pct"] * d["n_envios"] for d in depots) / max(total_envios, 1)
        )
        # Average utilization (by stock)
        avg_util = (
            stock_actual_sum / stock_max_sum * 100 if stock_max_sum > 0
            else sum(d["utilizacion_pct"] for d in depots) / len(depots)
        )
        avg_demora = (
            sum(d["dias_demora_prom"] * d["n_envios"] for d in depots) / max(total_envios, 1)
        )

        n_criticos = sum(1 for d in depots if d.get("load_status") == "CRÍTICO")
        n_rutas_criticas = sum(1 for f in flows if f["otif_pct"] < 75)

        return {
            "total_envios":          total_envios,
            "peso_total_kg":         round(peso_total, 0),
            "costo_flete_total":     round(costo_total, 0),
            "otif_global":           round(w_otif, 2),
            "utilizacion_promedio":  round(avg_util, 1),
            "capacidad_total_ton":   cap_total,
            "stock_actual_ton":      round(stock_actual_sum, 0),
            "capacidad_libre_ton":   round(capacidad_libre, 0),
            "valor_stock_ars":       round(valor_stock, 0),
            "dias_demora_prom":      round(avg_demora, 2),
            "n_depositos":           len(depots),
            "n_depositos_criticos":  n_criticos,
            "n_rutas_criticas":      n_rutas_criticas,
        }

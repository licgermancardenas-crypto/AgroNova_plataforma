from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.core.database import DB_SCHEMA

_S = DB_SCHEMA


class CustomerSpatialRepository:
    def __init__(self, db: Session):
        self.db = db

    # ── helpers ────────────────────────────────────────────────────────────────

    def _row_to_dict(self, row, cols: list[str]) -> dict:
        d = dict(zip(cols, row))
        for k in ("lat", "lon", "revenue_ars", "margen_pct",
                   "ticket_promedio_ars", "churn_score", "otif_pct"):
            if d.get(k) is not None:
                d[k] = float(d[k])
        if d.get("ultima_compra"):
            d["ultima_compra"] = str(d["ultima_compra"])
        return d

    _COLS = [
        "cliente_id", "razon_social", "segmento", "ciclo_vida",
        "provincia", "ciudad", "cuit", "sucursal_id",
        "tier", "riesgo_crediticio", "superficie_ha",
        "lat", "lon", "is_outlier",
        "revenue_ars", "margen_pct", "ticket_promedio_ars",
        "n_compras", "ultima_compra", "otif_pct", "churn_score", "churn_level",
    ]

    _BASE_SELECT = f"""
        SELECT
            sc.cliente_id,
            c.razon_social,
            c.segmento,
            c.ciclo_vida,
            sc.provincia,
            sc.ciudad,
            c.cuit,
            sc.sucursal_id_asignada AS sucursal_id,
            sc.tier,
            c.riesgo_crediticio,
            c.superficie_ha,
            sc.latitud   AS lat,
            sc.longitud  AS lon,
            sc.is_outlier,
            sc.revenue_ars,
            sc.margen_pct,
            sc.ticket_promedio_ars,
            sc.n_compras,
            sc.ultima_compra,
            sc.otif_pct,
            sc.churn_score,
            sc.churn_level
        FROM {_S}.spatial_clientes sc
        JOIN {_S}.dim_cliente      c  ON c.cliente_id = sc.cliente_id
        WHERE sc.is_outlier = false
    """

    # ── public interface ────────────────────────────────────────────────────────

    def get_all(self, provincia: str | None = None,
                segmento:  str | None = None,
                tier:      str | None = None,
                churn_lvl: str | None = None) -> list[dict]:
        filters = ""
        params: dict = {}
        if provincia:
            filters += " AND sc.provincia = :provincia"
            params["provincia"] = provincia
        if segmento:
            filters += " AND c.segmento = :segmento"
            params["segmento"] = segmento
        if tier:
            filters += " AND sc.tier = :tier"
            params["tier"] = tier
        if churn_lvl:
            filters += " AND sc.churn_level = :churn_level"
            params["churn_level"] = churn_lvl

        sql = text(self._BASE_SELECT + filters + " ORDER BY sc.cliente_id")
        rows = self.db.execute(sql, params).all()
        return [self._row_to_dict(r, self._COLS) for r in rows]

    def search(self, q: str = "",
               provincia: str | None = None,
               ciudad:    str | None = None,
               segmento:  str | None = None,
               limit:     int = 50) -> list[dict]:
        filters = ""
        params: dict = {"lim": limit}
        if q:
            filters += " AND (c.razon_social ILIKE :q OR c.cuit ILIKE :q OR sc.ciudad ILIKE :q)"
            params["q"] = f"%{q}%"
        if provincia:
            filters += " AND sc.provincia = :provincia"
            params["provincia"] = provincia
        if ciudad:
            filters += " AND sc.ciudad ILIKE :ciudad"
            params["ciudad"] = f"%{ciudad}%"
        if segmento:
            filters += " AND c.segmento = :segmento"
            params["segmento"] = segmento

        sql = text(self._BASE_SELECT + filters + " ORDER BY sc.revenue_ars DESC NULLS LAST LIMIT :lim")
        rows = self.db.execute(sql, params).all()
        return [self._row_to_dict(r, self._COLS) for r in rows]

    def get_by_id(self, cliente_id: str) -> dict | None:
        sql = text(self._BASE_SELECT + " AND sc.cliente_id = :cid")
        row = self.db.execute(sql, {"cid": cliente_id}).one_or_none()
        if not row:
            return None
        return self._row_to_dict(row, self._COLS)

    def get_nearby(self, lat: float, lon: float, radius_km: float = 50.0) -> list[dict]:
        """ST_DWithin (geography) + distance ordering. Uses GIST index."""
        radius_m = radius_km * 1000
        sql = text(f"""
            SELECT
                sc.cliente_id,
                c.razon_social,
                c.segmento,
                c.ciclo_vida,
                sc.provincia,
                sc.ciudad,
                c.cuit,
                sc.sucursal_id_asignada AS sucursal_id,
                sc.tier,
                c.riesgo_crediticio,
                c.superficie_ha,
                sc.latitud   AS lat,
                sc.longitud  AS lon,
                sc.is_outlier,
                sc.revenue_ars,
                sc.margen_pct,
                sc.ticket_promedio_ars,
                sc.n_compras,
                sc.ultima_compra,
                sc.otif_pct,
                sc.churn_score,
                sc.churn_level,
                ST_Distance(
                    sc.geom::geography,
                    ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography
                ) / 1000.0  AS distance_km
            FROM {_S}.spatial_clientes sc
            JOIN {_S}.dim_cliente      c  ON c.cliente_id = sc.cliente_id
            WHERE sc.is_outlier = false
              AND ST_DWithin(
                    sc.geom::geography,
                    ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography,
                    :radius_m
                  )
            ORDER BY sc.geom <-> ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)
            LIMIT 200
        """)
        rows = self.db.execute(sql, {"lat": lat, "lon": lon, "radius_m": radius_m}).all()
        cols = self._COLS + ["distance_km"]
        result = []
        for r in rows:
            d = dict(zip(cols, r))
            for k in ("lat", "lon", "revenue_ars", "margen_pct",
                       "ticket_promedio_ars", "churn_score", "otif_pct", "distance_km"):
                if d.get(k) is not None:
                    d[k] = float(d[k])
            if d.get("ultima_compra"):
                d["ultima_compra"] = str(d["ultima_compra"])
            result.append(d)
        return result

    def validate_outliers(self) -> int:
        """
        Mark is_outlier=true for clients whose geom falls outside the declared province.
        Uses ST_Contains(provincia.geom, cliente.geom).
        Returns count of outliers found.
        """
        sql = text(f"""
            UPDATE {_S}.spatial_clientes sc
            SET is_outlier = true
            FROM {_S}.spatial_provincias sp
            WHERE sp.nombre = sc.provincia
              AND NOT ST_Contains(sp.geom, sc.geom)
        """)
        try:
            result = self.db.execute(sql)
            self.db.commit()
            return result.rowcount
        except Exception:
            return 0  # spatial_provincias may not exist yet

    def get_stats(self) -> dict:
        sql = text(f"""
            SELECT
                COUNT(*)                          AS total_clientes,
                SUM(sc.revenue_ars)               AS revenue_total,
                AVG(sc.revenue_ars)               AS revenue_promedio,
                AVG(sc.ticket_promedio_ars)       AS ticket_promedio,
                SUM(CASE WHEN sc.churn_level='Alto' THEN 1 ELSE 0 END) AS alto_riesgo
            FROM {_S}.spatial_clientes sc
            WHERE sc.is_outlier = false
        """)
        row = self.db.execute(sql).one()

        top_sql = text(f"""
            SELECT sc.cliente_id, c.razon_social, sc.provincia, sc.revenue_ars, sc.tier
            FROM {_S}.spatial_clientes sc
            JOIN {_S}.dim_cliente c ON c.cliente_id = sc.cliente_id
            WHERE sc.is_outlier = false AND sc.revenue_ars IS NOT NULL
            ORDER BY sc.revenue_ars DESC LIMIT 10
        """)
        top_rows = self.db.execute(top_sql).all()

        prov_sql = text(f"""
            SELECT sc.provincia, COUNT(*) AS n, SUM(sc.revenue_ars) AS rev
            FROM {_S}.spatial_clientes sc
            WHERE sc.is_outlier = false
            GROUP BY sc.provincia ORDER BY n DESC LIMIT 10
        """)
        prov_rows = self.db.execute(prov_sql).all()

        seg_sql = text(f"""
            SELECT c.segmento, COUNT(*) AS n, SUM(sc.revenue_ars) AS rev
            FROM {_S}.spatial_clientes sc
            JOIN {_S}.dim_cliente c ON c.cliente_id = sc.cliente_id
            WHERE sc.is_outlier = false
            GROUP BY c.segmento ORDER BY n DESC
        """)
        seg_rows = self.db.execute(seg_sql).all()

        tier_sql = text(f"""
            SELECT sc.tier, COUNT(*) AS n, SUM(sc.revenue_ars) AS rev
            FROM {_S}.spatial_clientes sc
            WHERE sc.is_outlier = false
            GROUP BY sc.tier ORDER BY sc.tier
        """)
        tier_rows = self.db.execute(tier_sql).all()

        churn_sql = text(f"""
            SELECT sc.churn_level, COUNT(*) AS n
            FROM {_S}.spatial_clientes sc
            WHERE sc.is_outlier = false
            GROUP BY sc.churn_level
        """)
        churn_rows = self.db.execute(churn_sql).all()

        def _f(v):
            return float(v) if v is not None else 0.0

        return {
            "total_clientes":       int(row.total_clientes),
            "revenue_total_ars":    _f(row.revenue_total),
            "revenue_promedio_ars": _f(row.revenue_promedio),
            "ticket_promedio_ars":  _f(row.ticket_promedio),
            "clientes_alto_riesgo": int(row.alto_riesgo),
            "top_clientes": [
                {"cliente_id": r[0], "razon_social": r[1], "provincia": r[2],
                 "revenue_ars": _f(r[3]), "tier": r[4]}
                for r in top_rows
            ],
            "por_provincia": [
                {"provincia": r[0], "n": int(r[1]), "revenue_ars": _f(r[2])}
                for r in prov_rows
            ],
            "por_segmento": [
                {"segmento": r[0], "n": int(r[1]), "revenue_ars": _f(r[2])}
                for r in seg_rows
            ],
            "por_tier": [
                {"tier": r[0], "n": int(r[1]), "revenue_ars": _f(r[2])}
                for r in tier_rows
            ],
            "churn_distribution": {
                r[0]: int(r[1]) for r in churn_rows
            },
        }

    def monthly_revenue(self, cliente_id: str, months: int = 12) -> list[dict]:
        sql = text(f"""
            SELECT
                df.mes_nombre,
                df.mes,
                df.año AS anio,
                SUM(fv.total_ars) AS revenue_ars
            FROM {_S}.fact_ventas fv
            JOIN {_S}.dim_fecha df ON df.fecha_id = fv.fecha_id
            WHERE fv.cliente_id = :cid
              AND df.fecha >= (CURRENT_DATE - INTERVAL '1 year')
            GROUP BY df.mes_nombre, df.mes, df.año
            ORDER BY df.año, df.mes
            LIMIT :m
        """)
        rows = self.db.execute(sql, {"cid": cliente_id, "m": months}).all()
        return [
            {"mes": r.mes_nombre, "revenue_ars": float(r.revenue_ars)}
            for r in rows
        ]

    def quarterly_orders(self, cliente_id: str) -> list[dict]:
        sql = text(f"""
            SELECT df.año AS anio, df.trimestre, COUNT(DISTINCT fv.venta_id) AS n_compras
            FROM {_S}.fact_ventas fv
            JOIN {_S}.dim_fecha df ON df.fecha_id = fv.fecha_id
            WHERE fv.cliente_id = :cid
              AND df.fecha >= (CURRENT_DATE - INTERVAL '2 years')
            GROUP BY df.año, df.trimestre
            ORDER BY df.año, df.trimestre
        """)
        rows = self.db.execute(sql, {"cid": cliente_id}).all()
        return [
            {"periodo": f"Q{r.trimestre} {r.anio}", "n_compras": int(r.n_compras)}
            for r in rows
        ]

    def nearest_branch_for(self, lat: float, lon: float) -> dict | None:
        sql = text(f"""
            SELECT ss.sucursal_id, ss.nombre, ss.provincia,
                   ss.latitud, ss.longitud,
                   ST_Distance(
                       ss.geom::geography,
                       ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography
                   ) / 1000.0 AS distance_km
            FROM {_S}.spatial_sucursales ss
            ORDER BY ss.geom <-> ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)
            LIMIT 1
        """)
        row = self.db.execute(sql, {"lat": lat, "lon": lon}).one_or_none()
        if not row:
            return None
        return {
            "sucursal_id": row.sucursal_id,
            "nombre":      row.nombre,
            "provincia":   row.provincia,
            "lat":         float(row.latitud),
            "lon":         float(row.longitud),
            "distance_km": round(float(row.distance_km), 2),
        }

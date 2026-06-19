from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.core.database import DB_SCHEMA

_S = DB_SCHEMA


class SpatialRepository:
    def __init__(self, db: Session):
        self.db = db

    def postgis_version(self) -> str | None:
        try:
            row = self.db.execute(text("SELECT PostGIS_Version()")).one()
            return str(row[0])
        except Exception:
            return None

    def spatial_tables_ready(self) -> dict[str, bool]:
        tables = ["spatial_sucursales", "spatial_depositos", "spatial_clientes", "spatial_provincias"]
        result: dict[str, bool] = {}
        for tbl in tables:
            try:
                row = self.db.execute(
                    text(
                        "SELECT COUNT(*) FROM information_schema.tables "
                        "WHERE table_schema = :s AND table_name = :t"
                    ),
                    {"s": _S, "t": tbl},
                ).one()
                if row[0] > 0:
                    cnt = self.db.execute(text(f"SELECT COUNT(*) FROM {_S}.{tbl}")).scalar_one()
                    result[tbl] = cnt > 0
                else:
                    result[tbl] = False
            except Exception:
                result[tbl] = False
        return result

    def clients_within_radius(self, lat: float, lon: float, radius_km: float) -> list[dict]:
        """ST_DWithin with geography → result in meters; GIST-accelerated."""
        radius_m = radius_km * 1000
        sql = text(
            f"""
            SELECT
                sc.cliente_id,
                sc.provincia,
                sc.latitud,
                sc.longitud,
                ST_Distance(
                    sc.geom::geography,
                    ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography
                ) AS distance_m
            FROM {_S}.spatial_clientes sc
            WHERE ST_DWithin(
                sc.geom::geography,
                ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography,
                :radius_m
            )
            ORDER BY distance_m
            LIMIT 500
            """
        )
        rows = self.db.execute(sql, {"lat": lat, "lon": lon, "radius_m": radius_m}).all()
        return [
            {
                "cliente_id": r.cliente_id,
                "provincia": r.provincia,
                "lat": float(r.latitud),
                "lon": float(r.longitud),
                "distance_m": round(float(r.distance_m), 1),
            }
            for r in rows
        ]

    def provinces_intersecting_buffers(self, radius_km: float) -> list[dict]:
        """Provinces whose polygon intersects any sucursal buffer. Uses ST_Intersects + ST_Buffer."""
        radius_m = radius_km * 1000
        sql = text(
            f"""
            SELECT DISTINCT
                sp.provincia_id,
                sp.nombre          AS provincia,
                sp.macro_region,
                ss.sucursal_id,
                ss.nombre          AS sucursal_nombre
            FROM {_S}.spatial_provincias  sp
            JOIN {_S}.spatial_sucursales  ss
              ON ST_Intersects(
                    sp.geom,
                    ST_Buffer(ss.geom::geography, :radius_m)::geometry
                 )
            ORDER BY sp.nombre, ss.nombre
            """
        )
        rows = self.db.execute(sql, {"radius_m": radius_m}).all()
        return [
            {
                "provincia_id": r.provincia_id,
                "provincia": r.provincia,
                "macro_region": r.macro_region,
                "sucursal_id": r.sucursal_id,
                "sucursal_nombre": r.sucursal_nombre,
            }
            for r in rows
        ]

    def nearest_branch(self, lat: float, lon: float) -> dict | None:
        """KNN with <-> operator — uses GIST index, no full scan."""
        sql = text(
            f"""
            SELECT
                ss.sucursal_id,
                ss.nombre,
                ss.provincia,
                ss.latitud,
                ss.longitud,
                ST_Distance(
                    ss.geom::geography,
                    ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography
                ) / 1000.0 AS distance_km
            FROM {_S}.spatial_sucursales ss
            ORDER BY ss.geom <-> ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)
            LIMIT 1
            """
        )
        row = self.db.execute(sql, {"lat": lat, "lon": lon}).one_or_none()
        if not row:
            return None
        return {
            "sucursal_id": row.sucursal_id,
            "nombre": row.nombre,
            "provincia": row.provincia,
            "lat": float(row.latitud),
            "lon": float(row.longitud),
            "distance_km": round(float(row.distance_km), 3),
        }

    def nearest_depot(self, lat: float, lon: float, limit: int = 3) -> list[dict]:
        """Top-N nearest depots using KNN <-> operator."""
        sql = text(
            f"""
            SELECT
                sd.deposito_id,
                sd.nombre,
                sd.sucursal_id,
                sd.latitud,
                sd.longitud,
                ST_Distance(
                    sd.geom::geography,
                    ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography
                ) / 1000.0 AS distance_km
            FROM {_S}.spatial_depositos sd
            ORDER BY sd.geom <-> ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)
            LIMIT :lim
            """
        )
        rows = self.db.execute(sql, {"lat": lat, "lon": lon, "lim": limit}).all()
        return [
            {
                "deposito_id": r.deposito_id,
                "nombre": r.nombre,
                "sucursal_id": r.sucursal_id,
                "lat": float(r.latitud),
                "lon": float(r.longitud),
                "distance_km": round(float(r.distance_km), 3),
            }
            for r in rows
        ]

    def hotspot_intersections(self) -> list[dict]:
        """Hotspots from vw_hotspots joined with spatial_provincias via ST_Contains."""
        sql = text(
            f"""
            SELECT
                h.provincia,
                h.score,
                h.clientes_count           AS clientes_en_zona,
                COALESCE(h.revenue_ars, 0) AS revenue_ars
            FROM {_S}.vw_hotspots h
            JOIN {_S}.spatial_provincias sp
              ON ST_Contains(sp.geom, ST_SetSRID(ST_MakePoint(h.longitud, h.latitud), 4326))
            ORDER BY h.score DESC
            LIMIT 30
            """
        )
        try:
            rows = self.db.execute(sql).all()
            return [
                {
                    "provincia": r.provincia,
                    "score": float(r.score),
                    "clientes_en_zona": int(r.clientes_en_zona),
                    "revenue_ars": float(r.revenue_ars),
                }
                for r in rows
            ]
        except Exception:
            return []

    def territorial_overlaps(self) -> list[dict]:
        """Provinces whose buffers (50 km around sucursales) overlap each other."""
        sql = text(
            f"""
            SELECT
                sp1.nombre AS provincia_a,
                sp2.nombre AS provincia_b,
                'buffer_overlap' AS overlap_type,
                COUNT(DISTINCT ss.sucursal_id) AS sucursales_en_overlap
            FROM {_S}.spatial_provincias  sp1
            JOIN {_S}.spatial_provincias  sp2 ON sp1.provincia_id < sp2.provincia_id
            JOIN {_S}.spatial_sucursales  ss
              ON ST_Intersects(sp1.geom, ST_Buffer(ss.geom::geography, 50000)::geometry)
             AND ST_Intersects(sp2.geom, ST_Buffer(ss.geom::geography, 50000)::geometry)
            GROUP BY sp1.nombre, sp2.nombre
            ORDER BY sucursales_en_overlap DESC
            LIMIT 20
            """
        )
        try:
            rows = self.db.execute(sql).all()
            return [
                {
                    "provincia_a": r.provincia_a,
                    "provincia_b": r.provincia_b,
                    "overlap_type": r.overlap_type,
                    "sucursales_en_overlap": int(r.sucursales_en_overlap),
                }
                for r in rows
            ]
        except Exception:
            return []

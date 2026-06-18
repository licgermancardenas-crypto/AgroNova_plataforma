from __future__ import annotations

import json
from pathlib import Path

from sqlalchemy.orm import Session

from backend.repositories.spatial_repository import SpatialRepository

_GIS_DIR = Path(__file__).resolve().parents[2] / "data" / "gis_outputs"
_DEFAULT_RADIUS_KM = 150.0


def _load_json(name: str) -> list | dict:
    try:
        with open(_GIS_DIR / name) as f:
            return json.load(f)
    except Exception:
        return []


def get_postgis_status(db: Session | None) -> dict:
    if db is None:
        return {"available": False, "version": None, "tables_ready": {}, "mode": "fallback"}
    repo = SpatialRepository(db)
    version = repo.postgis_version()
    if version is None:
        return {"available": False, "version": None, "tables_ready": {}, "mode": "fallback"}
    tables = repo.spatial_tables_ready()
    return {
        "available": True,
        "version": version,
        "tables_ready": tables,
        "mode": "postgis" if any(tables.values()) else "fallback",
    }


def coverage_analysis_db(db: Session | None, radius_km: float = _DEFAULT_RADIUS_KM) -> dict:
    """Coverage: how many clients fall within radius_km of each sucursal."""
    if db is None:
        return {"mode": "fallback", "items": _load_json("coverage.json")}

    repo = SpatialRepository(db)
    version = repo.postgis_version()
    if version is None:
        return {"mode": "fallback", "items": _load_json("coverage.json")}

    try:
        from sqlalchemy import text
        from backend.core.database import DB_SCHEMA as _S

        sql = text(
            f"""
            SELECT
                ss.sucursal_id,
                ss.nombre,
                ss.provincia,
                ss.latitud,
                ss.longitud,
                COUNT(sc.cliente_id) AS clientes_cubiertos
            FROM {_S}.spatial_sucursales ss
            LEFT JOIN {_S}.spatial_clientes sc
              ON ST_DWithin(
                    ss.geom::geography,
                    sc.geom::geography,
                    :radius_m
                 )
            GROUP BY ss.sucursal_id, ss.nombre, ss.provincia, ss.latitud, ss.longitud
            ORDER BY clientes_cubiertos DESC
            """
        )
        rows = db.execute(sql, {"radius_m": radius_km * 1000}).all()
        items = [
            {
                "sucursal_id": r.sucursal_id,
                "nombre": r.nombre,
                "provincia": r.provincia,
                "lat": float(r.latitud),
                "lon": float(r.longitud),
                "clientes_cubiertos": int(r.clientes_cubiertos),
                "radius_km": radius_km,
            }
            for r in rows
        ]
        return {"mode": "postgis", "items": items}
    except Exception:
        return {"mode": "fallback", "items": _load_json("coverage.json")}


def expansion_targets_db(db: Session | None) -> list:
    if db is None:
        return _load_json("territories.json")
    try:
        from sqlalchemy import text
        from backend.core.database import DB_SCHEMA as _S

        sql = text(f"SELECT * FROM {_S}.vw_expansion_targets ORDER BY score DESC LIMIT 20")
        rows = db.execute(sql).mappings().all()
        if rows:
            return [dict(r) for r in rows]
    except Exception:
        pass
    return _load_json("territories.json")


def territorial_overlap_db(db: Session | None) -> dict:
    if db is None:
        return {"mode": "fallback", "items": []}
    repo = SpatialRepository(db)
    version = repo.postgis_version()
    if version is None:
        return {"mode": "fallback", "items": []}
    items = repo.territorial_overlaps()
    return {"mode": "postgis", "items": items}

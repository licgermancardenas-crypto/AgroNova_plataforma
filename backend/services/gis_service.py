from __future__ import annotations

import json
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.core.database import DB_SCHEMA

_GIS_DIR = Path(__file__).resolve().parents[2] / "data" / "gis_outputs"


def _load_json(name: str) -> list | dict:
    try:
        with open(_GIS_DIR / name) as f:
            return json.load(f)
    except Exception:
        return []


def get_provincias(db: Session | None) -> list:
    if db is not None:
        try:
            stmt = text(
                f"SELECT nombre, macro_region, latitud, longitud FROM {DB_SCHEMA}.dim_region ORDER BY nombre"
            )
            rows = db.execute(stmt).all()
            if rows:
                return [
                    {
                        "provincia": r.nombre,
                        "macro_region": r.macro_region,
                        "lat": float(r.latitud) if r.latitud else None,
                        "lon": float(r.longitud) if r.longitud else None,
                    }
                    for r in rows
                ]
        except Exception:
            pass
    return _load_json("provincias.json")


def get_hotspots(db: Session | None) -> list:
    if db is not None:
        try:
            stmt = text(
                f"SELECT * FROM {DB_SCHEMA}.vw_hotspots ORDER BY score DESC LIMIT 20"
            )
            rows = db.execute(stmt).mappings().all()
            if rows:
                return [dict(r) for r in rows]
        except Exception:
            pass
    return _load_json("hotspots.json")


def get_coverage(db: Session | None) -> list:
    if db is not None:
        try:
            stmt = text(f"SELECT * FROM {DB_SCHEMA}.vw_clientes_cobertura LIMIT 100")
            rows = db.execute(stmt).mappings().all()
            if rows:
                return [dict(r) for r in rows]
        except Exception:
            pass
    return _load_json("coverage.json")


def get_territories(db: Session | None) -> list:
    if db is not None:
        try:
            stmt = text(f"SELECT * FROM {DB_SCHEMA}.vw_expansion_targets LIMIT 50")
            rows = db.execute(stmt).mappings().all()
            if rows:
                return [dict(r) for r in rows]
        except Exception:
            pass
    return _load_json("territories.json")

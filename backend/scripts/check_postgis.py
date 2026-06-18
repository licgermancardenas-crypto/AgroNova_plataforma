#!/usr/bin/env python3
"""Verify PostGIS extension, version, and SRID support on the configured Neon instance."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from sqlalchemy import create_engine, text

from backend.core.config import get_settings

settings = get_settings()

_SRID_TESTS = [4326, 4258, 5347]


def check_postgis() -> None:
    if not settings.database_url:
        print("ERROR: DATABASE_URL not set")
        sys.exit(1)

    engine = create_engine(settings.database_url, pool_pre_ping=True)

    with engine.connect() as conn:
        # PostGIS version
        try:
            row = conn.execute(text("SELECT PostGIS_Version()")).one()
            print(f"✓ PostGIS version : {row[0]}")
        except Exception as e:
            print(f"✗ PostGIS not available: {e}")
            sys.exit(1)

        # Extension active
        row = conn.execute(
            text("SELECT extname, extversion FROM pg_extension WHERE extname = 'postgis'")
        ).one_or_none()
        if row:
            print(f"✓ Extension active : postgis {row.extversion}")
        else:
            print("✗ Extension 'postgis' not found in pg_extension")

        # SRID support
        for srid in _SRID_TESTS:
            row = conn.execute(
                text("SELECT COUNT(*) FROM spatial_ref_sys WHERE srid = :srid"),
                {"srid": srid},
            ).one()
            status = "✓" if row[0] > 0 else "✗"
            print(f"{status} SRID {srid}          : {'found' if row[0] > 0 else 'NOT found'}")

        # spatial_* tables
        schema = settings.db_schema
        for tbl in ["spatial_sucursales", "spatial_depositos", "spatial_clientes", "spatial_provincias"]:
            row = conn.execute(
                text(
                    "SELECT COUNT(*) FROM information_schema.tables "
                    "WHERE table_schema = :s AND table_name = :t"
                ),
                {"s": schema, "t": tbl},
            ).one()
            status = "✓" if row[0] > 0 else "✗"
            row_count = 0
            if row[0] > 0:
                try:
                    row_count = conn.execute(
                        text(f"SELECT COUNT(*) FROM {schema}.{tbl}")
                    ).scalar_one()
                except Exception:
                    pass
            print(f"{status} {schema}.{tbl:<30}: {'exists' if row[0] > 0 else 'MISSING'} ({row_count} rows)")

        # GIST indexes
        for idx in ["idx_spatial_sucursales_geom", "idx_spatial_depositos_geom",
                    "idx_spatial_clientes_geom", "idx_spatial_provincias_geom"]:
            row = conn.execute(
                text(
                    "SELECT COUNT(*) FROM pg_indexes "
                    "WHERE schemaname = :s AND indexname = :i"
                ),
                {"s": schema, "i": idx},
            ).one()
            status = "✓" if row[0] > 0 else "✗"
            print(f"{status} index {idx}: {'found' if row[0] > 0 else 'MISSING'}")


if __name__ == "__main__":
    check_postgis()

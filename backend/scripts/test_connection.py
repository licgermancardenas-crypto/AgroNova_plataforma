"""
Diagnostic: verify the Neon/PostgreSQL connection and report row counts per
table in the agronova schema. Doesn't touch any endpoint — standalone check
to run after setting DATABASE_URL in .env, before wiring any service to it.

Usage:
    python -m backend.scripts.test_connection

Neon's free tier suspends the compute after inactivity — the first query
after a while can take several seconds while it wakes up. CONNECT_TIMEOUT_S
below is generous on purpose; don't lower it to "fix" a slow first run.
"""
from __future__ import annotations

import sys
import time

from sqlalchemy import inspect, text

from backend.core.database import DB_SCHEMA, engine
from backend.models.orm import Base

CONNECT_TIMEOUT_S = 15


def main() -> int:
    if engine is None:
        print("FAIL: DATABASE_URL not set.")
        print("  Copy .env.example to .env and fill in a real Neon connection string.")
        return 1

    print(f"Connecting (schema={DB_SCHEMA!r}, timeout={CONNECT_TIMEOUT_S}s)...")
    t0 = time.time()
    try:
        with engine.connect() as conn:
            elapsed = time.time() - t0
            version = conn.execute(text("SELECT version()")).scalar()
            print(f"OK — connected in {elapsed:.1f}s")
            print(f"  {version}")

            insp = inspect(engine)
            existing_tables = set(insp.get_table_names(schema=DB_SCHEMA))
            expected_tables = {t.split(".", 1)[1] for t in Base.metadata.tables}

            missing = expected_tables - existing_tables
            if missing:
                print(f"\nWARNING: schema {DB_SCHEMA!r} is missing tables: {sorted(missing)}")
                print("  Run the DDL first: psql $DATABASE_URL_UNPOOLED -f data/sql/02_ddl_productivo.sql")
                print("  or: python -m etl.run_pipeline --conn \"$DATABASE_URL_UNPOOLED\"")
                return 1

            print(f"\nRow counts ({len(expected_tables)} tables):")
            for table in sorted(expected_tables):
                try:
                    count = conn.execute(
                        text(f"SELECT COUNT(*) FROM {DB_SCHEMA}.{table}")
                    ).scalar()
                    print(f"  {table:<28} {count:>12,}")
                except Exception as e:  # noqa: BLE001 — diagnostic script, report and continue
                    print(f"  {table:<28} ERROR: {e}")
    except Exception as e:  # noqa: BLE001 — diagnostic script: print, don't traceback
        print(f"FAIL: could not connect — {e}")
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())

"""
Applies data/sql/02_ddl_productivo.sql (schema, ENUMs, tables, indexes) and
data/sql/03_vistas_analiticas.sql (analytical views) to the Neon database.

Uses psycopg2 directly — NOT SQLAlchemy text() loops — because
02_ddl_productivo.sql contains DO $$ BEGIN...END $$ blocks for ENUMs.
A naive split-by-semicolon (like the one in etl/load_postgres.py's DDL
section) fragments those blocks and skips the ENUM creation silently.
psycopg2 cursor.execute() with the full DDL string passes it to libpq's
PQexec(), which handles multi-statement scripts including dollar-quoted blocks.

Usage:
    python -m backend.scripts.apply_ddl              # reads DATABASE_URL_UNPOOLED from .env
    python -m backend.scripts.apply_ddl --conn "postgresql://..."

Neon notes:
  - Use DATABASE_URL_UNPOOLED (direct connection), not the pooler — some DDL
    statements (SET search_path, CREATE TYPE) behave incorrectly through
    PgBouncer in transaction-pooling mode.
  - The 'ALTER DATABASE' statement in 05_neon_setup.sql is NOT applied here —
    it names the database literally ('neondb') and isn't portable. Run it
    manually in the Neon SQL editor if you want those settings.
"""
from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path

import psycopg2

ROOT = Path(__file__).resolve().parents[2]
DDL_PATHS = [
    ROOT / "data" / "sql" / "02_ddl_productivo.sql",
    ROOT / "data" / "sql" / "03_vistas_analiticas.sql",
]

_LOAD_DOTENV_DONE = False


def _load_env():
    global _LOAD_DOTENV_DONE
    if _LOAD_DOTENV_DONE:
        return
    try:
        from dotenv import load_dotenv
        load_dotenv(ROOT / ".env")
        _LOAD_DOTENV_DONE = True
    except ImportError:
        pass


def apply(conn_str: str, schema: str = "agronova") -> None:
    print(f"Connecting (unpooled)...")
    conn = psycopg2.connect(conn_str)
    conn.autocommit = True
    cur = conn.cursor()

    for ddl_path in DDL_PATHS:
        if not ddl_path.exists():
            print(f"  [SKIP] {ddl_path.name} not found")
            continue

        ddl = ddl_path.read_text(encoding="utf-8")
        t0 = time.time()
        print(f"  Applying {ddl_path.name}...")
        try:
            cur.execute(ddl)
            print(f"  [OK] {ddl_path.name} — {time.time()-t0:.1f}s")
        except psycopg2.Error as e:
            print(f"  [ERR] {ddl_path.name}: {e.pgerror or e}")
            cur.close()
            conn.close()
            sys.exit(1)

    # Verify tables exist
    cur.execute(
        "SELECT tablename FROM pg_tables WHERE schemaname = %s ORDER BY tablename",
        (schema,),
    )
    tables = [r[0] for r in cur.fetchall()]
    print(f"\n  Tables in schema '{schema}' ({len(tables)}): {', '.join(tables)}")

    # Verify ENUMs
    cur.execute(
        "SELECT typname FROM pg_type JOIN pg_namespace ON pg_type.typnamespace = pg_namespace.oid "
        "WHERE nspname = %s AND typtype = 'e' ORDER BY typname",
        (schema,),
    )
    enums = [r[0] for r in cur.fetchall()]
    print(f"  ENUMs ({len(enums)}): {', '.join(enums)}")

    cur.close()
    conn.close()
    print("\n[DONE] DDL applied successfully.")


def main() -> int:
    _load_env()

    parser = argparse.ArgumentParser(description="Apply AgroNova DDL to Neon/PostgreSQL")
    parser.add_argument(
        "--conn",
        default=os.getenv("DATABASE_URL_UNPOOLED") or os.getenv("DATABASE_URL"),
        help="Unpooled connection string (or DATABASE_URL_UNPOOLED from .env)",
    )
    parser.add_argument("--schema", default=os.getenv("DB_SCHEMA", "agronova"))
    args = parser.parse_args()

    if not args.conn:
        print("FAIL: DATABASE_URL_UNPOOLED not set.")
        print("  Copy .env.example to .env and fill in the connection strings.")
        print("  Use the UNPOOLED connection for DDL (not the pooler URL).")
        return 1

    try:
        apply(args.conn, args.schema)
    except psycopg2.OperationalError as e:
        print(f"FAIL: connection error — {e}")
        print("  Check that the connection string is correct and Neon project is active.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())

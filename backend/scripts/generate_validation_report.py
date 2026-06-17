"""
Generates docs/backend/neon_validation_report.md after a successful ETL load.

Queries:
  - Row counts per table (agronova schema)
  - Disk size per table (data + indexes)
  - Total schema size
  - Compares against expected CSV row counts
  - Wall-clock timing for the last pipeline run (from logs/report_*.json)

Usage:
    python -m backend.scripts.generate_validation_report
"""
from __future__ import annotations

import glob
import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path

import psycopg2

ROOT = Path(__file__).resolve().parents[2]
REPORT_PATH = ROOT / "docs" / "backend" / "neon_validation_report.md"

# Expected CSV row counts (from ETL dry-run: 2026-06-16)
EXPECTED_COUNTS: dict[str, int] = {
    "dim_fecha":              4_018,
    "dim_region":                 5,
    "dim_sucursal":               5,
    "dim_deposito":               3,
    "dim_vendedor":              48,
    "dim_proveedor":             15,
    "dim_producto":           2_500,
    "dim_cliente":            4_000,
    "fact_compras":         150_000,
    "fact_inventario":       39_600,
    "fact_ventas":        1_500_000,
    "fact_logistica":       200_000,
    "cotizaciones_externas":  2_870,
}


def _load_env():
    try:
        from dotenv import load_dotenv
        load_dotenv(ROOT / ".env")
    except ImportError:
        pass


def _last_pipeline_elapsed() -> str:
    """Return wall-clock seconds from the most recent pipeline run log, or N/A."""
    logs = sorted(glob.glob(str(ROOT / "logs" / "report_*.json")))
    if not logs:
        return "N/A"
    with open(logs[-1], encoding="utf-8") as f:
        try:
            d = json.load(f)
            s = d.get("elapsed_s", "N/A")
            return f"{s}s" if s != "N/A" else "N/A"
        except Exception:
            return "N/A"


def generate(conn_str: str, schema: str = "agronova") -> None:
    print("Connecting to Neon...")
    t_start = time.time()
    conn = psycopg2.connect(conn_str)
    conn.autocommit = True
    cur = conn.cursor()

    # PostgreSQL version
    cur.execute("SELECT version()")
    pg_version = cur.fetchone()[0].split(",")[0]

    # Row counts
    cur.execute(
        "SELECT tablename FROM pg_tables WHERE schemaname = %s ORDER BY tablename",
        (schema,),
    )
    tables = [r[0] for r in cur.fetchall()]

    rows: dict[str, int] = {}
    for t in tables:
        cur.execute(f"SELECT COUNT(*) FROM {schema}.{t}")
        rows[t] = cur.fetchone()[0]

    # Table sizes
    cur.execute(
        """
        SELECT
            tablename,
            pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total,
            pg_total_relation_size(schemaname||'.'||tablename) AS bytes
        FROM pg_tables
        WHERE schemaname = %s
        ORDER BY bytes DESC
        """,
        (schema,),
    )
    sizes = {r[0]: (r[1], r[2]) for r in cur.fetchall()}

    # Schema total size
    cur.execute(
        """
        SELECT pg_size_pretty(SUM(pg_total_relation_size(schemaname||'.'||tablename)))
        FROM pg_tables WHERE schemaname = %s
        """,
        (schema,),
    )
    total_size = cur.fetchone()[0]

    # View count
    cur.execute(
        "SELECT COUNT(*) FROM pg_views WHERE schemaname = %s", (schema,)
    )
    view_count = cur.fetchone()[0]

    # ENUM count
    cur.execute(
        "SELECT typname FROM pg_type JOIN pg_namespace ON pg_type.typnamespace = pg_namespace.oid "
        "WHERE nspname = %s AND typtype = 'e' ORDER BY typname",
        (schema,),
    )
    enums = [r[0] for r in cur.fetchall()]

    cur.close()
    conn.close()

    elapsed_connect = time.time() - t_start
    last_etl_time = _last_pipeline_elapsed()
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # Build markdown
    total_rows_db = sum(rows.values())
    total_rows_csv = sum(EXPECTED_COUNTS.values())

    lines: list[str] = [
        "# AgroNova — Neon Validation Report",
        "",
        f"**Generado:** {ts}  ",
        f"**Schema:** `{schema}` | **PostgreSQL:** {pg_version}  ",
        f"**Tiempo de consulta:** {elapsed_connect:.1f}s  ",
        f"**Último ETL registrado:** {last_etl_time}",
        "",
        "---",
        "",
        "## Conteo de registros",
        "",
        f"| Tabla | DB | CSV esperado | Δ | Estado |",
        f"|---|---:|---:|---:|---|",
    ]

    all_ok = True
    for t in sorted(EXPECTED_COUNTS):
        db_n = rows.get(t, -1)
        exp_n = EXPECTED_COUNTS[t]
        delta = db_n - exp_n if db_n >= 0 else "N/A"
        if db_n < 0:
            status = "❌ NO EXISTE"
            all_ok = False
        elif db_n != exp_n:
            status = "⚠️ DIFERENCIA"
            all_ok = False
        else:
            status = "✅ OK"
        lines.append(
            f"| `{t}` | {db_n:,} | {exp_n:,} | {delta:+,} | {status} |"
            if isinstance(delta, int) else
            f"| `{t}` | {db_n} | {exp_n:,} | {delta} | {status} |"
        )

    lines += [
        f"| **TOTAL** | **{total_rows_db:,}** | **{total_rows_csv:,}** | {total_rows_db-total_rows_csv:+,} | {'✅' if all_ok else '⚠️'} |",
        "",
        "---",
        "",
        "## Tamaño por tabla",
        "",
        "| Tabla | Tamaño total (datos + índices) | Bytes |",
        "|---|---:|---:|",
    ]

    for t, (size_str, size_bytes) in sorted(sizes.items(), key=lambda x: -x[1][1]):
        lines.append(f"| `{t}` | {size_str} | {size_bytes:,} |")

    lines += [
        f"| **TOTAL SCHEMA** | **{total_size}** | — |",
        "",
        "---",
        "",
        "## Objetos de base de datos",
        "",
        f"- **Tablas:** {len(tables)}",
        f"- **Vistas analíticas:** {view_count}",
        f"- **ENUMs:** {', '.join(f'`{e}`' for e in enums) or 'ninguno'}",
        "",
        "---",
        "",
        "## Estimación de uso Neon free tier",
        "",
        f"- **Usado:** {total_size} / 512 MB",
        "- **Estado:** " + (
            "✅ Dentro del límite free tier"
            if "MB" in total_size and float(total_size.split()[0]) < 450
            else "⚠️ Cercano al límite (considerar upgrade a Launch)"
        ),
        "",
        "---",
        "",
        "## Próximos pasos",
        "",
        "1. **Migrar `GET /api/kpis`** — swappear `kpis_service.py` a `VentaRepository`.",
        "   - Revenue y margen ya tienen el SQL equivalente en `backend/repositories/venta_repository.py`.",
        "   - OTIF en `backend/repositories/logistica_repository.py`.",
        "2. **Migrar `GET /api/logistics/risk` y `/costs`** — leer desde `fact_logistica` en lugar de JSON.",
        "3. **Migrar `GET /api/gis/provincias` y `/coverage`** — usar vistas `v_*` de `03_vistas_analiticas.sql`.",
        "4. Dejar para después: `/hotspots`, `/territories` (requieren PostGIS), `/api/logistics/routes`.",
    ]

    REPORT_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"[OK] Report written: {REPORT_PATH}")
    print(f"     Total rows in DB: {total_rows_db:,} / expected {total_rows_csv:,}")
    print(f"     Schema size: {total_size}")
    print(f"     Status: {'ALL OK' if all_ok else 'DISCREPANCIES FOUND — see report'}")


def main() -> int:
    _load_env()
    conn_str = os.getenv("DATABASE_URL_UNPOOLED") or os.getenv("DATABASE_URL")
    if not conn_str:
        print("FAIL: DATABASE_URL_UNPOOLED not set — copy .env.example to .env first.")
        return 1
    try:
        generate(conn_str, os.getenv("DB_SCHEMA", "agronova"))
    except psycopg2.OperationalError as e:
        print(f"FAIL: {e}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())

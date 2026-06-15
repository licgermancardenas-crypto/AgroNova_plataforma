"""
run_pipeline.py — Pipeline principal de AgroNova.

Flujo:
  1. Extraccion:    Lee 13 CSVs con validacion de schema
  2. Transformacion: Tipado, limpieza, enriquecimiento, reglas de negocio
  3. Carga:          Inserta en PostgreSQL / Neon en orden FK-safe
  4. Verificacion:   Conteos post-carga
  5. Reporte:        JSON + TXT con resultado de la ejecucion

Uso:
  python etl/run_pipeline.py --conn "postgresql://..."
  python etl/run_pipeline.py --dry-run   (extrae y transforma, no carga)
  python etl/run_pipeline.py --skip-load (idem, mas verbose)

Variables de entorno:
  DATABASE_URL  — connection string (alternativa a --conn)
"""

import argparse
import json
import logging
import os
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Optional

# Asegurar que el root del proyecto este en el path
ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

from etl.extract   import extract_all
from etl.transform import transform_all
from etl.load      import load_all, verify_load

# ── Logging ───────────────────────────────────────────────────────────

LOGS_DIR = ROOT / "logs"
LOGS_DIR.mkdir(exist_ok=True)

RUN_TS   = datetime.now().strftime("%Y%m%d_%H%M%S")
LOG_FILE = LOGS_DIR / f"pipeline_{RUN_TS}.log"


def setup_logging(verbose: bool = False) -> logging.Logger:
    level = logging.DEBUG if verbose else logging.INFO
    fmt   = "%(asctime)s  %(levelname)-8s  %(message)s"
    datefmt = "%H:%M:%S"

    logging.basicConfig(
        level=level,
        format=fmt,
        datefmt=datefmt,
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler(LOG_FILE, encoding="utf-8"),
        ],
    )
    return logging.getLogger("agronova.pipeline")


# ── Reporte ───────────────────────────────────────────────────────────

def build_report(
    run_ts: str,
    fase_resultados: dict,
    elapsed_total: float,
    conn_str: str = None,
    dry_run: bool = False,
) -> dict:
    return {
        "run_id":       run_ts,
        "timestamp":    datetime.now().isoformat(),
        "dry_run":      dry_run,
        "elapsed_s":    round(elapsed_total, 2),
        "database":     conn_str[:30] + "..." if conn_str else "N/A (dry-run)",
        "fases":        fase_resultados,
        "status":       "SUCCESS" if all(
            f.get("ok") for f in fase_resultados.values()
        ) else "FAILED",
    }


def save_report(report: dict) -> Path:
    path = LOGS_DIR / f"report_{RUN_TS}.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    return path


def print_summary(report: dict) -> None:
    status = report["status"]
    emoji  = "[OK]" if status == "SUCCESS" else "[ERR]"
    print("\n" + "=" * 65)
    print(f"  PIPELINE {status}  {emoji}")
    print(f"  Run ID:   {report['run_id']}")
    print(f"  Duracion: {report['elapsed_s']:.1f}s")
    print(f"  Modo:     {'Dry-run (sin carga)' if report['dry_run'] else 'Completo'}")
    print("=" * 65)
    for fase, info in report["fases"].items():
        ok_label = "[OK]  " if info.get("ok") else "[ERR]"
        detalle  = info.get("detalle", "")
        print(f"  {ok_label} {fase:<20} {detalle}")
    print("=" * 65 + "\n")


# ── Main ──────────────────────────────────────────────────────────────

def run(conn_str: Optional[str] = None,
        schema: str = "agronova",
        dry_run: bool = False,
        verbose: bool = False) -> dict:
    logger = setup_logging(verbose)
    t_global = time.time()
    fases = {}

    logger.info("=" * 60)
    logger.info("  AgroNova Argentina S.A. — Pipeline ETL")
    logger.info(f"  Run: {RUN_TS}  |  Modo: {'dry-run' if dry_run else 'completo'}")
    logger.info("=" * 60)

    # ── Fase 1: Extract ───────────────────────────────────────────
    logger.info("\n[FASE 1] EXTRACCION")
    t0 = time.time()
    try:
        datasets = extract_all()
        filas_ext = sum(len(df) for df in datasets.values())
        fases["extract"] = {
            "ok": True,
            "tablas": len(datasets),
            "filas": filas_ext,
            "duracion_s": round(time.time() - t0, 2),
            "detalle": f"{len(datasets)} tablas, {filas_ext:,} filas",
        }
        logger.info(f"[FASE 1] OK — {len(datasets)} tablas, {filas_ext:,} filas ({time.time()-t0:.1f}s)")
    except Exception as e:
        logger.error(f"[FASE 1] FAILED: {e}")
        fases["extract"] = {"ok": False, "error": str(e), "detalle": str(e)[:80]}
        report = build_report(RUN_TS, fases, time.time()-t_global, conn_str, dry_run)
        save_report(report)
        print_summary(report)
        return report

    # ── Fase 2: Transform ─────────────────────────────────────────
    logger.info("\n[FASE 2] TRANSFORMACION")
    t0 = time.time()
    try:
        datasets = transform_all(datasets)
        fases["transform"] = {
            "ok": True,
            "duracion_s": round(time.time() - t0, 2),
            "detalle": "Tipado, limpieza, enriquecimiento y BR OK",
        }
        logger.info(f"[FASE 2] OK ({time.time()-t0:.1f}s)")
    except ValueError as e:
        logger.error(f"[FASE 2] FAILED: {e}")
        fases["transform"] = {"ok": False, "error": str(e), "detalle": str(e)[:80]}
        report = build_report(RUN_TS, fases, time.time()-t_global, conn_str, dry_run)
        save_report(report)
        print_summary(report)
        return report

    # ── Fase 3: Load ──────────────────────────────────────────────
    if dry_run or not conn_str:
        logger.info("\n[FASE 3] CARGA — SALTADA (dry-run o sin --conn)")
        fases["load"] = {
            "ok": True,
            "detalle": "Saltada (dry-run)",
            "duracion_s": 0,
        }
        fases["verify"] = {"ok": True, "detalle": "N/A", "duracion_s": 0}
    else:
        logger.info("\n[FASE 3] CARGA A POSTGRESQL")
        t0 = time.time()
        try:
            conteos = load_all(datasets, conn_str, schema)
            total_cargadas = sum(conteos.values())
            fases["load"] = {
                "ok": True,
                "tablas": len(conteos),
                "filas": total_cargadas,
                "duracion_s": round(time.time() - t0, 2),
                "detalle": f"{len(conteos)} tablas, {total_cargadas:,} filas",
            }
            logger.info(f"[FASE 3] OK ({time.time()-t0:.1f}s)")
        except Exception as e:
            logger.error(f"[FASE 3] FAILED: {e}")
            fases["load"] = {"ok": False, "error": str(e), "detalle": str(e)[:80]}
            report = build_report(RUN_TS, fases, time.time()-t_global, conn_str, dry_run)
            save_report(report)
            print_summary(report)
            return report

        # ── Fase 4: Verify ────────────────────────────────────────
        logger.info("\n[FASE 4] VERIFICACION POST-CARGA")
        t0 = time.time()
        try:
            conteos_db = verify_load(conn_str, schema)
            fases["verify"] = {
                "ok": True,
                "conteos": conteos_db,
                "duracion_s": round(time.time() - t0, 2),
                "detalle": f"{len(conteos_db)} tablas verificadas",
            }
            logger.info(f"[FASE 4] OK ({time.time()-t0:.1f}s)")
        except Exception as e:
            logger.warning(f"[FASE 4] WARNING — verificacion fallida: {e}")
            fases["verify"] = {"ok": True, "detalle": f"Warning: {str(e)[:60]}"}

    # ── Reporte final ─────────────────────────────────────────────
    report = build_report(RUN_TS, fases, time.time()-t_global, conn_str, dry_run)
    report_path = save_report(report)
    logger.info(f"\nReporte guardado: {report_path}")
    print_summary(report)
    return report


# ── CLI ───────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="AgroNova ETL Pipeline",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Ejemplos:
  python etl/run_pipeline.py --dry-run
  python etl/run_pipeline.py --conn "postgresql://user:pass@host/db"
  python etl/run_pipeline.py --conn "$DATABASE_URL" --schema agronova -v
        """,
    )
    parser.add_argument("--conn",    default=os.getenv("DATABASE_URL"),
                        help="PostgreSQL connection string (o DATABASE_URL)")
    parser.add_argument("--schema",  default="agronova")
    parser.add_argument("--dry-run", action="store_true",
                        help="Extrae y transforma, pero no carga a la DB")
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args()

    result = run(
        conn_str=args.conn,
        schema=args.schema,
        dry_run=args.dry_run,
        verbose=args.verbose,
    )
    sys.exit(0 if result.get("status") == "SUCCESS" else 1)


if __name__ == "__main__":
    main()

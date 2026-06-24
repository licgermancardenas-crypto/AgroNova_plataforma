"""
Generate web/public/data/gis_outputs/network_analysis.json
from real Neon data (fact_logistica + fact_inventario + dim_deposito + dim_sucursal).

Usage:
    python scripts/generate_network_analysis.py
"""
from __future__ import annotations

import datetime
import json
import os
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv()

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

DB_URL  = os.environ["DATABASE_URL"]
engine  = create_engine(DB_URL, pool_pre_ping=True)

OUT_DIR = pathlib.Path(__file__).parent.parent / "web" / "public" / "data" / "gis_outputs"
OUT_DIR.mkdir(parents=True, exist_ok=True)


def main():
    from backend.services.network_service import NetworkService

    with Session(engine) as db:
        svc = NetworkService(db)
        print("Fetching depots...")
        depots = svc.get_depots()
        print(f"  {len(depots)} depots")

        print("Fetching flows...")
        flows  = svc.get_flows()
        print(f"  {len(flows)} flow records")

        print("Computing status...")
        status = svc.get_status()

    out = {
        "generated_at": datetime.datetime.utcnow().isoformat() + "Z",
        "status":   status,
        "depots":   depots,
        "flows":    flows,
    }

    path = OUT_DIR / "network_analysis.json"
    path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Written: {path}")

    bn = [d for d in depots if d.get("load_status") in ("CRITICO", "ALTO_USO")]
    print(f"  Depots: {len(depots)} | Bottlenecks: {len(bn)} | "
          f"OTIF: {status.get('otif_global', 0):.1f}% | "
          f"Util: {status.get('utilizacion_promedio', 0):.1f}%")


if __name__ == "__main__":
    main()

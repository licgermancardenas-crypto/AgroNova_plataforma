from __future__ import annotations

import json
from pathlib import Path

from sqlalchemy.orm import Session

from backend.repositories.venta_repository import VentaRepository
from backend.repositories.cliente_repository import ClienteRepository
from backend.repositories.logistica_repository import LogisticaRepository

_GIS_DIR = Path(__file__).resolve().parents[2] / "data" / "gis_outputs"


def _fallback_kpis(anio: int) -> dict:
    try:
        with open(_GIS_DIR / "kpis.json") as f:
            data = json.load(f)
        for item in data:
            if item.get("anio") == anio:
                return item
        return data[0] if data else {}
    except Exception:
        return {
            "anio": anio,
            "revenue_total_ars": 0,
            "margen_bruto_pct": 0,
            "clientes_activos": 0,
            "clientes_total": 0,
            "churn_rate_pct": 0,
            "otif_pct": 0,
        }


def get_kpis(anio: int, db: Session | None) -> dict:
    if db is None:
        return _fallback_kpis(anio)
    try:
        v_repo = VentaRepository(db)
        c_repo = ClienteRepository(db)
        l_repo = LogisticaRepository(db)

        revenue = v_repo.revenue_total_anio(anio)
        margen = v_repo.margen_bruto_anio(anio)
        clientes_activos = v_repo.clientes_activos_anio(anio)
        clientes_total = c_repo.count()
        otif = l_repo.otif_pct_anio(anio)

        prev_year = v_repo.clientes_activos_anio(anio - 1) or 1
        churn = round(max(0, (prev_year - clientes_activos) / prev_year * 100), 2)

        return {
            "anio": anio,
            "revenue_total_ars": revenue,
            "margen_bruto_pct": margen,
            "clientes_activos": clientes_activos,
            "clientes_total": clientes_total,
            "churn_rate_pct": churn,
            "otif_pct": otif,
        }
    except Exception:
        return _fallback_kpis(anio)

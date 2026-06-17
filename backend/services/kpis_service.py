"""
Real KPI aggregation from data/csv/ — no mock, no ML. Reuses the loaders
already in gis/geo_utils.py (load_ventas, load_logistica, load_clientes) so
there's a single source of truth for column names / filters.
"""
from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from sqlalchemy.orm import Session  # noqa: E402

from gis.geo_utils import load_ventas, load_logistica, load_clientes  # noqa: E402

from backend.repositories.cliente_repository import ClienteRepository  # noqa: E402
from backend.repositories.logistica_repository import LogisticaRepository  # noqa: E402
from backend.repositories.venta_repository import VentaRepository  # noqa: E402
from backend.schemas.kpis import KPIResponse


def compute_kpis_db(db: Session) -> KPIResponse:
    """KPI aggregation backed by Neon — replaces CSV reads with SQL queries."""
    vr = VentaRepository(db)
    cr = ClienteRepository(db)
    lr = LogisticaRepository(db)

    anio = vr.max_anio()
    revenue_total_ars, margen_bruto_pct = vr.revenue_y_margen_anio(anio)
    clientes_total = cr.count()
    clientes_activos = cr.count_activos()
    churn_rate_pct = cr.churn_rate_pct()
    otif_pct = lr.otif_pct_anio(anio)

    return KPIResponse(
        anio=anio,
        revenue_total_ars=round(revenue_total_ars, 2),
        margen_bruto_pct=margen_bruto_pct,
        clientes_activos=clientes_activos,
        clientes_total=clientes_total,
        churn_rate_pct=churn_rate_pct,
        otif_pct=otif_pct,
    )


def compute_kpis() -> KPIResponse:
    ventas = load_ventas()
    anio_actual = int(ventas["anio"].max())
    ventas_actual = ventas[ventas["anio"] == anio_actual]

    revenue_total_ars = float(ventas_actual["total_ars"].sum())
    margen_bruto_pct = float(
        ventas_actual["margen_bruto_ars"].sum() / ventas_actual["total_ars"].sum() * 100
    )

    clientes = load_clientes()
    clientes_total = int(len(clientes))
    clientes_activos = int(clientes["activo"].sum())
    churn_rate_pct = float((1 - clientes["activo"].mean()) * 100)

    log = load_logistica()
    log_actual = log[log["anio"] == anio_actual]
    otif_pct = float(log_actual["otif"].mean() * 100)

    return KPIResponse(
        anio=anio_actual,
        revenue_total_ars=round(revenue_total_ars, 2),
        margen_bruto_pct=round(margen_bruto_pct, 2),
        clientes_activos=clientes_activos,
        clientes_total=clientes_total,
        churn_rate_pct=round(churn_rate_pct, 2),
        otif_pct=round(otif_pct, 2),
    )

from __future__ import annotations

from sqlalchemy import func, select

from backend.models.orm import DimFecha, FactVentas
from backend.repositories.base import BaseRepository


class VentaRepository(BaseRepository[FactVentas]):
    model = FactVentas

    def max_anio(self) -> int | None:
        stmt = select(func.max(DimFecha.anio)).select_from(FactVentas).join(
            DimFecha, FactVentas.fecha_id == DimFecha.fecha_id
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def revenue_y_margen_anio(self, anio: int) -> tuple[float, float]:
        """Returns (revenue_total_ars, margen_bruto_pct) for the given year —
        the SQL equivalent of backend/services/kpis_service.py's pandas
        aggregation, kept here so migrating /api/kpis is a single swap."""
        stmt = (
            select(func.sum(FactVentas.total_ars), func.sum(FactVentas.margen_bruto_ars))
            .join(DimFecha, FactVentas.fecha_id == DimFecha.fecha_id)
            .where(DimFecha.anio == anio)
        )
        revenue_total, margen_total = self.db.execute(stmt).one()
        revenue_total = float(revenue_total or 0)
        margen_pct = round(float(margen_total or 0) / revenue_total * 100, 2) if revenue_total else 0.0
        return revenue_total, margen_pct

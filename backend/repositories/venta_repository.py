from __future__ import annotations

from sqlalchemy import select, func
from sqlalchemy.orm import Session

from backend.models.orm import DimCliente, DimFecha, FactVentas
from backend.repositories.base import BaseRepository


class VentaRepository(BaseRepository[FactVentas]):
    model = FactVentas

    def __init__(self, db: Session):
        super().__init__(db)

    def revenue_total_anio(self, anio: int) -> float:
        stmt = (
            select(func.sum(FactVentas.total_ars))
            .join(DimFecha, FactVentas.fecha_id == DimFecha.fecha_id)
            .where(DimFecha.anio == anio)
        )
        result = self.db.execute(stmt).scalar_one()
        return float(result or 0)

    def margen_bruto_anio(self, anio: int) -> float:
        stmt_rev = (
            select(func.sum(FactVentas.total_ars))
            .join(DimFecha, FactVentas.fecha_id == DimFecha.fecha_id)
            .where(DimFecha.anio == anio)
        )
        stmt_mg = (
            select(func.sum(FactVentas.margen_bruto_ars))
            .join(DimFecha, FactVentas.fecha_id == DimFecha.fecha_id)
            .where(DimFecha.anio == anio)
        )
        rev = float(self.db.execute(stmt_rev).scalar_one() or 1)
        mg = float(self.db.execute(stmt_mg).scalar_one() or 0)
        return round(mg / rev * 100, 2)

    def clientes_activos_anio(self, anio: int) -> int:
        stmt = (
            select(func.count(func.distinct(FactVentas.cliente_id)))
            .join(DimFecha, FactVentas.fecha_id == DimFecha.fecha_id)
            .where(DimFecha.anio == anio)
        )
        return self.db.execute(stmt).scalar_one() or 0

    def revenue_by_provincia(self) -> list[dict]:
        stmt = (
            select(
                DimCliente.provincia,
                func.sum(FactVentas.total_ars).label("revenue_ars"),
            )
            .join(DimCliente, FactVentas.cliente_id == DimCliente.cliente_id)
            .group_by(DimCliente.provincia)
            .order_by(func.sum(FactVentas.total_ars).desc())
        )
        rows = self.db.execute(stmt).all()
        return [{"provincia": r.provincia, "revenue_ars": float(r.revenue_ars or 0)} for r in rows]

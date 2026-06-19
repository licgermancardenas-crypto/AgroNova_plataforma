from __future__ import annotations

from sqlalchemy import select, func
from sqlalchemy.orm import Session

from backend.models.orm import DimCliente, DimDeposito, DimSucursal
from backend.repositories.base import BaseRepository


class RoutingRepository(BaseRepository[DimSucursal]):
    model = DimSucursal

    def __init__(self, db: Session):
        super().__init__(db)

    def sucursales(self) -> list[dict]:
        stmt = select(DimSucursal).where(DimSucursal.estado == "Activa")
        rows = self.db.execute(stmt).scalars().all()
        return [
            {
                "sucursal_id": s.sucursal_id,
                "nombre": s.nombre,
                "provincia": s.provincia,
                "lat": float(s.lat) if s.lat else None,
                "lon": float(s.lon) if s.lon else None,
            }
            for s in rows
        ]

    def depositos(self) -> list[dict]:
        stmt = select(DimDeposito).where(DimDeposito.estado == "Operativo")
        rows = self.db.execute(stmt).scalars().all()
        return [
            {
                "deposito_id": d.deposito_id,
                "nombre": d.nombre,
                "sucursal_id": d.sucursal_id,
                "lat": float(d.lat) if d.lat else None,
                "lon": float(d.lon) if d.lon else None,
            }
            for d in rows
        ]

    def provincia_counts(self) -> dict[str, int]:
        stmt = (
            select(DimCliente.provincia, func.count(DimCliente.cliente_id).label("n"))
            .where(DimCliente.activo.is_(True))
            .group_by(DimCliente.provincia)
        )
        rows = self.db.execute(stmt).all()
        return {r.provincia: r.n for r in rows if r.provincia}

    def sucursal_real_counts(self) -> dict[int, int]:
        stmt = (
            select(
                DimCliente.sucursal_id_asignada,
                func.count(DimCliente.cliente_id).label("n"),
            )
            .where(DimCliente.activo.is_(True), DimCliente.sucursal_id_asignada.isnot(None))
            .group_by(DimCliente.sucursal_id_asignada)
        )
        rows = self.db.execute(stmt).all()
        return {r.sucursal_id_asignada: r.n for r in rows}

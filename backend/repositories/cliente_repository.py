from __future__ import annotations

from sqlalchemy import select, func
from sqlalchemy.orm import Session

from backend.models.orm import DimCliente
from backend.repositories.base import BaseRepository


class ClienteRepository(BaseRepository[DimCliente]):
    model = DimCliente

    def __init__(self, db: Session):
        super().__init__(db)

    def activos(self) -> list[DimCliente]:
        stmt = select(DimCliente).where(DimCliente.activo.is_(True))
        return list(self.db.execute(stmt).scalars().all())

    def count_activos(self) -> int:
        stmt = select(func.count()).select_from(DimCliente).where(DimCliente.activo.is_(True))
        return self.db.execute(stmt).scalar_one()

    def by_provincia(self) -> list[dict]:
        stmt = (
            select(DimCliente.provincia, func.count(DimCliente.cliente_id).label("n"))
            .group_by(DimCliente.provincia)
            .order_by(func.count(DimCliente.cliente_id).desc())
        )
        rows = self.db.execute(stmt).all()
        return [{"provincia": r.provincia, "n": r.n} for r in rows]

    def by_segmento(self) -> list[dict]:
        stmt = (
            select(DimCliente.segmento, func.count(DimCliente.cliente_id).label("n"))
            .group_by(DimCliente.segmento)
            .order_by(func.count(DimCliente.cliente_id).desc())
        )
        rows = self.db.execute(stmt).all()
        return [{"segmento": r.segmento, "n": r.n} for r in rows]

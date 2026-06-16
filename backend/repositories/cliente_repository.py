from __future__ import annotations

from sqlalchemy import func, select

from backend.models.orm import DimCliente
from backend.repositories.base import BaseRepository


class ClienteRepository(BaseRepository[DimCliente]):
    model = DimCliente

    def count_activos(self) -> int:
        stmt = select(func.count()).select_from(DimCliente).where(DimCliente.activo.is_(True))
        return self.db.execute(stmt).scalar_one()

    def churn_rate_pct(self) -> float:
        total = self.count()
        if total == 0:
            return 0.0
        activos = self.count_activos()
        return round((1 - activos / total) * 100, 2)

    def by_provincia(self, provincia: str) -> list[DimCliente]:
        stmt = select(DimCliente).where(DimCliente.provincia == provincia)
        return list(self.db.execute(stmt).scalars().all())

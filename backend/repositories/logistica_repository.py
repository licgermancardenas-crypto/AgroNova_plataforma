from __future__ import annotations

from sqlalchemy import case, func, select

from backend.models.orm import FactLogistica
from backend.repositories.base import BaseRepository


class LogisticaRepository(BaseRepository[FactLogistica]):
    model = FactLogistica

    def otif_pct_global(self) -> float:
        """OTIF = entregado a tiempo (estado='Entregado' AND dias_demora=0) —
        same definition as gis/geo_utils.py::load_logistica()'s otif column."""
        otif_count = func.sum(
            case((FactLogistica.estado == "Entregado", 1), else_=0)
            * case((FactLogistica.dias_demora == 0, 1), else_=0)
        )
        total = func.count()
        stmt = select(otif_count, total).select_from(FactLogistica)
        otif, total_n = self.db.execute(stmt).one()
        return round(float(otif or 0) / total_n * 100, 2) if total_n else 0.0

    def by_deposito(self, deposito_id: int) -> list[FactLogistica]:
        stmt = select(FactLogistica).where(FactLogistica.deposito_origen_id == deposito_id)
        return list(self.db.execute(stmt).scalars().all())

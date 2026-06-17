from __future__ import annotations

from sqlalchemy import select

from backend.models.orm import DimProducto
from backend.repositories.base import BaseRepository


class ProductoRepository(BaseRepository[DimProducto]):
    model = DimProducto

    def by_categoria(self, categoria: str) -> list[DimProducto]:
        stmt = select(DimProducto).where(DimProducto.categoria == categoria)
        return list(self.db.execute(stmt).scalars().all())

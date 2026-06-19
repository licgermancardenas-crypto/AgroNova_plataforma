from __future__ import annotations

from typing import Generic, TypeVar

from sqlalchemy import select
from sqlalchemy.orm import Session

ModelT = TypeVar("ModelT")


class BaseRepository(Generic[ModelT]):
    model: type[ModelT]

    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, id_: object) -> ModelT | None:
        return self.db.get(self.model, id_)

    def get_all(self, limit: int = 100, offset: int = 0) -> list[ModelT]:
        stmt = select(self.model).limit(limit).offset(offset)
        return list(self.db.execute(stmt).scalars().all())

    def count(self) -> int:
        from sqlalchemy import func
        stmt = select(func.count()).select_from(self.model)
        return self.db.execute(stmt).scalar_one()

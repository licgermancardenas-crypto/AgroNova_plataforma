from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import declarative_base, sessionmaker

from .config import get_settings

settings = get_settings()

DB_SCHEMA = settings.db_schema

engine: Engine | None = (
    create_engine(settings.database_url, pool_pre_ping=True) if settings.database_url else None
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine) if engine else None

Base = declarative_base()


def get_db():
    if SessionLocal is None:
        raise RuntimeError(
            "DATABASE_URL not configured — copy .env.example to .env and set it."
        )
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_db_or_none():
    """Yields None when DATABASE_URL isn't configured — for endpoints with CSV fallback."""
    if SessionLocal is None:
        yield None
        return
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

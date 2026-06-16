"""
SQLAlchemy scaffolding for the future Neon PostgreSQL migration.

Not wired into any endpoint today — every router reads directly from
data/csv/*.csv and data/gis_outputs/*.json (see backend/services/). This
module exists so the ORM layer (backend/models/) has somewhere to bind once
DATABASE_URL is set, without requiring a live DB connection for the rest of
the platform to run.
"""
from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from .config import get_settings

settings = get_settings()

engine = create_engine(settings.database_url, pool_pre_ping=True) if settings.database_url else None
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine) if engine else None

Base = declarative_base()


def get_db():
    """FastAPI dependency — raises if DATABASE_URL isn't configured. Unused until Neon is connected."""
    if SessionLocal is None:
        raise RuntimeError("DATABASE_URL not configured — no DB connection available yet.")
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

"""
SQLAlchemy connection layer for Neon PostgreSQL.

Not wired into any router yet (see docs/backend/backend_audit.md §5) — every
endpoint still reads data/csv/*.csv and data/gis_outputs/*.json directly.
This module exists so the ORM layer (backend/models/orm.py) and the
repository layer (backend/repositories/) have somewhere to bind once
DATABASE_URL is set, and so backend/scripts/test_connection.py has an engine
to test against.

engine and SessionLocal are None until DATABASE_URL is configured — importing
this module never raises just because there's no DB yet.
"""
from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import declarative_base, sessionmaker

from .config import get_settings  # loads .env as a side effect — see config.py docstring

settings = get_settings()

DB_SCHEMA = settings.db_schema

engine: Engine | None = (
    create_engine(settings.database_url, pool_pre_ping=True) if settings.database_url else None
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine) if engine else None

Base = declarative_base()


def get_db():
    """FastAPI dependency. Raises if DATABASE_URL isn't configured — no
    endpoint depends on this today, so the failure mode only matters once
    a router actually starts using it."""
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
    """FastAPI dependency that yields None when DATABASE_URL isn't configured.
    Use this in endpoints that have a CSV/JSON fallback — they degrade
    gracefully instead of returning 500 when the DB is unavailable."""
    if SessionLocal is None:
        yield None
        return
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

"""
AgroNova v3.0 — Backend Platform settings.

DATABASE_URL is intentionally optional: Neon PostgreSQL isn't connected yet
(see backend/core/db.py and backend/models/). Current endpoints read
directly from data/csv/*.csv and data/gis_outputs/*.json via the existing
gis/ pipeline — there is no live DB dependency today.
"""
from __future__ import annotations

import os
from pathlib import Path
from functools import lru_cache

from pydantic import BaseModel


class Settings(BaseModel):
    app_name: str = "AgroNova Backend Platform"
    version: str = "3.0"

    repo_root: Path = Path(__file__).resolve().parents[2]

    @property
    def data_csv_dir(self) -> Path:
        return self.repo_root / "data" / "csv"

    @property
    def gis_outputs_dir(self) -> Path:
        return self.repo_root / "data" / "gis_outputs"

    @property
    def geo_dir(self) -> Path:
        return self.repo_root / "web" / "public" / "data" / "geo"

    database_url: str | None = os.getenv("DATABASE_URL")

    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
    ]


@lru_cache
def get_settings() -> Settings:
    return Settings()

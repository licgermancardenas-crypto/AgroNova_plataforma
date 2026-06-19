from __future__ import annotations

import os
from pathlib import Path
from functools import lru_cache

from dotenv import load_dotenv
from pydantic import BaseModel

_REPO_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(_REPO_ROOT / ".env")


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
    database_url_unpooled: str | None = os.getenv("DATABASE_URL_UNPOOLED")
    db_schema: str = os.getenv("DB_SCHEMA", "agronova")

    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
    ]


@lru_cache
def get_settings() -> Settings:
    return Settings()

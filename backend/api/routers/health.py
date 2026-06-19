from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.core.database import get_db_or_none

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health")
def health(db: Session | None = Depends(get_db_or_none)):
    db_ok = False
    if db is not None:
        try:
            db.execute(text("SELECT 1"))
            db_ok = True
        except Exception:
            pass
    return {
        "status": "ok",
        "db": "connected" if db_ok else "fallback",
    }

from __future__ import annotations

import json
from pathlib import Path

_GIS_DIR = Path(__file__).resolve().parents[2] / "data" / "gis_outputs"


def _load_json(name: str) -> list | dict:
    try:
        with open(_GIS_DIR / name) as f:
            return json.load(f)
    except Exception:
        return []


def get_churn() -> dict:
    data = _load_json("churn.json")
    return {
        "status": "placeholder",
        "note": "No trained model artifact yet — values mirror the frontend mock dataset.",
        "data": data if isinstance(data, list) else [],
    }


def get_forecast() -> dict:
    data = _load_json("forecast.json")
    return {
        "status": "placeholder",
        "note": "No trained model artifact yet — values mirror the frontend mock dataset.",
        "data": data if isinstance(data, list) else [],
    }


def get_recommendations() -> dict:
    data = _load_json("recommendations.json")
    return {
        "status": "placeholder",
        "note": "No trained model artifact yet — values mirror the frontend mock dataset.",
        "data": data if isinstance(data, list) else [],
    }


def get_stock_risk() -> dict:
    data = _load_json("stock_risk.json")
    return {
        "status": "placeholder",
        "note": "No trained model artifact yet — values mirror the frontend mock dataset.",
        "data": data if isinstance(data, list) else [],
    }

from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    version: str


class GeoJSONFeatureCollection(BaseModel):
    """Pass-through wrapper — geometry typing is left as dict to avoid
    re-deriving the full GeoJSON spec; FastAPI still validates structure."""
    type: str
    features: list[dict]

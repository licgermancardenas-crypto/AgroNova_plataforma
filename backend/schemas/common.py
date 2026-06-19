from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    version: str


class GeoJSONFeatureCollection(BaseModel):
    type: str
    features: list[dict]

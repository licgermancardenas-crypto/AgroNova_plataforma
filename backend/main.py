from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.core.config import get_settings
from backend.api.routers import health, gis, kpis, logistics, ml, spatial, ai_spatial, environment, customer_spatial, territory, network

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    description="AgroNova backend — PostGIS Spatial Intelligence + AI Spatial Analytics",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(gis.router)
app.include_router(kpis.router)
app.include_router(logistics.router)
app.include_router(ml.router)
app.include_router(spatial.router)
app.include_router(ai_spatial.router)
app.include_router(environment.router)
app.include_router(customer_spatial.router)
app.include_router(territory.router)
app.include_router(network.router)


@app.get("/")
def root():
    return {"name": settings.app_name, "version": settings.version, "docs": "/docs"}

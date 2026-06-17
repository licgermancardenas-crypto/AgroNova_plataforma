"""
AgroNova v2.0 — PostGIS Loader (Sprint GIS-05)
Reads the GeoDataFrames already built in gis/geodataframes.py and syncs them
into the spatial_* tables defined in database/postgis/02_spatial_tables.sql.

No real PostGIS instance is required to exist yet — this module only needs
a real connection at call time, via the DATABASE_URL environment variable.
sqlalchemy / geoalchemy2 / psycopg2 are imported lazily inside the functions
that need them (none are installed in this environment yet) so the module
itself stays importable and inspectable without those dependencies.

Activation, once a real instance exists:
    psql $DATABASE_URL -f database/postgis/01_enable_postgis.sql
    psql $DATABASE_URL -f database/postgis/02_spatial_tables.sql
    psql $DATABASE_URL -f database/postgis/03_spatial_indexes.sql
    psql $DATABASE_URL -f database/postgis/04_spatial_views.sql
    python -m gis.postgis_loader
"""
from __future__ import annotations

import os

from shapely.geometry import MultiPolygon

from .geodataframes import (
    CRS_PROJECTED,
    CRS_WGS84,
    clientes_gdf,
    depositos_gdf,
    provincias_gdf,
    sucursales_gdf,
)

SCHEMA = "agronova"

_MISSING_DEPS_MSG = (
    "PostGIS loader requires sqlalchemy, geoalchemy2 y psycopg2-binary, "
    "ninguno instalado en este entorno todavia. Instalar con:\n"
    "  pip install sqlalchemy geoalchemy2 psycopg2-binary\n"
    "antes de ejecutar python -m gis.postgis_loader contra una instancia real."
)


def get_engine():
    """
    Builds a SQLAlchemy engine from the DATABASE_URL environment variable.
    Raises a clear RuntimeError (not an ImportError traceback) if the
    PostGIS driver stack isn't installed, or if DATABASE_URL is unset.
    """
    try:
        import sqlalchemy
    except ImportError as exc:
        raise RuntimeError(_MISSING_DEPS_MSG) from exc

    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        raise RuntimeError(
            "DATABASE_URL no esta seteada. Ejemplo: "
            "postgresql://user:pass@host:5432/agronova"
        )
    return sqlalchemy.create_engine(dsn)


def _to_multipolygon(geom):
    """spatial_provincias.geom is declared MultiPolygon — promote bare Polygons."""
    if geom.geom_type == "Polygon":
        return MultiPolygon([geom])
    return geom


def _write(gdf, table_name: str, engine) -> int:
    gdf.to_postgis(
        table_name,
        engine,
        schema=SCHEMA,
        if_exists="replace",
        index=False,
    )
    return len(gdf)


def sucursales_table_gdf():
    """Builds the spatial_sucursales-shaped GeoDataFrame from sucursales_gdf()."""
    gdf = sucursales_gdf()[["sucursal_id", "nombre", "provincia", "lat", "lon", "geometry"]].copy()
    return gdf.rename(columns={"lat": "latitud", "lon": "longitud"})


def depositos_table_gdf():
    """Builds the spatial_depositos-shaped GeoDataFrame from depositos_gdf()."""
    gdf = depositos_gdf()[["deposito_id", "nombre", "sucursal_id", "lat", "lon", "geometry"]].copy()
    return gdf.rename(columns={"lat": "latitud", "lon": "longitud"})


def clientes_table_gdf():
    """Builds the spatial_clientes-shaped GeoDataFrame (province-centroid proxy geometry)."""
    gdf = clientes_gdf()[["cliente_id", "provincia_norm", "lat", "lon", "geometry"]].copy()
    return gdf.rename(columns={"provincia_norm": "provincia", "lat": "latitud", "lon": "longitud"})


def provincias_table_gdf():
    """Builds the spatial_provincias-shaped GeoDataFrame (continental-clipped, see GIS-04)."""
    gdf = provincias_gdf(clip_to_continental=True).copy()
    gdf["provincia_id"] = gdf["in1"].astype(str).str.zfill(2)
    gdf["nombre"] = gdf["provincia_norm"]
    # Centroid computed in the projected CRS (metric) then reprojected back —
    # a centroid taken directly in degrees (EPSG:4326) skews with latitude.
    centroids = gdf.geometry.to_crs(CRS_PROJECTED).centroid.to_crs(CRS_WGS84)
    gdf["latitud"] = centroids.y
    gdf["longitud"] = centroids.x
    gdf["geometry"] = gdf.geometry.apply(_to_multipolygon)
    gdf = gdf[["provincia_id", "nombre", "macro_region", "latitud", "longitud", "geometry"]]
    return gdf.set_geometry("geometry").set_crs(CRS_WGS84, allow_override=True)


def load_sucursales(engine) -> int:
    """Syncs spatial_sucursales from sucursales_gdf()."""
    return _write(sucursales_table_gdf(), "spatial_sucursales", engine)


def load_depositos(engine) -> int:
    """Syncs spatial_depositos from depositos_gdf()."""
    return _write(depositos_table_gdf(), "spatial_depositos", engine)


def load_clientes(engine) -> int:
    """Syncs spatial_clientes from clientes_gdf() (province-centroid proxy geometry)."""
    return _write(clientes_table_gdf(), "spatial_clientes", engine)


def load_provincias(engine) -> int:
    """Syncs spatial_provincias from provincias_gdf() (continental-clipped, see GIS-04)."""
    return _write(provincias_table_gdf(), "spatial_provincias", engine)


def sync_all() -> None:
    """Loads all four spatial_* tables against DATABASE_URL. Prints a summary."""
    engine = get_engine()
    print("AgroNova GIS — PostGIS sync")
    print("-" * 40)
    n = load_sucursales(engine)
    print(f"  OK  spatial_sucursales  ({n} filas)")
    n = load_depositos(engine)
    print(f"  OK  spatial_depositos   ({n} filas)")
    n = load_clientes(engine)
    print(f"  OK  spatial_clientes    ({n} filas)")
    n = load_provincias(engine)
    print(f"  OK  spatial_provincias  ({n} filas)")
    print("-" * 40)
    print("Done. Ejecutar database/postgis/03_spatial_indexes.sql y "
          "04_spatial_views.sql si todavia no corrieron.")


if __name__ == "__main__":
    sync_all()

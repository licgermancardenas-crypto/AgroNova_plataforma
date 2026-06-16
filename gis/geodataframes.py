"""
AgroNova v2.0 — GeoDataFrames
Converts core entities (clientes, sucursales, depósitos, provincias) into
GeoPandas GeoDataFrames for the spatial-science layer (buffers, Voronoi,
hotspots). No PostGIS — all geometry lives in-process via Shapely/GeoPandas.
"""
from __future__ import annotations

import geopandas as gpd
from shapely.geometry import box

from . import geo_utils as gu

CRS_WGS84 = gu.CRS_WGS84  # "EPSG:4326" — storage/display CRS

# POSGAR 2007 / Argentina 5 (central meridian -60°) — projected CRS used for
# all metric operations (buffers, areas). Chosen because 4 of the 5 sucursales
# (Rosario, Pergamino, Tandil, Paraná) sit within ~1.5° of the central
# meridian; Río Cuarto (-64.35°) is the outlier at ~4.3° and incurs slightly
# more Transverse Mercator scale distortion, but a 50 km buffer test against
# this CRS reproduces the ideal π·r² area within 0.2% — accurate enough for
# this network's footprint without resorting to PostGIS.
CRS_PROJECTED = "EPSG:5347"


def provincias_gdf(clip_to_continental: bool = True) -> gpd.GeoDataFrame:
    """
    24 province polygons (IGN boundaries), enriched with AgroNova fields.

    Tierra del Fuego's polygon includes Argentina's Antarctic claim, which
    extends to -90° latitude — far outside the POSGAR/Transverse Mercator
    CRS's valid range, and it corrupts any union/intersection run in a
    projected CRS (NaN/inf coordinates poison GEOS predicates for every
    other polygon too). By default this clips every province to
    geo_utils.ARGENTINA_BBOX (the continental envelope already used for the
    choropleth) before returning, which keeps mainland geometry intact and
    drops only the Antarctic/sub-Antarctic fragment. Pass
    clip_to_continental=False to get the raw IGN geometry untouched.
    """
    data = gu.provincias_poly_geojson()
    gdf = gpd.GeoDataFrame.from_features(data["features"], crs=CRS_WGS84)
    if clip_to_continental:
        bbox = gu.ARGENTINA_BBOX
        envelope = box(bbox["min_lon"], bbox["min_lat"], bbox["max_lon"], bbox["max_lat"])
        gdf["geometry"] = gdf.geometry.intersection(envelope)
        gdf = gdf[~gdf.geometry.is_empty].reset_index(drop=True)
    return gdf


def sucursales_gdf() -> gpd.GeoDataFrame:
    """5 sucursales as Point geometries (real lat/lon from Dim_Sucursal.csv)."""
    df = gu.load_sucursales()
    geometry = gpd.points_from_xy(df["lon"], df["lat"])
    return gpd.GeoDataFrame(df, geometry=geometry, crs=CRS_WGS84)


def depositos_gdf() -> gpd.GeoDataFrame:
    """3 depósitos as Point geometries (real lat/lon from Dim_Depósito.csv)."""
    df = gu.load_depositos()
    geometry = gpd.points_from_xy(df["lon"], df["lat"])
    return gpd.GeoDataFrame(df, geometry=geometry, crs=CRS_WGS84)


def clientes_gdf() -> gpd.GeoDataFrame:
    """
    4000 clientes as Point geometries.

    Data limitation (see docs/geospatial/network_intelligence.md and
    docs/geospatial/spatial_science.md): Dim_Cliente.csv has no per-client
    lat/lon. Each client's geometry is its province centroid
    (gu.PROVINCE_CATALOGUE) — every client in the same province shares an
    identical point. Spatial joins below (buffers, Voronoi membership) are
    therefore accurate at province granularity, not at individual-client
    granularity.
    """
    df = gu.load_clientes().copy()
    centroids = df["provincia_norm"].apply(gu.province_centroid)
    df["lat"] = centroids.apply(lambda c: c[0] if c else None)
    df["lon"] = centroids.apply(lambda c: c[1] if c else None)
    df = df.dropna(subset=["lat", "lon"])
    geometry = gpd.points_from_xy(df["lon"], df["lat"])
    return gpd.GeoDataFrame(df, geometry=geometry, crs=CRS_WGS84)

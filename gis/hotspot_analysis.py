"""
AgroNova v2.0 — Hotspot Analysis
Kernel-density-based detection of commercial hotspots, and a geometric
coverage check used to flag candidate sucursal locations.
"""
from __future__ import annotations

import geopandas as gpd
import numpy as np
from scipy.stats import gaussian_kde
from shapely.geometry import Point, shape
from shapely.ops import unary_union

from .geodataframes import CRS_PROJECTED, CRS_WGS84, clientes_gdf, provincias_gdf
from .spatial_operations import BUFFER_RADII_KM, coverage_buffers
from .territorial_clustering import expansion_recommendations

GRID_RESOLUTION = 80          # grid cells along the longer bbox axis
DENSITY_PERCENTILE = 97.0     # grid cells at/above this percentile are "hot"
HOTSPOT_MERGE_RADIUS_KM = 40  # buffer used to dissolve hot grid cells into polygons


def commercial_hotspots() -> dict:
    """
    Fits a 2-D Gaussian KDE over every client point (projected to EPSG:5347,
    metres, so the bandwidth is metric). Clients are stacked at their
    province centroid (see geodataframes.clientes_gdf), so the KDE naturally
    weights by client *count* per province without a manual weight vector —
    a province with 1,564 clients contributes 1,564x the density mass of one
    with 1.

    Evaluates the density on a regular grid over continental Argentina,
    keeps the top 3% of grid cells (>= 97th percentile — the 90th percentile
    was tried first and merged every active province into one undifferentiated
    blob, since Buenos Aires's mass dominates the global density scale), and
    dissolves the surviving cells — each buffered by HOTSPOT_MERGE_RADIUS_KM —
    into discrete hotspot polygons via Shapely's unary_union. Each polygon's
    intensity_score is its peak grid density normalized against the single
    highest density value found anywhere on the grid (100 = the hottest
    point in the country).
    """
    cli  = clientes_gdf().to_crs(CRS_PROJECTED)
    prov = provincias_gdf().to_crs(CRS_PROJECTED)

    coords = np.array([[pt.x, pt.y] for pt in cli.geometry])
    kde = gaussian_kde(coords.T)

    minx, miny, maxx, maxy = prov.total_bounds
    nx = GRID_RESOLUTION
    ny = max(int(GRID_RESOLUTION * (maxy - miny) / (maxx - minx)), 10)
    gx, gy = np.meshgrid(np.linspace(minx, maxx, nx), np.linspace(miny, maxy, ny))
    grid_points = np.vstack([gx.ravel(), gy.ravel()])
    density = kde(grid_points)

    threshold = np.percentile(density, DENSITY_PERCENTILE)
    hot_mask = density >= threshold
    hot_xy = grid_points[:, hot_mask]
    hot_density = density[hot_mask]

    if hot_xy.shape[1] == 0:
        return {"type": "FeatureCollection", "features": []}

    circles = [Point(x, y).buffer(HOTSPOT_MERGE_RADIUS_KM * 1000) for x, y in hot_xy.T]
    dissolved = unary_union(circles)
    polygons = list(dissolved.geoms) if dissolved.geom_type == "MultiPolygon" else [dissolved]

    max_density = float(density.max())
    country_boundary = prov.geometry.union_all()

    features = []
    for i, poly in enumerate(polygons):
        clipped = poly.intersection(country_boundary)
        if clipped.is_empty:
            continue

        inside_mask = np.array([clipped.contains(Point(x, y)) for x, y in hot_xy.T])
        local_max = float(hot_density[inside_mask].max()) if inside_mask.any() else 0.0
        intensity_score = round(local_max / max_density * 100, 1)

        client_mask = cli.geometry.within(clipped)
        n_clientes = int(client_mask.sum())
        dominant_provincia = (
            cli.loc[client_mask, "provincia_norm"].mode().iat[0] if n_clientes > 0 else None
        )

        clipped_wgs84 = gpd.GeoSeries([clipped], crs=CRS_PROJECTED).to_crs(CRS_WGS84).iloc[0]
        features.append({
            "type": "Feature",
            "geometry": clipped_wgs84.__geo_interface__,
            "properties": {
                "intensity_score":    intensity_score,
                "area_km2":           round(clipped.area / 1e6, 1),
                "n_clientes":         n_clientes,
                "dominant_provincia": dominant_provincia,
            },
        })

    features.sort(key=lambda f: f["properties"]["intensity_score"], reverse=True)
    for rank, f in enumerate(features):
        f["properties"]["hotspot_id"] = rank
    return {"type": "FeatureCollection", "features": features}


def candidate_branches(top_n: int = 5) -> dict:
    """
    Geometric verification layer over Sprint GIS-03's expansion_recommendations():
    for each recommended city, tests whether its point falls outside the union
    of every sucursal's outer (150 km) buffer ring via a true Shapely
    point-in-polygon test, rather than trusting the Haversine
    nearest-sucursal distance already stored on the recommendation.
    """
    recs = expansion_recommendations(top_n=top_n)
    if not recs:
        return {"type": "FeatureCollection", "features": []}

    max_radius = max(BUFFER_RADII_KM)
    outer_rings = [
        shape(f["geometry"])
        for f in coverage_buffers()["features"]
        if f["properties"]["radius_km"] == max_radius
    ]
    outer_union = unary_union(outer_rings)

    features = []
    for rec in recs:
        point = Point(rec["lon"], rec["lat"])
        features.append({
            "type": "Feature",
            "geometry": point.__geo_interface__,
            "properties": {
                **rec,
                "fuera_cobertura_150km": not outer_union.contains(point),
            },
        })

    return {"type": "FeatureCollection", "features": features}

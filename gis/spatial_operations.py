"""
AgroNova v2.0 — Spatial Operations
Buffer generation and geometric (point-in-polygon) coverage analysis using
GeoPandas + Shapely. No PostGIS — every operation runs in-process on
GeoDataFrames built in gis/geodataframes.py.
"""
from __future__ import annotations

import geopandas as gpd

from .geodataframes import CRS_PROJECTED, CRS_WGS84, clientes_gdf, sucursales_gdf

BUFFER_RADII_KM = [50, 100, 150]


def coverage_buffers() -> dict:
    """
    Circular buffers (50/100/150 km) around each sucursal. Buffering happens
    in the projected CRS (EPSG:5347, metric) so the circles are true-distance
    — a buffer built directly in EPSG:4326 (degrees) would be an ellipse, not
    a circle, and would distort with latitude. Reprojected back to EPSG:4326
    for export.
    """
    suc = sucursales_gdf().to_crs(CRS_PROJECTED)
    features = []
    for radius_km in BUFFER_RADII_KM:
        ring = suc.copy()
        ring["geometry"] = suc.geometry.buffer(radius_km * 1000)
        ring = ring.to_crs(CRS_WGS84)
        for _, row in ring.iterrows():
            features.append({
                "type": "Feature",
                "geometry": row.geometry.__geo_interface__,
                "properties": {
                    "sucursal_id": int(row["sucursal_id"]),
                    "nombre":      row["nombre"],
                    "radius_km":   radius_km,
                },
            })
    return {"type": "FeatureCollection", "features": features}


def real_coverage_by_client() -> dict:
    """
    Geometric (point-in-polygon) coverage check: for each client point, finds
    the smallest buffer radius (50/100/150 km, union across all sucursales)
    that contains it, via a true Shapely `.contains()` spatial test — not the
    Haversine-distance bucketing used in coverage_distribution.json
    (Sprint GIS-03). The two should agree almost exactly; this is a geometric
    cross-check of that earlier nearest-distance calculation.
    """
    cli = clientes_gdf().to_crs(CRS_PROJECTED)
    suc = sucursales_gdf().to_crs(CRS_PROJECTED)

    radius_unions = {
        radius_km: suc.geometry.buffer(radius_km * 1000).union_all()
        for radius_km in BUFFER_RADII_KM
    }
    bucket_labels = [f"<= {r} km" for r in BUFFER_RADII_KM] + ["> 150 km"]

    def _classify(point) -> str:
        for radius_km in BUFFER_RADII_KM:
            if radius_unions[radius_km].contains(point):
                return f"<= {radius_km} km"
        return "> 150 km"

    cli = cli.copy()
    cli["real_bucket"] = cli.geometry.apply(_classify)

    total = len(cli)
    counts = cli.groupby("real_bucket")["cliente_id"].count().reindex(bucket_labels, fill_value=0)
    national = [
        {
            "bucket":     label,
            "n_clientes": int(counts[label]),
            "pct":        round(float(counts[label]) / total * 100, 1) if total else 0.0,
        }
        for label in bucket_labels
    ]

    by_provincia_counts = (
        cli.groupby(["provincia_norm", "real_bucket"])["cliente_id"]
        .count()
        .reset_index()
        .rename(columns={"provincia_norm": "provincia", "cliente_id": "n_clientes"})
    )

    return {
        "national":         national,
        "by_provincia":     by_provincia_counts.to_dict("records"),
        "n_clientes_total": total,
    }

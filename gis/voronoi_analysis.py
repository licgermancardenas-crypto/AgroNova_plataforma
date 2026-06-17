"""
AgroNova v2.0 — Voronoi Territories
Voronoi tessellation over sucursal locations, clipped to Argentina's
boundary, to derive each sucursal's theoretical exclusive service territory
under pure nearest-neighbor assignment.
"""
from __future__ import annotations

import geopandas as gpd
import shapely
from shapely.geometry import MultiPoint

from .geodataframes import CRS_PROJECTED, CRS_WGS84, clientes_gdf, provincias_gdf, sucursales_gdf

# Clipping a Voronoi cell against the full-resolution IGN province boundary
# inherits every vertex along the shared province edges, and adjacent
# province polygons that don't share identical border vertices leave behind
# thousands of microscopic sliver fragments at the seams — one territory
# came out as an 85 MB MultiPolygon before this fix. 3 km is negligible at
# the scale of a multi-province territory (tens of thousands of km2) but
# collapses that noise; export size drops by ~3 orders of magnitude.
SIMPLIFY_TOLERANCE_M = 3000


def voronoi_territories() -> dict:
    """
    Builds a Voronoi diagram from the 5 sucursal points (shapely.voronoi_polygons),
    extended to Argentina's bounding envelope so edge cells aren't left
    unbounded, then clips every cell to the real country boundary (union of
    province polygons). Each resulting polygon is the theoretical territory
    a sucursal would serve if every client were assigned strictly by nearest
    distance — comparable to, but geometrically independent of, the
    Haversine-based nearest_branch_assignment() in Sprint GIS-03.
    """
    suc  = sucursales_gdf().to_crs(CRS_PROJECTED)
    prov = provincias_gdf().to_crs(CRS_PROJECTED)
    cli  = clientes_gdf().to_crs(CRS_PROJECTED)

    country_boundary = prov.geometry.union_all()
    points = MultiPoint(list(suc.geometry))
    cells = list(shapely.voronoi_polygons(points, extend_to=country_boundary).geoms)

    features = []
    for _, suc_row in suc.iterrows():
        cell = next((c for c in cells if c.contains(suc_row.geometry)), None)
        if cell is None:
            continue
        clipped = cell.intersection(country_boundary)
        if clipped.is_empty:
            continue

        n_clientes = int(cli.geometry.within(clipped).sum())
        provincias_en_celda = prov.loc[prov.geometry.intersects(clipped), "provincia_norm"].tolist()
        simplified = clipped.simplify(SIMPLIFY_TOLERANCE_M, preserve_topology=True)
        clipped_wgs84 = gpd.GeoSeries([simplified], crs=CRS_PROJECTED).to_crs(CRS_WGS84).iloc[0]

        features.append({
            "type": "Feature",
            "geometry": clipped_wgs84.__geo_interface__,
            "properties": {
                "sucursal_id":          int(suc_row["sucursal_id"]),
                "nombre":               suc_row["nombre"],
                "area_km2":             round(clipped.area / 1e6, 1),
                "n_clientes_territorio": n_clientes,
                "provincias":           provincias_en_celda,
            },
        })

    return {"type": "FeatureCollection", "features": features}

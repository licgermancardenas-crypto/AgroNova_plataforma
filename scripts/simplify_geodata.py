"""
GIS-26 - Simplify IGN Argentina GeoJSONs for web use.
Outputs kept only 'nombre' property to minimize JSON size.
"""

import geopandas as gpd
import os
import tempfile
import zipfile
from pathlib import Path

ROOT      = Path(__file__).parent.parent
OUT_DIR   = ROOT / "web" / "public" / "data" / "geo"
DOWNLOADS = Path("C:/Users/corra/Downloads")
SHAPEFILE = DOWNLOADS / "GeoEspacial Argentina" / "SHAPEFILE" / "provincia.zip"
DEPTO_SRC = DOWNLOADS / "departamento.geojson"

OUT_DIR.mkdir(parents=True, exist_ok=True)


# 1. Provinces
print("\n[1/2] Processing provinces from shapefile...")

tmp = tempfile.mkdtemp()
with zipfile.ZipFile(SHAPEFILE) as zf:
    zf.extractall(tmp)

shp_path = os.path.join(tmp, "provinciaPolygon.shp")
prov_gdf  = gpd.read_file(shp_path)
print(f"  Source: {len(prov_gdf)} features, CRS={prov_gdf.crs}")

prov_gdf = prov_gdf[["nam", "geometry"]].copy()
prov_gdf = prov_gdf.rename(columns={"nam": "nombre"})
prov_gdf["geometry"] = prov_gdf.geometry.buffer(0)
prov_gdf["geometry"] = prov_gdf.geometry.simplify(0.002, preserve_topology=True)
prov_out = prov_gdf[prov_gdf.geometry.notna() & ~prov_gdf.geometry.is_empty].copy()

# Normalize name to match KPI dataset (geo-data.ts)
NAME_MAP = {
    "Tierra del Fuego, Antártida e Islas del Atlántico Sur": "Tierra del Fuego",
}
prov_out["nombre"] = prov_out["nombre"].map(lambda n: NAME_MAP.get(n, n))

out_prov = OUT_DIR / "provincias_hq.geojson"
prov_out.to_file(out_prov, driver="GeoJSON")
size_kb = out_prov.stat().st_size / 1024
print(f"  OK: {len(prov_out)} provinces -> provincias_hq.geojson ({size_kb:.0f} KB, tol=0.002deg)")
print("  Names:", sorted(prov_out["nombre"].tolist()))


# 2. Departments
print("\n[2/2] Processing departments from IGN GeoJSON...")
print("  (This will take ~2-5 minutes for the 136 MB file...)")

# Remove the 50 MB limit that blocks reading departamento.geojson (136 MB)
os.environ["OGR_GEOJSON_MAX_OBJ_SIZE"] = "0"

depto_gdf = gpd.read_file(str(DEPTO_SRC))
print(f"  Source: {len(depto_gdf)} features, CRS={depto_gdf.crs}")

depto_gdf = depto_gdf[["nam", "geometry"]].copy()
depto_gdf = depto_gdf.rename(columns={"nam": "nombre"})
depto_gdf["geometry"] = depto_gdf.geometry.buffer(0)
depto_gdf["geometry"] = depto_gdf.geometry.simplify(0.004, preserve_topology=True)
depto_out = depto_gdf[depto_gdf.geometry.notna() & ~depto_gdf.geometry.is_empty].copy()

out_depto = OUT_DIR / "departamentos_hq.geojson"
depto_out.to_file(out_depto, driver="GeoJSON")
size_kb = out_depto.stat().st_size / 1024
print(f"  OK: {len(depto_out)} departments -> departamentos_hq.geojson ({size_kb:.0f} KB, tol=0.004deg)")

print("\nDone. Files written to:", OUT_DIR)

"""
GIS-28 - National Transport Network.
Simplify IGN transport GeoJSONs (vial nacional/provincial/terciaria, ferrocarril,
puentes, peajes, estaciones de servicio) for web use.

Keeps only the properties the frontend needs: nombre, tipo, provincia,
longitud_km (roads/rail), fuente. Points (peajes/estaciones) keep categoria
instead of longitud_km.
"""

import json
import os
import time
from pathlib import Path

import geopandas as gpd
from pyproj import Geod

os.environ["OGR_GEOJSON_MAX_OBJ_SIZE"] = "0"

ROOT      = Path(__file__).parent.parent
DOWNLOADS = Path("C:/Users/corra/Downloads")
OUT_DIR   = ROOT / "web" / "public" / "data" / "geo" / "transport"
OUT_DIR.mkdir(parents=True, exist_ok=True)

GEOD       = Geod(ellps="WGS84")
PROVINCIAS = gpd.read_file(ROOT / "web" / "public" / "data" / "geo" / "provincias_hq.geojson")

REPORT: list[dict] = []


def join_provincia(gdf: gpd.GeoDataFrame) -> list:
    """Assign a provincia name to each feature via its representative point."""
    pts = gdf.geometry.representative_point()
    pts_gdf = gpd.GeoDataFrame({"idx": range(len(gdf))}, geometry=pts, crs=gdf.crs)

    joined = gpd.sjoin(pts_gdf, PROVINCIAS, how="left", predicate="within")
    joined = joined[~joined.index.duplicated(keep="first")].sort_index()

    missing = joined["nombre"].isna()
    if missing.any():
        nearest = gpd.sjoin_nearest(pts_gdf[missing.values], PROVINCIAS, how="left")
        nearest = nearest[~nearest.index.duplicated(keep="first")].sort_index()
        joined.loc[missing.values, "nombre"] = nearest["nombre"].values

    return joined["nombre"].tolist()


def geodesic_km(geom) -> float | None:
    if geom is None or geom.is_empty:
        return None
    try:
        return round(abs(GEOD.geometry_length(geom)) / 1000, 2)
    except Exception:
        return None


def write_out(gdf: gpd.GeoDataFrame, name: str, label: str, tipo_field: str, n_km: float | None):
    out_path = OUT_DIR / f"{name}.geojson"
    gdf.to_file(out_path, driver="GeoJSON", COORDINATE_PRECISION=5)
    size_kb = out_path.stat().st_size / 1024
    print(f"  OK -> {out_path.name} ({size_kb:.0f} KB, {len(gdf)} features)")
    REPORT.append({
        "archivo": out_path.name,
        "que_hace": label,
        "estado": "OK",
        "features": len(gdf),
        "km": n_km,
        "size_kb": round(size_kb, 1),
    })


def process_roads(src_file: str, out_name: str, label: str, tolerance: float, tipo_generico: str):
    """
    Nacional / provincial: single national file (tipo/fuente are constant per
    file, so the frontend hardcodes them instead of repeating on every feature).
    """
    print(f"\n[{out_name}] loading {src_file} ...")
    t0 = time.time()
    src = DOWNLOADS / src_file
    gdf = gpd.read_file(src, encoding="latin1", engine="pyogrio")
    print(f"  source rows: {len(gdf)}  ({time.time()-t0:.1f}s)")

    gdf = gdf.assign(geometry=gdf.geometry.simplify(tolerance, preserve_topology=True))
    gdf = gdf[gdf.geometry.notna() & ~gdf.geometry.is_empty].reset_index(drop=True)

    nombre = gdf["rtn"].apply(lambda v: f"{tipo_generico} {v}" if pd_notna(v) else tipo_generico)

    longitud_km = gdf.geometry.apply(geodesic_km)
    provincia   = join_provincia(gdf)

    out = gpd.GeoDataFrame({
        "nombre":      nombre.reset_index(drop=True),
        "provincia":   provincia,
        "longitud_km": longitud_km.reset_index(drop=True),
        "geometry":    gdf.geometry,
    }, crs=gdf.crs)

    total_km = round(out["longitud_km"].fillna(0).sum(), 1)
    write_out(out, out_name, label, "tipo", total_km)
    return total_km


def process_secondary_roads(tolerance: float = 0.003, precision: int = 4):
    """
    Terciaria: 136k features / 88MB source -- too large for a single fetch.
    Split by provincia (dir of small files + index.json) so the frontend only
    loads the province currently being inspected, per GIS-28 Fase 8.
    """
    print("\n[road_secondary] loading vial_terciaria.geojson ...")
    t0 = time.time()
    gdf = gpd.read_file(DOWNLOADS / "vial_terciaria.geojson", encoding="latin1", engine="pyogrio")
    print(f"  source rows: {len(gdf)}  ({time.time()-t0:.1f}s)")

    gdf = gdf.assign(geometry=gdf.geometry.simplify(tolerance, preserve_topology=True))
    gdf = gdf[gdf.geometry.notna() & ~gdf.geometry.is_empty].reset_index(drop=True)

    nombre      = gdf["fna1"].fillna("Camino sin nombre")
    longitud_km = gdf.geometry.apply(geodesic_km)
    provincia   = join_provincia(gdf)

    full = gpd.GeoDataFrame({
        "nombre":      nombre.reset_index(drop=True),
        "longitud_km": longitud_km.reset_index(drop=True),
        "provincia":   provincia,
        "geometry":    gdf.geometry,
    }, crs=gdf.crs)

    out_dir = OUT_DIR / "road_secondary"
    out_dir.mkdir(parents=True, exist_ok=True)
    index: list[dict] = []
    total_size_kb = 0.0
    total_km = 0.0

    for prov, group in full.groupby("provincia", dropna=False):
        prov_name = prov if isinstance(prov, str) else "Sin Provincia"
        slug = slugify(prov_name)
        group_out = group.drop(columns=["provincia"]).reset_index(drop=True)
        path = out_dir / f"{slug}.geojson"
        group_out.to_file(path, driver="GeoJSON", COORDINATE_PRECISION=precision)
        size_kb = path.stat().st_size / 1024
        km = round(group_out["longitud_km"].fillna(0).sum(), 1)
        index.append({"provincia": prov_name, "slug": slug, "features": len(group_out), "km": km, "size_kb": round(size_kb, 1)})
        total_size_kb += size_kb
        total_km += km

    with open(out_dir / "index.json", "w", encoding="utf-8") as fh:
        json.dump(index, fh, ensure_ascii=False, indent=2)

    print(f"  OK -> road_secondary/*.geojson ({len(index)} provincias, {total_size_kb/1024:.1f} MB total, {len(full)} features)")
    REPORT.append({
        "archivo": "road_secondary/*.geojson (24 provincias, lazy por provincia)",
        "que_hace": "Red vial terciaria / caminos rurales (IGN)",
        "estado": "OK",
        "features": len(full),
        "km": round(total_km, 1),
        "size_kb": round(total_size_kb, 1),
    })
    return total_km


def slugify(name: str) -> str:
    import unicodedata
    n = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode("ascii")
    return n.lower().strip().replace(" ", "-").replace(",", "")


def pd_notna(v):
    import pandas as pd
    return pd.notna(v) and str(v).strip() != ""


def process_railway(tolerance: float = 0.0008):
    print("\n[railway] loading ferrocarril ...")
    src = DOWNLOADS / "lineas_de_transporte_ferroviario_AN010.geojson"
    gdf = gpd.read_file(src, encoding="latin1", engine="pyogrio")
    print(f"  source rows: {len(gdf)}")

    gdf = gdf.assign(geometry=gdf.geometry.simplify(tolerance, preserve_topology=True))
    gdf = gdf[gdf.geometry.notna() & ~gdf.geometry.is_empty].reset_index(drop=True)

    def operador(fdc: str | None) -> str:
        if not fdc or str(fdc) == "nan":
            return "IGN"
        parts = str(fdc).split("/")
        return parts[-1].strip() if len(parts) > 1 else "IGN"

    nombre      = gdf["nam"].fillna(gdf.get("fna", gdf["nam"])).fillna("Ramal s/n")
    operador_c  = gdf["fdc"].apply(operador)
    tipo        = gdf["gna"].fillna("Ferrocarril")
    longitud_km = gdf.geometry.apply(geodesic_km)
    provincia   = join_provincia(gdf)

    out = gpd.GeoDataFrame({
        "nombre":      nombre.reset_index(drop=True),
        "tipo":        tipo.reset_index(drop=True),
        "operador":    operador_c.reset_index(drop=True),
        "provincia":   provincia,
        "longitud_km": longitud_km.reset_index(drop=True),
        "geometry":    gdf.geometry,
    }, crs=gdf.crs)

    total_km = round(out["longitud_km"].fillna(0).sum(), 1)
    write_out(out, "railway", "Líneas ferroviarias (Trenes Argentinos, concesionarias)", "tipo", total_km)
    return total_km


def process_bridges(tolerance: float = 0.0002):
    print("\n[bridges] loading puentes/cruces ...")
    src = DOWNLOADS / "lineas_de_cruces_y_enlaces_AQ040.geojson"
    gdf = gpd.read_file(src, encoding="latin1", engine="pyogrio")
    print(f"  source rows: {len(gdf)}")

    gdf = gdf.assign(geometry=gdf.geometry.simplify(tolerance, preserve_topology=True))
    gdf = gdf[gdf.geometry.notna() & ~gdf.geometry.is_empty].reset_index(drop=True)

    nombre    = gdf["nam"].fillna(gdf.get("fna")).fillna("Puente s/n")
    tipo      = gdf["gna"].fillna("Puente")
    provincia = join_provincia(gdf)

    out = gpd.GeoDataFrame({
        "nombre":    nombre.reset_index(drop=True),
        "tipo":      tipo.reset_index(drop=True),
        "provincia": provincia,
        "geometry":  gdf.geometry,
    }, crs=gdf.crs)

    write_out(out, "bridges", "Puentes y cruces viales/ferroviarios", "tipo", None)


def process_points(src_file: str, out_name: str, label: str, categoria: str):
    print(f"\n[{out_name}] loading {src_file} ...")
    src = DOWNLOADS / src_file
    gdf = gpd.read_file(src, encoding="latin1", engine="pyogrio")
    print(f"  source rows: {len(gdf)}")

    nombre    = gdf["nam"].fillna(gdf.get("fna")).fillna(categoria)
    provincia = join_provincia(gdf)

    out = gpd.GeoDataFrame({
        "nombre":    nombre.reset_index(drop=True),
        "provincia": provincia,
        "geometry":  gdf.geometry,
    }, crs=gdf.crs)

    write_out(out, out_name, label, "categoria", None)


# ── run ───────────────────────────────────────────────────────────────────────

km_nacional  = process_roads("vial_nacional.geojson",   "road_national",   "Red vial nacional (IGN)",   0.0008, "Ruta Nacional")
km_provincial= process_roads("vial_provincial.geojson",  "road_provincial", "Red vial provincial (IGN)", 0.0008, "Ruta Provincial")
km_terciaria = process_secondary_roads()
km_rail      = process_railway()
process_bridges()
process_points("infraestructura_de_transporte_030801.geojson", "toll_stations", "Estaciones de peaje (IGN)", "peaje")
process_points("infraestructura_de_transporte_AQ170.geojson",  "fuel_stations", "Estaciones de servicio (IGN)", "combustible")

print("\n" + "=" * 70)
print(json.dumps(REPORT, indent=2, ensure_ascii=False))
print("\nTotal km red vial + ferroviaria:",
      round((km_nacional or 0) + (km_provincial or 0) + (km_terciaria or 0) + (km_rail or 0), 1))

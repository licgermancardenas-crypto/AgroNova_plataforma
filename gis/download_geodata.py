"""
AgroNova v2.0 — GeoData Download Utility
Downloads and validates public Argentine geographic data from official sources.

Usage:
    python -m gis.download_geodata               # download all layers
    python -m gis.download_geodata --layer provincias
    python -m gis.download_geodata --simplify    # simplify poly after download
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.request
from pathlib import Path

ROOT     = Path(__file__).parent.parent
DATA_GEO = ROOT / "data" / "geojson"

LAYERS: dict[str, dict] = {
    "provincias": {
        "url":         "https://apis.datos.gob.ar/georef/api/provincias?formato=geojson&max=100",
        "out":         DATA_GEO / "provincias.geojson",
        "description": "Province centroids (Georef API — datos.gob.ar)",
        "min_kb":      2,
    },
    "departamentos": {
        "url":         "https://apis.datos.gob.ar/georef/api/departamentos?formato=geojson&max=600",
        "out":         DATA_GEO / "departamentos.geojson",
        "description": "Department centroids (Georef API — datos.gob.ar)",
        "min_kb":      50,
    },
    "provincias_poly": {
        "url":         (
            "https://wms.ign.gob.ar/geoserver/ows?"
            "service=wfs&version=2.0.0&request=GetFeature"
            "&typeName=ign:provincia&outputFormat=application%2Fjson"
        ),
        "out":         DATA_GEO / "provincias_poly.geojson",
        "description": "Province polygons full resolution (IGN WFS — 52 MB)",
        "min_kb":      10_000,
    },
    "departamentos_poly": {
        "url":         (
            "https://wms.ign.gob.ar/geoserver/ows?"
            "service=wfs&version=2.0.0&request=GetFeature"
            "&typeName=ign:departamento&outputFormat=application%2Fjson"
        ),
        "out":         DATA_GEO / "departamentos_poly.geojson",
        "description": "Department polygons (IGN WFS — ~200 MB, slow)",
        "min_kb":      50_000,
    },
}


def download(layer: str, force: bool = False) -> bool:
    cfg = LAYERS[layer]
    out = cfg["out"]

    if out.exists() and not force:
        size_kb = out.stat().st_size / 1024
        print(f"  [SKIP] {layer}: already exists ({size_kb:.0f} KB)")
        return True

    print(f"  [DL]   {layer}: {cfg['description']}")
    print(f"         → {out}")
    try:
        urllib.request.urlretrieve(cfg["url"], out)
    except Exception as exc:
        print(f"  [FAIL] {layer}: {exc}")
        return False

    size_kb = out.stat().st_size / 1024
    if size_kb < cfg["min_kb"]:
        print(f"  [WARN] {layer}: file too small ({size_kb:.0f} KB, expected ≥ {cfg['min_kb']} KB)")
        print("         Response may be an error. Check the file content.")
        return False

    print(f"  [OK]   {layer}: {size_kb:.0f} KB")
    return True


def simplify_poly(
    src: Path,
    dst: Path | None = None,
    tolerance: float = 0.01,
) -> Path:
    """
    Simplify a polygon GeoJSON to reduce file size for web use.
    Requires geopandas + shapely.

    Args:
        src:       Source GeoJSON path (e.g. provincias_poly.geojson, 52 MB).
        dst:       Output path. Defaults to src.stem + '_simple.geojson'.
        tolerance: Simplification tolerance in degrees (~1 km at 0.01°).

    Returns:
        Path to the simplified file.
    """
    try:
        import geopandas as gpd
    except ImportError:
        print("  [FAIL] geopandas not installed. Run: pip install geopandas")
        sys.exit(1)

    if dst is None:
        dst = src.parent / (src.stem + "_simple.geojson")

    print(f"  [SIMPLIFY] {src.name} → {dst.name} (tolerance={tolerance}°)")
    gdf = gpd.read_file(src)
    gdf = gdf.copy()
    gdf["geometry"] = gdf.simplify(tolerance=tolerance, preserve_topology=True)
    gdf.to_file(dst, driver="GeoJSON")

    in_kb  = src.stat().st_size  / 1024
    out_kb = dst.stat().st_size  / 1024
    print(f"  [OK]   {in_kb:.0f} KB → {out_kb:.0f} KB (ratio {out_kb/in_kb:.1%})")
    return dst


def validate_geojson(path: Path) -> bool:
    """Basic structural validation of a GeoJSON file."""
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        assert data.get("type") == "FeatureCollection"
        assert isinstance(data.get("features"), list)
        assert len(data["features"]) > 0
        print(f"  [VALID] {path.name}: {len(data['features'])} features")
        return True
    except Exception as exc:
        print(f"  [INVALID] {path.name}: {exc}")
        return False


def main() -> None:
    parser = argparse.ArgumentParser(description="Download AgroNova geospatial data")
    parser.add_argument("--layer",    choices=list(LAYERS) + ["all"], default="all")
    parser.add_argument("--force",    action="store_true", help="Re-download even if file exists")
    parser.add_argument("--simplify", action="store_true", help="Simplify provincias_poly after download")
    parser.add_argument("--validate", action="store_true", help="Validate existing GeoJSON files")
    args = parser.parse_args()

    DATA_GEO.mkdir(parents=True, exist_ok=True)

    if args.validate:
        print("Validating GeoJSON files...")
        for path in DATA_GEO.glob("*.geojson"):
            # Skip 52MB poly file unless explicitly requested
            if "poly" in path.name and path.stat().st_size > 5_000_000:
                print(f"  [SKIP] {path.name}: too large to validate in memory")
                continue
            validate_geojson(path)
        return

    layers = list(LAYERS) if args.layer == "all" else [args.layer]
    # Skip heavy poly layers unless explicitly requested
    if args.layer == "all":
        layers = ["provincias", "departamentos"]

    print(f"Downloading {len(layers)} layer(s)...")
    results = {layer: download(layer, force=args.force) for layer in layers}

    if args.simplify and results.get("provincias_poly"):
        simplify_poly(LAYERS["provincias_poly"]["out"])

    failed = [k for k, v in results.items() if not v]
    if failed:
        print(f"\n[WARN] Failed layers: {', '.join(failed)}")
        sys.exit(1)
    print("\nDone.")


if __name__ == "__main__":
    main()

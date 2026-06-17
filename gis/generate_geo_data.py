"""
AgroNova v2.0 — GIS Frontend Data Generator
Produces web-ready GeoJSON and province KPI JSON for the Next.js dashboard.

Run from repo root:
    python -m gis.generate_geo_data

Outputs:
    web/public/data/geo/provincias_simple.geojson   (~1-3 MB simplified polygons)
    web/public/data/geo/province_kpis.json          (province-level KPI data)
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import geopandas as gpd
import pandas as pd

ROOT    = Path(__file__).parent.parent
IN_GEO  = ROOT / "data" / "geojson" / "provincias_poly.geojson"
OUT_DIR = ROOT / "web" / "public" / "data" / "geo"

# Canonical names — matching geo_utils.PROVINCE_CATALOGUE
NAME_MAP: dict[str, str] = {
    "Ciudad Autónoma de Buenos Aires": "Ciudad Autónoma de Buenos Aires",
    "Buenos Aires":                    "Buenos Aires",
    "Catamarca":                       "Catamarca",
    "Córdoba":                         "Córdoba",
    "Corrientes":                      "Corrientes",
    "Chaco":                           "Chaco",
    "Chubut":                          "Chubut",
    "Entre Ríos":                      "Entre Ríos",
    "Formosa":                         "Formosa",
    "Jujuy":                           "Jujuy",
    "La Pampa":                        "La Pampa",
    "La Rioja":                        "La Rioja",
    "Mendoza":                         "Mendoza",
    "Misiones":                        "Misiones",
    "Neuquén":                         "Neuquén",
    "Río Negro":                       "Río Negro",
    "Salta":                           "Salta",
    "San Juan":                        "San Juan",
    "San Luis":                        "San Luis",
    "Santa Cruz":                      "Santa Cruz",
    "Santa Fe":                        "Santa Fe",
    "Santiago del Estero":             "Santiago del Estero",
    "Tucumán":                         "Tucumán",
    "Tierra del Fuego, Antártida e Islas del Atlántico Sur": "Tierra del Fuego",
}

MACRO_REGION: dict[str, str] = {
    "Ciudad Autónoma de Buenos Aires": "PAM",
    "Buenos Aires": "PAM", "Santa Fe": "PAM", "Córdoba": "PAM",
    "Entre Ríos": "PAM", "La Pampa": "PAM",
    "Salta": "NOA", "Jujuy": "NOA", "Tucumán": "NOA",
    "Catamarca": "NOA", "La Rioja": "NOA", "Santiago del Estero": "NOA",
    "Chaco": "NEA", "Formosa": "NEA", "Corrientes": "NEA", "Misiones": "NEA",
    "Mendoza": "CUY", "San Juan": "CUY", "San Luis": "CUY",
    "Neuquén": "PAT", "Río Negro": "PAT", "Chubut": "PAT",
    "Santa Cruz": "PAT", "Tierra del Fuego": "PAT",
}


def simplify_provinces(tolerance: float = 0.01) -> Path:
    import os
    os.environ.setdefault("OGR_GEOJSON_MAX_OBJ_SIZE", "0")  # remove size limit

    print(f"[1/2] Loading {IN_GEO.name} ({IN_GEO.stat().st_size // 1024 // 1024} MB)…")
    gdf = gpd.read_file(str(IN_GEO))

    print(f"      Simplifying (tolerance={tolerance}°, preserve_topology=True)…")
    gdf["geometry"] = gdf.geometry.simplify(tolerance=tolerance, preserve_topology=True)

    # Normalize properties
    gdf["nombre"] = gdf["nam"].map(NAME_MAP).fillna(gdf["nam"])
    gdf["provincia_id"] = gdf["in1"]
    gdf["macro_region"] = gdf["nombre"].map(MACRO_REGION).fillna("OTHER")

    # Keep only what the frontend needs
    out = gdf[["geometry", "provincia_id", "nombre", "macro_region"]].copy()

    dst = OUT_DIR / "provincias_simple.geojson"
    dst.parent.mkdir(parents=True, exist_ok=True)
    out.to_file(str(dst), driver="GeoJSON")

    size_kb = dst.stat().st_size / 1024
    print(f"      → {dst.name}: {size_kb:.0f} KB  ({gdf.shape[0]} features)")
    return dst


def generate_province_kpis() -> Path:
    """
    Generate province-level KPIs.
    Values derived from Dim_Cliente distribution (BA 40%, SF 25%, CBA 22%, ER 10%, LP 3%)
    and BI dashboard regional benchmarks (gis_dashboard.md).
    """
    KPIS = [
        # PAM — core AgroNova territory
        {"nombre": "Buenos Aires",     "macro_region": "PAM", "lat": -36.6774, "lon": -60.5585,
         "revenue_ars": 3_280_000_000, "n_clientes": 1360, "n_activos": 1042, "margen_pct": 19.5,
         "churn_score": 0.18, "agr_ha_m": 16.0, "gap_score": 0.8,  "otif_pct": 94.8},
        {"nombre": "Santa Fe",         "macro_region": "PAM", "lat": -30.7088, "lon": -60.9507,
         "revenue_ars": 2_050_000_000, "n_clientes": 850,  "n_activos": 671,  "margen_pct": 20.1,
         "churn_score": 0.16, "agr_ha_m": 7.5,  "gap_score": 1.1,  "otif_pct": 95.2},
        {"nombre": "Córdoba",          "macro_region": "PAM", "lat": -32.1448, "lon": -63.8020,
         "revenue_ars": 1_800_000_000, "n_clientes": 748,  "n_activos": 601,  "margen_pct": 19.8,
         "churn_score": 0.19, "agr_ha_m": 8.2,  "gap_score": 0.9,  "otif_pct": 93.9},
        {"nombre": "Entre Ríos",       "macro_region": "PAM", "lat": -32.0589, "lon": -59.2013,
         "revenue_ars": 820_000_000,  "n_clientes": 340,  "n_activos": 257,  "margen_pct": 19.2,
         "churn_score": 0.24, "agr_ha_m": 4.2,  "gap_score": 2.1,  "otif_pct": 92.1},
        {"nombre": "La Pampa",         "macro_region": "PAM", "lat": -37.1351, "lon": -65.4476,
         "revenue_ars": 250_000_000,  "n_clientes": 102,  "n_activos":  78,  "margen_pct": 21.3,
         "churn_score": 0.27, "agr_ha_m": 3.8,  "gap_score": 4.5,  "otif_pct": 91.5},

        # NOA
        {"nombre": "Salta",            "macro_region": "NOA", "lat": -24.2993, "lon": -64.8142,
         "revenue_ars": 550_000_000,  "n_clientes": 186,  "n_activos": 142,  "margen_pct": 20.8,
         "churn_score": 0.31, "agr_ha_m": 1.8,  "gap_score": 6.2,  "otif_pct": 88.2},
        {"nombre": "Tucumán",          "macro_region": "NOA", "lat": -26.9483, "lon": -65.3648,
         "revenue_ars": 480_000_000,  "n_clientes": 163,  "n_activos": 122,  "margen_pct": 21.1,
         "churn_score": 0.28, "agr_ha_m": 1.1,  "gap_score": 5.4,  "otif_pct": 89.4},
        {"nombre": "Santiago del Estero","macro_region": "NOA","lat": -27.7834,"lon": -63.2526,
         "revenue_ars": 310_000_000,  "n_clientes": 105,  "n_activos":  74,  "margen_pct": 19.9,
         "churn_score": 0.35, "agr_ha_m": 2.8,  "gap_score": 9.3,  "otif_pct": 87.1},
        {"nombre": "Jujuy",            "macro_region": "NOA", "lat": -23.3200, "lon": -65.7644,
         "revenue_ars": 228_000_000,  "n_clientes":  77,  "n_activos":  55,  "margen_pct": 20.4,
         "churn_score": 0.32, "agr_ha_m": 0.3,  "gap_score": 3.2,  "otif_pct": 87.8},
        {"nombre": "Catamarca",        "macro_region": "NOA", "lat": -27.3360, "lon": -66.9479,
         "revenue_ars": 142_000_000,  "n_clientes":  48,  "n_activos":  31,  "margen_pct": 20.0,
         "churn_score": 0.38, "agr_ha_m": 0.4,  "gap_score": 4.8,  "otif_pct": 86.3},
        {"nombre": "La Rioja",         "macro_region": "NOA", "lat": -29.6849, "lon": -67.1818,
         "revenue_ars":  90_000_000,  "n_clientes":  30,  "n_activos":  18,  "margen_pct": 20.6,
         "churn_score": 0.40, "agr_ha_m": 0.3,  "gap_score": 5.7,  "otif_pct": 85.9},

        # NEA
        {"nombre": "Chaco",            "macro_region": "NEA", "lat": -26.3870, "lon": -60.7651,
         "revenue_ars": 380_000_000,  "n_clientes": 129,  "n_activos":  91,  "margen_pct": 18.7,
         "churn_score": 0.34, "agr_ha_m": 3.2,  "gap_score": 8.6,  "otif_pct": 86.7},
        {"nombre": "Corrientes",       "macro_region": "NEA", "lat": -28.7742, "lon": -57.8011,
         "revenue_ars": 310_000_000,  "n_clientes": 105,  "n_activos":  74,  "margen_pct": 19.1,
         "churn_score": 0.33, "agr_ha_m": 2.0,  "gap_score": 7.2,  "otif_pct": 87.3},
        {"nombre": "Misiones",         "macro_region": "NEA", "lat": -26.8753, "lon": -54.6516,
         "revenue_ars": 228_000_000,  "n_clientes":  77,  "n_activos":  52,  "margen_pct": 18.3,
         "churn_score": 0.36, "agr_ha_m": 0.8,  "gap_score": 5.1,  "otif_pct": 86.1},
        {"nombre": "Formosa",          "macro_region": "NEA", "lat": -24.8951, "lon": -59.9322,
         "revenue_ars": 182_000_000,  "n_clientes":  62,  "n_activos":  40,  "margen_pct": 18.9,
         "churn_score": 0.39, "agr_ha_m": 1.2,  "gap_score": 10.2, "otif_pct": 85.4},

        # CUY
        {"nombre": "Mendoza",          "macro_region": "CUY", "lat": -34.6304, "lon": -68.5829,
         "revenue_ars": 580_000_000,  "n_clientes": 197,  "n_activos": 154,  "margen_pct": 21.8,
         "churn_score": 0.22, "agr_ha_m": 0.5,  "gap_score": 2.1,  "otif_pct": 91.8},
        {"nombre": "San Juan",         "macro_region": "CUY", "lat": -30.8657, "lon": -68.8882,
         "revenue_ars": 210_000_000,  "n_clientes":  71,  "n_activos":  52,  "margen_pct": 21.2,
         "churn_score": 0.29, "agr_ha_m": 0.3,  "gap_score": 3.4,  "otif_pct": 90.6},
        {"nombre": "San Luis",         "macro_region": "CUY", "lat": -33.7611, "lon": -66.0252,
         "revenue_ars": 110_000_000,  "n_clientes":  37,  "n_activos":  25,  "margen_pct": 20.9,
         "churn_score": 0.33, "agr_ha_m": 1.5,  "gap_score": 7.8,  "otif_pct": 90.1},

        # PAT
        {"nombre": "Neuquén",          "macro_region": "PAT", "lat": -38.6420, "lon": -70.1199,
         "revenue_ars": 180_000_000,  "n_clientes":  61,  "n_activos":  44,  "margen_pct": 22.5,
         "churn_score": 0.26, "agr_ha_m": 0.4,  "gap_score": 3.6,  "otif_pct": 90.3},
        {"nombre": "Río Negro",        "macro_region": "PAT", "lat": -40.4051, "lon": -67.2297,
         "revenue_ars": 130_000_000,  "n_clientes":  44,  "n_activos":  31,  "margen_pct": 22.1,
         "churn_score": 0.28, "agr_ha_m": 0.6,  "gap_score": 5.8,  "otif_pct": 89.5},
        {"nombre": "Chubut",           "macro_region": "PAT", "lat": -43.7886, "lon": -68.5267,
         "revenue_ars":  72_000_000,  "n_clientes":  24,  "n_activos":  16,  "margen_pct": 22.8,
         "churn_score": 0.31, "agr_ha_m": 0.5,  "gap_score": 7.4,  "otif_pct": 88.7},
        {"nombre": "Santa Cruz",       "macro_region": "PAT", "lat": -48.8155, "lon": -69.9558,
         "revenue_ars":  22_000_000,  "n_clientes":   7,  "n_activos":   4,  "margen_pct": 23.1,
         "churn_score": 0.42, "agr_ha_m": 0.2,  "gap_score": 9.2,  "otif_pct": 87.2},
        {"nombre": "Tierra del Fuego", "macro_region": "PAT", "lat": -54.8000, "lon": -68.3000,
         "revenue_ars":   8_000_000,  "n_clientes":   3,  "n_activos":   2,  "margen_pct": 23.5,
         "churn_score": 0.45, "agr_ha_m": 0.05, "gap_score": 6.5,  "otif_pct": 86.1},

        # Special
        {"nombre": "Ciudad Autónoma de Buenos Aires", "macro_region": "PAM",
         "lat": -34.6144, "lon": -58.4459,
         "revenue_ars":  48_000_000,  "n_clientes":  16,  "n_activos":  11,  "margen_pct": 18.2,
         "churn_score": 0.48, "agr_ha_m": 0.0,  "gap_score": 0.0,  "otif_pct": 97.1},
    ]

    # Compute revenue_pct
    total_rev = sum(k["revenue_ars"] for k in KPIS)
    for k in KPIS:
        k["revenue_pct"] = round(k["revenue_ars"] / total_rev * 100, 2)

    dst = OUT_DIR / "province_kpis.json"
    dst.parent.mkdir(parents=True, exist_ok=True)
    with open(dst, "w", encoding="utf-8") as f:
        json.dump(KPIS, f, ensure_ascii=False, indent=2)

    print(f"[2/2] → {dst.name}: {len(KPIS)} provinces, total ARS {total_rev / 1e9:.1f}B")
    return dst


if __name__ == "__main__":
    print("AgroNova v2.0 — GIS Data Generator")
    print("=" * 45)

    if not IN_GEO.exists():
        print(f"ERROR: {IN_GEO} not found. Run download_geodata.py first.")
        sys.exit(1)

    simplify_provinces(tolerance=0.01)
    generate_province_kpis()
    print("\nAll done. Files saved to web/public/data/geo/")

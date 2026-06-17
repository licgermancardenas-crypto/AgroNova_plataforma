"""
AgroNova v2.0 — Geospatial Intelligence
Core utilities: province catalogue, CRS constants, distance, data loaders.
"""
from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

import pandas as pd

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
ROOT     = Path(__file__).parent.parent
DATA_CSV = ROOT / "data" / "csv"
DATA_GEO = ROOT / "data" / "geojson"

# ---------------------------------------------------------------------------
# CRS & bounding box (WGS-84)
# ---------------------------------------------------------------------------
CRS_WGS84    = "EPSG:4326"
ARGENTINA_BBOX = {"min_lon": -73.58, "max_lon": -53.64, "min_lat": -55.06, "max_lat": -21.78}

# ---------------------------------------------------------------------------
# Province catalogue — INDEC codes + centroids (Georef API / INDEC Censo 2022)
# ---------------------------------------------------------------------------
PROVINCE_CATALOGUE: dict[str, dict] = {
    "02": {"nombre": "Ciudad Autónoma de Buenos Aires", "short": "CABA",           "lat": -34.6144, "lon": -58.4459},
    "06": {"nombre": "Buenos Aires",                    "short": "Buenos Aires",    "lat": -36.6774, "lon": -60.5585},
    "10": {"nombre": "Catamarca",                       "short": "Catamarca",       "lat": -27.3360, "lon": -66.9479},
    "14": {"nombre": "Córdoba",                         "short": "Córdoba",         "lat": -32.1448, "lon": -63.8020},
    "18": {"nombre": "Corrientes",                      "short": "Corrientes",      "lat": -28.7742, "lon": -57.8011},
    "22": {"nombre": "Chaco",                           "short": "Chaco",           "lat": -26.3870, "lon": -60.7651},
    "26": {"nombre": "Chubut",                          "short": "Chubut",          "lat": -43.7886, "lon": -68.5267},
    "30": {"nombre": "Entre Ríos",                      "short": "Entre Ríos",      "lat": -32.0589, "lon": -59.2013},
    "34": {"nombre": "Formosa",                         "short": "Formosa",         "lat": -24.8951, "lon": -59.9322},
    "38": {"nombre": "Jujuy",                           "short": "Jujuy",           "lat": -23.3200, "lon": -65.7644},
    "42": {"nombre": "La Pampa",                        "short": "La Pampa",        "lat": -37.1351, "lon": -65.4476},
    "46": {"nombre": "La Rioja",                        "short": "La Rioja",        "lat": -29.6849, "lon": -67.1818},
    "50": {"nombre": "Mendoza",                         "short": "Mendoza",         "lat": -34.6304, "lon": -68.5829},
    "54": {"nombre": "Misiones",                        "short": "Misiones",        "lat": -26.8753, "lon": -54.6516},
    "58": {"nombre": "Neuquén",                         "short": "Neuquén",         "lat": -38.6420, "lon": -70.1199},
    "62": {"nombre": "Río Negro",                       "short": "Río Negro",       "lat": -40.4051, "lon": -67.2297},
    "66": {"nombre": "Salta",                           "short": "Salta",           "lat": -24.2993, "lon": -64.8142},
    "70": {"nombre": "San Juan",                        "short": "San Juan",        "lat": -30.8657, "lon": -68.8882},
    "74": {"nombre": "San Luis",                        "short": "San Luis",        "lat": -33.7611, "lon": -66.0252},
    "78": {"nombre": "Santa Cruz",                      "short": "Santa Cruz",      "lat": -48.8155, "lon": -69.9558},
    "82": {"nombre": "Santa Fe",                        "short": "Santa Fe",        "lat": -30.7088, "lon": -60.9507},
    "86": {"nombre": "Santiago del Estero",             "short": "Stgo. Estero",    "lat": -27.7834, "lon": -63.2526},
    "90": {"nombre": "Tucumán",                         "short": "Tucumán",         "lat": -26.9483, "lon": -65.3648},
    "94": {"nombre": "Tierra del Fuego",                "short": "Tierra del Fuego","lat": -54.8000, "lon": -68.3000},
}

# Canonical name aliases — handles CSV variations (lowercase → canonical)
PROVINCE_ALIASES: dict[str, str] = {
    "buenos aires":                           "Buenos Aires",
    "caba":                                   "Ciudad Autónoma de Buenos Aires",
    "ciudad de buenos aires":                 "Ciudad Autónoma de Buenos Aires",
    "ciudad autonoma de buenos aires":        "Ciudad Autónoma de Buenos Aires",
    "ciudad autónoma de buenos aires":        "Ciudad Autónoma de Buenos Aires",
    "cordoba":                                "Córdoba",
    "córdoba":                                "Córdoba",
    "entre rios":                             "Entre Ríos",
    "entre ríos":                             "Entre Ríos",
    "jujuy":                                  "Jujuy",
    "la pampa":                               "La Pampa",
    "la rioja":                               "La Rioja",
    "mendoza":                                "Mendoza",
    "misiones":                               "Misiones",
    "neuquen":                                "Neuquén",
    "neuquén":                                "Neuquén",
    "rio negro":                              "Río Negro",
    "río negro":                              "Río Negro",
    "salta":                                  "Salta",
    "san juan":                               "San Juan",
    "san luis":                               "San Luis",
    "santa cruz":                             "Santa Cruz",
    "santa fe":                               "Santa Fe",
    "santiago del estero":                    "Santiago del Estero",
    "tierra del fuego":                       "Tierra del Fuego",
    "tierra del fuego, antartida e islas del atlantico sur": "Tierra del Fuego",
    "tucuman":                                "Tucumán",
    "tucumán":                                "Tucumán",
    "chaco":                                  "Chaco",
    "chubut":                                 "Chubut",
    "catamarca":                              "Catamarca",
    "corrientes":                             "Corrientes",
    "formosa":                                "Formosa",
}

# ---------------------------------------------------------------------------
# Macro-regions (PAM / NOA / NEA / CUY / PAT)
# ---------------------------------------------------------------------------
MACRO_REGION: dict[str, str] = {
    "Ciudad Autónoma de Buenos Aires": "PAM",
    "Buenos Aires":                    "PAM",
    "Santa Fe":                        "PAM",
    "Córdoba":                         "PAM",
    "Entre Ríos":                      "PAM",
    "La Pampa":                        "PAM",
    "Salta":                           "NOA",
    "Jujuy":                           "NOA",
    "Tucumán":                         "NOA",
    "Catamarca":                       "NOA",
    "La Rioja":                        "NOA",
    "Santiago del Estero":             "NOA",
    "Chaco":                           "NEA",
    "Formosa":                         "NEA",
    "Corrientes":                      "NEA",
    "Misiones":                        "NEA",
    "Mendoza":                         "CUY",
    "San Juan":                        "CUY",
    "San Luis":                        "CUY",
    "Neuquén":                         "PAT",
    "Río Negro":                       "PAT",
    "Chubut":                          "PAT",
    "Santa Cruz":                      "PAT",
    "Tierra del Fuego":                "PAT",
}

# Agricultural area estimates (millions of cultivable hectares)
# Source: MAGyP / INDEC Censo Agropecuario estimates
PROVINCE_AGR_HA_M: dict[str, float] = {
    "Buenos Aires":                    16.0,
    "Córdoba":                          8.2,
    "Santa Fe":                         7.5,
    "Chaco":                            3.2,
    "Entre Ríos":                       4.2,
    "La Pampa":                         3.8,
    "Santiago del Estero":              2.8,
    "Corrientes":                       2.0,
    "Salta":                            1.8,
    "San Luis":                         1.5,
    "Formosa":                          1.2,
    "Tucumán":                          1.1,
    "Misiones":                         0.8,
    "Río Negro":                        0.6,
    "Mendoza":                          0.5,
    "Chubut":                           0.5,
    "Neuquén":                          0.4,
    "Catamarca":                        0.4,
    "Jujuy":                            0.3,
    "La Rioja":                         0.3,
    "San Juan":                         0.3,
    "Santa Cruz":                       0.2,
    "Tierra del Fuego":                 0.05,
    "Ciudad Autónoma de Buenos Aires":  0.0,
}

# AgroNova Dim_Región mapping (sucursal → region_id from Dim_Región.csv)
PROVINCE_REGION_ID: dict[str, int] = {
    "Santa Fe":     1,  # Litoral Norte
    "Buenos Aires": 2,  # Pampa Norte (simplified; south sub-region = 3)
    "Córdoba":      4,  # Centro Oeste
    "Entre Ríos":   5,  # Mesopotamia
    "La Pampa":     3,  # Pampa Sur
}

# Provincial capital (or principal city) — used as the recommended expansion
# point. Coordinates reuse the province centroid (PROVINCE_CATALOGUE above);
# no new geocoding source was introduced, so the candidate point is an
# approximation of the capital's true location, not a precise geocode.
# Lives here (not in territorial_clustering.py) so modules that just need
# the city name don't have to import sklearn to get it.
PROVINCE_CAPITAL: dict[str, str] = {
    "Catamarca":            "San Fernando del Valle de Catamarca",
    "Corrientes":            "Corrientes",
    "Chaco":                 "Resistencia",
    "Chubut":                "Rawson",
    "Formosa":               "Formosa",
    "Jujuy":                 "San Salvador de Jujuy",
    "La Rioja":              "La Rioja",
    "Mendoza":               "Mendoza",
    "Misiones":              "Posadas",
    "Neuquén":               "Neuquén",
    "Río Negro":             "Viedma",
    "Salta":                 "Salta",
    "San Juan":              "San Juan",
    "San Luis":              "San Luis",
    "Santa Cruz":            "Río Gallegos",
    "Santiago del Estero":   "Santiago del Estero",
    "Tucumán":               "San Miguel de Tucumán",
    "Tierra del Fuego":      "Ushuaia",
}


# ---------------------------------------------------------------------------
# Lookup helpers
# ---------------------------------------------------------------------------

def normalize_province(name: str) -> str:
    """Normalize a province name string to its canonical form."""
    if not name or not isinstance(name, str):
        return name
    return PROVINCE_ALIASES.get(name.strip().lower(), name.strip())


def province_centroid(province: str) -> tuple[float, float] | None:
    """Return (lat, lon) for the given province name. None if unknown."""
    canon = normalize_province(province)
    for data in PROVINCE_CATALOGUE.values():
        if data["nombre"] == canon or data["short"] == canon:
            return data["lat"], data["lon"]
    return None


def get_macro_region(province: str) -> str:
    """Return macro-region code (PAM/NOA/NEA/CUY/PAT) for a province."""
    return MACRO_REGION.get(normalize_province(province), "OTHER")


def provinces_as_features() -> list[dict]:
    """Build GeoJSON feature list from catalogue (centroid Points)."""
    return [
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [d["lon"], d["lat"]]},
            "properties": {
                "id":           code,
                "nombre":       d["nombre"],
                "short":        d["short"],
                "macro_region": MACRO_REGION.get(d["nombre"], "OTHER"),
                "agr_ha_m":     PROVINCE_AGR_HA_M.get(d["nombre"], 0),
            },
        }
        for code, d in PROVINCE_CATALOGUE.items()
    ]


# ---------------------------------------------------------------------------
# Distance
# ---------------------------------------------------------------------------

def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in kilometres (WGS-84)."""
    R = 6_371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2)
    return R * 2 * math.asin(math.sqrt(a))


# ---------------------------------------------------------------------------
# GeoJSON loaders
# ---------------------------------------------------------------------------

def load_geojson(path: Path) -> dict[str, Any]:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def provincias_geojson() -> dict[str, Any]:
    """
    GeoJSON FeatureCollection for Argentine provinces (centroid Points).
    Uses downloaded Georef file; falls back to catalogue if missing.
    """
    path = DATA_GEO / "provincias.geojson"
    if path.exists():
        data = load_geojson(path)
        for feat in data.get("features", []):
            nombre = feat["properties"].get("nombre", "")
            feat["properties"].setdefault("macro_region", MACRO_REGION.get(nombre, "OTHER"))
            feat["properties"].setdefault("agr_ha_m", PROVINCE_AGR_HA_M.get(nombre, 0))
        return data
    return {"type": "FeatureCollection", "features": provinces_as_features()}


def provincias_poly_geojson() -> dict[str, Any]:
    """
    GeoJSON FeatureCollection for Argentine provinces (MultiPolygon boundaries).
    Source: IGN WFS — 52 MB, full resolution. Use for server-side analysis.
    Properties: gid, fna (full name), nam (short name), in1 (INDEC code), sag='IGN'.

    For frontend choropleth use a simplified version (tolerance ~0.01°).
    To simplify: geopandas.read_file(path).simplify(0.01).to_file(out, driver='GeoJSON')
    """
    path = DATA_GEO / "provincias_poly.geojson"
    if not path.exists():
        raise FileNotFoundError(
            f"Polygon GeoJSON not found at {path}. "
            "Run: download_geodata.py --layer provincias_poly"
        )
    data = load_geojson(path)
    # Enrich with AgroNova-specific fields
    for feat in data.get("features", []):
        nam = feat["properties"].get("nam", "") or feat["properties"].get("fna", "")
        norm = normalize_province(nam)
        feat["properties"]["provincia_norm"] = norm
        feat["properties"]["macro_region"]   = MACRO_REGION.get(norm, "OTHER")
        feat["properties"]["agr_ha_m"]       = PROVINCE_AGR_HA_M.get(norm, 0)
    return data


def municipios_geojson() -> dict[str, Any]:
    """GeoJSON FeatureCollection for Argentine municipios (INDEC Censo 2022)."""
    return load_geojson(DATA_GEO / "municipios_2022.geojson")


# ---------------------------------------------------------------------------
# CSV loaders
# ---------------------------------------------------------------------------

def _read_csv(name: str) -> pd.DataFrame:
    return pd.read_csv(DATA_CSV / name, low_memory=False)


def load_clientes() -> pd.DataFrame:
    df = _read_csv("Dim_Cliente.csv")
    df["provincia_norm"] = df["provincia"].apply(normalize_province)
    df["macro_region"]   = df["provincia_norm"].apply(get_macro_region)
    return df


def load_ventas() -> pd.DataFrame:
    df = _read_csv("Fact_Ventas.csv")
    # Derive year from YYYYMMDD integer key
    df["anio"] = df["fecha_id"].astype(str).str[:4].astype(int)
    df = df[df["estado"] == "Facturada"]
    return df


def load_logistica() -> pd.DataFrame:
    df = _read_csv("Fact_Logística.csv")
    df["anio"] = df["fecha_despacho_id"].astype(str).str[:4].astype(int)
    df["otif"] = ((df["estado"] == "Entregado") & (df["dias_demora"] == 0)).astype(int)
    return df


def load_sucursales() -> pd.DataFrame:
    return _read_csv("Dim_Sucursal.csv")


def load_depositos() -> pd.DataFrame:
    """Dim_Depósito.csv — only 3 real depósitos (vs. 5 sucursales); not 1:1."""
    return _read_csv("Dim_Depósito.csv")


def load_regiones() -> pd.DataFrame:
    return _read_csv("Dim_Región.csv")

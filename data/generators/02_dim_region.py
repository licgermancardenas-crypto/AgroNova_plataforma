"""
Dim_Región - 5 regiones comerciales de AgroNova
"""

import pandas as pd
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from config import CSV_DIR

REGIONES = [
    {
        "region_id":          1,
        "nombre_region":      "Litoral Norte",
        "provincia_principal": "Santa Fe",
        "ciudades":           "Rosario, San Lorenzo, Villa Constitución",
        "superficie_km2":     133_007,
        "hectareas_prod_estimadas": 1_850_000,
        "cultivo_principal":  "Soja / Girasol",
        "peso_comercial_pct": 0.28,
    },
    {
        "region_id":          2,
        "nombre_region":      "Pampa Norte",
        "provincia_principal": "Buenos Aires Norte",
        "ciudades":           "Pergamino, Junín, Chivilcoy",
        "superficie_km2":     95_000,
        "hectareas_prod_estimadas": 1_400_000,
        "cultivo_principal":  "Maíz / Soja",
        "peso_comercial_pct": 0.25,
    },
    {
        "region_id":          3,
        "nombre_region":      "Pampa Sur",
        "provincia_principal": "Buenos Aires Sur",
        "ciudades":           "Tandil, Azul, Olavarría",
        "superficie_km2":     88_000,
        "hectareas_prod_estimadas": 980_000,
        "cultivo_principal":  "Trigo / Girasol",
        "peso_comercial_pct": 0.17,
    },
    {
        "region_id":          4,
        "nombre_region":      "Centro Oeste",
        "provincia_principal": "Córdoba Sur",
        "ciudades":           "Río Cuarto, Villa María, Bell Ville",
        "superficie_km2":     121_000,
        "hectareas_prod_estimadas": 1_650_000,
        "cultivo_principal":  "Maíz / Soja",
        "peso_comercial_pct": 0.22,
    },
    {
        "region_id":          5,
        "nombre_region":      "Mesopotamia",
        "provincia_principal": "Entre Ríos",
        "ciudades":           "Paraná, Concordia, Gualeguaychú",
        "superficie_km2":     78_781,
        "hectareas_prod_estimadas": 620_000,
        "cultivo_principal":  "Soja / Arroz",
        "peso_comercial_pct": 0.08,
    },
]


def generate():
    df = pd.DataFrame(REGIONES)
    out = os.path.join(CSV_DIR, "Dim_Región.csv")
    df.to_csv(out, index=False, encoding="utf-8-sig")
    print(f"[OK] Dim_Región: {len(df):,} filas -> {out}")
    return df


if __name__ == "__main__":
    generate()

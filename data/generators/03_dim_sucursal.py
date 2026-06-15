"""
Dim_Sucursal - 5 sucursales comerciales de AgroNova
"""

import pandas as pd
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from config import CSV_DIR, SUCURSALES

EXTRA = [
    {"sucursal_id": 1, "fecha_apertura": "2012-03-01", "superficie_m2": 850,  "empleados_totales": 32, "estado": "Activa"},
    {"sucursal_id": 2, "fecha_apertura": "2013-06-15", "superficie_m2": 620,  "empleados_totales": 24, "estado": "Activa"},
    {"sucursal_id": 3, "fecha_apertura": "2015-09-01", "superficie_m2": 480,  "empleados_totales": 18, "estado": "Activa"},
    {"sucursal_id": 4, "fecha_apertura": "2014-01-10", "superficie_m2": 710,  "empleados_totales": 27, "estado": "Activa"},
    {"sucursal_id": 5, "fecha_apertura": "2016-03-20", "superficie_m2": 390,  "empleados_totales": 14, "estado": "Activa"},
]


def generate():
    df_base  = pd.DataFrame(SUCURSALES)
    df_extra = pd.DataFrame(EXTRA)
    df = df_base.merge(df_extra, on="sucursal_id")
    col_order = [
        "sucursal_id", "nombre", "provincia", "region_id",
        "lat", "lon", "fecha_apertura", "superficie_m2",
        "empleados_totales", "estado",
    ]
    df = df[col_order]
    out = os.path.join(CSV_DIR, "Dim_Sucursal.csv")
    df.to_csv(out, index=False, encoding="utf-8-sig")
    print(f"[OK] Dim_Sucursal: {len(df):,} filas -> {out}")
    return df


if __name__ == "__main__":
    generate()

"""
Dim_Depósito - 3 centros logísticos de AgroNova
"""

import pandas as pd
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from config import CSV_DIR, DEPOSITOS

EXTRA = [
    {
        "deposito_id": 1,
        "fecha_habilitacion": "2012-03-01",
        "tipo": "Centro Logístico Principal",
        "muelles_carga": 8,
        "temperatura_controlada": 0,
        "certificaciones": "ISO 9001; SENASA",
        "estado": "Operativo",
    },
    {
        "deposito_id": 2,
        "fecha_habilitacion": "2013-06-15",
        "tipo": "Centro Logístico Regional",
        "muelles_carga": 5,
        "temperatura_controlada": 1,
        "certificaciones": "SENASA",
        "estado": "Operativo",
    },
    {
        "deposito_id": 3,
        "fecha_habilitacion": "2014-01-10",
        "tipo": "Centro Logístico Regional",
        "muelles_carga": 4,
        "temperatura_controlada": 0,
        "certificaciones": "SENASA",
        "estado": "Operativo",
    },
]


def generate():
    df_base  = pd.DataFrame(DEPOSITOS)
    df_extra = pd.DataFrame(EXTRA)
    df = df_base.merge(df_extra, on="deposito_id")
    out = os.path.join(CSV_DIR, "Dim_Depósito.csv")
    df.to_csv(out, index=False, encoding="utf-8-sig")
    print(f"[OK] Dim_Depósito: {len(df):,} filas -> {out}")
    return df


if __name__ == "__main__":
    generate()

"""
Dim_Fecha - Dimensión de tiempo completa 2016-2026
"""

import pandas as pd
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from config import CSV_DIR, START_DATE, END_DATE, ESTACIONALIDAD

FERIADOS_ARG = {
    # Fijos nacionales
    "01-01", "01-05", "07-09", "10-12", "12-08", "12-25",
    # Carnaval y Semana Santa varían - incluimos como aproximación fija
    "02-12", "02-13",  # carnaval aprox
}

DIAS_SEMANA_ES = {
    0: "Lunes", 1: "Martes", 2: "Miércoles",
    3: "Jueves", 4: "Viernes", 5: "Sábado", 6: "Domingo",
}

MESES_ES = {
    1: "Enero", 2: "Febrero", 3: "Marzo", 4: "Abril",
    5: "Mayo", 6: "Junio", 7: "Julio", 8: "Agosto",
    9: "Septiembre", 10: "Octubre", 11: "Noviembre", 12: "Diciembre",
}

TEMPORADAS = {
    (12, 1, 2):  "Verano",
    (3, 4, 5):   "Otoño",
    (6, 7, 8):   "Invierno",
    (9, 10, 11): "Primavera",
}

def get_temporada(mes):
    for meses, temporada in TEMPORADAS.items():
        if mes in meses:
            return temporada
    return "Verano"

def get_temporada_agricola(mes):
    if mes in [9, 10, 11, 12]:
        return "Siembra Verano"
    elif mes in [1, 2, 3]:
        return "Cosecha Verano"
    elif mes in [4, 5]:
        return "Cosecha Otoño / Siembra Invierno"
    else:
        return "Crecimiento Cultivos Invierno"


def generate():
    fechas = pd.date_range(START_DATE, END_DATE, freq="D")
    rows = []
    for f in fechas:
        mmdd = f.strftime("%m-%d")
        es_feriado = mmdd in FERIADOS_ARG
        es_fds = f.weekday() >= 5
        rows.append({
            "fecha_id":            int(f.strftime("%Y%m%d")),
            "fecha":               f.date(),
            "año":                 f.year,
            "semestre":            1 if f.month <= 6 else 2,
            "trimestre":           f.quarter,
            "mes":                 f.month,
            "mes_nombre":          MESES_ES[f.month],
            "semana_iso":          f.isocalendar()[1],
            "dia_año":             f.day_of_year,
            "dia_semana":          f.weekday() + 1,
            "dia_semana_nombre":   DIAS_SEMANA_ES[f.weekday()],
            "es_feriado":          int(es_feriado),
            "es_fin_de_semana":    int(es_fds),
            "es_dia_habil":        int(not es_feriado and not es_fds),
            "temporada":           get_temporada(f.month),
            "temporada_agricola":  get_temporada_agricola(f.month),
            "factor_estacional":   ESTACIONALIDAD[f.month],
        })

    df = pd.DataFrame(rows)
    out = os.path.join(CSV_DIR, "Dim_Fecha.csv")
    df.to_csv(out, index=False, encoding="utf-8-sig")
    print(f"[OK] Dim_Fecha: {len(df):,} filas -> {out}")
    return df


if __name__ == "__main__":
    generate()

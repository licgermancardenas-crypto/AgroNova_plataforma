"""
Fact_Logística - envíos desde depósitos a clientes
~200.000 registros, tiempos realistas por distancia inter-regional.
"""

import pandas as pd
import numpy as np
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from config import CSV_DIR, SEED, SUCURSALES, DEPOSITOS

rng = np.random.default_rng(SEED + 3)

N_LOGISTICA = 200_000

# Tiempo de tránsito base en días entre depósito origen y región destino
# dep_id -> region_id -> (dias_min, dias_max)
TIEMPOS = {
    1: {1: (1,2),  2: (2,4),  3: (4,6),  4: (3,5),  5: (2,3)},  # CL Rosario
    2: {1: (2,4),  2: (1,2),  3: (2,4),  4: (3,5),  5: (3,5)},  # CL Pergamino
    3: {1: (3,5),  2: (3,5),  3: (5,7),  4: (1,2),  5: (4,6)},  # CL Río Cuarto
}

TRANSPORTISTAS = [
    "TCA Transporte Agrícola",
    "LogiCampo S.A.",
    "AgroExpress Logística",
    "Pampa Cargas",
    "TransAgro Norte",
]

TIPOS_ENVIO = {
    "Terrestre": 0.82,
    "Ferroviario": 0.12,
    "Fluvial": 0.06,
}


def generate(df_cliente=None):
    dates   = pd.date_range("2016-01-01", "2026-12-31", freq="D")
    dates   = dates[dates.weekday < 6]  # excluir domingos
    date_ids = np.array([int(d.strftime("%Y%m%d")) for d in dates])

    n = N_LOGISTICA
    idx_fecha = rng.integers(0, len(date_ids), n)
    f_ids     = date_ids[idx_fecha]

    dep_ids    = rng.choice([1, 2, 3], size=n, p=[0.45, 0.30, 0.25])
    region_ids = rng.choice([1, 2, 3, 4, 5], size=n, p=[0.28, 0.25, 0.17, 0.22, 0.08])

    # Tiempo de tránsito según origen-destino
    dias_transito = np.array([
        int(rng.integers(*TIEMPOS[dep_ids[i]][region_ids[i]]))
        for i in range(n)
    ])

    tipo_envio = rng.choice(
        list(TIPOS_ENVIO.keys()),
        size=n,
        p=list(TIPOS_ENVIO.values())
    )

    if df_cliente is not None:
        cli_ids = rng.choice(df_cliente["cliente_id"].values, size=n)
    else:
        cli_ids = np.array([f"C{rng.integers(1,4001):05d}" for _ in range(n)])

    peso_kg    = np.round(rng.lognormal(5.5, 1.2, n)).astype(int)
    peso_kg    = np.clip(peso_kg, 50, 25_000)
    costo_flete_ars = np.round(peso_kg * rng.uniform(8, 35, n), 2)

    estado = rng.choice(
        ["Entregado", "En tránsito", "Demorado", "Devuelto"],
        size=n, p=[0.88, 0.07, 0.04, 0.01]
    )

    demora_dias = np.where(
        estado == "Demorado",
        rng.integers(1, 8, n),
        0
    )

    df = pd.DataFrame({
        "logistica_id":       range(1, n+1),
        "fecha_despacho_id":  f_ids,
        "cliente_id":         cli_ids,
        "deposito_origen_id": dep_ids,
        "region_destino_id":  region_ids,
        "transportista":      rng.choice(TRANSPORTISTAS, size=n),
        "tipo_envio":         tipo_envio,
        "peso_kg":            peso_kg,
        "dias_transito_base": dias_transito,
        "dias_demora":        demora_dias,
        "dias_transito_real": dias_transito + demora_dias,
        "costo_flete_ars":    costo_flete_ars,
        "estado":             estado,
    })

    out = os.path.join(CSV_DIR, "Fact_Logística.csv")
    df.to_csv(out, index=False, encoding="utf-8-sig")
    print(f"[OK] Fact_Logística: {len(df):,} filas -> {out}")
    return df


if __name__ == "__main__":
    generate()

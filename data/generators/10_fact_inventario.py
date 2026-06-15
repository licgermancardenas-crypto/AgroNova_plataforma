"""
Fact_Inventario - snapshot mensual de stock por depósito y producto
~90.000 registros (2.500 productos × 3 depósitos × ~12 meses × ~1 año muestra = escalado)
"""

import pandas as pd
import numpy as np
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from config import CSV_DIR, SEED, INFLACION, USD_ARS

rng = np.random.default_rng(SEED + 2)

DEPOSITO_IDS = [1, 2, 3]
DEP_CAP_TON  = {1: 12_000, 2: 8_000, 3: 7_500}


def generate(df_producto=None):
    # Un snapshot por mes, por depósito, por producto (muestra de 30 prods por depósito/mes)
    periodos = pd.period_range("2016-01", "2026-12", freq="M")

    if df_producto is not None:
        prod_ids     = df_producto["producto_id"].values
        prod_precios = df_producto["precio_usd_base_2016"].values.astype(float)
    else:
        prod_ids     = np.array([f"P{i:04d}" for i in range(1, 2501)])
        prod_precios = rng.uniform(10, 500, 2500)

    rows = []
    inv_id = 1

    for periodo in periodos:
        fecha_id  = int(f"{periodo.year}{periodo.month:02d}01")
        year      = periodo.year
        tc        = USD_ARS.get(year, 14.8)
        infl      = INFLACION.get(year, 1.0)

        for dep_id in DEPOSITO_IDS:
            # Sample ~100 productos por depósito por mes
            idx = rng.choice(len(prod_ids), size=100, replace=False)
            for i in idx:
                stock_actual  = int(rng.integers(0, 800))
                stock_minimo  = int(rng.integers(10, 100))
                stock_maximo  = int(rng.integers(200, 1_000))
                bajo_minimo   = int(stock_actual < stock_minimo)
                precio_usd    = round(float(prod_precios[i]), 2)
                valor_stock_ars = round(stock_actual * precio_usd * tc, 2)
                valor_stock_usd = round(stock_actual * precio_usd, 2)

                rows.append({
                    "inventario_id":    inv_id,
                    "fecha_id":         fecha_id,
                    "producto_id":      prod_ids[i],
                    "deposito_id":      dep_id,
                    "stock_actual":     stock_actual,
                    "stock_minimo":     stock_minimo,
                    "stock_maximo":     stock_maximo,
                    "bajo_minimo":      bajo_minimo,
                    "valor_stock_ars":  valor_stock_ars,
                    "valor_stock_usd":  valor_stock_usd,
                    "merma_pct":        round(float(rng.uniform(0, 0.03)), 4),
                })
                inv_id += 1

    df = pd.DataFrame(rows)
    out = os.path.join(CSV_DIR, "Fact_Inventario.csv")
    df.to_csv(out, index=False, encoding="utf-8-sig")
    print(f"[OK] Fact_Inventario: {len(df):,} filas -> {out}")
    return df


if __name__ == "__main__":
    generate()

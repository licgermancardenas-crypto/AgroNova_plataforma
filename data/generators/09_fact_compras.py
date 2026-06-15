"""
Fact_Compras - órdenes de compra a proveedores (2016-2026)
~150.000 registros: reabastecimiento consistente con ventas.
"""

import pandas as pd
import numpy as np
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from config import CSV_DIR, SEED, INFLACION, USD_ARS

rng = np.random.default_rng(SEED + 1)

N_COMPRAS = 150_000


def generate(df_producto=None, df_proveedor=None):
    dates = pd.date_range("2016-01-01", "2026-12-31", freq="D")
    dates = dates[dates.weekday < 5]  # días hábiles
    date_ids = np.array([int(d.strftime("%Y%m%d")) for d in dates])
    years    = np.array([d.year for d in dates])

    n = N_COMPRAS
    idx_fecha = rng.integers(0, len(date_ids), n)
    f_ids   = date_ids[idx_fecha]
    f_years = years[idx_fecha]

    # Proveedor IDs 1-15
    prov_ids = rng.integers(1, 16, n)

    # Producto IDs (sample de P0001-P2500)
    if df_producto is not None:
        prod_sample = df_producto["producto_id"].values
        prod_precios = df_producto["precio_usd_base_2016"].values.astype(float)
        idx_prod = rng.integers(0, len(prod_sample), n)
        prod_ids = prod_sample[idx_prod]
        precio_usd_base = prod_precios[idx_prod]
    else:
        prod_ids = np.array([f"P{rng.integers(1,2501):04d}" for _ in range(n)])
        precio_usd_base = rng.uniform(10, 500, n)

    cantidad = np.round(np.exp(rng.normal(3.2, 1.0, n))).astype(int)
    cantidad = np.clip(cantidad, 10, 5_000)

    tc = np.array([USD_ARS.get(y, 14.8) for y in f_years])
    descuento_proveedor = np.round(rng.uniform(0.03, 0.18, n), 4)
    precio_unit_usd  = np.round(precio_usd_base * rng.uniform(0.60, 0.82, n), 2)
    precio_unit_ars  = np.round(precio_unit_usd * tc, 2)
    total_ars  = np.round(cantidad * precio_unit_ars * (1 - descuento_proveedor), 2)
    total_usd  = np.round(cantidad * precio_unit_usd * (1 - descuento_proveedor), 2)

    plazo_entrega = rng.integers(3, 75, n)
    deposito_dest = rng.choice([1, 2, 3], size=n, p=[0.45, 0.30, 0.25])

    estado = rng.choice(
        ["Recibida", "En tránsito", "Pendiente", "Cancelada"],
        size=n, p=[0.78, 0.12, 0.07, 0.03]
    )

    df = pd.DataFrame({
        "compra_id":              range(1, n+1),
        "fecha_id":               f_ids,
        "proveedor_id":           prov_ids,
        "producto_id":            prod_ids,
        "deposito_destino_id":    deposito_dest,
        "cantidad":               cantidad,
        "precio_unitario_usd":    precio_unit_usd,
        "precio_unitario_ars":    precio_unit_ars,
        "descuento_proveedor_pct":descuento_proveedor,
        "total_usd":              total_usd,
        "total_ars":              total_ars,
        "plazo_entrega_dias":     plazo_entrega,
        "estado":                 estado,
    })

    out = os.path.join(CSV_DIR, "Fact_Compras.csv")
    df.to_csv(out, index=False, encoding="utf-8-sig")
    print(f"[OK] Fact_Compras: {len(df):,} filas -> {out}")
    return df


if __name__ == "__main__":
    generate()

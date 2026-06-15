"""
Fact_Ventas - 1.500.000 transacciones 2016-2026
Vectorizado con numpy para generación eficiente.
"""

import pandas as pd
import numpy as np
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from config import (
    CSV_DIR, SEED, N_VENTAS, N_CLIENTES, N_PRODUCTOS,
    ESTACIONALIDAD, INFLACION, USD_ARS, SUCURSALES,
)

rng = np.random.default_rng(SEED)

# -- Parámetros de comportamiento de cliente --------------------------
# Ciclo de vida -> distribución de volumen (normalizada)
CICLO_VOL = {
    "Activo estable":    1.00,
    "Activo creciente":  1.35,
    "Activo decreciente":0.65,
    "Churned":           0.40,
    "Nuevo (post 2022)": 0.70,
}

BATCH = 250_000   # procesar en lotes para controlar RAM


def build_date_index():
    """Crea arrays de fecha_id con pesos por estacionalidad."""
    dates = pd.date_range("2016-01-01", "2026-12-31", freq="D")
    # Filtrar domingos (negocio cerrado)
    dates = dates[dates.weekday != 6]
    weights = np.array([ESTACIONALIDAD[d.month] for d in dates], dtype=float)
    weights /= weights.sum()
    date_ids = np.array([int(d.strftime("%Y%m%d")) for d in dates])
    years    = np.array([d.year for d in dates])
    months   = np.array([d.month for d in dates])
    return date_ids, weights, years, months


def generate(df_cliente=None, df_producto=None):
    print("  Construyendo índice de fechas…")
    date_ids, date_weights, date_years, date_months = build_date_index()

    # -- Cargar o asumir IDs de clientes y productos ------------------
    if df_cliente is not None:
        cli_ids    = df_cliente["cliente_id"].values
        cli_ciclos = df_cliente["ciclo_vida"].values
        cli_altas  = df_cliente["año_alta"].fillna(2016).astype(int).values
        cli_bajas  = df_cliente["año_baja"].fillna(2027).astype(int).values
        cli_suc    = df_cliente["sucursal_id_asignada"].values
        # Pareto volume factor: escala cantidades por cliente
        cli_vol_factor = df_cliente["volumen_factor"].fillna(1.0).values.astype(float)
    else:
        cli_ids       = np.array([f"C{i:05d}" for i in range(1, N_CLIENTES+1)])
        cli_ciclos    = np.full(N_CLIENTES, "Activo estable")
        cli_altas     = np.full(N_CLIENTES, 2016)
        cli_bajas     = np.full(N_CLIENTES, 2027)
        cli_suc       = rng.integers(1, 6, N_CLIENTES)
        cli_vol_factor = np.ones(N_CLIENTES)

    if df_producto is not None:
        prod_ids   = df_producto["producto_id"].values
        prod_precios_usd = df_producto["precio_usd_base_2016"].values.astype(float)
        prod_margenes    = df_producto["margen_bruto_pct"].values.astype(float)
        prod_rot         = df_producto["rotacion"].values
    else:
        prod_ids   = np.array([f"P{i:04d}" for i in range(1, N_PRODUCTOS+1)])
        prod_precios_usd = rng.uniform(10, 500, N_PRODUCTOS)
        prod_margenes    = rng.uniform(0.12, 0.38, N_PRODUCTOS)
        prod_rot         = np.full(N_PRODUCTOS, "Media")

    # Pesos de rotación para sampling de productos
    rot_weight_map = {"Alta": 3.0, "Media": 1.0, "Baja": 0.3}
    prod_weights = np.array([rot_weight_map.get(r, 1.0) for r in prod_rot], dtype=float)
    prod_weights /= prod_weights.sum()

    # Pesos de clientes (ciclo de vida)
    cli_vol_weights = np.array([CICLO_VOL.get(c, 1.0) for c in cli_ciclos], dtype=float)
    cli_vol_weights /= cli_vol_weights.sum()

    suc_ids = [s["sucursal_id"] for s in SUCURSALES]

    print(f"  Generando {N_VENTAS:,} transacciones en lotes de {BATCH:,}…")
    chunks = []
    generados = 0
    venta_id  = 1

    while generados < N_VENTAS:
        n = min(BATCH, N_VENTAS - generados)

        # Samplear fechas con pesos estacionales
        idx_fecha = rng.choice(len(date_ids), size=n, p=date_weights)
        f_ids   = date_ids[idx_fecha]
        f_years = date_years[idx_fecha]

        # Samplear clientes con pesos de ciclo de vida
        idx_cli = rng.choice(N_CLIENTES, size=n, p=cli_vol_weights)

        # Filtrar: cliente activo en ese año
        year_ok = (f_years >= cli_altas[idx_cli]) & (f_years < cli_bajas[idx_cli])
        # Para churned: reducir ventas en años posteriores al abandono
        mask_valid = year_ok

        # Samplear productos
        idx_prod = rng.choice(N_PRODUCTOS, size=n, p=prod_weights)

        # Cantidad vendida: log-normal base * volumen_factor del cliente (Pareto 80/20)
        cantidad_base = np.exp(rng.normal(1.5, 0.7, n))
        vol_scale = cli_vol_factor[idx_cli]
        cantidad = np.round(cantidad_base * vol_scale).astype(int)
        cantidad = np.clip(cantidad, 1, 5_000)

        # Precio USD base escalado por inflación ARS
        precio_usd_base = prod_precios_usd[idx_prod]
        infl = np.array([INFLACION.get(y, 1.0) for y in f_years])
        tc   = np.array([USD_ARS.get(y, 14.8)  for y in f_years])

        # Precio en ARS = precio_USD_base * factor_inflación_acumulado * (ARS_actual/ARS_2016)
        # Simplificado: precio_ars = precio_usd * tc * pequeño_mkt_premium
        mkt_premium = rng.uniform(0.95, 1.08, n)
        precio_unit_ars = np.round(precio_usd_base * tc * mkt_premium, 2)
        precio_unit_usd = np.round(precio_usd_base * mkt_premium, 2)

        # Descuento (por segmento y volumen)
        descuento_pct = np.round(rng.uniform(0, 0.15, n), 4)
        # Cooperativas y agroindustrias tienen mayor descuento
        suc_cli = cli_suc[idx_cli].astype(int)

        total_ars   = np.round(cantidad * precio_unit_ars * (1 - descuento_pct), 2)
        total_usd   = np.round(cantidad * precio_unit_usd * (1 - descuento_pct), 2)
        margen_bruto_ars = np.round(total_ars * prod_margenes[idx_prod], 2)

        # Canal de venta
        canal = rng.choice(["Comercial Directo", "Portal B2B", "Televentas"],
                           size=n, p=[0.60, 0.28, 0.12])

        # Estado de la venta
        estado = rng.choice(["Facturada", "Entregada", "Cancelada", "Pendiente"],
                            size=n, p=[0.72, 0.22, 0.04, 0.02])

        chunk = pd.DataFrame({
            "venta_id":         range(venta_id, venta_id + n),
            "fecha_id":         f_ids,
            "cliente_id":       cli_ids[idx_cli],
            "producto_id":      prod_ids[idx_prod],
            "sucursal_id":      suc_cli,
            "vendedor_id":      rng.integers(1, 49, n),
            "cantidad":         cantidad,
            "precio_unitario_ars": precio_unit_ars,
            "precio_unitario_usd": precio_unit_usd,
            "descuento_pct":    descuento_pct,
            "total_ars":        total_ars,
            "total_usd":        total_usd,
            "margen_bruto_ars": margen_bruto_ars,
            "canal":            canal,
            "estado":           estado,
        })

        # Solo filas con cliente activo en esa fecha
        chunk = chunk[mask_valid]
        chunks.append(chunk)
        generados += len(chunk)
        venta_id  += len(chunk)
        print(f"    {generados:,}/{N_VENTAS:,}", end="\r")

    df = pd.concat(chunks, ignore_index=True)
    # Ajustar exactamente a N_VENTAS
    df = df.iloc[:N_VENTAS].reset_index(drop=True)
    df["venta_id"] = range(1, len(df)+1)

    out = os.path.join(CSV_DIR, "Fact_Ventas.csv")
    df.to_csv(out, index=False, encoding="utf-8-sig")
    print(f"\n[OK] Fact_Ventas: {len(df):,} filas -> {out}")
    return df


if __name__ == "__main__":
    generate()

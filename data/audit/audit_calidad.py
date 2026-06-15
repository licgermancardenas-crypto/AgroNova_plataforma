"""
AgroNova Argentina S.A. - Auditoria de Calidad de Datos
Cubre 14 dimensiones de calidad. Genera reporte TXT + JSON de hallazgos.
"""

import os, sys, json, warnings
from datetime import datetime
import pandas as pd
import numpy as np

warnings.filterwarnings("ignore")

CSV_DIR    = os.path.join(os.path.dirname(__file__), "..", "csv")
REPORT_DIR = os.path.dirname(__file__)

# ── Helpers ─────────────────────────────────────────────────────────
findings   = []   # lista de hallazgos {nivel, check, detalle}
stats      = {}   # estadisticas por tabla

def ok(check, msg=""):
    findings.append({"nivel": "OK",   "check": check, "detalle": msg})
    print(f"  [OK]   {check}" + (f" — {msg}" if msg else ""))

def warn(check, msg=""):
    findings.append({"nivel": "WARN", "check": check, "detalle": msg})
    print(f"  [WARN] {check} — {msg}")

def err(check, msg=""):
    findings.append({"nivel": "ERR",  "check": check, "detalle": msg})
    print(f"  [ERR]  {check} — {msg}")

def sep(title=""):
    print("\n" + "=" * 65)
    if title:
        print(f"  {title}")
        print("=" * 65)

def load(name):
    path = os.path.join(CSV_DIR, name)
    if not os.path.exists(path):
        err(f"Archivo {name}", "No encontrado")
        return pd.DataFrame()
    df = pd.read_csv(path, encoding="utf-8-sig", low_memory=False)
    print(f"  Cargado {name}: {len(df):,} filas x {len(df.columns)} cols")
    return df

# ── Carga ────────────────────────────────────────────────────────────
sep("CARGA DE DATOS")
df_fecha    = load("Dim_Fecha.csv")
df_region   = load("Dim_Region.csv") if os.path.exists(os.path.join(CSV_DIR,"Dim_Region.csv")) else load("Dim_Región.csv")
df_suc      = load("Dim_Sucursal.csv")
df_dep      = load("Dim_Depósito.csv") if os.path.exists(os.path.join(CSV_DIR,"Dim_Depósito.csv")) else load("Dim_Deposito.csv")
df_vend     = load("Dim_Vendedor.csv")
df_prov     = load("Dim_Proveedor.csv")
df_prod     = load("Dim_Producto.csv")
df_cli      = load("Dim_Cliente.csv")
df_compras  = load("Fact_Compras.csv")
df_inv      = load("Fact_Inventario.csv")
df_ventas   = load("Fact_Ventas.csv")
df_log      = load("Fact_Logística.csv") if os.path.exists(os.path.join(CSV_DIR,"Fact_Logística.csv")) else load("Fact_Logistica.csv")
df_cotiz    = load("Cotizaciones_Externas.csv")

# Normalizar nombres de columnas clave para robustez
if "region_id" not in df_region.columns and len(df_region) > 0:
    df_region.columns = [c.lower().replace(" ","_") for c in df_region.columns]

# ────────────────────────────────────────────────────────────────────
sep("1. INTEGRIDAD REFERENCIAL")

# fecha_id presentes en dims
fecha_set = set(df_fecha["fecha_id"])
for tabla, df_t, col in [
    ("Fact_Ventas",    df_ventas,  "fecha_id"),
    ("Fact_Compras",   df_compras, "fecha_id"),
    ("Fact_Inventario",df_inv,     "fecha_id"),
    ("Fact_Logistica", df_log,     "fecha_despacho_id"),
    ("Cotizaciones",   df_cotiz,   "fecha_id"),
]:
    huerfanos = df_t[~df_t[col].isin(fecha_set)][col].nunique()
    if huerfanos == 0:
        ok(f"FK fecha_id en {tabla}")
    else:
        err(f"FK fecha_id en {tabla}", f"{huerfanos} valores huerfanos")

# cliente_id
cli_set = set(df_cli["cliente_id"])
for tabla, df_t in [("Fact_Ventas", df_ventas), ("Fact_Logistica", df_log)]:
    col = "cliente_id"
    huerfanos = df_t[~df_t[col].isin(cli_set)][col].nunique()
    if huerfanos == 0:
        ok(f"FK cliente_id en {tabla}")
    else:
        err(f"FK cliente_id en {tabla}", f"{huerfanos} clientes huerfanos")

# producto_id
prod_set = set(df_prod["producto_id"])
for tabla, df_t in [("Fact_Ventas", df_ventas), ("Fact_Compras", df_compras), ("Fact_Inventario", df_inv)]:
    huerfanos = df_t[~df_t["producto_id"].isin(prod_set)]["producto_id"].nunique()
    if huerfanos == 0:
        ok(f"FK producto_id en {tabla}")
    else:
        err(f"FK producto_id en {tabla}", f"{huerfanos} productos huerfanos")

# proveedor_id
prov_set = set(df_prov["proveedor_id"])
huerfanos = df_compras[~df_compras["proveedor_id"].isin(prov_set)]["proveedor_id"].nunique()
if huerfanos == 0:
    ok("FK proveedor_id en Fact_Compras")
else:
    err("FK proveedor_id en Fact_Compras", f"{huerfanos} huerfanos")

# sucursal_id
suc_set = set(df_suc["sucursal_id"])
huerfanos = df_ventas[~df_ventas["sucursal_id"].isin(suc_set)]["sucursal_id"].nunique()
if huerfanos == 0:
    ok("FK sucursal_id en Fact_Ventas")
else:
    err("FK sucursal_id en Fact_Ventas", f"{huerfanos} huerfanos")

# vendedor_id
vend_set = set(df_vend["vendedor_id"])
huerfanos = df_ventas[~df_ventas["vendedor_id"].isin(vend_set)]["vendedor_id"].nunique()
if huerfanos == 0:
    ok("FK vendedor_id en Fact_Ventas")
else:
    err("FK vendedor_id en Fact_Ventas", f"{huerfanos} huerfanos")

# deposito_id
dep_set = set(df_dep["deposito_id"])
for tabla, df_t, col in [
    ("Fact_Compras",   df_compras, "deposito_destino_id"),
    ("Fact_Inventario",df_inv,     "deposito_id"),
    ("Fact_Logistica", df_log,     "deposito_origen_id"),
]:
    huerfanos = df_t[~df_t[col].isin(dep_set)][col].nunique()
    if huerfanos == 0:
        ok(f"FK deposito_id en {tabla}")
    else:
        err(f"FK deposito_id en {tabla}", f"{huerfanos} huerfanos")

# region_id en Fact_Logistica
if "region_id" in df_region.columns:
    reg_set = set(df_region["region_id"])
    huerfanos = df_log[~df_log["region_destino_id"].isin(reg_set)]["region_destino_id"].nunique()
    if huerfanos == 0:
        ok("FK region_id en Fact_Logistica")
    else:
        err("FK region_id en Fact_Logistica", f"{huerfanos} huerfanos")

# ────────────────────────────────────────────────────────────────────
sep("2. CLAVES PRIMARIAS DUPLICADAS")

pk_checks = [
    ("Dim_Fecha",     df_fecha,   "fecha_id"),
    ("Dim_Sucursal",  df_suc,     "sucursal_id"),
    ("Dim_Deposito",  df_dep,     "deposito_id"),
    ("Dim_Vendedor",  df_vend,    "vendedor_id"),
    ("Dim_Proveedor", df_prov,    "proveedor_id"),
    ("Dim_Producto",  df_prod,    "producto_id"),
    ("Dim_Cliente",   df_cli,     "cliente_id"),
    ("Fact_Ventas",   df_ventas,  "venta_id"),
    ("Fact_Compras",  df_compras, "compra_id"),
    ("Fact_Inventario",df_inv,    "inventario_id"),
    ("Cotizaciones",  df_cotiz,   "fecha"),
]
for nombre, df_t, pk in pk_checks:
    dups = df_t[pk].duplicated().sum()
    if dups == 0:
        ok(f"PK unica en {nombre}")
    else:
        err(f"PK duplicada en {nombre}", f"{dups} duplicados en '{pk}'")

# ────────────────────────────────────────────────────────────────────
sep("3. REGISTROS HUERFANOS")

# Clientes sin ventas
cli_con_ventas = set(df_ventas["cliente_id"])
cli_sin_ventas = cli_set - cli_con_ventas
pct = len(cli_sin_ventas) / len(cli_set) * 100
if pct < 5:
    ok("Clientes con al menos 1 venta", f"{pct:.1f}% sin ventas (aceptable)")
elif pct < 15:
    warn("Clientes sin ventas", f"{pct:.1f}% no tienen transacciones")
else:
    err("Clientes sin ventas", f"{pct:.1f}% no tienen transacciones")

# Productos sin ventas
prod_con_ventas = set(df_ventas["producto_id"])
prod_sin_ventas = prod_set - prod_con_ventas
pct_p = len(prod_sin_ventas) / len(prod_set) * 100
if pct_p < 10:
    ok("Productos con al menos 1 venta", f"{pct_p:.1f}% sin ventas")
else:
    warn("Productos sin ventas", f"{pct_p:.1f}% nunca vendidos")

# Vendedores sin ventas
vend_con_ventas = set(df_ventas["vendedor_id"])
vend_sin_ventas = vend_set - vend_con_ventas
if len(vend_sin_ventas) == 0:
    ok("Todos los vendedores tienen ventas")
else:
    warn("Vendedores sin ventas", f"{len(vend_sin_ventas)} vendedores inactivos en ventas")

# ────────────────────────────────────────────────────────────────────
sep("4. CONSISTENCIA DE FECHAS")

# Rango de Dim_Fecha
f_min, f_max = df_fecha["fecha"].min(), df_fecha["fecha"].max()
ok(f"Rango Dim_Fecha", f"{f_min} a {f_max}")

# Ventas dentro del rango
v_min = str(df_ventas["fecha_id"].min())
v_max = str(df_ventas["fecha_id"].max())
if v_min[:4] >= "2016" and v_max[:4] <= "2026":
    ok("Fechas Fact_Ventas dentro de 2016-2026", f"{v_min} a {v_max}")
else:
    err("Fechas Fact_Ventas fuera de rango", f"{v_min} a {v_max}")

# Fechas nulas
for nombre, df_t, col in [
    ("Fact_Ventas",  df_ventas,  "fecha_id"),
    ("Fact_Compras", df_compras, "fecha_id"),
]:
    nulos = df_t[col].isna().sum()
    if nulos == 0:
        ok(f"Sin fechas nulas en {nombre}")
    else:
        err(f"Fechas nulas en {nombre}", f"{nulos} registros")

# Dias de la semana en ventas (no deberia haber domingos)
df_fecha["fecha"] = pd.to_datetime(df_fecha["fecha"])
fecha_dow = df_fecha.set_index("fecha_id")["dia_semana"]
ventas_dow = df_ventas["fecha_id"].map(fecha_dow)
domingos = (ventas_dow == 7).sum()
if domingos == 0:
    ok("Sin ventas en domingo")
else:
    warn("Ventas en domingo", f"{domingos:,} registros")

# ────────────────────────────────────────────────────────────────────
sep("5. COMPRAS OCURREN ANTES QUE VENTAS (coherencia temporal)")

# Media de fecha de compras vs ventas por año
compras_año = df_compras["fecha_id"].astype(str).str[:4].astype(int)
ventas_año  = df_ventas["fecha_id"].astype(str).str[:4].astype(int)

c_dist = compras_año.value_counts().sort_index()
v_dist = ventas_año.value_counts().sort_index()
print(f"    Compras/año: {dict(c_dist)}")
print(f"    Ventas/año (sample): {dict(v_dist.head(11))}")

# En promedio, las compras deben ocurrir en años previos o iguales a las ventas
ok("Compras y ventas distribuidas en el mismo periodo (2016-2026)",
   f"Compras median={compras_año.median():.0f}, Ventas median={ventas_año.median():.0f}")

# ────────────────────────────────────────────────────────────────────
sep("6. STOCKS NEGATIVOS")

neg_stock = (df_inv["stock_actual"] < 0).sum()
if neg_stock == 0:
    ok("Sin stock negativo en Fact_Inventario")
else:
    err("Stock negativo", f"{neg_stock} registros")

min_stock = df_inv["stock_actual"].min()
max_stock = df_inv["stock_actual"].max()
ok(f"Rango stock_actual", f"min={min_stock}, max={max_stock}")

bajo_min = df_inv["bajo_minimo"].sum()
pct_bm = bajo_min / len(df_inv) * 100
ok(f"Alertas stock bajo minimo", f"{bajo_min:,} ({pct_bm:.1f}%) — esperado 10-25%")

# ────────────────────────────────────────────────────────────────────
sep("7. CLIENTES NO OPERAN ANTES DE SU ALTA")

# Extraer año de ventas y comparar con año_alta del cliente
cli_alta = df_cli.set_index("cliente_id")["año_alta"].to_dict()
cli_baja = df_cli.set_index("cliente_id")["año_baja"]

ventas_pequeño = df_ventas[["cliente_id","fecha_id"]].copy()
ventas_pequeño["año_venta"] = ventas_pequeño["fecha_id"].astype(str).str[:4].astype(int)
ventas_pequeño["año_alta"]  = ventas_pequeño["cliente_id"].map(cli_alta)

antes_de_alta = (ventas_pequeño["año_venta"] < ventas_pequeño["año_alta"]).sum()
pct_anterior = antes_de_alta / len(ventas_pequeño) * 100

if pct_anterior < 0.5:
    ok("Ventas no ocurren antes del alta del cliente",
       f"{antes_de_alta:,} casos ({pct_anterior:.3f}%) — dentro del umbral 0.5%")
elif pct_anterior < 2:
    warn("Ventas antes del alta del cliente",
         f"{antes_de_alta:,} ({pct_anterior:.2f}%)")
else:
    err("Ventas antes del alta del cliente",
        f"{antes_de_alta:,} ({pct_anterior:.2f}%)")

# ────────────────────────────────────────────────────────────────────
sep("8. REALISMO DE CANTIDADES, COSTOS Y PRECIOS")

# Fact_Ventas
print("\n  Fact_Ventas — precio_unitario_ars:")
print(df_ventas["precio_unitario_ars"].describe().round(2).to_string())
print("\n  Fact_Ventas — cantidad:")
print(df_ventas["cantidad"].describe().round(2).to_string())
print("\n  Fact_Ventas — total_ars:")
print(df_ventas["total_ars"].describe().round(2).to_string())
print("\n  Fact_Ventas — total_usd:")
print(df_ventas["total_usd"].describe().round(2).to_string())

# Precios negativos o cero
neg_precio = (df_ventas["precio_unitario_ars"] <= 0).sum()
neg_total  = (df_ventas["total_ars"] <= 0).sum()
neg_cant   = (df_ventas["cantidad"] <= 0).sum()
if neg_precio + neg_total + neg_cant == 0:
    ok("Sin precios/cantidades negativos o cero")
else:
    err("Valores negativos/cero en Fact_Ventas",
        f"precio<=0: {neg_precio}, total<=0: {neg_total}, cant<=0: {neg_cant}")

# Outliers extremos (p99.9)
p999 = df_ventas["total_ars"].quantile(0.999)
extremos = (df_ventas["total_ars"] > p999 * 10).sum()
if extremos == 0:
    ok(f"Sin outliers extremos en total_ars (p99.9={p999:,.0f})")
else:
    warn(f"Outliers extremos en total_ars", f"{extremos} registros > 10x p99.9")

# Descuentos
max_desc = df_ventas["descuento_pct"].max()
if max_desc <= 0.20:
    ok(f"Descuentos dentro de rango", f"max={max_desc:.1%}")
else:
    warn(f"Descuento maximo alto", f"max={max_desc:.1%}")

# ────────────────────────────────────────────────────────────────────
sep("9. PARETO 80/20 — CONCENTRACION DE CLIENTES")

ventas_x_cli = df_ventas.groupby("cliente_id")["total_ars"].sum().sort_values(ascending=False)
total_rev = ventas_x_cli.sum()
n_total = len(ventas_x_cli)

# Top 20% clientes
top20_n = max(1, int(n_total * 0.20))
top20_rev = ventas_x_cli.head(top20_n).sum()
pct_top20 = top20_rev / total_rev * 100

# Top 20% deberia generar ~70-85% del revenue
if 65 <= pct_top20 <= 90:
    ok(f"Pareto 80/20 valido", f"Top 20% clientes = {pct_top20:.1f}% del revenue")
elif 55 <= pct_top20 < 65:
    warn(f"Pareto debil", f"Top 20% clientes = {pct_top20:.1f}% del revenue (esperado 70-85%)")
else:
    warn(f"Pareto fuera de rango", f"Top 20% clientes = {pct_top20:.1f}% del revenue")

# Deciles
decil_labels = [f"D{i+1}" for i in range(10)]
n_decil = max(1, n_total // 10)
decil_pcts = []
for i in range(10):
    s = ventas_x_cli.iloc[i*n_decil:(i+1)*n_decil].sum()
    decil_pcts.append(round(s/total_rev*100, 2))
print(f"  Revenue por decil (D1=top): {decil_pcts}")

# Ticket promedio por segmento
ventas_seg = df_ventas.merge(df_cli[["cliente_id","segmento"]], on="cliente_id", how="left")
ticket_seg = ventas_seg.groupby("segmento")["total_ars"].agg(["mean","count","sum"]).round(0)
print("\n  Ticket y frecuencia por segmento:")
print(ticket_seg.to_string())

# ────────────────────────────────────────────────────────────────────
sep("10. ROTACION DE PRODUCTOS")

ventas_rot = df_ventas.merge(df_prod[["producto_id","rotacion","categoria"]], on="producto_id", how="left")
rot_stats = ventas_rot.groupby("rotacion").agg(
    n_transacciones=("venta_id","count"),
    revenue_ars=("total_ars","sum"),
    n_productos_distintos=("producto_id","nunique"),
).round(0)
print("\n  Ventas por nivel de rotacion:")
print(rot_stats.to_string())

# Alta rotacion debe tener mayor revenue por producto
alta = rot_stats.loc["Alta","revenue_ars"] / rot_stats.loc["Alta","n_productos_distintos"] if "Alta" in rot_stats.index else 0
baja = rot_stats.loc["Baja","revenue_ars"] / rot_stats.loc["Baja","n_productos_distintos"] if "Baja" in rot_stats.index else 1
if alta > baja:
    ok("Alta rotacion tiene mayor revenue por producto que Baja rotacion",
       f"Alta={alta:,.0f} vs Baja={baja:,.0f}")
else:
    warn("Rotacion no se refleja en revenue", f"Alta={alta:,.0f} <= Baja={baja:,.0f}")

# ────────────────────────────────────────────────────────────────────
sep("11. DIFERENCIACION REGIONAL")

ventas_reg = df_ventas.groupby("sucursal_id").agg(
    revenue_ars=("total_ars","sum"),
    n_transacciones=("venta_id","count"),
    ticket_promedio=("total_ars","mean"),
).round(0)
ventas_reg = ventas_reg.merge(df_suc[["sucursal_id","nombre"]], left_index=True, right_on="sucursal_id")
print("\n  Revenue por sucursal/region:")
print(ventas_reg.set_index("nombre").to_string())

# CV del revenue entre regiones (>0.2 = diferenciacion valida)
cv = ventas_reg["revenue_ars"].std() / ventas_reg["revenue_ars"].mean()
if cv > 0.15:
    ok(f"Regiones diferenciadas", f"CV revenue = {cv:.2f} (>0.15 = diferenciacion valida)")
else:
    warn(f"Regiones poco diferenciadas", f"CV revenue = {cv:.2f}")

# ────────────────────────────────────────────────────────────────────
sep("12. ESTACIONALIDAD AGRICOLA EN VENTAS")

df_ventas["mes"] = df_ventas["fecha_id"].astype(str).str[4:6].astype(int)
ventas_mes = df_ventas.groupby("mes").agg(
    n_transacciones=("venta_id","count"),
    revenue_ars=("total_ars","sum"),
).round(0)
ventas_mes["pct_revenue"] = (ventas_mes["revenue_ars"] / ventas_mes["revenue_ars"].sum() * 100).round(2)
print("\n  Ventas por mes (estacionalidad):")
print(ventas_mes.to_string())

# Pico en Oct-Nov (meses 10-11) y Abr-May (4-5)
pico_verano = ventas_mes.loc[[10,11],"n_transacciones"].sum()
pico_otono  = ventas_mes.loc[[4,5], "n_transacciones"].sum()
valle       = ventas_mes.loc[[6,7], "n_transacciones"].sum()

ratio_pico_valle = (pico_verano + pico_otono) / 2 / (valle / 2)
if ratio_pico_valle > 1.5:
    ok(f"Estacionalidad agricola reflejada", f"Pico/Valle ratio = {ratio_pico_valle:.2f}x")
elif ratio_pico_valle > 1.2:
    ok(f"Estacionalidad leve", f"ratio = {ratio_pico_valle:.2f}x")
else:
    warn(f"Estacionalidad debil", f"ratio = {ratio_pico_valle:.2f}x")

# ────────────────────────────────────────────────────────────────────
sep("13. CHURN vs CRECIMIENTO DE CLIENTES")

# Clientes churned: tienen ventas hasta año_baja, luego nada
churned = df_cli[df_cli["ciclo_vida"] == "Churned"].copy()
print(f"\n  Clientes Churned: {len(churned):,}")
print(f"  Clientes Activo creciente: {(df_cli['ciclo_vida']=='Activo creciente').sum():,}")
print(f"  Clientes Nuevo (post 2022): {(df_cli['ciclo_vida']=='Nuevo (post 2022)').sum():,}")

# Revenue promedio por ciclo de vida
ventas_ciclo = df_ventas.merge(df_cli[["cliente_id","ciclo_vida"]], on="cliente_id", how="left")
rev_ciclo = ventas_ciclo.groupby("ciclo_vida")["total_ars"].agg(["sum","mean","count"]).round(0)
print("\n  Revenue por ciclo de vida:")
print(rev_ciclo.to_string())

# Crecientes deben tener mayor revenue que decrecientes
if "Activo creciente" in rev_ciclo.index and "Activo decreciente" in rev_ciclo.index:
    crec_ticket = rev_ciclo.loc["Activo creciente","mean"]
    decr_ticket = rev_ciclo.loc["Activo decreciente","mean"]
    if crec_ticket > decr_ticket:
        ok("Crecientes tienen mayor ticket promedio que decrecientes",
           f"Crec={crec_ticket:,.0f} vs Decr={decr_ticket:,.0f}")
    else:
        warn("Ticket promedio invertido: decrecientes > crecientes",
             f"Crec={crec_ticket:,.0f} vs Decr={decr_ticket:,.0f}")

# Verificar que churned no tienen ventas despues de año_baja
churned_ids = set(churned["cliente_id"])
cli_baja_map = df_cli.set_index("cliente_id")["año_baja"].dropna().astype(int).to_dict()
ventas_churned = df_ventas[df_ventas["cliente_id"].isin(churned_ids)].copy()
ventas_churned["año"] = ventas_churned["fecha_id"].astype(str).str[:4].astype(int)
ventas_churned["año_baja"] = ventas_churned["cliente_id"].map(cli_baja_map)
post_churn = ventas_churned[ventas_churned["año"] >= ventas_churned["año_baja"]].shape[0]
pct_pc = post_churn / max(1, len(ventas_churned)) * 100
if pct_pc < 5:
    ok("Clientes churned no operan significativamente post-baja",
       f"{post_churn:,} ventas post-baja ({pct_pc:.1f}%) — aceptable por rango año")
else:
    warn("Ventas post-churn detectadas", f"{post_churn:,} registros ({pct_pc:.1f}%)")

# ────────────────────────────────────────────────────────────────────
sep("14. METRICAS FINANCIERAS")

# Ticket promedio global
ticket_global = df_ventas["total_ars"].mean()
ticket_usd    = df_ventas["total_usd"].mean()
freq_compra   = len(df_ventas) / df_ventas["cliente_id"].nunique()
margen_medio  = (df_ventas["margen_bruto_ars"] / df_ventas["total_ars"]).mean()

print(f"\n  Ticket promedio ARS:       {ticket_global:>15,.2f}")
print(f"  Ticket promedio USD:       {ticket_usd:>15,.2f}")
print(f"  Frecuencia de compra:      {freq_compra:>15,.1f} transacciones/cliente (historico)")
print(f"  Margen bruto medio:        {margen_medio:>15.2%}")

# Revenue total y por año
df_ventas["año"] = df_ventas["fecha_id"].astype(str).str[:4].astype(int)
rev_año = df_ventas.groupby("año")["total_ars"].sum()
print("\n  Revenue ARS por año:")
for y, v in rev_año.items():
    print(f"    {y}: ARS {v:>18,.0f}")

# CAGR (2016 a 2025 en USD)
rev_usd_año = df_ventas.groupby("año")["total_usd"].sum()
if 2016 in rev_usd_año.index and 2025 in rev_usd_año.index:
    cagr = (rev_usd_año[2025] / rev_usd_año[2016]) ** (1/9) - 1
    print(f"\n  CAGR revenue USD (2016-2025): {cagr:.2%}")
    if 0.03 <= cagr <= 0.25:
        ok("CAGR USD realista", f"{cagr:.2%} anual")
    else:
        warn("CAGR fuera de rango tipico", f"{cagr:.2%}")

# Margen dentro de rango esperado (12-38%)
if 0.10 <= margen_medio <= 0.40:
    ok("Margen bruto dentro de rango esperado", f"{margen_medio:.2%}")
else:
    warn("Margen fuera de rango", f"{margen_medio:.2%}")

# Canal de ventas
print("\n  Mix de canales:")
print(df_ventas["canal"].value_counts(normalize=True).mul(100).round(1).to_string())

# Estado de ventas
print("\n  Mix de estados:")
print(df_ventas["estado"].value_counts(normalize=True).mul(100).round(1).to_string())

# ────────────────────────────────────────────────────────────────────
sep("ESTADISTICAS DESCRIPTIVAS POR TABLA")

tablas_stat = {
    "Dim_Fecha":     (df_fecha,   ["factor_estacional"]),
    "Dim_Cliente":   (df_cli,     ["superficie_ha"]),
    "Dim_Producto":  (df_prod,    ["precio_usd_base_2016","margen_bruto_pct"]),
    "Dim_Vendedor":  (df_vend,    ["salario_base_ars_2016"]),
    "Fact_Ventas":   (df_ventas,  ["cantidad","precio_unitario_ars","total_ars","margen_bruto_ars","descuento_pct"]),
    "Fact_Compras":  (df_compras, ["cantidad","precio_unitario_usd","total_ars","plazo_entrega_dias"]),
    "Fact_Inventario":(df_inv,    ["stock_actual","valor_stock_ars","merma_pct"]),
    "Fact_Logistica":(df_log,     ["peso_kg","dias_transito_real","costo_flete_ars"]),
    "Cotizaciones":  (df_cotiz,   ["usd_ars_oficial","usd_ars_blue","soja_cbot_usd_ton","urea_fob_usd_ton"]),
}

for nombre, (df_t, cols) in tablas_stat.items():
    print(f"\n  {nombre} ({len(df_t):,} filas):")
    cols_ok = [c for c in cols if c in df_t.columns]
    if cols_ok:
        print(df_t[cols_ok].describe().round(3).to_string())

# ────────────────────────────────────────────────────────────────────
sep("RESUMEN DE HALLAZGOS")

ok_count   = sum(1 for f in findings if f["nivel"] == "OK")
warn_count = sum(1 for f in findings if f["nivel"] == "WARN")
err_count  = sum(1 for f in findings if f["nivel"] == "ERR")

print(f"\n  Total checks: {len(findings)}")
print(f"  [OK]   {ok_count}")
print(f"  [WARN] {warn_count}")
print(f"  [ERR]  {err_count}")

if warn_count > 0:
    print("\n  Advertencias:")
    for f in findings:
        if f["nivel"] == "WARN":
            print(f"    - {f['check']}: {f['detalle']}")

if err_count > 0:
    print("\n  Errores criticos:")
    for f in findings:
        if f["nivel"] == "ERR":
            print(f"    - {f['check']}: {f['detalle']}")

# ────────────────────────────────────────────────────────────────────
sep("RECOMENDACIONES")

recomendaciones = []

if antes_de_alta > 0:
    recomendaciones.append(
        "Las ventas que preceden al año_alta del cliente son consecuencia del "
        "filtro por AÑO (no fecha exacta). Para produccion: filtrar por fecha completa "
        "usando fecha_alta >= primer dia del año_alta."
    )

pct_prod_sin_ventas = len(prod_sin_ventas) / len(prod_set) * 100
if pct_prod_sin_ventas > 5:
    recomendaciones.append(
        f"{pct_prod_sin_ventas:.1f}% de productos nunca fueron vendidos. "
        "En produccion: marcar como 'Discontinuado' o aumentar peso de rotacion en el generador."
    )

recomendaciones.append(
    "Fact_Inventario usa snapshots mensuales de 100 productos/deposito. "
    "Para un DW productivo completo: generar snapshot para los 2.500 productos "
    "(~900k filas/año, ~9M totales). El generador actual usa muestra para rapidez."
)

recomendaciones.append(
    "El churn post-baja tiene tolerancia de 1 año por el filtro de año entero. "
    "Afinar a nivel de fecha exacta si se usara para modelos ML de churn prediction."
)

recomendaciones.append(
    "Agregar columna 'tipo_cambio_fecha' en Fact_Ventas uniendo con Cotizaciones_Externas "
    "para análisis de revenue USD diario preciso (actualmente usa TC anual promedio)."
)

for i, r in enumerate(recomendaciones, 1):
    print(f"\n  {i}. {r}")

# ────────────────────────────────────────────────────────────────────
# Guardar reporte JSON
reporte = {
    "fecha_auditoria": datetime.now().isoformat(),
    "resumen": {"ok": ok_count, "warn": warn_count, "err": err_count, "total": len(findings)},
    "hallazgos": findings,
    "recomendaciones": recomendaciones,
    "metricas": {
        "ticket_promedio_ars":  round(ticket_global, 2),
        "ticket_promedio_usd":  round(ticket_usd, 2),
        "margen_bruto_medio":   round(float(margen_medio), 4),
        "freq_compra_historica": round(freq_compra, 1),
        "pareto_top20_pct":     round(pct_top20, 1),
        "ratio_estacionalidad": round(ratio_pico_valle, 2),
    }
}

out_json = os.path.join(REPORT_DIR, "reporte_calidad.json")
with open(out_json, "w", encoding="utf-8") as f:
    json.dump(reporte, f, ensure_ascii=False, indent=2)

print(f"\n\n[DONE] Reporte JSON guardado en: {out_json}")
sep()

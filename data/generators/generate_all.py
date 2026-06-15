"""
AgroNova Argentina S.A. - Master Data Generator
Ejecutar: python generate_all.py
Genera todos los CSVs en ../csv/ en el orden correcto.
"""

import sys, os, time, importlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import CSV_DIR, SQL_DIR
os.makedirs(CSV_DIR, exist_ok=True)
os.makedirs(SQL_DIR, exist_ok=True)

def imp(name):
    """Importa modulo con nombre que empieza en digito via importlib."""
    return importlib.import_module(name)

print("=" * 60)
print("  AgroNova Argentina S.A. - Generador de Datos")
print("=" * 60)

t0 = time.time()

print("\n[1/13] Dim_Fecha")
df_fecha = imp("01_dim_fecha").generate()

print("\n[2/13] Dim_Region")
df_region = imp("02_dim_region").generate()

print("\n[3/13] Dim_Sucursal")
df_sucursal = imp("03_dim_sucursal").generate()

print("\n[4/13] Dim_Deposito")
df_deposito = imp("04_dim_deposito").generate()

print("\n[5/13] Dim_Vendedor")
df_vendedor = imp("05_dim_vendedor").generate()

print("\n[6/13] Dim_Proveedor")
df_proveedor = imp("06_dim_proveedor").generate()

print("\n[7/13] Dim_Producto")
df_producto = imp("07_dim_producto").generate()

print("\n[8/13] Dim_Cliente")
df_cliente = imp("08_dim_cliente").generate()

print("\n[9/13] Fact_Compras")
df_compras = imp("09_fact_compras").generate(df_producto=df_producto, df_proveedor=df_proveedor)

print("\n[10/13] Fact_Inventario")
df_inventario = imp("10_fact_inventario").generate(df_producto=df_producto)

print("\n[11/13] Fact_Ventas  <- puede tomar 2-4 min")
df_ventas = imp("11_fact_ventas").generate(df_cliente=df_cliente, df_producto=df_producto)

print("\n[12/13] Fact_Logistica")
df_logistica = imp("12_fact_logistica").generate(df_cliente=df_cliente)

print("\n[13/13] Cotizaciones_Externas")
df_cotiz = imp("13_cotizaciones").generate()

elapsed = time.time() - t0
print("\n" + "=" * 60)
print(f"  [DONE] Generacion completada en {elapsed:.1f}s")
print("=" * 60)
print(f"\n  Archivos en: {CSV_DIR}")
print(f"  Dim_Fecha:              {len(df_fecha):>10,} filas")
print(f"  Dim_Region:             {len(df_region):>10,} filas")
print(f"  Dim_Sucursal:           {len(df_sucursal):>10,} filas")
print(f"  Dim_Deposito:           {len(df_deposito):>10,} filas")
print(f"  Dim_Vendedor:           {len(df_vendedor):>10,} filas")
print(f"  Dim_Proveedor:          {len(df_proveedor):>10,} filas")
print(f"  Dim_Producto:           {len(df_producto):>10,} filas")
print(f"  Dim_Cliente:            {len(df_cliente):>10,} filas")
print(f"  Fact_Compras:           {len(df_compras):>10,} filas")
print(f"  Fact_Inventario:        {len(df_inventario):>10,} filas")
print(f"  Fact_Ventas:            {len(df_ventas):>10,} filas")
print(f"  Fact_Logistica:         {len(df_logistica):>10,} filas")
print(f"  Cotizaciones_Externas:  {len(df_cotiz):>10,} filas")
total = sum(len(x) for x in [
    df_fecha, df_region, df_sucursal, df_deposito, df_vendedor,
    df_proveedor, df_producto, df_cliente, df_compras,
    df_inventario, df_ventas, df_logistica, df_cotiz
])
print(f"\n  TOTAL REGISTROS:        {total:>10,}")
print("=" * 60)

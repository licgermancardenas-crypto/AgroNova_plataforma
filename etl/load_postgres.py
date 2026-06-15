"""
ETL — Carga de CSVs a PostgreSQL / Neon
Uso: python load_postgres.py --conn "postgresql://user:pass@host/db"
     o define DATABASE_URL en el entorno.
"""

import os, sys, argparse, time
import pandas as pd
from sqlalchemy import create_engine, text

CSV_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "csv")
SQL_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "sql")

LOAD_ORDER = [
    ("Dim_Fecha.csv",             "dim_fecha",             {}),
    ("Dim_Región.csv",            "dim_region",            {}),
    ("Dim_Sucursal.csv",          "dim_sucursal",          {}),
    ("Dim_Depósito.csv",          "dim_deposito",          {}),
    ("Dim_Vendedor.csv",          "dim_vendedor",          {}),
    ("Dim_Proveedor.csv",         "dim_proveedor",         {}),
    ("Dim_Producto.csv",          "dim_producto",          {}),
    ("Dim_Cliente.csv",           "dim_cliente",           {}),
    ("Fact_Compras.csv",          "fact_compras",          {"chunksize": 10_000}),
    ("Fact_Inventario.csv",       "fact_inventario",       {"chunksize": 10_000}),
    ("Fact_Ventas.csv",           "fact_ventas",           {"chunksize": 50_000}),
    ("Fact_Logística.csv",        "fact_logistica",        {"chunksize": 20_000}),
    ("Cotizaciones_Externas.csv", "cotizaciones_externas", {}),
]

BOOL_COLS = {
    "dim_fecha":    ["es_feriado","es_fin_de_semana","es_dia_habil"],
    "dim_sucursal": [],
    "dim_deposito": ["temperatura_controlada"],
    "dim_vendedor": ["activo"],
    "dim_proveedor":["activo"],
    "dim_producto": ["requiere_frio","activo"],
    "dim_cliente":  ["activo"],
    "fact_inventario": ["bajo_minimo"],
}


def run(conn_str: str, schema: str = "agronova"):
    engine = create_engine(conn_str)

    # Crear schema y tablas
    ddl_path = os.path.join(SQL_DIR, "01_ddl_schema.sql")
    with engine.connect() as con:
        with open(ddl_path, encoding="utf-8") as f:
            ddl = f.read()
        con.execute(text(ddl))
        con.commit()
    print("✓ Schema y tablas creadas")

    for csv_file, table, opts in LOAD_ORDER:
        path = os.path.join(CSV_DIR, csv_file)
        if not os.path.exists(path):
            print(f"  ⚠ No encontrado: {csv_file} — saltando")
            continue

        t0  = time.time()
        df  = pd.read_csv(path, encoding="utf-8-sig", low_memory=False)

        # Convertir bool
        for col in BOOL_COLS.get(table, []):
            if col in df.columns:
                df[col] = df[col].astype(bool)

        chunksize = opts.get("chunksize", None)
        df.to_sql(
            name=table,
            con=engine,
            schema=schema,
            if_exists="append",
            index=False,
            chunksize=chunksize,
            method="multi",
        )
        elapsed = time.time() - t0
        print(f"  ✓ {table:<30} {len(df):>10,} filas  ({elapsed:.1f}s)")

    print("\n✅ Carga completa en PostgreSQL")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--conn", default=os.getenv("DATABASE_URL"),
                        help="Connection string PostgreSQL")
    parser.add_argument("--schema", default="agronova")
    args = parser.parse_args()

    if not args.conn:
        print("ERROR: Define --conn o la variable DATABASE_URL")
        sys.exit(1)

    run(args.conn, args.schema)

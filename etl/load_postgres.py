"""
AgroNova Argentina S.A. - ETL: Carga CSV -> PostgreSQL / Neon
Uso: python load_postgres.py --conn "postgresql://user:pass@host/db"
     o define DATABASE_URL en el entorno.

Columnas GENERATED excluidas automaticamente de la carga:
  - fact_inventario.bajo_minimo (calculada)
  - fact_logistica.dias_transito_real (calculada)
"""

import os, sys, argparse, time
import pandas as pd
from sqlalchemy import create_engine, text

CSV_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "csv")
SQL_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "sql")

# Orden respeta dependencias FK
# (archivo CSV, tabla SQL, columnas a excluir del CSV, chunksize)
LOAD_ORDER = [
    ("Dim_Fecha.csv",             "dim_fecha",             [],                          None),
    ("Dim_Region.csv",            "dim_region",            [],                          None),
    ("Dim_Sucursal.csv",          "dim_sucursal",          [],                          None),
    ("Dim_Depósito.csv",          "dim_deposito",          [],                          None),
    ("Dim_Vendedor.csv",          "dim_vendedor",          [],                          None),
    ("Dim_Proveedor.csv",         "dim_proveedor",         [],                          None),
    ("Dim_Producto.csv",          "dim_producto",          [],                          None),
    ("Dim_Cliente.csv",           "dim_cliente",           [],                          None),
    ("Fact_Compras.csv",          "fact_compras",          [],                          10_000),
    ("Fact_Inventario.csv",       "fact_inventario",       ["bajo_minimo"],             10_000),
    ("Fact_Ventas.csv",           "fact_ventas",           [],                          50_000),
    ("Fact_Logística.csv",        "fact_logistica",        ["dias_transito_real"],      20_000),
    ("Cotizaciones_Externas.csv", "cotizaciones_externas", [],                          None),
]

# Columnas bool para conversion correcta
BOOL_COLS = {
    "dim_fecha":       ["es_feriado", "es_fin_de_semana", "es_dia_habil"],
    "dim_deposito":    ["temperatura_controlada"],
    "dim_vendedor":    ["activo"],
    "dim_proveedor":   ["activo"],
    "dim_producto":    ["requiere_frio", "activo"],
    "dim_cliente":     ["activo"],
}

# Columnas enum para evitar problemas de tipo
ENUM_COLS = {
    "fact_ventas":     {"estado": "estado_venta::text", "canal": "canal_venta::text"},
    "fact_compras":    {"estado": "estado_compra::text"},
    "fact_logistica":  {"estado": "estado_logistica::text"},
    "dim_producto":    {"rotacion": "rotacion_producto::text"},
    "dim_cliente":     {"riesgo_crediticio": "riesgo_tipo::text", "tier_cliente": "tier_cliente::text"},
}


def find_csv(filename):
    """Intenta nombre exacto, luego versiones alternativas (acentos)."""
    alternates = {
        "Dim_Region.csv":   ["Dim_Región.csv"],
        "Dim_Depósito.csv": ["Dim_Deposito.csv"],
        "Fact_Logística.csv": ["Fact_Logistica.csv"],
    }
    path = os.path.join(CSV_DIR, filename)
    if os.path.exists(path):
        return path
    for alt in alternates.get(filename, []):
        path2 = os.path.join(CSV_DIR, alt)
        if os.path.exists(path2):
            return path2
    return None


def run(conn_str: str, schema: str = "agronova", drop_recreate: bool = False):
    engine = create_engine(conn_str, pool_pre_ping=True)

    # Crear schema y tablas
    ddl_path = os.path.join(SQL_DIR, "02_ddl_productivo.sql")
    if not os.path.exists(ddl_path):
        ddl_path = os.path.join(SQL_DIR, "01_ddl_schema.sql")

    print(f"[1/2] Aplicando DDL desde {os.path.basename(ddl_path)}...")
    with engine.connect() as con:
        with open(ddl_path, encoding="utf-8") as f:
            ddl = f.read()
        # Neon no soporta SET search_path persistente en COPY; lo ejecutamos por sesion
        con.execute(text(f"SET search_path TO {schema}"))
        # Separar statements (DDL puede tener DO blocks, etc.)
        for stmt in ddl.split(";"):
            stmt = stmt.strip()
            if stmt and not stmt.startswith("--"):
                try:
                    con.execute(text(stmt))
                except Exception as e:
                    if "already exists" not in str(e).lower():
                        print(f"  [WARN] {str(e)[:120]}")
        con.commit()
    print(f"  [OK] Schema '{schema}' y tablas listas")

    print(f"\n[2/2] Cargando datos ({len(LOAD_ORDER)} tablas)...")
    total_rows = 0

    for csv_file, table, exclude_cols, chunksize in LOAD_ORDER:
        path = find_csv(csv_file)
        if not path:
            print(f"  [SKIP] {csv_file} no encontrado")
            continue

        t0 = time.time()
        df = pd.read_csv(path, encoding="utf-8-sig", low_memory=False)

        # Eliminar columnas GENERATED (no se pueden insertar)
        for col in exclude_cols:
            if col in df.columns:
                df = df.drop(columns=[col])

        # Convertir bools
        for col in BOOL_COLS.get(table, []):
            if col in df.columns:
                df[col] = df[col].astype(bool)

        # Nulos para columnas opcionales
        df = df.where(pd.notna(df), None)

        df.to_sql(
            name=table,
            con=engine,
            schema=schema,
            if_exists="append",
            index=False,
            chunksize=chunksize or len(df),
            method="multi",
        )
        elapsed = time.time() - t0
        total_rows += len(df)
        print(f"  [OK] {table:<30} {len(df):>10,} filas  ({elapsed:.1f}s)")

    print(f"\n  TOTAL REGISTROS CARGADOS: {total_rows:,}")
    print(f"  [DONE] Carga completa en PostgreSQL/{schema}")

    # Verificacion final
    print("\n  Verificacion de conteos:")
    with engine.connect() as con:
        con.execute(text(f"SET search_path TO {schema}"))
        for csv_file, table, _, _ in LOAD_ORDER:
            try:
                result = con.execute(text(f"SELECT COUNT(*) FROM {table}"))
                count = result.scalar()
                print(f"    {table:<32} {count:>10,}")
            except Exception as e:
                print(f"    {table:<32} ERROR: {e}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="AgroNova ETL: CSV -> PostgreSQL")
    parser.add_argument("--conn",   default=os.getenv("DATABASE_URL"),
                        help="PostgreSQL connection string")
    parser.add_argument("--schema", default="agronova",
                        help="Schema de destino (default: agronova)")
    args = parser.parse_args()

    if not args.conn:
        print("ERROR: Define --conn 'postgresql://...' o la variable DATABASE_URL")
        sys.exit(1)

    run(args.conn, args.schema)

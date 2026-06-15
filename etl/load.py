"""
load.py — Capa de carga del pipeline ETL.
Carga DataFrames transformados a PostgreSQL / Neon via SQLAlchemy.
"""

import logging
import time
from typing import Dict, Optional
import pandas as pd
from sqlalchemy import create_engine, text, inspect

logger = logging.getLogger(__name__)

# Orden FK-safe: dims primero, facts despues
LOAD_ORDER = [
    ("Dim_Fecha",           "dim_fecha",             []),
    ("Dim_Región",          "dim_region",            []),
    ("Dim_Sucursal",        "dim_sucursal",          []),
    ("Dim_Depósito",        "dim_deposito",          []),
    ("Dim_Vendedor",        "dim_vendedor",          []),
    ("Dim_Proveedor",       "dim_proveedor",         []),
    ("Dim_Producto",        "dim_producto",          []),
    ("Dim_Cliente",         "dim_cliente",           ["is_churned"]),  # col derivada, no en DB
    ("Fact_Compras",        "fact_compras",          []),
    ("Fact_Inventario",     "fact_inventario",       ["bajo_minimo"]),  # GENERATED
    ("Fact_Ventas",         "fact_ventas",           ["año", "mes", "mes_nombre",
                                                       "trimestre", "temporada_agricola"]),
    ("Fact_Logística",      "fact_logistica",        ["dias_transito_real"]),  # GENERATED
    ("Cotizaciones_Externas","cotizaciones_externas", []),
]

CHUNKSIZE = {
    "fact_ventas":   50_000,
    "fact_compras":  20_000,
    "fact_logistica":20_000,
    "fact_inventario":10_000,
}


def get_engine(conn_str: str):
    return create_engine(conn_str, pool_pre_ping=True, pool_size=5)


def table_exists(engine, schema: str, table: str) -> bool:
    insp = inspect(engine)
    return insp.has_table(table, schema=schema)


def truncate_table(engine, schema: str, table: str) -> None:
    with engine.connect() as con:
        con.execute(text(f"SET search_path TO {schema}"))
        con.execute(text(f"TRUNCATE TABLE {table} RESTART IDENTITY CASCADE"))
        con.commit()


def load_table(
    engine,
    df: pd.DataFrame,
    table: str,
    schema: str,
    exclude_cols: list,
    if_exists: str = "append",
) -> int:
    df_load = df.drop(columns=[c for c in exclude_cols if c in df.columns], errors="ignore")
    df_load = df_load.where(pd.notna(df_load), None)

    chunk = CHUNKSIZE.get(table, None)

    df_load.to_sql(
        name=table,
        con=engine,
        schema=schema,
        if_exists=if_exists,
        index=False,
        chunksize=chunk,
        method="multi",
    )
    return len(df_load)


def load_all(
    datasets: Dict[str, pd.DataFrame],
    conn_str: str,
    schema: str = "agronova",
    truncate: bool = True,
) -> Dict[str, int]:
    """
    Carga todos los datasets en PostgreSQL.
    Retorna dict {tabla: filas_cargadas}.
    """
    engine  = get_engine(conn_str)
    results = {}
    total   = 0

    logger.info(f"Conectando a PostgreSQL (schema: {schema})...")

    # Verificar conexion
    with engine.connect() as con:
        version = con.execute(text("SELECT version()")).scalar()
        logger.info(f"Conexion OK: {version[:60]}...")

    for nombre_logico, tabla_sql, exclude in LOAD_ORDER:
        # Buscar el DataFrame (con y sin acento)
        df = datasets.get(nombre_logico)
        if df is None:
            # Intentar alias
            for key in datasets:
                if key.replace("ó","o").replace("é","e").replace("á","a") == \
                   nombre_logico.replace("ó","o").replace("é","e").replace("á","a"):
                    df = datasets[key]
                    break

        if df is None:
            logger.warning(f"  [SKIP] {nombre_logico} — no encontrado en datasets")
            continue

        t0 = time.time()

        if truncate and table_exists(engine, schema, tabla_sql):
            truncate_table(engine, schema, tabla_sql)

        try:
            n = load_table(engine, df, tabla_sql, schema, exclude)
            elapsed = time.time() - t0
            results[tabla_sql] = n
            total += n
            logger.info(f"  [OK] {tabla_sql:<30} {n:>10,} filas  ({elapsed:.1f}s)")
        except Exception as e:
            logger.error(f"  [ERR] {tabla_sql}: {e}")
            raise

    logger.info(f"Load completo: {len(results)} tablas, {total:,} filas totales")
    return results


def verify_load(conn_str: str, schema: str = "agronova") -> Dict[str, int]:
    """Verifica conteos post-carga."""
    engine = get_engine(conn_str)
    counts = {}
    tablas = [t for _, t, _ in LOAD_ORDER]
    with engine.connect() as con:
        con.execute(text(f"SET search_path TO {schema}"))
        for tabla in tablas:
            try:
                n = con.execute(text(f"SELECT COUNT(*) FROM {tabla}")).scalar()
                counts[tabla] = n
                logger.info(f"  {tabla:<32} {n:>10,}")
            except Exception:
                counts[tabla] = -1
    return counts

"""
extract.py — Capa de extraccion del pipeline ETL de AgroNova.
Lee todos los CSVs y los devuelve como DataFrames validados en schema.
"""

import os
import logging
from pathlib import Path
from typing import Dict
import pandas as pd

logger = logging.getLogger(__name__)

CSV_DIR = Path(__file__).parent.parent / "data" / "csv"

# Schema esperado: columnas requeridas por tabla
SCHEMA: Dict[str, list] = {
    "Dim_Fecha":    ["fecha_id", "fecha", "año", "mes", "dia_semana", "factor_estacional"],
    "Dim_Región":   ["region_id", "nombre_region", "provincia_principal"],
    "Dim_Sucursal": ["sucursal_id", "nombre", "provincia", "region_id", "lat", "lon"],
    "Dim_Depósito": ["deposito_id", "nombre", "sucursal_id", "capacidad_ton"],
    "Dim_Vendedor": ["vendedor_id", "nombre", "apellido", "sucursal_id", "categoria"],
    "Dim_Proveedor":["proveedor_id", "nombre_proveedor", "tipo", "pais"],
    "Dim_Producto": ["producto_id", "nombre_producto", "categoria", "subcategoria",
                     "precio_usd_base_2016", "margen_bruto_pct", "rotacion"],
    "Dim_Cliente":  ["cliente_id", "razon_social", "segmento", "ciclo_vida",
                     "año_alta", "activo", "volumen_factor", "tier_cliente"],
    "Fact_Ventas":  ["venta_id", "fecha_id", "cliente_id", "producto_id",
                     "sucursal_id", "vendedor_id", "cantidad",
                     "precio_unitario_ars", "total_ars", "margen_bruto_ars"],
    "Fact_Compras": ["compra_id", "fecha_id", "proveedor_id", "producto_id",
                     "deposito_destino_id", "cantidad", "total_ars", "total_usd"],
    "Fact_Inventario": ["inventario_id", "fecha_id", "producto_id", "deposito_id",
                        "stock_actual", "stock_minimo", "valor_stock_ars"],
    "Fact_Logística":  ["logistica_id", "fecha_despacho_id", "cliente_id",
                        "deposito_origen_id", "region_destino_id",
                        "dias_transito_base", "costo_flete_ars"],
    "Cotizaciones_Externas": ["fecha", "fecha_id", "usd_ars_oficial", "usd_ars_blue",
                               "soja_cbot_usd_ton", "urea_fob_usd_ton"],
}

# Alias para nombres con/sin acento
_ALIASES = {
    "Dim_Región":    ["Dim_Region"],
    "Dim_Depósito":  ["Dim_Deposito"],
    "Fact_Logística":["Fact_Logistica"],
}


def _find_csv(name: str) -> Path:
    candidates = [name] + _ALIASES.get(name, [])
    for c in candidates:
        p = CSV_DIR / f"{c}.csv"
        if p.exists():
            return p
    raise FileNotFoundError(
        f"CSV '{name}' no encontrado en {CSV_DIR}. "
        f"Ejecutar: python data/generators/generate_all.py"
    )


def _validate_schema(df: pd.DataFrame, name: str, required: list) -> None:
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f"[{name}] Columnas faltantes: {missing}")


def extract_table(name: str) -> pd.DataFrame:
    """Lee y valida schema de una tabla por nombre logico."""
    path = _find_csv(name)
    logger.info(f"Leyendo {path.name} ...")
    df = pd.read_csv(path, encoding="utf-8-sig", low_memory=False)
    logger.info(f"  {name}: {len(df):,} filas x {len(df.columns)} columnas")

    if name in SCHEMA:
        _validate_schema(df, name, SCHEMA[name])

    return df


def extract_all() -> Dict[str, pd.DataFrame]:
    """Lee todas las tablas. Retorna dict {nombre_logico: DataFrame}."""
    tablas = list(SCHEMA.keys())
    datasets = {}
    errores = []

    for nombre in tablas:
        try:
            datasets[nombre] = extract_table(nombre)
        except FileNotFoundError as e:
            logger.error(str(e))
            errores.append(nombre)
        except ValueError as e:
            logger.error(str(e))
            errores.append(nombre)

    if errores:
        raise RuntimeError(
            f"No se pudieron cargar {len(errores)} tablas: {errores}\n"
            f"Verificar que los CSVs existen en {CSV_DIR}"
        )

    total_filas = sum(len(df) for df in datasets.values())
    logger.info(f"Extraccion completa: {len(datasets)} tablas, {total_filas:,} filas totales")
    return datasets

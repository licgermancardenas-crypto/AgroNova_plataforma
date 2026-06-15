"""
transform.py — Capa de transformacion y validacion del pipeline ETL.
Aplica tipado, limpieza, enriquecimiento y reglas de negocio.
"""

import logging
from typing import Dict, Tuple, List
import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)

ValidationResult = Tuple[bool, List[str]]


# ── Tipado ────────────────────────────────────────────────────────────

DTYPES = {
    "Dim_Fecha": {
        "fecha_id": "int32",
        "año": "int16",
        "semestre": "int8",
        "trimestre": "int8",
        "mes": "int8",
        "dia_semana": "int8",
        "factor_estacional": "float32",
        "es_feriado": "bool",
        "es_fin_de_semana": "bool",
        "es_dia_habil": "bool",
    },
    "Dim_Producto": {
        "precio_usd_base_2016": "float32",
        "margen_bruto_pct": "float32",
        "requiere_frio": "bool",
        "activo": "bool",
    },
    "Dim_Cliente": {
        "activo": "bool",
        "volumen_factor": "float32",
    },
    "Fact_Ventas": {
        "venta_id": "int32",
        "fecha_id": "int32",
        "sucursal_id": "int8",
        "vendedor_id": "int8",
        "cantidad": "int32",
        "precio_unitario_ars": "float64",
        "precio_unitario_usd": "float32",
        "descuento_pct": "float32",
        "total_ars": "float64",
        "total_usd": "float32",
        "margen_bruto_ars": "float64",
    },
    "Fact_Compras": {
        "compra_id": "int32",
        "cantidad": "int32",
        "total_ars": "float64",
        "total_usd": "float32",
    },
    "Fact_Inventario": {
        "stock_actual": "int32",
        "stock_minimo": "int32",
        "stock_maximo": "int32",
        "merma_pct": "float32",
    },
}


def apply_dtypes(df: pd.DataFrame, tabla: str) -> pd.DataFrame:
    """Aplica dtypes eficientes para reducir uso de memoria."""
    if tabla not in DTYPES:
        return df
    for col, dtype in DTYPES[tabla].items():
        if col in df.columns:
            try:
                df[col] = df[col].astype(dtype)
            except (ValueError, TypeError):
                logger.warning(f"[{tabla}] No se pudo castear {col} a {dtype}")
    return df


# ── Limpieza ──────────────────────────────────────────────────────────

def clean_strings(df: pd.DataFrame) -> pd.DataFrame:
    """Strip de espacios en columnas de texto."""
    str_cols = df.select_dtypes(include="object").columns
    for col in str_cols:
        df[col] = df[col].str.strip() if hasattr(df[col], "str") else df[col]
    return df


def normalize_estado(df: pd.DataFrame, col: str = "estado") -> pd.DataFrame:
    """Normaliza el campo estado para evitar variaciones de capitalización."""
    if col in df.columns:
        df[col] = df[col].str.title()
    return df


# ── Enriquecimiento ───────────────────────────────────────────────────

def enrich_ventas(df_ventas: pd.DataFrame, df_fecha: pd.DataFrame) -> pd.DataFrame:
    """Agrega año, mes y temporada a Fact_Ventas."""
    fecha_cols = df_fecha[["fecha_id", "año", "mes", "mes_nombre",
                            "trimestre", "temporada_agricola"]].copy()
    df_ventas = df_ventas.merge(fecha_cols, on="fecha_id", how="left")
    logger.info(f"Fact_Ventas enriquecida con dimensiones de fecha")
    return df_ventas


def enrich_clientes(df_clientes: pd.DataFrame) -> pd.DataFrame:
    """Deriva columna is_churned para facilitar analisis."""
    df_clientes["is_churned"] = df_clientes["año_baja"].notna()
    return df_clientes


# ── Validaciones de negocio ───────────────────────────────────────────

def validate_stock(df_inv: pd.DataFrame) -> ValidationResult:
    errores = []
    neg = (df_inv["stock_actual"] < 0).sum()
    if neg > 0:
        errores.append(f"BR-01: {neg:,} registros con stock_actual < 0")
    return (len(errores) == 0, errores)


def validate_ventas_post_alta(df_ventas: pd.DataFrame,
                               df_clientes: pd.DataFrame) -> ValidationResult:
    errores = []
    alta_map = df_clientes.set_index("cliente_id")["año_alta"].to_dict()
    fv = df_ventas[["cliente_id", "fecha_id"]].copy()
    fv["año_venta"] = fv["fecha_id"].astype(str).str[:4].astype(int)
    fv["año_alta"] = fv["cliente_id"].map(alta_map)
    previas = (fv["año_venta"] < fv["año_alta"]).sum()
    pct = previas / len(fv) * 100
    if pct >= 0.5:
        errores.append(f"BR-02: {previas:,} ventas ({pct:.3f}%) antes del alta del cliente")
    return (len(errores) == 0, errores)


def validate_margen(df_ventas: pd.DataFrame) -> ValidationResult:
    errores = []
    neg = (df_ventas["margen_bruto_ars"] < 0).sum()
    if neg > 0:
        errores.append(f"BR-03: {neg:,} ventas con margen negativo")
    return (len(errores) == 0, errores)


def validate_fechas(df: pd.DataFrame, col: str = "fecha_id",
                    tabla: str = "") -> ValidationResult:
    errores = []
    fuera = df[(df[col] < 20160101) | (df[col] > 20261231)]
    if len(fuera) > 0:
        errores.append(f"BR-04 [{tabla}]: {len(fuera):,} registros con fecha fuera de 2016-2026")
    return (len(errores) == 0, errores)


def validate_precios(df_ventas: pd.DataFrame) -> ValidationResult:
    errores = []
    if (df_ventas["precio_unitario_ars"] <= 0).any():
        errores.append("BR-05: precio_unitario_ars <= 0 detectado")
    if (df_ventas["cantidad"] <= 0).any():
        errores.append("BR-05: cantidad <= 0 detectada")
    if (df_ventas["total_ars"] <= 0).any():
        errores.append("BR-05: total_ars <= 0 detectado")
    return (len(errores) == 0, errores)


# ── Pipeline de transformacion ────────────────────────────────────────

def transform_all(datasets: Dict[str, pd.DataFrame]) -> Dict[str, pd.DataFrame]:
    """
    Aplica tipado, limpieza, enriquecimiento y validaciones.
    Retorna datasets transformados y lanza excepcion si hay errores criticos.
    """
    errores_criticos = []

    # 1. Limpieza y tipado
    logger.info("Aplicando tipado y limpieza...")
    for nombre, df in datasets.items():
        df = clean_strings(df)
        df = apply_dtypes(df, nombre)
        datasets[nombre] = df
        logger.info(f"  [{nombre}] OK — memoria: {df.memory_usage(deep=True).sum() / 1e6:.1f} MB")

    # 2. Enriquecimiento
    logger.info("Enriqueciendo datasets...")
    if "Fact_Ventas" in datasets and "Dim_Fecha" in datasets:
        datasets["Fact_Ventas"] = enrich_ventas(
            datasets["Fact_Ventas"], datasets["Dim_Fecha"]
        )
    if "Dim_Cliente" in datasets:
        datasets["Dim_Cliente"] = enrich_clientes(datasets["Dim_Cliente"])

    # 3. Validaciones de negocio
    logger.info("Ejecutando reglas de negocio...")

    checks = [
        ("BR-01 Stock",     lambda: validate_stock(datasets.get("Fact_Inventario", pd.DataFrame()))),
        ("BR-02 Ventas/Alta", lambda: validate_ventas_post_alta(
            datasets.get("Fact_Ventas", pd.DataFrame()),
            datasets.get("Dim_Cliente", pd.DataFrame())
        )),
        ("BR-03 Margen",    lambda: validate_margen(datasets.get("Fact_Ventas", pd.DataFrame()))),
        ("BR-04 Fechas FV", lambda: validate_fechas(
            datasets.get("Fact_Ventas", pd.DataFrame()), "fecha_id", "Fact_Ventas"
        )),
        ("BR-05 Precios",   lambda: validate_precios(datasets.get("Fact_Ventas", pd.DataFrame()))),
    ]

    for nombre_check, fn in checks:
        try:
            ok, errores = fn()
            if ok:
                logger.info(f"  [{nombre_check}] PASS")
            else:
                for e in errores:
                    logger.error(f"  [{nombre_check}] FAIL: {e}")
                errores_criticos.extend(errores)
        except Exception as ex:
            logger.warning(f"  [{nombre_check}] ERROR al ejecutar: {ex}")

    if errores_criticos:
        raise ValueError(
            f"Transform fallida: {len(errores_criticos)} reglas de negocio violadas:\n"
            + "\n".join(f"  - {e}" for e in errores_criticos)
        )

    total_filas = sum(len(df) for df in datasets.values())
    logger.info(f"Transform completa: {len(datasets)} tablas, {total_filas:,} filas")
    return datasets

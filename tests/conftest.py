"""
conftest.py — Fixtures compartidas para todos los tests de AgroNova.
Los DataFrames se cargan UNA sola vez por sesion (scope="session").
"""

import os
import pytest
import pandas as pd

# Ruta a los CSVs generados
CSV_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "csv")


def _load(filename: str) -> pd.DataFrame:
    """Carga un CSV con fallback para nombres con/sin acento."""
    candidates = [filename]
    # Alternativas sin acento para sistemas Windows
    fallbacks = {
        "Dim_Región.csv":     "Dim_Region.csv",
        "Dim_Depósito.csv":   "Dim_Deposito.csv",
        "Fact_Logística.csv": "Fact_Logistica.csv",
        "Dim_Region.csv":     "Dim_Región.csv",
        "Dim_Deposito.csv":   "Dim_Depósito.csv",
        "Fact_Logistica.csv": "Fact_Logística.csv",
    }
    if filename in fallbacks:
        candidates.append(fallbacks[filename])

    for name in candidates:
        path = os.path.join(CSV_DIR, name)
        if os.path.exists(path):
            return pd.read_csv(path, encoding="utf-8-sig", low_memory=False)

    pytest.skip(f"CSV no encontrado: {filename} — ejecutar data/generators/generate_all.py primero")


# ── Dimensiones ────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def dim_fecha():
    return _load("Dim_Fecha.csv")

@pytest.fixture(scope="session")
def dim_region():
    df = _load("Dim_Region.csv")
    if df.empty:
        df = _load("Dim_Región.csv")
    return df

@pytest.fixture(scope="session")
def dim_sucursal():
    return _load("Dim_Sucursal.csv")

@pytest.fixture(scope="session")
def dim_deposito():
    df = _load("Dim_Depósito.csv")
    if df.empty:
        df = _load("Dim_Deposito.csv")
    return df

@pytest.fixture(scope="session")
def dim_vendedor():
    return _load("Dim_Vendedor.csv")

@pytest.fixture(scope="session")
def dim_proveedor():
    return _load("Dim_Proveedor.csv")

@pytest.fixture(scope="session")
def dim_producto():
    return _load("Dim_Producto.csv")

@pytest.fixture(scope="session")
def dim_cliente():
    return _load("Dim_Cliente.csv")

# ── Facts ──────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def fact_ventas():
    return _load("Fact_Ventas.csv")

@pytest.fixture(scope="session")
def fact_compras():
    return _load("Fact_Compras.csv")

@pytest.fixture(scope="session")
def fact_inventario():
    return _load("Fact_Inventario.csv")

@pytest.fixture(scope="session")
def fact_logistica():
    df = _load("Fact_Logística.csv")
    if df.empty:
        df = _load("Fact_Logistica.csv")
    return df

@pytest.fixture(scope="session")
def cotizaciones():
    return _load("Cotizaciones_Externas.csv")

# ── Sets de IDs para validacion FK ────────────────────────────────

@pytest.fixture(scope="session")
def fecha_ids(dim_fecha):
    return set(dim_fecha["fecha_id"])

@pytest.fixture(scope="session")
def cliente_ids(dim_cliente):
    return set(dim_cliente["cliente_id"])

@pytest.fixture(scope="session")
def producto_ids(dim_producto):
    return set(dim_producto["producto_id"])

@pytest.fixture(scope="session")
def sucursal_ids(dim_sucursal):
    return set(dim_sucursal["sucursal_id"])

@pytest.fixture(scope="session")
def deposito_ids(dim_deposito):
    return set(dim_deposito["deposito_id"])

@pytest.fixture(scope="session")
def proveedor_ids(dim_proveedor):
    return set(dim_proveedor["proveedor_id"])

@pytest.fixture(scope="session")
def vendedor_ids(dim_vendedor):
    return set(dim_vendedor["vendedor_id"])

@pytest.fixture(scope="session")
def region_ids(dim_region):
    return set(dim_region["region_id"])

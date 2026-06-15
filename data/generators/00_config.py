"""
AgroNova Argentina S.A. - Data Generator Config
Shared constants, seeds, economic & agricultural parameters.
"""

import os

# -- Reproducibility ------------------------------------------------
SEED = 42
START_DATE = "2016-01-01"
END_DATE   = "2026-12-31"

# -- Volume targets -------------------------------------------------
N_CLIENTES   = 4_000
N_PRODUCTOS  = 2_500
N_VENTAS     = 1_500_000
N_PROVEEDORES = 15
N_VENDEDORES  = 48

# -- Output paths ---------------------------------------------------
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV_DIR  = os.path.join(BASE_DIR, "csv")
SQL_DIR  = os.path.join(BASE_DIR, "sql")

# -- USD/ARS exchange rate by year (promedio anual) -----------------
# Source: BCRA / INDEC historical
USD_ARS = {
    2016: 14.8,
    2017: 16.6,
    2018: 38.1,
    2019: 59.9,
    2020: 84.2,
    2021: 102.7,
    2022: 189.0,
    2023: 296.0,   # pre-diciembre; post-devaluación diciembre ~850
    2024: 910.0,
    2025: 1_050.0,
    2026: 1_120.0,
}

# Inflación acumulada base 2016=1.0 (para escalar precios en ARS)
INFLACION = {
    2016: 1.00,
    2017: 1.25,
    2018: 1.73,
    2019: 2.60,
    2020: 3.38,
    2021: 4.25,
    2022: 6.89,
    2023: 17.50,
    2024: 45.00,
    2025: 65.00,
    2026: 80.00,
}

# -- Estacionalidad agrícola (factor mensual sobre base 1.0) --------
# Pico Oct-Nov (siembra verano), Abr-May (cosecha soja/maíz)
ESTACIONALIDAD = {
    1:  0.62,
    2:  0.71,
    3:  0.95,
    4:  1.42,
    5:  1.31,
    6:  0.78,
    7:  0.70,
    8:  0.88,
    9:  1.18,
    10: 1.52,
    11: 1.65,
    12: 1.08,
}

# -- Regiones y sucursales ------------------------------------------
SUCURSALES = [
    {"sucursal_id": 1, "nombre": "Rosario",   "provincia": "Santa Fe",    "lat": -32.9442, "lon": -60.6505, "region_id": 1},
    {"sucursal_id": 2, "nombre": "Pergamino", "provincia": "Buenos Aires", "lat": -33.8895, "lon": -60.5736, "region_id": 2},
    {"sucursal_id": 3, "nombre": "Tandil",    "provincia": "Buenos Aires", "lat": -37.3217, "lon": -59.1332, "region_id": 3},
    {"sucursal_id": 4, "nombre": "Río Cuarto","provincia": "Córdoba",      "lat": -33.1307, "lon": -64.3499, "region_id": 4},
    {"sucursal_id": 5, "nombre": "Paraná",    "provincia": "Entre Ríos",   "lat": -31.7319, "lon": -60.5238, "region_id": 5},
]

DEPOSITOS = [
    {"deposito_id": 1, "nombre": "CL Rosario",    "sucursal_id": 1, "lat": -32.9442, "lon": -60.6505, "capacidad_ton": 12_000},
    {"deposito_id": 2, "nombre": "CL Pergamino",  "sucursal_id": 2, "lat": -33.8895, "lon": -60.5736, "capacidad_ton":  8_000},
    {"deposito_id": 3, "nombre": "CL Río Cuarto", "sucursal_id": 4, "lat": -33.1307, "lon": -64.3499, "capacidad_ton":  7_500},
]

# -- Proveedores (provistos por el usuario) -------------------------
PROVEEDORES_NAC = [
    "FertiSur S.A.",
    "AgroPampa Insumos",
    "NutriCampo Argentina",
    "Semillas del Centro",
    "BioAgro Santa Fe",
    "QuimAgro Córdoba",
    "AgroAndes S.A.",
    "Pampeana Crop Solutions",
    "TecnoAgro Argentina",
]
PROVEEDORES_INT = [
    "AgroBrasil Ltda.",
    "Midwest Crop Solutions USA",
    "GreenSeed America",
    "SinoAgro Chemicals",
    "Bayer Agro Germany",
    "EuroCrop Solutions",
]

# -- Categorías de productos ----------------------------------------
CATEGORIAS = {
    "Fertilizantes": {
        "subcategorias": ["Urea Granulada", "MAP", "DAP", "Sulfato de Amonio", "Fosfato Monoamónico"],
        "peso_pct": 0.28,
        "proveedor_preferencia": "nacional",
    },
    "Fitosanitarios": {
        "subcategorias": ["Herbicidas", "Fungicidas", "Insecticidas", "Coadyuvantes"],
        "peso_pct": 0.30,
        "proveedor_preferencia": "mixto",
    },
    "Semillas": {
        "subcategorias": ["Maíz", "Soja", "Trigo", "Girasol"],
        "peso_pct": 0.22,
        "proveedor_preferencia": "nacional",
    },
    "Nutrición Vegetal": {
        "subcategorias": ["Bioestimulantes", "Correctores Micronutrientes", "Fertilizantes Foliares"],
        "peso_pct": 0.12,
        "proveedor_preferencia": "internacional",
    },
    "Tecnología Agrícola": {
        "subcategorias": ["Sensores", "Monitoreo Cultivos", "Software Agrícola", "Estaciones Meteorológicas"],
        "peso_pct": 0.08,
        "proveedor_preferencia": "internacional",
    },
}

# -- Segmentos de clientes ------------------------------------------
SEGMENTOS = {
    "Productor Agropecuario": 0.52,
    "Cooperativa Agrícola":   0.18,
    "Agroindustria":          0.15,
    "Distribuidor/Revendedor": 0.15,
}

# -- Provincias de Argentina (para clientes) ------------------------
PROVINCIAS_COBERTURA = [
    ("Buenos Aires",  0.40),
    ("Santa Fe",      0.25),
    ("Córdoba",       0.22),
    ("Entre Ríos",    0.10),
    ("La Pampa",      0.03),
]

print("[OK] Config cargada - AgroNova Argentina S.A.")

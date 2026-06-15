"""
Dim_Proveedor - 15 proveedores (9 nacionales + 6 internacionales)
"""

import pandas as pd
import numpy as np
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from config import CSV_DIR, SEED, PROVEEDORES_NAC, PROVEEDORES_INT, CATEGORIAS

rng = np.random.default_rng(SEED)

PAISES_INT = {
    "AgroBrasil Ltda.":          {"pais": "Brasil",        "puerto_ingreso": "Puerto de Rosario",       "moneda": "BRL"},
    "Midwest Crop Solutions USA": {"pais": "Estados Unidos", "puerto_ingreso": "Puerto de Buenos Aires", "moneda": "USD"},
    "GreenSeed America":          {"pais": "Estados Unidos", "puerto_ingreso": "Puerto de Buenos Aires", "moneda": "USD"},
    "SinoAgro Chemicals":         {"pais": "China",          "puerto_ingreso": "Puerto de Bahía Blanca", "moneda": "USD"},
    "Bayer Agro Germany":         {"pais": "Alemania",       "puerto_ingreso": "Puerto de Buenos Aires", "moneda": "EUR"},
    "EuroCrop Solutions":         {"pais": "Alemania",       "puerto_ingreso": "Puerto de Rosario",      "moneda": "EUR"},
}

CATEGORIAS_PROV = {
    "FertiSur S.A.":              ["Fertilizantes"],
    "AgroPampa Insumos":          ["Fertilizantes", "Fitosanitarios"],
    "NutriCampo Argentina":       ["Nutrición Vegetal", "Fertilizantes"],
    "Semillas del Centro":        ["Semillas"],
    "BioAgro Santa Fe":           ["Fitosanitarios", "Nutrición Vegetal"],
    "QuimAgro Córdoba":           ["Fitosanitarios"],
    "AgroAndes S.A.":             ["Semillas", "Fertilizantes"],
    "Pampeana Crop Solutions":    ["Fitosanitarios", "Semillas"],
    "TecnoAgro Argentina":        ["Tecnología Agrícola"],
    "AgroBrasil Ltda.":           ["Fertilizantes", "Semillas"],
    "Midwest Crop Solutions USA": ["Fitosanitarios", "Tecnología Agrícola"],
    "GreenSeed America":          ["Semillas", "Nutrición Vegetal"],
    "SinoAgro Chemicals":         ["Fitosanitarios", "Fertilizantes"],
    "Bayer Agro Germany":         ["Fitosanitarios", "Nutrición Vegetal"],
    "EuroCrop Solutions":         ["Tecnología Agrícola", "Nutrición Vegetal"],
}

CIUDADES_NAC = {
    "FertiSur S.A.":           ("Buenos Aires",    "La Plata"),
    "AgroPampa Insumos":       ("Buenos Aires",    "Rosario"),
    "NutriCampo Argentina":    ("Córdoba",         "Córdoba Capital"),
    "Semillas del Centro":     ("Córdoba",         "Villa María"),
    "BioAgro Santa Fe":        ("Santa Fe",        "Rafaela"),
    "QuimAgro Córdoba":        ("Córdoba",         "Río Cuarto"),
    "AgroAndes S.A.":          ("Buenos Aires",    "Bahía Blanca"),
    "Pampeana Crop Solutions": ("Santa Fe",        "Rosario"),
    "TecnoAgro Argentina":     ("Buenos Aires",    "Buenos Aires Capital"),
}


def generate():
    rows = []
    pid  = 1

    for nombre in PROVEEDORES_NAC:
        prov, ciudad = CIUDADES_NAC[nombre]
        rows.append({
            "proveedor_id":       pid,
            "nombre_proveedor":   nombre,
            "tipo":               "Nacional",
            "pais":               "Argentina",
            "provincia":          prov,
            "ciudad":             ciudad,
            "puerto_ingreso":     None,
            "moneda_operacion":   "ARS",
            "categorias_supply":  "; ".join(CATEGORIAS_PROV[nombre]),
            "plazo_entrega_dias": int(rng.integers(3, 12)),
            "condicion_pago":     rng.choice(["30 días", "60 días", "Contado"]),
            "calificacion":       round(float(rng.uniform(3.5, 5.0)), 1),
            "activo":             1,
        })
        pid += 1

    for nombre in PROVEEDORES_INT:
        info = PAISES_INT[nombre]
        rows.append({
            "proveedor_id":       pid,
            "nombre_proveedor":   nombre,
            "tipo":               "Internacional",
            "pais":               info["pais"],
            "provincia":          None,
            "ciudad":             None,
            "puerto_ingreso":     info["puerto_ingreso"],
            "moneda_operacion":   info["moneda"],
            "categorias_supply":  "; ".join(CATEGORIAS_PROV[nombre]),
            "plazo_entrega_dias": int(rng.integers(25, 75)),
            "condicion_pago":     rng.choice(["LC 30d", "LC 60d", "Transferencia anticipada"]),
            "calificacion":       round(float(rng.uniform(3.8, 5.0)), 1),
            "activo":             1,
        })
        pid += 1

    df = pd.DataFrame(rows)
    out = os.path.join(CSV_DIR, "Dim_Proveedor.csv")
    df.to_csv(out, index=False, encoding="utf-8-sig")
    print(f"[OK] Dim_Proveedor: {len(df):,} filas -> {out}")
    return df


if __name__ == "__main__":
    generate()

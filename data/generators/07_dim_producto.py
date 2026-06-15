"""
Dim_Producto - 2.500 productos distribuidos en 5 categorías
"""

import pandas as pd
import numpy as np
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from config import CSV_DIR, SEED, N_PRODUCTOS, CATEGORIAS

rng = np.random.default_rng(SEED)

# Proveedor preferido por categoría (IDs: 1-9 nac, 10-15 int)
PROV_IDS = {
    "Fertilizantes":       {"nac": [1,2,7], "int": [10]},
    "Fitosanitarios":      {"nac": [2,5,6,8], "int": [13,14]},
    "Semillas":            {"nac": [4,7,8], "int": [11,12]},
    "Nutrición Vegetal":   {"nac": [3,5], "int": [12,14,15]},
    "Tecnología Agrícola": {"nac": [9], "int": [11,15]},
}

UNIDADES = {
    "Fertilizantes":       ["kg", "bolsa 50kg", "tonelada"],
    "Fitosanitarios":      ["litro", "kg", "bidón 20L"],
    "Semillas":            ["bolsa 20kg", "kg", "unidades"],
    "Nutrición Vegetal":   ["litro", "kg", "bidón 5L"],
    "Tecnología Agrícola": ["unidad", "kit", "servicio anual"],
}

# Precio base USD 2016 por categoría-subcategoría
PRECIO_USD_BASE = {
    "Urea Granulada":                (260, 320),
    "MAP":                           (380, 450),
    "DAP":                           (360, 430),
    "Sulfato de Amonio":             (200, 260),
    "Fosfato Monoamónico":           (370, 440),
    "Herbicidas":                    (8, 45),
    "Fungicidas":                    (12, 60),
    "Insecticidas":                  (10, 55),
    "Coadyuvantes":                  (4, 18),
    "Maíz":                          (180, 320),
    "Soja":                          (80, 150),
    "Trigo":                         (60, 120),
    "Girasol":                       (90, 180),
    "Bioestimulantes":               (25, 80),
    "Correctores Micronutrientes":   (15, 55),
    "Fertilizantes Foliares":        (12, 45),
    "Sensores":                      (250, 1_200),
    "Monitoreo Cultivos":            (180, 900),
    "Software Agrícola":             (300, 2_500),
    "Estaciones Meteorológicas":     (800, 4_500),
}

ROTACION_DIST = {
    "Fertilizantes":       {"Alta": 0.50, "Media": 0.35, "Baja": 0.15},
    "Fitosanitarios":      {"Alta": 0.45, "Media": 0.40, "Baja": 0.15},
    "Semillas":            {"Alta": 0.55, "Media": 0.30, "Baja": 0.15},
    "Nutrición Vegetal":   {"Alta": 0.30, "Media": 0.45, "Baja": 0.25},
    "Tecnología Agrícola": {"Alta": 0.20, "Media": 0.40, "Baja": 0.40},
}


def pick_proveedor(cat, pref):
    if pref == "nacional":
        pool = PROV_IDS[cat]["nac"]
    elif pref == "internacional":
        pool = PROV_IDS[cat]["int"]
    else:
        pool = PROV_IDS[cat]["nac"] + PROV_IDS[cat]["int"]
    return int(rng.choice(pool))


def generate():
    rows = []
    pid  = 1

    for cat, info in CATEGORIAS.items():
        n_cat = round(N_PRODUCTOS * info["peso_pct"])
        subcats = info["subcategorias"]
        pref    = info["proveedor_preferencia"]
        rot_map = ROTACION_DIST[cat]
        rot_choices = list(rot_map.keys())
        rot_probs   = list(rot_map.values())

        for i in range(n_cat):
            subcat = subcats[i % len(subcats)]
            lo, hi = PRECIO_USD_BASE.get(subcat, (10, 200))
            precio_usd = round(float(rng.uniform(lo, hi)), 2)
            margen_pct = round(float(rng.uniform(0.12, 0.38)), 4)

            rot = str(rng.choice(rot_choices, p=rot_probs))

            rows.append({
                "producto_id":        f"P{pid:04d}",
                "nombre_producto":    f"{subcat} {cat[:3].upper()}-{pid:04d}",
                "categoria":          cat,
                "subcategoria":       subcat,
                "unidad_medida":      str(rng.choice(UNIDADES[cat])),
                "precio_usd_base_2016": precio_usd,
                "margen_bruto_pct":   margen_pct,
                "proveedor_id_principal": pick_proveedor(cat, pref),
                "rotacion":           rot,
                "requiere_frio":      int(cat == "Semillas" and rng.random() < 0.2),
                "estacionalidad_alta": "; ".join(
                    ["Sep", "Oct", "Nov"] if cat in ["Semillas", "Fertilizantes"]
                    else ["Abr", "May"] if cat == "Fitosanitarios"
                    else ["Todo el año"]
                ),
                "activo":             int(rng.random() > 0.08),
            })
            pid += 1

            if pid > N_PRODUCTOS:
                break
        if pid > N_PRODUCTOS:
            break

    # Rellenar si quedaron cortos por redondeo
    while len(rows) < N_PRODUCTOS:
        rows.append(rows[-1].copy())
        rows[-1]["producto_id"] = f"P{pid:04d}"
        pid += 1

    df = pd.DataFrame(rows[:N_PRODUCTOS])
    out = os.path.join(CSV_DIR, "Dim_Producto.csv")
    df.to_csv(out, index=False, encoding="utf-8-sig")
    print(f"[OK] Dim_Producto: {len(df):,} filas -> {out}")
    return df


if __name__ == "__main__":
    generate()

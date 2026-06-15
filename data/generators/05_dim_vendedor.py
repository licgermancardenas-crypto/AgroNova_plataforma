"""
Dim_Vendedor - 48 vendedores distribuidos en 5 sucursales
"""

import pandas as pd
import numpy as np
from faker import Faker
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from config import CSV_DIR, SEED, N_VENDEDORES

fake = Faker("es_AR")
fake.seed_instance(SEED)
rng  = np.random.default_rng(SEED)

SUCURSAL_DIST = {1: 12, 2: 10, 3: 8, 4: 10, 5: 8}  # 48 total

CATEGORIAS_VENDEDOR = ["Junior", "Semi Senior", "Senior", "Key Account"]
CAT_WEIGHTS         = [0.25, 0.35, 0.30, 0.10]

ZONAS = {
    1: ["Norte Santa Fe", "Sur Santa Fe", "Gran Rosario"],
    2: ["Pergamino", "Junín", "Chivilcoy"],
    3: ["Tandil", "Azul", "Olavarría"],
    4: ["Río Cuarto", "Villa María", "Bell Ville"],
    5: ["Paraná", "Concordia", "Gualeguaychú"],
}


def generate():
    rows = []
    vid  = 1
    for sucursal_id, n in SUCURSAL_DIST.items():
        zonas_suc = ZONAS[sucursal_id]
        for _ in range(n):
            categoria = rng.choice(CATEGORIAS_VENDEDOR, p=CAT_WEIGHTS)
            anio_ingreso = int(rng.integers(2012, 2025))
            # Salario base ARS 2016 según categoría
            base_ars = {"Junior": 45_000, "Semi Senior": 72_000,
                        "Senior": 110_000, "Key Account": 160_000}[categoria]

            rows.append({
                "vendedor_id":     vid,
                "nombre":          fake.first_name_male() if rng.random() > 0.35 else fake.first_name_female(),
                "apellido":        fake.last_name(),
                "email":           fake.email(),
                "telefono":        fake.phone_number(),
                "sucursal_id":     sucursal_id,
                "zona_asignada":   rng.choice(zonas_suc),
                "categoria":       categoria,
                "año_ingreso":     anio_ingreso,
                "activo":          int(anio_ingreso <= 2025 and rng.random() > 0.12),
                "salario_base_ars_2016": base_ars,
            })
            vid += 1

    df = pd.DataFrame(rows)
    out = os.path.join(CSV_DIR, "Dim_Vendedor.csv")
    df.to_csv(out, index=False, encoding="utf-8-sig")
    print(f"[OK] Dim_Vendedor: {len(df):,} filas -> {out}")
    return df


if __name__ == "__main__":
    generate()

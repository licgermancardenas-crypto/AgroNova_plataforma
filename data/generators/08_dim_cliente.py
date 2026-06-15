"""
Dim_Cliente - 4.000 clientes con ciclo de vida (activos, churn, nuevos)
"""

import pandas as pd
import numpy as np
from faker import Faker
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from config import (
    CSV_DIR, SEED, N_CLIENTES, SEGMENTOS,
    PROVINCIAS_COBERTURA, SUCURSALES,
)

fake = Faker("es_AR")
fake.seed_instance(SEED)
rng  = np.random.default_rng(SEED)

# Ciclos de vida: cuántos clientes de cada tipo
CICLOS = {
    "Activo estable":    0.45,
    "Activo creciente":  0.20,
    "Activo decreciente":0.10,
    "Churned":           0.15,   # abandonaron antes de 2026
    "Nuevo (post 2022)": 0.10,
}

RAZONES_SOCIALES = {
    "Productor Agropecuario":   ["Establecimiento {apellido}", "Campo {apellido}",
                                  "{apellido} Agropecuaria", "{apellido} & Hijos"],
    "Cooperativa Agrícola":     ["Cooperativa Agropecuaria {loc}",
                                  "Cooagro {loc}", "AgroCooperativa {loc}"],
    "Agroindustria":            ["{apellido} Agroindustrias S.A.",
                                  "Procesadora {apellido} S.R.L.",
                                  "{loc} Agro Export S.A."],
    "Distribuidor/Revendedor":  ["{apellido} Distribuciones",
                                  "Agro Distribuidora {loc}", "{apellido} Insumos"],
}

LOCS = ["Norte", "Sur", "Centro", "Pampa", "Litoral", "Cuyo", "Delta", "Pampas"]


def razon_social(segmento, apellido, loc):
    template = str(rng.choice(RAZONES_SOCIALES[segmento]))
    return template.format(apellido=apellido, loc=loc)


def generate():
    segmentos  = list(SEGMENTOS.keys())
    seg_probs  = list(SEGMENTOS.values())
    ciclos     = list(CICLOS.keys())
    ciclo_prob = list(CICLOS.values())

    provincias = [p for p, _ in PROVINCIAS_COBERTURA]
    prov_probs = [w for _, w in PROVINCIAS_COBERTURA]

    sucursal_ids = [s["sucursal_id"] for s in SUCURSALES]
    suc_probs    = [0.28, 0.25, 0.17, 0.22, 0.08]

    rows = []
    for i in range(N_CLIENTES):
        apellido = fake.last_name()
        loc      = str(rng.choice(LOCS))
        seg      = str(rng.choice(segmentos, p=seg_probs))
        ciclo    = str(rng.choice(ciclos,    p=ciclo_prob))
        prov     = str(rng.choice(provincias, p=prov_probs))
        suc_id   = int(rng.choice(sucursal_ids, p=suc_probs))

        # Fechas coherentes con ciclo de vida
        if ciclo == "Nuevo (post 2022)":
            alta = int(rng.integers(2022, 2026))
            baja = None
        elif ciclo == "Churned":
            alta = int(rng.integers(2016, 2022))
            baja = int(rng.integers(alta + 1, 2025))
        else:
            alta = int(rng.integers(2012, 2021))
            baja = None

        # Score crediticio / riesgo
        riesgo = str(rng.choice(["Bajo", "Medio", "Alto"], p=[0.55, 0.33, 0.12]))

        # Superficie (solo productores y cooperativas)
        if seg in ["Productor Agropecuario", "Cooperativa Agrícola"]:
            ha = int(rng.integers(50, 5_000) if seg == "Productor Agropecuario"
                     else rng.integers(500, 25_000))
        else:
            ha = None

        rows.append({
            "cliente_id":         f"C{i+1:05d}",
            "razon_social":       razon_social(seg, apellido, loc),
            "segmento":           seg,
            "ciclo_vida":         ciclo,
            "provincia":          prov,
            "ciudad":             fake.city(),
            "sucursal_id_asignada": suc_id,
            "año_alta":           alta,
            "año_baja":           baja,
            "activo":             int(baja is None),
            "riesgo_crediticio":  riesgo,
            "superficie_ha":      ha,
            "email":              fake.email(),
            "telefono":           fake.phone_number(),
            "cuit":               fake.numerify("##-########-#"),
            # volumen_factor y tier asignados post-loop segun distribucion Pareto
            "volumen_factor":     None,
            "tier_cliente":       None,
        })

    df = pd.DataFrame(rows)

    # ── Distribucion Pareto de volumen para lograr 80/20 ──────────────
    # Top 10% (tier A): factor 8-20x  → clientes grandes (cooperativas, agroindustrias)
    # Sig 20% (tier B): factor 2-8x   → medianos
    # Sig 30% (tier C): factor 0.5-2x → pequenos estables
    # Bot 40% (tier D): factor 0.05-0.5x → muy pequenos o inactivos
    n = len(df)
    tier_breakpoints = [int(n * 0.10), int(n * 0.30), int(n * 0.60)]

    # Samplear factores en bloques y asignar aleatoriamente
    rng2 = np.random.default_rng(SEED + 99)
    shuffled_idx = rng2.permutation(n)

    factors = np.empty(n)
    tiers   = np.empty(n, dtype=object)

    idxA = shuffled_idx[:tier_breakpoints[0]]
    idxB = shuffled_idx[tier_breakpoints[0]:tier_breakpoints[1]]
    idxC = shuffled_idx[tier_breakpoints[1]:tier_breakpoints[2]]
    idxD = shuffled_idx[tier_breakpoints[2]:]

    factors[idxA] = rng2.uniform(8.0,  20.0, len(idxA))
    factors[idxB] = rng2.uniform(2.0,   8.0, len(idxB))
    factors[idxC] = rng2.uniform(0.5,   2.0, len(idxC))
    factors[idxD] = rng2.uniform(0.05,  0.5, len(idxD))

    tiers[idxA] = "A"
    tiers[idxB] = "B"
    tiers[idxC] = "C"
    tiers[idxD] = "D"

    # Clientes churned: reducir su factor adicional (compraban menos antes de irse)
    churned_mask = df["ciclo_vida"] == "Churned"
    factors[churned_mask.values] *= 0.35

    df["volumen_factor"] = np.round(factors, 4)
    df["tier_cliente"]   = tiers

    out = os.path.join(CSV_DIR, "Dim_Cliente.csv")
    df.to_csv(out, index=False, encoding="utf-8-sig")
    print(f"[OK] Dim_Cliente: {len(df):,} filas -> {out}")
    return df


if __name__ == "__main__":
    generate()

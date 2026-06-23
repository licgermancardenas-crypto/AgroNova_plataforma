"""
Generate web/public/data/gis_outputs/territory_analysis.json
from real Neon/PostGIS data.

Usage:
    python scripts/generate_territory_analysis.py

Reads DATABASE_URL from .env or environment.
Output is consumed by TerritoryOptimizationLayer.tsx at runtime (no backend proxy needed on Vercel).
"""
from __future__ import annotations

import json
import os
import pathlib
import sys

# Make sure backend package is importable
sys.path.insert(0, str(pathlib.Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv()

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

DB_URL  = os.environ["DATABASE_URL"]
SCHEMA  = os.environ.get("DB_SCHEMA", "agronova")
OUT_DIR = pathlib.Path(__file__).parent.parent / "web" / "public" / "data" / "gis_outputs"
OUT_DIR.mkdir(parents=True, exist_ok=True)

_S = SCHEMA

engine = create_engine(DB_URL, pool_pre_ping=True)


# ── helpers ───────────────────────────────────────────────────────────────────

def _f(v, decimals: int = 2):
    return round(float(v), decimals) if v is not None else 0.0


# ── 1. Branch metrics ─────────────────────────────────────────────────────────

def fetch_branches(db: Session) -> list[dict]:
    sql = text(f"""
        SELECT
            ss.sucursal_id,
            ss.nombre,
            ss.provincia          AS branch_provincia,
            ss.latitud,
            ss.longitud,
            COUNT(sc.cliente_id)                                        AS n_clientes,
            COALESCE(SUM(sc.revenue_ars), 0)                            AS revenue_total,
            COALESCE(AVG(sc.otif_pct), 0)                               AS otif_avg,
            COALESCE(AVG(
                ST_Distance(sc.geom::geography, ss.geom::geography) / 1000.0
            ), 0)                                                        AS avg_distance_km,
            COALESCE(AVG(sc.margen_pct), 0)                             AS margen_avg,
            COALESCE(AVG(sc.churn_score), 0)                            AS churn_avg,
            SUM(CASE WHEN sc.churn_level = 'Alto' THEN 1 ELSE 0 END)   AS n_alto_riesgo,
            SUM(CASE WHEN sc.tier = 'A' THEN 1 ELSE 0 END)             AS n_tier_a
        FROM {_S}.spatial_sucursales ss
        LEFT JOIN {_S}.spatial_clientes sc
            ON  sc.sucursal_id_asignada = ss.sucursal_id
            AND sc.is_outlier = false
        GROUP BY ss.sucursal_id, ss.nombre, ss.provincia, ss.latitud, ss.longitud
        ORDER BY ss.sucursal_id
    """)
    rows = db.execute(sql).all()
    result = []
    for r in rows:
        result.append({
            "sucursal_id":     int(r.sucursal_id),
            "nombre":          r.nombre,
            "provincia":       r.branch_provincia,
            "lat":             _f(r.latitud, 5),
            "lng":             _f(r.longitud, 5),
            "n_clientes":      int(r.n_clientes),
            "revenue_total":   _f(r.revenue_total, 0),
            "otif_avg":        _f(r.otif_avg, 2),
            "avg_distance_km": _f(r.avg_distance_km, 1),
            "margen_avg":      _f(r.margen_avg, 2),
            "churn_avg":       _f(r.churn_avg, 3),
            "n_alto_riesgo":   int(r.n_alto_riesgo or 0),
            "n_tier_a":        int(r.n_tier_a or 0),
        })
    return result


def classify_load(n: int, max_n: int, otif: float, dist: float, max_dist: float) -> str:
    vol   = n    / max(max_n,    1)
    inv_o = max(0.0, 1.0 - otif / 100.0)
    d     = dist / max(max_dist, 1)
    score = vol * 0.40 + inv_o * 0.30 + d * 0.30
    if score >= 0.65:
        return "SATURADA"
    if score >= 0.40:
        return "ALTA_CARGA"
    return "NORMAL"


# ── 2. Conflicts (client KNN reassignment) ────────────────────────────────────

def fetch_conflicts(db: Session, threshold_pct: float = 20.0) -> list[dict]:
    sql = text(f"""
        WITH nearest AS (
            SELECT
                sc.cliente_id,
                sc.sucursal_id_asignada                                       AS current_id,
                sc.revenue_ars,
                sc.otif_pct,
                sc.provincia,
                sc.latitud,
                sc.longitud,
                ST_Distance(sc.geom::geography, curr.geom::geography) / 1000.0  AS current_dist_km,
                nn.sucursal_id                                                AS nearest_id,
                nn.nombre                                                     AS nearest_nombre,
                ST_Distance(sc.geom::geography, nn.geom::geography) / 1000.0  AS nearest_dist_km
            FROM {_S}.spatial_clientes sc
            JOIN {_S}.spatial_sucursales curr ON curr.sucursal_id = sc.sucursal_id_asignada
            JOIN LATERAL (
                SELECT s2.sucursal_id, s2.nombre, s2.geom
                FROM {_S}.spatial_sucursales s2
                ORDER BY sc.geom <-> s2.geom
                LIMIT 1
            ) nn ON true
            WHERE sc.is_outlier = false
        )
        SELECT
            n.cliente_id,
            c.razon_social,
            n.provincia,
            n.current_id,
            curr_s.nombre                                                     AS current_nombre,
            n.nearest_id,
            n.nearest_nombre,
            n.revenue_ars,
            n.otif_pct,
            n.latitud                                                         AS lat,
            n.longitud                                                        AS lon,
            n.current_dist_km,
            n.nearest_dist_km,
            n.current_dist_km - n.nearest_dist_km                            AS improvement_km,
            CASE WHEN n.current_dist_km > 0
                THEN (n.current_dist_km - n.nearest_dist_km) / n.current_dist_km * 100
                ELSE 0 END                                                    AS improvement_pct
        FROM nearest n
        JOIN {_S}.dim_cliente c ON c.cliente_id = n.cliente_id
        JOIN {_S}.spatial_sucursales curr_s ON curr_s.sucursal_id = n.current_id
        WHERE n.nearest_id != n.current_id
          AND n.current_dist_km > 0
          AND (n.current_dist_km - n.nearest_dist_km) / n.current_dist_km * 100 >= :thr
        ORDER BY improvement_km DESC
    """)
    rows = db.execute(sql, {"thr": threshold_pct}).all()
    result = []
    for r in rows:
        result.append({
            "cliente_id":      r.cliente_id,
            "razon_social":    r.razon_social,
            "provincia":       r.provincia,
            "current_id":      int(r.current_id),
            "current_nombre":  r.current_nombre,
            "nearest_id":      int(r.nearest_id),
            "nearest_nombre":  r.nearest_nombre,
            "revenue_ars":     _f(r.revenue_ars, 0),
            "otif_pct":        _f(r.otif_pct, 2),
            "lat":             _f(r.lat, 5),
            "lon":             _f(r.lon, 5),
            "current_dist_km": _f(r.current_dist_km, 1),
            "nearest_dist_km": _f(r.nearest_dist_km, 1),
            "improvement_km":  _f(r.improvement_km, 1),
            "improvement_pct": _f(r.improvement_pct, 1),
        })
    return result


# ── 3. Status summary ─────────────────────────────────────────────────────────

def compute_status(branches: list[dict], conflicts: list[dict]) -> dict:
    total   = sum(b["n_clientes"]   for b in branches)
    revenue = sum(b["revenue_total"] for b in branches)
    n_conf  = len(conflicts)
    rev_risk = sum(c["revenue_ars"] for c in conflicts)
    savings  = sum(c["improvement_km"] for c in conflicts)
    avg_red  = (sum(c["improvement_pct"] for c in conflicts) / n_conf) if n_conf else 0.0
    w_otif   = (sum(b["otif_avg"] * b["n_clientes"] for b in branches) / total) if total else 0.0

    max_n    = max((b["n_clientes"]     for b in branches), default=1)
    max_dist = max((b["avg_distance_km"] for b in branches), default=1)

    load_dist = {"NORMAL": 0, "ALTA_CARGA": 0, "SATURADA": 0}
    for b in branches:
        lbl = classify_load(b["n_clientes"], max_n, b["otif_avg"], b["avg_distance_km"], max_dist)
        load_dist[lbl] += 1

    return {
        "total_clientes":      total,
        "total_revenue_ars":   revenue,
        "n_conflictos":        n_conf,
        "pct_conflictos":      round(n_conf / max(total, 1) * 100, 1),
        "revenue_en_riesgo":   rev_risk,
        "ahorro_potencial_km": round(savings, 0),
        "reduccion_media_pct": round(avg_red, 1),
        "otif_global":         round(w_otif, 2),
        "otif_ganancia_est":   round(avg_red * 0.05, 2),
        "n_branches":          len(branches),
        "load_distribution":   load_dist,
    }


# ── 4. Assemble and write ─────────────────────────────────────────────────────

def main():
    with Session(engine) as db:
        print("Fetching branch metrics...")
        branches  = fetch_branches(db)

        print("Running KNN conflict detection...")
        conflicts = fetch_conflicts(db, threshold_pct=20.0)

    print(f"  branches : {len(branches)}")
    print(f"  conflicts: {len(conflicts)}")

    # Add load classification and per-branch conflict count
    if branches:
        max_n    = max(b["n_clientes"]     for b in branches)
        max_dist = max(b["avg_distance_km"] for b in branches)
        total_c  = sum(b["n_clientes"]     for b in branches)
        branch_conf: dict[int, int] = {}
        for c in conflicts:
            branch_conf[c["current_id"]] = branch_conf.get(c["current_id"], 0) + 1

        LOAD_COLOR = {
            "NORMAL":     "#22C55E",
            "ALTA_CARGA": "#F97316",
            "SATURADA":   "#E03E3E",
        }
        for b in branches:
            load = classify_load(b["n_clientes"], max_n, b["otif_avg"], b["avg_distance_km"], max_dist)
            b["load_status"]    = load
            b["load_color"]     = LOAD_COLOR[load]
            b["revenue_total_m"]= round(b["revenue_total"] / 1_000_000, 2)
            b["pct_clientes"]   = round(b["n_clientes"] / max(total_c, 1) * 100, 1)
            b["n_conflictos"]   = branch_conf.get(b["sucursal_id"], 0)

    status = compute_status(branches, conflicts)

    out = {
        "generated_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "status":    status,
        "branches":  branches,
        "conflicts": conflicts,
    }

    out_path = OUT_DIR / "territory_analysis.json"
    out_path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Written: {out_path}")
    print(f"  Status: {status['n_conflictos']} conflicts, "
          f"{status['pct_conflictos']}% of clients, "
          f"ARS {status['revenue_en_riesgo']:,.0f} at risk")


if __name__ == "__main__":
    main()

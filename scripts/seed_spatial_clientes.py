"""
Seed script: creates agronova.spatial_clientes from dim_cliente + v_clientes_rfm + fact_logistica.
Coordinates are assigned deterministically from province bounds + cliente_id hash.
Run once to populate the spatial table, then re-run to refresh.

Usage:
    python scripts/seed_spatial_clientes.py
    python scripts/seed_spatial_clientes.py --json-only   # skip DB, just write JSON
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
from datetime import date
from decimal import Decimal
from pathlib import Path

import psycopg2
from sqlalchemy import create_engine, text

ROOT = Path(__file__).resolve().parents[1]
DATABASE_URL = "postgresql://neondb_owner:npg_vMoICJ5PqX8D@ep-lingering-paper-ac3uc1ym-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
DATABASE_URL_UNPOOLED = "postgresql://neondb_owner:npg_vMoICJ5PqX8D@ep-lingering-paper-ac3uc1ym.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
OUT_JSON = ROOT / "web" / "public" / "data" / "customers" / "customers.json"

# Conservative bounds (lat_min, lat_max, lon_min, lon_max) — avoids sea/borders
PROVINCE_BOUNDS: dict[str, tuple[float, float, float, float]] = {
    "Buenos Aires":                    (-38.2, -33.5, -63.0, -57.8),
    "Córdoba":                         (-34.5, -29.5, -65.5, -62.0),
    "Santa Fe":                        (-33.5, -28.0, -62.0, -59.5),
    "Entre Ríos":                      (-33.5, -30.5, -59.8, -57.8),
    "La Pampa":                        (-39.5, -35.5, -67.5, -64.0),
    "Salta":                           (-24.5, -22.0, -66.0, -63.0),
    "Tucumán":                         (-27.8, -26.2, -65.8, -64.8),
    "Santiago del Estero":             (-30.0, -26.0, -65.0, -62.0),
    "Jujuy":                           (-24.2, -22.0, -67.0, -65.0),
    "Catamarca":                       (-29.0, -26.5, -68.5, -66.0),
    "La Rioja":                        (-31.0, -28.0, -68.5, -66.5),
    "Chaco":                           (-27.0, -24.5, -61.5, -58.5),
    "Corrientes":                      (-30.0, -27.5, -59.0, -57.0),
    "Misiones":                        (-27.5, -26.0, -56.0, -54.0),
    "Formosa":                         (-25.5, -23.0, -62.0, -58.5),
    "Mendoza":                         (-36.5, -33.0, -70.0, -68.0),
    "San Juan":                        (-32.0, -29.0, -70.0, -68.0),
    "San Luis":                        (-35.0, -32.5, -67.0, -65.5),
    "Neuquén":                         (-40.5, -37.5, -71.0, -69.0),
    "Río Negro":                       (-41.5, -39.5, -70.5, -63.0),
    "Chubut":                          (-45.5, -42.5, -70.5, -65.0),
    "Santa Cruz":                      (-51.5, -47.0, -72.5, -66.0),
    "Tierra del Fuego":                (-55.0, -53.0, -68.5, -65.0),
    "Ciudad Autónoma de Buenos Aires": (-34.70, -34.55, -58.50, -58.35),
}
DEFAULT_BOUNDS = (-34.0, -31.0, -64.0, -60.0)  # central Córdoba fallback

RIESGO_CHURN: dict[str, float] = {"Bajo": 0.15, "Medio": 0.45, "Alto": 0.75}
CICLO_DELTA: dict[str, float] = {
    "Activo creciente":  -0.10,
    "Activo estable":     0.00,
    "Activo decreciente": +0.08,
    "Nuevo (post 2022)": -0.05,
    "Churned":           +0.18,
}


def hash_coords(cliente_id: str, bounds: tuple[float, float, float, float]) -> tuple[float, float]:
    """Deterministic lat/lon from cliente_id hash within province bounds."""
    digest = hashlib.sha256(cliente_id.encode()).digest()
    h1 = int.from_bytes(digest[:4], "big") / 0xFFFFFFFF  # 0..1
    h2 = int.from_bytes(digest[4:8], "big") / 0xFFFFFFFF
    lat_min, lat_max, lon_min, lon_max = bounds
    lat = round(lat_min + h1 * (lat_max - lat_min), 6)
    lon = round(lon_min + h2 * (lon_max - lon_min), 6)
    return lat, lon


def churn_score(riesgo: str, ciclo_vida: str) -> float:
    base  = RIESGO_CHURN.get(riesgo, 0.40)
    delta = CICLO_DELTA.get(ciclo_vida, 0.0)
    return round(max(0.05, min(0.98, base + delta)), 3)


def fetch_clients(engine) -> list[dict]:
    sql = text("""
        SELECT
            c.cliente_id,
            c.razon_social,
            c.segmento,
            c.ciclo_vida,
            c.provincia,
            c.ciudad,
            COALESCE(c.cuit, '') AS cuit,
            c.sucursal_id_asignada,
            c.tier_cliente::text  AS tier,
            c.riesgo_crediticio::text AS riesgo_crediticio,
            c.superficie_ha,
            rfm.valor_total_ars          AS revenue_ars,
            rfm.ticket_promedio_ars,
            rfm.frecuencia               AS n_compras,
            rfm.recencia_proxy,
            -- margen from ventas
            (SELECT AVG(margen_bruto_ars / NULLIF(total_ars, 0)) * 100
               FROM agronova.fact_ventas fv
              WHERE fv.cliente_id = c.cliente_id) AS margen_pct,
            -- ultima compra
            (SELECT df.fecha FROM agronova.dim_fecha df
              JOIN agronova.fact_ventas fv2 ON df.fecha_id = fv2.fecha_id
             WHERE fv2.cliente_id = c.cliente_id
             ORDER BY df.fecha DESC LIMIT 1) AS ultima_compra,
            -- OTIF
            (SELECT ROUND(
                AVG(CASE WHEN l.dias_demora = 0 THEN 1.0 ELSE 0.0 END) * 100, 1)
               FROM agronova.fact_logistica l
              WHERE l.cliente_id = c.cliente_id) AS otif_pct
        FROM agronova.dim_cliente c
        LEFT JOIN agronova.v_clientes_rfm rfm ON rfm.cliente_id = c.cliente_id
        WHERE c.activo = true
        ORDER BY c.cliente_id
    """)
    with engine.connect() as conn:
        rows = conn.execute(sql).all()
        cols = ["cliente_id","razon_social","segmento","ciclo_vida","provincia","ciudad",
                "cuit","sucursal_id_asignada","tier","riesgo_crediticio","superficie_ha",
                "revenue_ars","ticket_promedio_ars","n_compras","recencia_proxy",
                "margen_pct","ultima_compra","otif_pct"]
        return [dict(zip(cols, r)) for r in rows]


def build_records(raw: list[dict]) -> list[dict]:
    records = []
    for r in raw:
        prov = r["provincia"] or ""
        bounds = PROVINCE_BOUNDS.get(prov, DEFAULT_BOUNDS)
        lat, lon = hash_coords(r["cliente_id"], bounds)

        score = churn_score(r["riesgo_crediticio"] or "Medio", r["ciclo_vida"] or "Activo estable")
        churn_lvl = "Alto" if score >= 0.60 else "Medio" if score >= 0.30 else "Bajo"

        def f2(v, d=2):
            if v is None: return None
            return round(float(v), d)

        records.append({
            "cliente_id":          r["cliente_id"],
            "razon_social":        r["razon_social"],
            "segmento":            r["segmento"],
            "ciclo_vida":          r["ciclo_vida"],
            "provincia":           prov,
            "ciudad":              r["ciudad"] or "",
            "cuit":                r["cuit"],
            "sucursal_id":         r["sucursal_id_asignada"],
            "tier":                r["tier"] or "D",
            "riesgo_crediticio":   r["riesgo_crediticio"] or "Medio",
            "superficie_ha":       r["superficie_ha"],
            "lat":                 lat,
            "lon":                 lon,
            "is_outlier":          False,
            "revenue_ars":         f2(r["revenue_ars"], 2),
            "ticket_promedio_ars": f2(r["ticket_promedio_ars"], 2),
            "n_compras":           int(r["n_compras"]) if r["n_compras"] else 0,
            "margen_pct":          f2(r["margen_pct"], 2),
            "ultima_compra":       r["ultima_compra"].isoformat() if r["ultima_compra"] else None,
            "otif_pct":            f2(r["otif_pct"], 1),
            "churn_score":         score,
            "churn_level":         churn_lvl,
        })
    return records


DDL_SPATIAL_CLIENTES = """
CREATE TABLE IF NOT EXISTS agronova.spatial_clientes (
    cliente_id          VARCHAR(7)      PRIMARY KEY
                        REFERENCES agronova.dim_cliente(cliente_id),
    provincia           VARCHAR(50),
    ciudad              VARCHAR(60),
    latitud             NUMERIC(10,6)   NOT NULL,
    longitud            NUMERIC(10,6)   NOT NULL,
    geom                geometry(Point, 4326),
    is_outlier          BOOLEAN         NOT NULL DEFAULT false,
    revenue_ars         NUMERIC(18,2),
    margen_pct          NUMERIC(6,2),
    ticket_promedio_ars NUMERIC(18,2),
    n_compras           INTEGER,
    ultima_compra       DATE,
    churn_score         NUMERIC(4,3),
    churn_level         VARCHAR(5),
    otif_pct            NUMERIC(5,1),
    tier                VARCHAR(1),
    segmento            VARCHAR(40),
    sucursal_id_asignada SMALLINT
);

CREATE INDEX IF NOT EXISTS idx_spatial_clientes_geom
    ON agronova.spatial_clientes USING GIST (geom);

CREATE INDEX IF NOT EXISTS idx_spatial_clientes_prov
    ON agronova.spatial_clientes (provincia);
"""

DDL_SPATIAL_SUCURSALES = """
CREATE TABLE IF NOT EXISTS agronova.spatial_sucursales (
    sucursal_id  SMALLINT    PRIMARY KEY
                 REFERENCES agronova.dim_sucursal(sucursal_id),
    nombre       VARCHAR(60),
    provincia    VARCHAR(50),
    latitud      NUMERIC(10,6) NOT NULL,
    longitud     NUMERIC(10,6) NOT NULL,
    geom         geometry(Point, 4326)
);

CREATE INDEX IF NOT EXISTS idx_spatial_sucursales_geom
    ON agronova.spatial_sucursales USING GIST (geom);
"""


def seed_db(records: list[dict]) -> None:
    print("Connecting to Neon (unpooled)...")
    conn = psycopg2.connect(DATABASE_URL_UNPOOLED)
    conn.autocommit = True
    cur = conn.cursor()

    print("Enabling PostGIS extension...")
    cur.execute("CREATE EXTENSION IF NOT EXISTS postgis;")

    print("Creating tables...")
    cur.execute(DDL_SPATIAL_CLIENTES)
    cur.execute(DDL_SPATIAL_SUCURSALES)

    print("Seeding spatial_sucursales...")
    cur.execute("""
        INSERT INTO agronova.spatial_sucursales
            (sucursal_id, nombre, provincia, latitud, longitud, geom)
        SELECT sucursal_id, nombre, provincia, lat, lon,
               ST_SetSRID(ST_MakePoint(lon::float8, lat::float8), 4326)
        FROM agronova.dim_sucursal
        ON CONFLICT (sucursal_id) DO UPDATE SET
            nombre   = EXCLUDED.nombre,
            geom     = EXCLUDED.geom
    """)

    print(f"Upserting {len(records)} clients into spatial_clientes...")
    for r in records:
        cur.execute("""
            INSERT INTO agronova.spatial_clientes
                (cliente_id, provincia, ciudad, latitud, longitud, geom,
                 is_outlier, revenue_ars, margen_pct, ticket_promedio_ars,
                 n_compras, ultima_compra, churn_score, churn_level, otif_pct,
                 tier, segmento, sucursal_id_asignada)
            VALUES (%s,%s,%s,%s,%s,
                    ST_SetSRID(ST_MakePoint(%s,%s),4326),
                    %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT (cliente_id) DO UPDATE SET
                provincia           = EXCLUDED.provincia,
                ciudad              = EXCLUDED.ciudad,
                latitud             = EXCLUDED.latitud,
                longitud            = EXCLUDED.longitud,
                geom                = EXCLUDED.geom,
                revenue_ars         = EXCLUDED.revenue_ars,
                margen_pct          = EXCLUDED.margen_pct,
                ticket_promedio_ars = EXCLUDED.ticket_promedio_ars,
                n_compras           = EXCLUDED.n_compras,
                ultima_compra       = EXCLUDED.ultima_compra,
                churn_score         = EXCLUDED.churn_score,
                churn_level         = EXCLUDED.churn_level,
                otif_pct            = EXCLUDED.otif_pct,
                tier                = EXCLUDED.tier,
                segmento            = EXCLUDED.segmento,
                sucursal_id_asignada= EXCLUDED.sucursal_id_asignada
        """, (
            r["cliente_id"], r["provincia"], r["ciudad"],
            r["lat"], r["lon"],
            r["lon"], r["lat"],
            r["is_outlier"], r["revenue_ars"], r["margen_pct"],
            r["ticket_promedio_ars"], r["n_compras"], r["ultima_compra"],
            r["churn_score"], r["churn_level"], r["otif_pct"],
            r["tier"], r["segmento"], r["sucursal_id"],
        ))

    cnt = cur.execute("SELECT COUNT(*) FROM agronova.spatial_clientes")
    row = cur.fetchone()
    print(f"  spatial_clientes rows: {row[0] if row else '?'}")
    cur.close()
    conn.close()
    print("DB seed complete.")


def write_json(records: list[dict]) -> None:
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, separators=(",", ":"))
    size_kb = OUT_JSON.stat().st_size / 1024
    print(f"Written: {OUT_JSON} ({len(records)} clients, {size_kb:.0f} KB)")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--json-only", action="store_true", help="Skip DB, only write JSON")
    args = parser.parse_args()

    engine = create_engine(DATABASE_URL)
    print("Fetching client data from Neon...")
    raw = fetch_clients(engine)
    print(f"  {len(raw)} active clients fetched")

    print("Building records with coordinates...")
    records = build_records(raw)

    if not args.json_only:
        seed_db(records)

    write_json(records)
    print("Done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

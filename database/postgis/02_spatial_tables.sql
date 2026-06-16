-- =============================================================================
-- AgroNova v2.0 — Spatial Database Layer (Sprint GIS-05)
-- 02_spatial_tables.sql
-- Tablas espaciales, anexas al Data Warehouse existente (database/create_database.sql).
-- No modifican dim_sucursal/dim_deposito/dim_cliente — son tablas 1:1 referenciadas
-- por clave foranea, pobladas por gis/postgis_loader.py.
-- SRID 4326 (WGS-84) en las cuatro — igual que CRS_WGS84 en gis/geodataframes.py.
-- Ejecutar DESPUES de 01_enable_postgis.sql.
-- =============================================================================

SET search_path TO agronova, public;

-- ── spatial_sucursales ────────────────────────────────────────────────────────
-- 1:1 con dim_sucursal. geom = Point real (Dim_Sucursal.csv lat/lon).
CREATE TABLE IF NOT EXISTS spatial_sucursales (
    sucursal_id     SMALLINT              PRIMARY KEY REFERENCES dim_sucursal(sucursal_id),
    nombre          VARCHAR(80)           NOT NULL,
    provincia       VARCHAR(50)           NOT NULL,
    latitud         DOUBLE PRECISION      NOT NULL CHECK (latitud BETWEEN -90 AND 90),
    longitud        DOUBLE PRECISION      NOT NULL CHECK (longitud BETWEEN -180 AND 180),
    geom            geometry(Point, 4326) NOT NULL,
    actualizado_en  TIMESTAMPTZ           NOT NULL DEFAULT now()
);
COMMENT ON TABLE spatial_sucursales IS 'Extension espacial de dim_sucursal — Point real, SRID 4326';

-- ── spatial_depositos ─────────────────────────────────────────────────────────
-- 1:1 con dim_deposito. geom = Point real (Dim_Depósito.csv lat/lon).
CREATE TABLE IF NOT EXISTS spatial_depositos (
    deposito_id     SMALLINT              PRIMARY KEY REFERENCES dim_deposito(deposito_id),
    nombre          VARCHAR(80)           NOT NULL,
    sucursal_id     SMALLINT              NOT NULL REFERENCES dim_sucursal(sucursal_id),
    latitud         DOUBLE PRECISION      NOT NULL CHECK (latitud BETWEEN -90 AND 90),
    longitud        DOUBLE PRECISION      NOT NULL CHECK (longitud BETWEEN -180 AND 180),
    geom            geometry(Point, 4326) NOT NULL,
    actualizado_en  TIMESTAMPTZ           NOT NULL DEFAULT now()
);
COMMENT ON TABLE spatial_depositos IS 'Extension espacial de dim_deposito — Point real, SRID 4326';

-- ── spatial_clientes ──────────────────────────────────────────────────────────
-- 1:1 con dim_cliente. geom = Point proxy (centroide de provincia, no ubicacion
-- real — ver gis/geodataframes.py::clientes_gdf y docs/geospatial/spatial_science.md).
CREATE TABLE IF NOT EXISTS spatial_clientes (
    cliente_id      CHAR(6)               PRIMARY KEY REFERENCES dim_cliente(cliente_id),
    provincia       VARCHAR(50)           NOT NULL,
    latitud         DOUBLE PRECISION      NOT NULL CHECK (latitud BETWEEN -90 AND 90),
    longitud        DOUBLE PRECISION      NOT NULL CHECK (longitud BETWEEN -180 AND 180),
    geom            geometry(Point, 4326) NOT NULL,
    actualizado_en  TIMESTAMPTZ           NOT NULL DEFAULT now()
);
COMMENT ON TABLE spatial_clientes IS 'Extension espacial de dim_cliente — Point proxy (centroide provincial), SRID 4326';

-- ── spatial_provincias ────────────────────────────────────────────────────────
-- Catalogo propio (24 provincias) — sin FK, no hay tabla dim_provincia en el
-- Data Warehouse actual (dim_region agrupa por macro-region, no por provincia).
-- provincia_id = codigo INDEC de 2 digitos (mismo que gis.geo_utils.PROVINCE_CATALOGUE).
CREATE TABLE IF NOT EXISTS spatial_provincias (
    provincia_id    CHAR(2)                    PRIMARY KEY,
    nombre          VARCHAR(60)                NOT NULL UNIQUE,
    macro_region    VARCHAR(10)                NOT NULL CHECK (macro_region IN ('PAM','NOA','NEA','CUY','PAT')),
    latitud         DOUBLE PRECISION           NOT NULL CHECK (latitud BETWEEN -90 AND 90),
    longitud        DOUBLE PRECISION           NOT NULL CHECK (longitud BETWEEN -180 AND 180),
    geom            geometry(MultiPolygon, 4326) NOT NULL,
    actualizado_en  TIMESTAMPTZ                NOT NULL DEFAULT now()
);
COMMENT ON TABLE spatial_provincias IS 'Limites provinciales IGN, recortados al continente (sin reclamo antartico) — SRID 4326';
COMMENT ON COLUMN spatial_provincias.latitud IS 'Centroide de la geometria, no del catalogo INDEC (puede diferir levemente)';

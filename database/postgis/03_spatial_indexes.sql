-- =============================================================================
-- AgroNova v2.0 — Spatial Database Layer (Sprint GIS-05)
-- 03_spatial_indexes.sql
-- Indices GIST sobre cada columna geom + B-Tree de soporte para joins no
-- espaciales contra el Data Warehouse. Ejecutar DESPUES de cargar los datos
-- (02_spatial_tables.sql + gis/postgis_loader.py).
-- =============================================================================

SET search_path TO agronova, public;

-- ── Indices GIST (uno por geometria) ─────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_spatial_sucursales_geom
    ON spatial_sucursales USING GIST (geom);

CREATE INDEX IF NOT EXISTS idx_spatial_depositos_geom
    ON spatial_depositos USING GIST (geom);

CREATE INDEX IF NOT EXISTS idx_spatial_clientes_geom
    ON spatial_clientes USING GIST (geom);

CREATE INDEX IF NOT EXISTS idx_spatial_provincias_geom
    ON spatial_provincias USING GIST (geom);

-- ── B-Tree de soporte (joins no espaciales con dim_*/fact_*) ────────────────

CREATE INDEX IF NOT EXISTS idx_spatial_depositos_sucursal_id
    ON spatial_depositos (sucursal_id);

CREATE INDEX IF NOT EXISTS idx_spatial_clientes_provincia
    ON spatial_clientes (provincia);

CREATE INDEX IF NOT EXISTS idx_spatial_provincias_nombre
    ON spatial_provincias (nombre);

CREATE INDEX IF NOT EXISTS idx_spatial_provincias_macro_region
    ON spatial_provincias (macro_region);

-- ── Estadisticas ──────────────────────────────────────────────────────────
ANALYZE spatial_sucursales;
ANALYZE spatial_depositos;
ANALYZE spatial_clientes;
ANALYZE spatial_provincias;

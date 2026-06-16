-- =============================================================================
-- AgroNova v2.0 — Spatial Database Layer (Sprint GIS-05)
-- 01_enable_postgis.sql
-- Habilita la extension PostGIS sobre la base existente (database/create_database.sql
-- ya debe haber corrido). Ejecutar como superuser, una sola vez por base.
-- No requiere una instancia real para este sprint — script preparado, no aplicado.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS postgis;

-- Confirma version y disponibilidad (no falla si ya esta habilitada)
-- SELECT postgis_full_version();

SET search_path TO agronova, public;

COMMENT ON EXTENSION postgis IS 'PostGIS — tipos geometry/geography, indices GIST, funciones ST_*';

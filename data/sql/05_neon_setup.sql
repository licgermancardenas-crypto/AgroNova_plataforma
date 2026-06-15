-- ============================================================
-- AgroNova Argentina S.A. - Setup Neon (PostgreSQL serverless)
-- Instrucciones para despliegue en neon.tech
-- ============================================================

-- PASO 1: Crear proyecto en neon.tech (free tier soporta ~512MB)
--   Dashboard -> New Project -> Region: us-east-1 o sa-east-1 (Sao Paulo)
--   Guardar el connection string en .env.local:
--   DATABASE_URL="postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require"

-- PASO 2: Ejecutar este archivo en orden en la consola de Neon o via psql:
--   psql $DATABASE_URL -f 05_neon_setup.sql

-- PASO 3: Cargar datos via Python (recomendado sobre COPY para Neon):
--   python etl/load_postgres.py --conn "$DATABASE_URL"

-- ── Configuracion inicial ─────────────────────────────────────────

-- Extensiones utiles en Neon (ya incluidas por defecto)
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS btree_gin;

-- Schema dedicado
CREATE SCHEMA IF NOT EXISTS agronova;
SET search_path TO agronova;

-- ── Pool de conexiones recomendado para Next.js ───────────────────
-- En Neon usar el connection string de "pooler" (puerto 5432 pooler)
-- Agregar ?pgbouncer=true&connection_limit=1 para serverless functions

-- ── Variables de entorno necesarias (.env.local) ─────────────────
-- DATABASE_URL=postgresql://...@ep-xxx.neon.tech/neondb?sslmode=require
-- DATABASE_URL_UNPOOLED=postgresql://...@ep-xxx.neon.tech/neondb?sslmode=require
-- (unpooled para migraciones; pooled para runtime)

-- ── Limite de Neon Free: 512MB storage ───────────────────────────
-- Fact_Ventas comprimida en PG ocupa ~200-300MB
-- Total estimado: ~350-400MB -> dentro del limite free
-- Para mas datos: upgradar a Launch ($19/mo, 10GB)

-- ── Columnas GENERATED: diferencia Neon vs CSV ───────────────────
-- fact_inventario.bajo_minimo: GENERATED ALWAYS AS (stock_actual < stock_minimo)
-- fact_logistica.dias_transito_real: GENERATED ALWAYS AS (dias_transito_base + dias_demora)
-- NO incluir estas columnas en COPY/INSERT — se calculan automaticamente

-- ── Comando de carga recomendado (desde Windows) ─────────────────
-- set DATABASE_URL=postgresql://user:pass@host/db
-- python etl/load_postgres.py --conn "%DATABASE_URL%"

-- ── Verificacion post-carga ───────────────────────────────────────
-- Ejecutar esta query para confirmar integridad:

/*
SELECT
    schemaname,
    tablename,
    n_live_tup AS filas_estimadas
FROM pg_stat_user_tables
WHERE schemaname = 'agronova'
ORDER BY n_live_tup DESC;
*/

-- ── Recomendaciones de performance para Neon ─────────────────────
-- 1. Usar CLUSTER en fact_ventas por fecha_id para lectura secuencial
-- 2. Activar columnar storage en Neon (columnar extension) para analytics
-- 3. Usar read replicas para Power BI / queries pesadas
-- 4. Setear statement_timeout = '30s' para queries de BI

ALTER DATABASE neondb SET statement_timeout = '60s';
ALTER DATABASE neondb SET work_mem = '64MB';

-- ── Branch de desarrollo (feature de Neon) ───────────────────────
-- Neon permite crear branches del database (como git branches)
-- Usar para testing de modelos ML sin afectar produccion:
-- Dashboard -> Branches -> Create Branch -> "ml-experiments"

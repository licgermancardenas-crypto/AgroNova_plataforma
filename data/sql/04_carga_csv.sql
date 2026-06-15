-- ============================================================
-- AgroNova Argentina S.A. - Carga de CSVs a PostgreSQL
-- Usar COPY para carga masiva eficiente (requiere superuser o pg_read_server_files)
-- Para Neon/RDS usar el script Python: etl/load_postgres.py
-- ============================================================

SET search_path TO agronova;

-- ── IMPORTANTE: ajustar la ruta absoluta segun tu entorno ────────
-- Reemplazar '/absolute/path/to/data/csv/' con la ruta real
-- En Windows usar barras forward: 'C:/Users/corra/AgroNova_plataforma/data/csv/'

-- Orden de carga respeta dependencias FK (dims primero, facts despues)

\set csv_dir '/absolute/path/to/data/csv/'

-- 1. Dim_Fecha
TRUNCATE TABLE dim_fecha RESTART IDENTITY CASCADE;
COPY dim_fecha (
    fecha_id, fecha, año, semestre, trimestre, mes, mes_nombre,
    semana_iso, dia_año, dia_semana, dia_semana_nombre,
    es_feriado, es_fin_de_semana, es_dia_habil,
    temporada, temporada_agricola, factor_estacional
)
FROM :'csv_dir' || 'Dim_Fecha.csv'
WITH (FORMAT CSV, HEADER TRUE, ENCODING 'UTF8');

-- 2. Dim_Region
TRUNCATE TABLE dim_region RESTART IDENTITY CASCADE;
COPY dim_region FROM :'csv_dir' || 'Dim_Region.csv'
WITH (FORMAT CSV, HEADER TRUE, ENCODING 'UTF8');

-- 3. Dim_Sucursal
TRUNCATE TABLE dim_sucursal RESTART IDENTITY CASCADE;
COPY dim_sucursal FROM :'csv_dir' || 'Dim_Sucursal.csv'
WITH (FORMAT CSV, HEADER TRUE, ENCODING 'UTF8');

-- 4. Dim_Deposito
TRUNCATE TABLE dim_deposito RESTART IDENTITY CASCADE;
COPY dim_deposito FROM :'csv_dir' || 'Dim_Depósito.csv'
WITH (FORMAT CSV, HEADER TRUE, ENCODING 'UTF8');

-- 5. Dim_Vendedor
TRUNCATE TABLE dim_vendedor RESTART IDENTITY CASCADE;
COPY dim_vendedor FROM :'csv_dir' || 'Dim_Vendedor.csv'
WITH (FORMAT CSV, HEADER TRUE, ENCODING 'UTF8');

-- 6. Dim_Proveedor
TRUNCATE TABLE dim_proveedor RESTART IDENTITY CASCADE;
COPY dim_proveedor FROM :'csv_dir' || 'Dim_Proveedor.csv'
WITH (FORMAT CSV, HEADER TRUE, ENCODING 'UTF8');

-- 7. Dim_Producto (FK a dim_proveedor)
TRUNCATE TABLE dim_producto RESTART IDENTITY CASCADE;
COPY dim_producto FROM :'csv_dir' || 'Dim_Producto.csv'
WITH (FORMAT CSV, HEADER TRUE, ENCODING 'UTF8');

-- 8. Dim_Cliente
TRUNCATE TABLE dim_cliente RESTART IDENTITY CASCADE;
COPY dim_cliente FROM :'csv_dir' || 'Dim_Cliente.csv'
WITH (FORMAT CSV, HEADER TRUE, ENCODING 'UTF8');

-- 9. Fact_Compras
TRUNCATE TABLE fact_compras RESTART IDENTITY CASCADE;
COPY fact_compras FROM :'csv_dir' || 'Fact_Compras.csv'
WITH (FORMAT CSV, HEADER TRUE, ENCODING 'UTF8');

-- 10. Fact_Inventario (omitir bajo_minimo: columna generada)
TRUNCATE TABLE fact_inventario RESTART IDENTITY CASCADE;
COPY fact_inventario (
    inventario_id, fecha_id, producto_id, deposito_id,
    stock_actual, stock_minimo, stock_maximo,
    valor_stock_ars, valor_stock_usd, merma_pct
)
FROM :'csv_dir' || 'Fact_Inventario.csv'
WITH (FORMAT CSV, HEADER TRUE, ENCODING 'UTF8');

-- 11. Fact_Ventas (tabla grande: ~1.5M filas, puede tomar 30-60s)
TRUNCATE TABLE fact_ventas RESTART IDENTITY CASCADE;
COPY fact_ventas FROM :'csv_dir' || 'Fact_Ventas.csv'
WITH (FORMAT CSV, HEADER TRUE, ENCODING 'UTF8');

-- 12. Fact_Logistica (omitir dias_transito_real: columna generada)
TRUNCATE TABLE fact_logistica RESTART IDENTITY CASCADE;
COPY fact_logistica (
    logistica_id, fecha_despacho_id, cliente_id, deposito_origen_id,
    region_destino_id, transportista, tipo_envio, peso_kg,
    dias_transito_base, dias_demora, costo_flete_ars, estado
)
FROM :'csv_dir' || 'Fact_Logística.csv'
WITH (FORMAT CSV, HEADER TRUE, ENCODING 'UTF8');

-- 13. Cotizaciones_Externas
TRUNCATE TABLE cotizaciones_externas RESTART IDENTITY CASCADE;
COPY cotizaciones_externas FROM :'csv_dir' || 'Cotizaciones_Externas.csv'
WITH (FORMAT CSV, HEADER TRUE, ENCODING 'UTF8');

-- Verificacion rapida
SELECT
    'dim_fecha'            AS tabla, COUNT(*) AS filas FROM dim_fecha UNION ALL
SELECT 'dim_region',                 COUNT(*) FROM dim_region         UNION ALL
SELECT 'dim_sucursal',               COUNT(*) FROM dim_sucursal       UNION ALL
SELECT 'dim_deposito',               COUNT(*) FROM dim_deposito       UNION ALL
SELECT 'dim_vendedor',               COUNT(*) FROM dim_vendedor       UNION ALL
SELECT 'dim_proveedor',              COUNT(*) FROM dim_proveedor      UNION ALL
SELECT 'dim_producto',               COUNT(*) FROM dim_producto       UNION ALL
SELECT 'dim_cliente',                COUNT(*) FROM dim_cliente        UNION ALL
SELECT 'fact_compras',               COUNT(*) FROM fact_compras       UNION ALL
SELECT 'fact_inventario',            COUNT(*) FROM fact_inventario    UNION ALL
SELECT 'fact_ventas',                COUNT(*) FROM fact_ventas        UNION ALL
SELECT 'fact_logistica',             COUNT(*) FROM fact_logistica     UNION ALL
SELECT 'cotizaciones_externas',      COUNT(*) FROM cotizaciones_externas
ORDER BY tabla;

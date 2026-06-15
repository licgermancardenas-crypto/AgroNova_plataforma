-- =============================================================================
-- AgroNova Argentina S.A. — Carga de datos desde CSV (alternativa a ETL Python)
-- Usar este script si se tiene acceso directo al filesystem del servidor Postgres.
-- Para Neon / cloud: usar etl/run_pipeline.py que carga via SQLAlchemy/psycopg2.
-- =============================================================================
-- Prerequisito: ejecutar create_database.sql primero.
-- Los CSV deben estar accesibles desde el servidor (o via \copy en psql cliente).
-- Reemplazar '/ruta/a/csv/' con la ruta real de los archivos.
-- =============================================================================

SET search_path TO agronova;

-- Desactivar temporalmente checks de FK durante la carga masiva
SET session_replication_role = replica;  -- solo en Postgres; en Neon puede no estar disponible

-- ── ORDEN FK-SAFE: dimensiones primero, luego hechos ─────────────────────────

-- 1. Dim_Fecha
\copy dim_fecha FROM '/ruta/a/csv/Dim_Fecha.csv'
    WITH (FORMAT CSV, HEADER TRUE, ENCODING 'UTF8', DELIMITER ',');

-- 2. Dim_Region
\copy dim_region FROM '/ruta/a/csv/Dim_Region.csv'
    WITH (FORMAT CSV, HEADER TRUE, ENCODING 'UTF8', DELIMITER ',');

-- 3. Dim_Sucursal
\copy dim_sucursal FROM '/ruta/a/csv/Dim_Sucursal.csv'
    WITH (FORMAT CSV, HEADER TRUE, ENCODING 'UTF8', DELIMITER ',');

-- 4. Dim_Deposito
\copy dim_deposito FROM '/ruta/a/csv/Dim_Deposito.csv'
    WITH (FORMAT CSV, HEADER TRUE, ENCODING 'UTF8', DELIMITER ',');

-- 5. Dim_Vendedor
\copy dim_vendedor FROM '/ruta/a/csv/Dim_Vendedor.csv'
    WITH (FORMAT CSV, HEADER TRUE, ENCODING 'UTF8', DELIMITER ',');

-- 6. Dim_Proveedor
\copy dim_proveedor FROM '/ruta/a/csv/Dim_Proveedor.csv'
    WITH (FORMAT CSV, HEADER TRUE, ENCODING 'UTF8', DELIMITER ',');

-- 7. Dim_Producto
\copy dim_producto FROM '/ruta/a/csv/Dim_Producto.csv'
    WITH (FORMAT CSV, HEADER TRUE, ENCODING 'UTF8', DELIMITER ',');

-- 8. Dim_Cliente
-- Nota: excluir columna 'is_churned' (derivada en Python, no en schema SQL)
-- Si el CSV la contiene, crear tabla temporal y hacer INSERT SELECT:
CREATE TEMP TABLE tmp_dim_cliente AS SELECT * FROM dim_cliente LIMIT 0;
ALTER TABLE tmp_dim_cliente ADD COLUMN is_churned BOOLEAN;

\copy tmp_dim_cliente FROM '/ruta/a/csv/Dim_Cliente.csv'
    WITH (FORMAT CSV, HEADER TRUE, ENCODING 'UTF8', DELIMITER ',');

INSERT INTO dim_cliente
SELECT cliente_id, razon_social, cuit, segmento, ciclo_vida, provincia,
       region_id, año_alta, año_baja, activo, riesgo_crediticio,
       limite_credito_usd, volumen_factor, tier_cliente, superficie_ha
FROM tmp_dim_cliente;

DROP TABLE tmp_dim_cliente;

-- 9. Cotizaciones_Externas
\copy cotizaciones_externas FROM '/ruta/a/csv/Cotizaciones_Externas.csv'
    WITH (FORMAT CSV, HEADER TRUE, ENCODING 'UTF8', DELIMITER ',');

-- 10. Fact_Compras
\copy fact_compras FROM '/ruta/a/csv/Fact_Compras.csv'
    WITH (FORMAT CSV, HEADER TRUE, ENCODING 'UTF8', DELIMITER ',');

-- 11. Fact_Inventario (excluir columna GENERATED 'bajo_minimo')
CREATE TEMP TABLE tmp_fact_inventario AS SELECT
    inventario_id, fecha_id, producto_id, deposito_id,
    stock_actual, stock_minimo, stock_maximo, valor_stock_ars, merma_pct
FROM fact_inventario LIMIT 0;

\copy tmp_fact_inventario FROM '/ruta/a/csv/Fact_Inventario.csv'
    WITH (FORMAT CSV, HEADER TRUE, ENCODING 'UTF8', DELIMITER ',');

INSERT INTO fact_inventario
    (inventario_id, fecha_id, producto_id, deposito_id,
     stock_actual, stock_minimo, stock_maximo, valor_stock_ars, merma_pct)
SELECT * FROM tmp_fact_inventario;

DROP TABLE tmp_fact_inventario;

-- 12. Fact_Ventas (excluir columnas enriquecidas: año, mes, mes_nombre, trimestre, temporada_agricola)
CREATE TEMP TABLE tmp_fact_ventas AS SELECT
    venta_id, fecha_id, cliente_id, producto_id, sucursal_id, vendedor_id,
    canal_venta, estado, cantidad, precio_unitario_ars, precio_unitario_usd,
    descuento_pct, total_ars, total_usd, margen_bruto_ars, nro_factura
FROM fact_ventas LIMIT 0;

\copy tmp_fact_ventas FROM '/ruta/a/csv/Fact_Ventas.csv'
    WITH (FORMAT CSV, HEADER TRUE, ENCODING 'UTF8', DELIMITER ',');

INSERT INTO fact_ventas SELECT * FROM tmp_fact_ventas;
DROP TABLE tmp_fact_ventas;

-- 13. Fact_Logistica (excluir columna GENERATED 'dias_transito_real')
CREATE TEMP TABLE tmp_fact_logistica AS SELECT
    logistica_id, fecha_despacho_id, fecha_entrega_id, cliente_id,
    deposito_origen_id, region_destino_id, transportista, estado,
    dias_transito_base, costo_flete_ars, peso_kg, volumen_m3
FROM fact_logistica LIMIT 0;

\copy tmp_fact_logistica FROM '/ruta/a/csv/Fact_Logistica.csv'
    WITH (FORMAT CSV, HEADER TRUE, ENCODING 'UTF8', DELIMITER ',');

INSERT INTO fact_logistica
    (logistica_id, fecha_despacho_id, fecha_entrega_id, cliente_id,
     deposito_origen_id, region_destino_id, transportista, estado,
     dias_transito_base, costo_flete_ars, peso_kg, volumen_m3)
SELECT * FROM tmp_fact_logistica;

DROP TABLE tmp_fact_logistica;

-- ── Re-activar FK checks ──────────────────────────────────────────────────────
SET session_replication_role = DEFAULT;

-- ── Verificacion post-carga ───────────────────────────────────────────────────
SELECT 'dim_fecha'              AS tabla, COUNT(*) AS filas FROM dim_fecha
UNION ALL SELECT 'dim_region',             COUNT(*) FROM dim_region
UNION ALL SELECT 'dim_sucursal',           COUNT(*) FROM dim_sucursal
UNION ALL SELECT 'dim_deposito',           COUNT(*) FROM dim_deposito
UNION ALL SELECT 'dim_vendedor',           COUNT(*) FROM dim_vendedor
UNION ALL SELECT 'dim_proveedor',          COUNT(*) FROM dim_proveedor
UNION ALL SELECT 'dim_producto',           COUNT(*) FROM dim_producto
UNION ALL SELECT 'dim_cliente',            COUNT(*) FROM dim_cliente
UNION ALL SELECT 'cotizaciones_externas',  COUNT(*) FROM cotizaciones_externas
UNION ALL SELECT 'fact_compras',           COUNT(*) FROM fact_compras
UNION ALL SELECT 'fact_inventario',        COUNT(*) FROM fact_inventario
UNION ALL SELECT 'fact_ventas',            COUNT(*) FROM fact_ventas
UNION ALL SELECT 'fact_logistica',         COUNT(*) FROM fact_logistica
ORDER BY tabla;

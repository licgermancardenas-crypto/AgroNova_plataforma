-- =============================================================================
-- AgroNova Argentina S.A. — Indices de performance
-- Ejecutar DESPUES de cargar los datos (create_database.sql + carga)
-- Convenciones: idx_{tabla}_{columnas}[_{tipo}]
-- =============================================================================

SET search_path TO agronova;

-- ── FACT_VENTAS (tabla caliente: 1.5M filas, el 95% de las queries) ──────────

-- PK ya tiene indice B-Tree implicito

-- Filtro mas comun: por fecha
CREATE INDEX IF NOT EXISTS idx_fact_ventas_fecha_id
    ON fact_ventas (fecha_id);

-- Drill-down por cliente
CREATE INDEX IF NOT EXISTS idx_fact_ventas_cliente_id
    ON fact_ventas (cliente_id);

-- Drill-down por producto
CREATE INDEX IF NOT EXISTS idx_fact_ventas_producto_id
    ON fact_ventas (producto_id);

-- Filtro por sucursal (5 valores — bajo cardinality, util para hash join)
CREATE INDEX IF NOT EXISTS idx_fact_ventas_sucursal_id
    ON fact_ventas (sucursal_id);

-- Filtro por vendedor
CREATE INDEX IF NOT EXISTS idx_fact_ventas_vendedor_id
    ON fact_ventas (vendedor_id);

-- Indice compuesto para query de performance de ventas por periodo + sucursal
CREATE INDEX IF NOT EXISTS idx_fact_ventas_fecha_sucursal
    ON fact_ventas (fecha_id, sucursal_id)
    INCLUDE (total_ars, cantidad, margen_bruto_ars);

-- Indice compuesto para analisis cliente x producto (cross-sell / basket)
CREATE INDEX IF NOT EXISTS idx_fact_ventas_cliente_producto
    ON fact_ventas (cliente_id, producto_id)
    INCLUDE (fecha_id, total_ars);

-- Indice parcial: solo ventas completadas (excluye ~5% canceladas/devueltas)
CREATE INDEX IF NOT EXISTS idx_fact_ventas_completadas
    ON fact_ventas (fecha_id, cliente_id, total_ars)
    WHERE estado = 'Completada';

-- Canal de ventas (para analisis omnicanal)
CREATE INDEX IF NOT EXISTS idx_fact_ventas_canal
    ON fact_ventas (canal_venta, fecha_id);

-- ── FACT_COMPRAS ──────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_fact_compras_fecha_id
    ON fact_compras (fecha_id);

CREATE INDEX IF NOT EXISTS idx_fact_compras_proveedor_id
    ON fact_compras (proveedor_id);

CREATE INDEX IF NOT EXISTS idx_fact_compras_producto_id
    ON fact_compras (producto_id);

CREATE INDEX IF NOT EXISTS idx_fact_compras_deposito
    ON fact_compras (deposito_destino_id);

-- Supply chain mensual: proveedor x periodo
CREATE INDEX IF NOT EXISTS idx_fact_compras_prov_fecha
    ON fact_compras (proveedor_id, fecha_id)
    INCLUDE (total_usd, cantidad);

-- ── FACT_INVENTARIO ───────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_fact_inv_fecha_id
    ON fact_inventario (fecha_id);

CREATE INDEX IF NOT EXISTS idx_fact_inv_producto_id
    ON fact_inventario (producto_id);

CREATE INDEX IF NOT EXISTS idx_fact_inv_deposito_id
    ON fact_inventario (deposito_id);

-- UK ya cubrio (fecha_id, producto_id, deposito_id) con un indice
-- Indice parcial para alertas de stock bajo
CREATE INDEX IF NOT EXISTS idx_fact_inv_bajo_minimo
    ON fact_inventario (deposito_id, producto_id)
    WHERE bajo_minimo = TRUE;

-- Valor de inventario por deposito (para reportes de activos)
CREATE INDEX IF NOT EXISTS idx_fact_inv_deposito_valor
    ON fact_inventario (deposito_id, fecha_id)
    INCLUDE (valor_stock_ars);

-- ── FACT_LOGISTICA ────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_fact_log_despacho_id
    ON fact_logistica (fecha_despacho_id);

CREATE INDEX IF NOT EXISTS idx_fact_log_cliente_id
    ON fact_logistica (cliente_id);

CREATE INDEX IF NOT EXISTS idx_fact_log_deposito_origen
    ON fact_logistica (deposito_origen_id);

CREATE INDEX IF NOT EXISTS idx_fact_log_region_destino
    ON fact_logistica (region_destino_id);

-- Analisis de demoras: estado != Entregado
CREATE INDEX IF NOT EXISTS idx_fact_log_demorados
    ON fact_logistica (region_destino_id, fecha_despacho_id, costo_flete_ars)
    WHERE estado IN ('Demorado','En_transito');

-- ── DIM_CLIENTE ───────────────────────────────────────────────────────────────

-- Busqueda por segmento (Tier A / cooperativas / etc.)
CREATE INDEX IF NOT EXISTS idx_dim_cliente_segmento
    ON dim_cliente (segmento);

CREATE INDEX IF NOT EXISTS idx_dim_cliente_tier
    ON dim_cliente (tier_cliente);

CREATE INDEX IF NOT EXISTS idx_dim_cliente_region
    ON dim_cliente (region_id);

-- Solo clientes activos (excluye ~30% churned)
CREATE INDEX IF NOT EXISTS idx_dim_cliente_activos
    ON dim_cliente (region_id, segmento)
    WHERE activo = TRUE;

-- CUIT ya tiene UNIQUE (implicito indice B-Tree)

-- ── DIM_PRODUCTO ──────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_dim_producto_categoria
    ON dim_producto (categoria);

CREATE INDEX IF NOT EXISTS idx_dim_producto_proveedor
    ON dim_producto (proveedor_id);

CREATE INDEX IF NOT EXISTS idx_dim_producto_rotacion
    ON dim_producto (rotacion)
    INCLUDE (precio_usd_base_2016, margen_bruto_pct);

-- ── COTIZACIONES_EXTERNAS ─────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_cotiz_fecha_id
    ON cotizaciones_externas (fecha_id);

-- ── ESTADISTICAS ──────────────────────────────────────────────────────────────
-- Actualizar estadisticas para que el planner use los nuevos indices
ANALYZE dim_fecha;
ANALYZE dim_cliente;
ANALYZE dim_producto;
ANALYZE fact_ventas;
ANALYZE fact_compras;
ANALYZE fact_inventario;
ANALYZE fact_logistica;
ANALYZE cotizaciones_externas;

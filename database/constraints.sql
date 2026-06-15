-- =============================================================================
-- AgroNova Argentina S.A. — Constraints adicionales
-- CHECK constraints de negocio que no van en create_database.sql
-- Ejecutar DESPUES de la carga inicial (evita validacion en bulk load)
-- =============================================================================

SET search_path TO agronova;

-- ── VENTAS: coherencia precio ARS vs USD ─────────────────────────────────────
-- TC minimo historico: ARS 14 / USD 1 (2016)
ALTER TABLE fact_ventas
    ADD CONSTRAINT chk_ventas_precio_ars_gt_usd
        CHECK (precio_unitario_ars > precio_unitario_usd);

-- Total = cantidad * precio * (1 - descuento) con 2% tolerancia por redondeo
-- (Constraint expresado como comment ya que depende de columnas calculadas)
COMMENT ON CONSTRAINT chk_ventas_precio_ars_gt_usd ON fact_ventas
    IS 'TC implicito: precio en ARS siempre mayor al precio en USD (TC > 1 desde 2016)';

-- ── INVENTARIO: coherencia stock ─────────────────────────────────────────────
ALTER TABLE fact_inventario
    ADD CONSTRAINT chk_inv_stock_coherente
        CHECK (stock_maximo >= stock_actual OR stock_actual = 0);

COMMENT ON CONSTRAINT chk_inv_stock_coherente ON fact_inventario
    IS 'stock_actual no puede superar stock_maximo (salvo que ambos sean 0)';

-- ── LOGISTICA: entrega posterior a despacho ───────────────────────────────────
ALTER TABLE fact_logistica
    ADD CONSTRAINT chk_log_entrega_posterior
        CHECK (fecha_entrega_id IS NULL OR fecha_entrega_id >= fecha_despacho_id);

-- ── CLIENTE: año_baja posterior a año_alta ────────────────────────────────────
-- (Ya en DDL como CHECK, redundante aqui — documentado para auditoria)
COMMENT ON COLUMN dim_cliente.año_baja
    IS 'NULL = cliente activo. Si NOT NULL debe ser > año_alta.';

-- ── COMPRAS: precio USD coherente ────────────────────────────────────────────
ALTER TABLE fact_compras
    ADD CONSTRAINT chk_compras_total_ars_positivo
        CHECK (total_ars > 0 AND cantidad > 0);

-- ── REGLAS DE NEGOCIO DOCUMENTADAS ───────────────────────────────────────────
-- Las siguientes reglas se aplican en la capa ETL (transform.py), no como
-- constraints SQL porque involucran multiples tablas o son estadisticas:
--
--   BR-01: stock_actual >= 0                          [CHECK en DDL]
--   BR-02: ventas no antes de alta del cliente        [transform.py]
--   BR-03: margen_bruto_ars >= 0                      [CHECK en DDL]
--   BR-04: fechas 2016-2026                           [CHECK año en dim_fecha]
--   BR-05: precios > 0, descuento 0-20%               [CHECK en DDL]
--   BR-06: Pareto top20% >= 60% revenue               [test suite]
--
-- ── FOREIGN KEYS (confirmacion explicita) ────────────────────────────────────
-- Todas las FK ya fueron declaradas en create_database.sql.
-- Esta seccion es documentacion de auditoria.

-- fact_ventas -> dim_fecha         (fecha_id)
-- fact_ventas -> dim_cliente       (cliente_id)
-- fact_ventas -> dim_producto      (producto_id)
-- fact_ventas -> dim_sucursal      (sucursal_id)
-- fact_ventas -> dim_vendedor      (vendedor_id)
-- fact_compras -> dim_fecha        (fecha_id)
-- fact_compras -> dim_proveedor    (proveedor_id)
-- fact_compras -> dim_producto     (producto_id)
-- fact_compras -> dim_deposito     (deposito_destino_id)
-- fact_inventario -> dim_fecha     (fecha_id)
-- fact_inventario -> dim_producto  (producto_id)
-- fact_inventario -> dim_deposito  (deposito_id)
-- fact_logistica -> dim_fecha      (fecha_despacho_id, fecha_entrega_id)
-- fact_logistica -> dim_cliente    (cliente_id)
-- fact_logistica -> dim_deposito   (deposito_origen_id)
-- fact_logistica -> dim_region     (region_destino_id)
-- cotizaciones_externas -> dim_fecha (fecha_id)
-- dim_sucursal -> dim_region       (region_id)
-- dim_deposito -> dim_sucursal     (sucursal_id)
-- dim_vendedor -> dim_sucursal     (sucursal_id)
-- dim_producto -> dim_proveedor    (proveedor_id)
-- dim_cliente -> dim_region        (region_id)

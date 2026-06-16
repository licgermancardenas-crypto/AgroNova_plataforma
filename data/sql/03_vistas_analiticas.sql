-- ============================================================
-- AgroNova Argentina S.A. - Vistas Analiticas
-- Optimizadas para Power BI, Metabase y consultas ad-hoc
-- ============================================================

SET search_path TO agronova;

-- ── V1: Dashboard Comercial — KPIs de ventas por periodo ─────────

CREATE OR REPLACE VIEW v_ventas_diarias AS
SELECT
    f.fecha,
    f.año,
    f.trimestre,
    f.mes,
    f.mes_nombre,
    f.temporada_agricola,
    f.factor_estacional,
    s.nombre          AS sucursal,
    s.provincia,
    r.nombre_region   AS region,
    p.categoria       AS cat_producto,
    p.subcategoria,
    p.rotacion,
    c.segmento        AS segmento_cliente,
    c.tier_cliente,
    c.ciclo_vida,
    v.canal,
    v.estado,
    COUNT(*)                         AS n_transacciones,
    SUM(v.cantidad)                  AS unidades_vendidas,
    SUM(v.total_ars)                 AS revenue_ars,
    SUM(v.total_usd)                 AS revenue_usd,
    SUM(v.margen_bruto_ars)          AS margen_bruto_ars,
    AVG(v.total_ars)                 AS ticket_promedio_ars,
    AVG(v.descuento_pct)             AS descuento_promedio,
    AVG(v.margen_bruto_ars / NULLIF(v.total_ars, 0)) AS margen_pct_promedio
FROM fact_ventas v
JOIN dim_fecha    f ON v.fecha_id    = f.fecha_id
JOIN dim_sucursal s ON v.sucursal_id = s.sucursal_id
JOIN dim_region   r ON s.region_id   = r.region_id
JOIN dim_producto p ON v.producto_id = p.producto_id
JOIN dim_cliente  c ON v.cliente_id  = c.cliente_id
GROUP BY
    f.fecha, f.año, f.trimestre, f.mes, f.mes_nombre,
    f.temporada_agricola, f.factor_estacional,
    s.nombre, s.provincia, r.nombre_region,
    p.categoria, p.subcategoria, p.rotacion,
    c.segmento, c.tier_cliente, c.ciclo_vida,
    v.canal, v.estado;

COMMENT ON VIEW v_ventas_diarias IS 'Ventas diarias con todas las dimensiones. Base para dashboard comercial en Power BI';

-- ── V2: Analisis de Clientes — RFM base ──────────────────────────

CREATE OR REPLACE VIEW v_clientes_rfm AS
WITH ultima_compra AS (
    SELECT
        cliente_id,
        MAX(fecha_id)            AS ultima_fecha_id,
        COUNT(*)                 AS frecuencia,
        SUM(total_ars)           AS valor_total_ars,
        SUM(total_usd)           AS valor_total_usd,
        AVG(total_ars)           AS ticket_promedio_ars,
        COUNT(DISTINCT producto_id) AS productos_distintos,
        COUNT(DISTINCT LEFT(CAST(fecha_id AS TEXT), 4)::INT) AS años_activo
    FROM fact_ventas
    WHERE estado NOT IN ('Cancelada')
    GROUP BY cliente_id
)
SELECT
    c.cliente_id,
    c.razon_social,
    c.segmento,
    c.tier_cliente,
    c.ciclo_vida,
    c.provincia,
    c.sucursal_id_asignada,
    c.riesgo_crediticio,
    c.superficie_ha,
    c.volumen_factor,
    c.activo,
    -- RFM
    u.ultima_fecha_id,
    u.frecuencia,
    u.valor_total_ars,
    u.valor_total_usd,
    u.ticket_promedio_ars,
    u.productos_distintos,
    -- Recencia en dias (desde 2026-12-31)
    (20261231 - u.ultima_fecha_id)                             AS recencia_proxy,
    -- Monetario percentil (calculado en Power BI/app)
    u.valor_total_ars / NULLIF(u.frecuencia, 0)               AS valor_por_transaccion
FROM dim_cliente c
LEFT JOIN ultima_compra u ON c.cliente_id = u.cliente_id;

COMMENT ON VIEW v_clientes_rfm IS 'Base RFM por cliente: Recencia, Frecuencia, Valor. Usar en modelos churn y segmentacion';

-- ── V3: Pareto de Clientes ────────────────────────────────────────

CREATE OR REPLACE VIEW v_pareto_clientes AS
WITH rev_cliente AS (
    SELECT
        v.cliente_id,
        c.razon_social,
        c.segmento,
        c.tier_cliente,
        c.ciclo_vida,
        c.provincia,
        SUM(v.total_ars)   AS revenue_ars,
        SUM(v.total_usd)   AS revenue_usd,
        COUNT(*)            AS n_transacciones
    FROM fact_ventas v
    JOIN dim_cliente c ON v.cliente_id = c.cliente_id
    WHERE v.estado NOT IN ('Cancelada')
    GROUP BY v.cliente_id, c.razon_social, c.segmento, c.tier_cliente, c.ciclo_vida, c.provincia
),
totales AS (
    SELECT SUM(revenue_ars) AS total_ars FROM rev_cliente
)
SELECT
    rc.*,
    t.total_ars,
    rc.revenue_ars / t.total_ars * 100                AS pct_revenue,
    SUM(rc.revenue_ars) OVER (
        ORDER BY rc.revenue_ars DESC
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) / t.total_ars * 100                              AS pct_acumulado,
    RANK() OVER (ORDER BY rc.revenue_ars DESC)         AS ranking
FROM rev_cliente rc, totales t;

COMMENT ON VIEW v_pareto_clientes IS 'Pareto de clientes por revenue ARS. pct_acumulado permite identificar el corte 80/20';

-- ── V4: Estacionalidad — ventas por mes y categoria ──────────────

CREATE OR REPLACE VIEW v_estacionalidad AS
SELECT
    f.año,
    f.mes,
    f.mes_nombre,
    f.temporada_agricola,
    f.factor_estacional,
    p.categoria,
    SUM(v.total_ars)         AS revenue_ars,
    SUM(v.total_usd)         AS revenue_usd,
    COUNT(*)                  AS n_transacciones,
    SUM(v.cantidad)           AS unidades,
    AVG(v.total_ars)          AS ticket_promedio
FROM fact_ventas v
JOIN dim_fecha   f ON v.fecha_id   = f.fecha_id
JOIN dim_producto p ON v.producto_id = p.producto_id
WHERE v.estado NOT IN ('Cancelada')
GROUP BY f.año, f.mes, f.mes_nombre, f.temporada_agricola, f.factor_estacional, p.categoria;

COMMENT ON VIEW v_estacionalidad IS 'Revenue mensual por categoria y año. Evidencia estacionalidad agricola Oct-Nov y Abr-May';

-- ── V5: Performance de Vendedores ────────────────────────────────

CREATE OR REPLACE VIEW v_performance_vendedores AS
SELECT
    vnd.vendedor_id,
    vnd.nombre || ' ' || vnd.apellido  AS vendedor,
    vnd.categoria,
    vnd.zona_asignada,
    s.nombre                           AS sucursal,
    f.año,
    f.trimestre,
    COUNT(*)                           AS n_ventas,
    COUNT(DISTINCT v.cliente_id)       AS clientes_atendidos,
    SUM(v.total_ars)                   AS revenue_ars,
    AVG(v.total_ars)                   AS ticket_promedio,
    SUM(v.margen_bruto_ars)            AS margen_total,
    AVG(v.descuento_pct)               AS descuento_promedio
FROM fact_ventas v
JOIN dim_vendedor  vnd ON v.vendedor_id  = vnd.vendedor_id
JOIN dim_sucursal  s   ON v.sucursal_id  = s.sucursal_id
JOIN dim_fecha     f   ON v.fecha_id     = f.fecha_id
WHERE v.estado NOT IN ('Cancelada')
GROUP BY vnd.vendedor_id, vnd.nombre, vnd.apellido, vnd.categoria,
         vnd.zona_asignada, s.nombre, f.año, f.trimestre;

COMMENT ON VIEW v_performance_vendedores IS 'KPIs trimestrales por vendedor: revenue, ticket, margen, clientes atendidos';

-- ── V6: ABC de Productos ─────────────────────────────────────────

CREATE OR REPLACE VIEW v_abc_productos AS
WITH rev_prod AS (
    SELECT
        p.producto_id,
        p.nombre_producto,
        p.categoria,
        p.subcategoria,
        p.rotacion,
        p.precio_usd_base_2016,
        p.margen_bruto_pct,
        SUM(v.total_ars)   AS revenue_ars,
        SUM(v.cantidad)    AS unidades_vendidas,
        COUNT(*)            AS n_transacciones,
        COUNT(DISTINCT v.cliente_id) AS clientes_compraron
    FROM fact_ventas v
    JOIN dim_producto p ON v.producto_id = p.producto_id
    WHERE v.estado NOT IN ('Cancelada')
    GROUP BY p.producto_id, p.nombre_producto, p.categoria, p.subcategoria,
             p.rotacion, p.precio_usd_base_2016, p.margen_bruto_pct
),
totales AS (SELECT SUM(revenue_ars) AS total FROM rev_prod)
SELECT
    rp.*,
    rp.revenue_ars / t.total * 100                 AS pct_revenue,
    SUM(rp.revenue_ars) OVER (
        ORDER BY rp.revenue_ars DESC
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) / t.total * 100                               AS pct_acumulado,
    CASE
        WHEN SUM(rp.revenue_ars) OVER (
            ORDER BY rp.revenue_ars DESC
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) / t.total <= 0.80 THEN 'A'
        WHEN SUM(rp.revenue_ars) OVER (
            ORDER BY rp.revenue_ars DESC
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) / t.total <= 0.95 THEN 'B'
        ELSE 'C'
    END                                             AS clase_abc
FROM rev_prod rp, totales t;

COMMENT ON VIEW v_abc_productos IS 'Clasificacion ABC de productos por revenue. A=top 80%, B=sig 15%, C=ultimo 5%';

-- ── V7: Evolucion de Compras vs Ventas (supply chain) ────────────

CREATE OR REPLACE VIEW v_supply_chain_mensual AS
WITH compras_mes AS (
    SELECT
        LEFT(CAST(fecha_id AS TEXT), 6)::INT  AS año_mes,
        LEFT(CAST(fecha_id AS TEXT), 4)::INT  AS año,
        CAST(SUBSTR(CAST(fecha_id AS TEXT), 5, 2) AS INT) AS mes,
        SUM(total_ars)                         AS compras_ars,
        SUM(total_usd)                         AS compras_usd,
        COUNT(*)                               AS n_compras
    FROM fact_compras
    WHERE estado != 'Cancelada'
    GROUP BY 1, 2, 3
),
ventas_mes AS (
    SELECT
        LEFT(CAST(fecha_id AS TEXT), 6)::INT  AS año_mes,
        SUM(total_ars)                         AS ventas_ars,
        SUM(total_usd)                         AS ventas_usd,
        COUNT(*)                               AS n_ventas
    FROM fact_ventas
    WHERE estado != 'Cancelada'
    GROUP BY 1
)
SELECT
    c.año,
    c.mes,
    m.mes_nombre,
    c.compras_ars,
    c.compras_usd,
    c.n_compras,
    COALESCE(v.ventas_ars, 0)           AS ventas_ars,
    COALESCE(v.ventas_usd, 0)           AS ventas_usd,
    COALESCE(v.n_ventas, 0)             AS n_ventas,
    COALESCE(v.ventas_ars, 0) - c.compras_ars AS margen_comercial_ars,
    CASE WHEN c.compras_ars > 0
         THEN (COALESCE(v.ventas_ars, 0) - c.compras_ars) / c.compras_ars * 100
         ELSE NULL END                  AS markup_pct
FROM compras_mes c
LEFT JOIN ventas_mes v ON c.año_mes = v.año_mes
LEFT JOIN dim_fecha   m ON m.fecha_id = c.año_mes * 100 + 1
ORDER BY c.año, c.mes;

COMMENT ON VIEW v_supply_chain_mensual IS 'Compras vs Ventas por mes: markup, margen comercial, balance supply chain';

-- ── V8: Logistica — performance por ruta ─────────────────────────

CREATE OR REPLACE VIEW v_logistica_performance AS
SELECT
    f.año,
    f.mes,
    f.mes_nombre,
    d.nombre                    AS deposito_origen,
    r.nombre_region             AS region_destino,
    l.tipo_envio,
    l.transportista,
    COUNT(*)                    AS n_envios,
    AVG(l.dias_transito_base)   AS dias_base_promedio,
    AVG(l.dias_demora)          AS demora_promedio,
    AVG(l.dias_transito_real)   AS dias_real_promedio,
    SUM(l.peso_kg)              AS peso_total_kg,
    SUM(l.costo_flete_ars)      AS costo_total_ars,
    AVG(l.costo_flete_ars / NULLIF(l.peso_kg, 0)) AS costo_por_kg,
    SUM(CASE WHEN l.estado = 'Entregado' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) AS pct_entregado,
    SUM(CASE WHEN l.estado = 'Demorado'  THEN 1 ELSE 0 END) * 100.0 / COUNT(*) AS pct_demorado
FROM fact_logistica l
JOIN dim_fecha   f ON l.fecha_despacho_id = f.fecha_id
JOIN dim_deposito d ON l.deposito_origen_id = d.deposito_id
JOIN dim_region  r ON l.region_destino_id  = r.region_id
GROUP BY f.año, f.mes, f.mes_nombre, d.nombre, r.nombre_region, l.tipo_envio, l.transportista;

COMMENT ON VIEW v_logistica_performance IS 'Performance logistica por ruta, transportista y mes';

-- ── V9: Cotizaciones + Ventas — revenue dolarizado preciso ───────

CREATE OR REPLACE VIEW v_ventas_dolarizadas AS
SELECT
    v.venta_id,
    v.fecha_id,
    f.fecha,
    f.año,
    f.mes,
    v.cliente_id,
    v.producto_id,
    v.sucursal_id,
    v.total_ars,
    v.total_usd,
    -- USD al tipo de cambio oficial del dia
    v.total_ars / NULLIF(cot.usd_ars_oficial, 0)  AS total_usd_tc_oficial,
    -- USD al dolar blue del dia
    v.total_ars / NULLIF(cot.usd_ars_blue, 0)     AS total_usd_tc_blue,
    cot.usd_ars_oficial,
    cot.usd_ars_blue,
    -- Relacion con commodities del dia
    cot.soja_cbot_usd_ton,
    cot.urea_fob_usd_ton
FROM fact_ventas v
JOIN dim_fecha          f   ON v.fecha_id = f.fecha_id
LEFT JOIN cotizaciones_externas cot ON cot.fecha_id = v.fecha_id
WHERE v.estado NOT IN ('Cancelada');

COMMENT ON VIEW v_ventas_dolarizadas IS 'Ventas con TC diario: permite revenue USD preciso con tipo de cambio oficial y blue del dia';

-- ── V10: Resumen ejecutivo (KPI card para dashboard) ─────────────

CREATE OR REPLACE VIEW v_kpi_ejecutivo AS
SELECT
    'Total Ventas ARS'              AS kpi,
    SUM(total_ars)::NUMERIC(20,0)   AS valor,
    'ARS'                           AS unidad
FROM fact_ventas WHERE estado != 'Cancelada'
UNION ALL
SELECT 'Total Ventas USD', SUM(total_usd)::NUMERIC(16,0), 'USD'
FROM fact_ventas WHERE estado != 'Cancelada'
UNION ALL
SELECT 'N Transacciones', COUNT(*)::NUMERIC, 'txn'
FROM fact_ventas WHERE estado != 'Cancelada'
UNION ALL
SELECT 'Clientes Activos', COUNT(DISTINCT cliente_id)::NUMERIC, 'clientes'
FROM fact_ventas WHERE estado != 'Cancelada'
UNION ALL
SELECT 'Ticket Promedio ARS', AVG(total_ars)::NUMERIC(14,0), 'ARS'
FROM fact_ventas WHERE estado != 'Cancelada'
UNION ALL
SELECT 'Margen Bruto Prom', (AVG(margen_bruto_ars / NULLIF(total_ars,0)) * 100)::NUMERIC(5,2), '%'
FROM fact_ventas WHERE estado != 'Cancelada'
UNION ALL
SELECT 'Productos Activos', COUNT(*)::NUMERIC, 'productos'
FROM dim_producto WHERE activo = TRUE;

COMMENT ON VIEW v_kpi_ejecutivo IS 'KPIs ejecutivos para tarjetas de dashboard. Una fila por metrica';

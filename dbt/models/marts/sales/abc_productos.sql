{{
    config(
        materialized = 'table',
        tags         = ['sales', 'abc', 'producto']
    )
}}

-- Clasificacion ABC de productos basada en revenue acumulado
-- A: top 70% del revenue, B: siguiente 20%, C: restante 10%
-- Incluye velocidad de venta y estacionalidad por categoria

with ventas as (
    select
        producto_id,
        nombre_producto,
        producto_categoria,
        producto_subcategoria,
        producto_abc,
        producto_rotacion,
        nombre_proveedor,
        tipo_proveedor,
        es_completada,
        total_ars,
        total_usd,
        margen_bruto_ars,
        cantidad,
        anio,
        mes,
        venta_id,
        cliente_id
    from {{ ref('fct_ventas') }}
    where es_completada = true
),

revenue_por_producto as (
    select
        producto_id,
        max(nombre_producto)       as nombre_producto,
        max(producto_categoria)    as categoria,
        max(producto_subcategoria) as subcategoria,
        max(producto_abc)          as clasificacion_abc_dim,
        max(producto_rotacion)     as rotacion,
        max(nombre_proveedor)      as proveedor,
        max(tipo_proveedor)        as tipo_proveedor,

        sum(total_ars)             as revenue_total_ars,
        sum(total_usd)             as revenue_total_usd,
        sum(margen_bruto_ars)      as margen_total_ars,
        sum(cantidad)              as unidades_totales,
        count(distinct venta_id)   as n_transacciones,
        count(distinct cliente_id) as n_clientes_unicos,
        count(distinct anio)       as anos_con_ventas

    from ventas
    group by producto_id
),

totales as (
    select
        sum(revenue_total_ars) as revenue_global_ars,
        count(*)               as total_productos
    from revenue_por_producto
),

ranking as (
    select
        p.*,
        t.revenue_global_ars,
        t.total_productos,

        row_number() over (order by p.revenue_total_ars desc) as rank_revenue,

        round(p.revenue_total_ars / nullif(t.revenue_global_ars, 0) * 100, 4) as pct_revenue,

        sum(p.revenue_total_ars) over (
            order by p.revenue_total_ars desc
            rows between unbounded preceding and current row
        ) / nullif(t.revenue_global_ars, 0)                   as pct_acumulado

    from revenue_por_producto p
    cross join totales t
),

final as (
    select
        producto_id,
        nombre_producto,
        categoria,
        subcategoria,
        proveedor,
        tipo_proveedor,
        rotacion,
        rank_revenue,
        total_productos,

        round(revenue_total_ars::numeric, 0) as revenue_total_ars,
        round(revenue_total_usd::numeric, 2) as revenue_total_usd,
        round(margen_total_ars::numeric, 0)  as margen_total_ars,
        unidades_totales,
        n_transacciones,
        n_clientes_unicos,
        anos_con_ventas,

        pct_revenue,
        round(pct_acumulado * 100, 4) as pct_revenue_acumulado,

        -- Clasificacion ABC calculada en dbt (autoritativa)
        case
            when pct_acumulado <= 0.70 then 'A'
            when pct_acumulado <= 0.90 then 'B'
            else 'C'
        end as clasificacion_abc,

        -- Clasificacion original de la dimension (para comparar)
        clasificacion_abc_dim,

        -- Margen %
        case when revenue_total_ars > 0
            then round(margen_total_ars / revenue_total_ars * 100, 2)
            else 0
        end as margen_pct,

        -- Velocidad de venta (unidades por año promedio)
        case when anos_con_ventas > 0
            then round(unidades_totales::numeric / anos_con_ventas, 0)
            else 0
        end as unidades_por_ano,

        -- Concentracion: clientes distintos / transacciones (baja = concentrado en pocos clientes)
        case when n_transacciones > 0
            then round(n_clientes_unicos::numeric / n_transacciones * 100, 2)
            else 0
        end as indice_dispersion_clientes

    from ranking
)

select * from final
order by rank_revenue

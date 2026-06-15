{{
    config(
        materialized = 'table',
        tags         = ['sales', 'aggregate', 'regional']
    )
}}

-- Revenue por region, con desglose por categoria de producto y año
-- Granularidad: anio x region x categoria

with ventas as (
    select
        anio,
        cliente_region,
        producto_categoria,
        temporada_agricola,
        es_completada,
        total_ars,
        total_usd,
        margen_bruto_ars,
        cantidad,
        cliente_id,
        producto_id,
        venta_id
    from {{ ref('fct_ventas') }}
),

region_anio as (
    select
        anio,
        cliente_region              as region,
        producto_categoria          as categoria,
        temporada_agricola,

        count(distinct venta_id)                          as n_ventas,
        count(distinct cliente_id)                        as n_clientes,
        count(distinct producto_id)                       as n_productos,
        sum(case when es_completada then cantidad  end)   as unidades,
        sum(case when es_completada then total_ars end)   as revenue_ars,
        sum(case when es_completada then total_usd end)   as revenue_usd,
        sum(case when es_completada then margen_bruto_ars end) as margen_ars

    from ventas
    group by 1, 2, 3, 4
),

-- Total por region x año (para calcular % de participacion)
total_por_anio as (
    select
        anio,
        sum(case when es_completada then total_ars end) as revenue_total_ars
    from ventas
    group by 1
),

final as (
    select
        r.anio,
        r.region,
        r.categoria,
        r.temporada_agricola,
        r.n_ventas,
        r.n_clientes,
        r.n_productos,
        r.unidades,
        round(r.revenue_ars::numeric, 0)  as revenue_ars,
        round(r.revenue_usd::numeric, 2)  as revenue_usd,
        round(r.margen_ars::numeric, 0)   as margen_ars,

        -- Margen %
        case when r.revenue_ars > 0
            then round(r.margen_ars / r.revenue_ars * 100, 2)
            else 0
        end as margen_pct,

        -- Participacion en el revenue total del año
        case when t.revenue_total_ars > 0
            then round(r.revenue_ars / t.revenue_total_ars * 100, 3)
            else 0
        end as pct_revenue_total,

        -- Ticket promedio por cliente
        case when r.n_clientes > 0
            then round(r.revenue_ars / r.n_clientes, 0)
            else 0
        end as revenue_por_cliente_ars

    from region_anio r
    left join total_por_anio t on t.anio = r.anio
)

select * from final
order by anio desc, revenue_ars desc

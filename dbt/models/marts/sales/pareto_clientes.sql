{{
    config(
        materialized = 'table',
        tags         = ['sales', 'pareto', 'cliente']
    )
}}

-- Curva de Pareto de clientes por revenue acumulado
-- Permite identificar el 20% de clientes que generan el 80% del revenue
-- Una fila por cliente, ordenada de mayor a menor revenue

with ventas_completadas as (
    select
        cliente_id,
        cliente_razon_social,
        tier_cliente,
        cliente_segmento,
        cliente_region,
        es_completada,
        total_ars,
        total_usd,
        margen_bruto_ars,
        venta_id,
        anio
    from {{ ref('fct_ventas') }}
    where es_completada = true
),

revenue_por_cliente as (
    select
        cliente_id,
        max(cliente_razon_social)  as razon_social,
        max(tier_cliente)          as tier_cliente,
        max(cliente_segmento)      as segmento,
        max(cliente_region)        as region,

        sum(total_ars)             as revenue_total_ars,
        sum(total_usd)             as revenue_total_usd,
        sum(margen_bruto_ars)      as margen_total_ars,
        count(distinct venta_id)   as n_transacciones,
        count(distinct anio)       as anos_activo

    from ventas_completadas
    group by cliente_id
),

-- Revenue global para calcular porcentajes
totales as (
    select
        sum(revenue_total_ars) as revenue_global_ars,
        count(distinct cliente_id) as total_clientes
    from revenue_por_cliente
),

ranking as (
    select
        r.*,
        t.revenue_global_ars,
        t.total_clientes,

        -- Ranking por revenue (1 = mayor)
        row_number() over (order by r.revenue_total_ars desc) as rank_revenue,

        -- % del revenue total
        round(r.revenue_total_ars / nullif(t.revenue_global_ars, 0) * 100, 4) as pct_revenue,

        -- Acumulado (para curva de Pareto)
        sum(r.revenue_total_ars) over (
            order by r.revenue_total_ars desc
            rows between unbounded preceding and current row
        )                          as revenue_acumulado_ars,

        round(
            sum(r.revenue_total_ars) over (
                order by r.revenue_total_ars desc
                rows between unbounded preceding and current row
            ) / nullif(t.revenue_global_ars, 0) * 100
        , 4)                       as pct_revenue_acumulado

    from revenue_por_cliente r
    cross join totales t
),

final as (
    select
        cliente_id,
        razon_social,
        tier_cliente,
        segmento,
        region,
        rank_revenue,
        total_clientes,

        -- Metricas
        round(revenue_total_ars::numeric, 0)  as revenue_total_ars,
        round(revenue_total_usd::numeric, 2)  as revenue_total_usd,
        round(margen_total_ars::numeric, 0)   as margen_total_ars,
        n_transacciones,
        anos_activo,

        -- Pareto
        pct_revenue,
        pct_revenue_acumulado,
        round(revenue_acumulado_ars::numeric, 0) as revenue_acumulado_ars,
        round(revenue_global_ars::numeric, 0)    as revenue_global_ars,

        -- Percentil de cliente (0-100, 100 = top)
        round(
            (1 - (rank_revenue::numeric - 1) / nullif(total_clientes - 1, 0)) * 100
        , 2)                                  as percentil_revenue,

        -- Clasificacion Pareto
        case
            when pct_revenue_acumulado <= 50  then 'Top 50%'
            when pct_revenue_acumulado <= 70  then 'Top 70%'
            when pct_revenue_acumulado <= 80  then 'Top 80%'
            when pct_revenue_acumulado <= 90  then 'Top 90%'
            else 'Long Tail'
        end as segmento_pareto,

        -- Margen %
        case when revenue_total_ars > 0
            then round(margen_total_ars / revenue_total_ars * 100, 2)
            else 0
        end as margen_pct

    from ranking
)

select * from final
order by rank_revenue

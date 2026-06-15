{{
    config(
        materialized = 'table',
        tags         = ['finance', 'margin', 'cliente']
    )
}}

-- Rentabilidad por cliente: margen bruto, LTV en USD, comparacion por tier
-- Insumo clave para decision de pricing, descuentos y terminos crediticios

with ventas as (
    select
        cliente_id,
        cliente_razon_social,
        tier_cliente,
        cliente_segmento,
        cliente_region,
        anio,
        es_completada,
        total_ars,
        revenue_usd_tc_real,
        margen_bruto_ars,
        descuento_pct,
        cantidad,
        venta_id
    from {{ ref('fct_ventas') }}
    where es_completada = true
),

por_cliente_anio as (
    select
        cliente_id,
        max(cliente_razon_social)  as razon_social,
        max(tier_cliente)          as tier_cliente,
        max(cliente_segmento)      as segmento,
        max(cliente_region)        as region,
        anio,

        count(distinct venta_id)   as n_transacciones,
        sum(cantidad)              as unidades,
        sum(total_ars)             as revenue_ars,
        sum(revenue_usd_tc_real)   as revenue_usd_real,
        sum(margen_bruto_ars)      as margen_ars,
        avg(descuento_pct)         as descuento_promedio

    from ventas
    group by cliente_id, anio
),

-- LTV: suma acumulada por cliente
ltv as (
    select
        cliente_id,
        sum(revenue_ars)     as ltv_ars,
        sum(revenue_usd_real) as ltv_usd,
        sum(margen_ars)      as ltv_margen_ars,
        count(distinct anio) as anos_activo
    from por_cliente_anio
    group by cliente_id
),

-- Promedio de margen por tier (para comparar cliente vs benchmark de su tier)
benchmark_tier as (
    select
        tier_cliente,
        anio,
        avg(margen_ars / nullif(revenue_ars, 0)) as margen_pct_promedio_tier
    from por_cliente_anio
    group by tier_cliente, anio
),

final as (
    select
        p.cliente_id,
        p.razon_social,
        p.tier_cliente,
        p.segmento,
        p.region,
        p.anio,

        p.n_transacciones,
        p.unidades,
        round(p.revenue_ars::numeric, 0)                    as revenue_ars,
        round(p.revenue_usd_real::numeric, 2)               as revenue_usd_real,
        round(p.margen_ars::numeric, 0)                     as margen_ars,
        round(p.descuento_promedio * 100, 2)                as descuento_promedio_pct,

        -- Margen % del cliente
        case when p.revenue_ars > 0
            then round(p.margen_ars / p.revenue_ars * 100, 2)
            else 0
        end as margen_pct,

        -- Benchmark del tier para ese año
        round(b.margen_pct_promedio_tier * 100, 2)          as margen_pct_promedio_tier,

        -- Delta vs benchmark (positivo = por encima del promedio de su tier)
        case
            when p.revenue_ars > 0 and b.margen_pct_promedio_tier is not null
            then round(
                (p.margen_ars / p.revenue_ars - b.margen_pct_promedio_tier) * 100
            , 2)
            else null
        end as delta_vs_tier_pct,

        -- LTV historico
        round(l.ltv_ars::numeric, 0)                        as ltv_total_ars,
        round(l.ltv_usd::numeric, 2)                        as ltv_total_usd,
        round(l.ltv_margen_ars::numeric, 0)                 as ltv_margen_ars,
        l.anos_activo,

        -- Clasificacion de rentabilidad del cliente
        case
            when p.margen_ars / nullif(p.revenue_ars, 0) >= 0.25 then 'Muy_Rentable'
            when p.margen_ars / nullif(p.revenue_ars, 0) >= 0.18 then 'Rentable'
            when p.margen_ars / nullif(p.revenue_ars, 0) >= 0.10 then 'Margen_Bajo'
            else 'No_Rentable'
        end as clasificacion_rentabilidad

    from por_cliente_anio p
    left join ltv            l on l.cliente_id  = p.cliente_id
    left join benchmark_tier b on b.tier_cliente = p.tier_cliente
                              and b.anio         = p.anio
)

select * from final
order by anio desc, margen_ars desc

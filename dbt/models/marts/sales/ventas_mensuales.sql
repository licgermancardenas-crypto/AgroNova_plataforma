{{
    config(
        materialized = 'table',
        tags         = ['sales', 'aggregate', 'monthly']
    )
}}

-- Ventas mensuales agregadas con comparativa YoY y MoM
-- Granularidad: anio x mes x sucursal

with base as (
    select
        anio,
        mes,
        mes_nombre,
        trimestre,
        semestre,
        temporada_agricola,
        nombre_sucursal,
        sucursal_id,

        -- Metricas del periodo
        count(distinct venta_id)                         as n_transacciones,
        count(distinct cliente_id)                       as n_clientes_activos,
        count(distinct producto_id)                      as n_productos_vendidos,
        sum(case when es_completada then cantidad  end)  as unidades_vendidas,
        sum(case when es_completada then total_ars end)  as revenue_ars,
        sum(case when es_completada then total_usd end)  as revenue_usd,
        sum(case when es_completada then margen_bruto_ars end) as margen_ars,
        avg(case when es_completada then total_ars end)  as ticket_promedio_ars,
        sum(case when es_completada
                 and descuento_pct > 0 then total_ars end) as revenue_con_descuento_ars

    from {{ ref('fct_ventas') }}
    group by 1, 2, 3, 4, 5, 6, 7, 8
),

-- Mismo periodo del año anterior para YoY
yoy as (
    select
        anio + 1    as anio_actual,
        mes,
        sucursal_id,
        revenue_ars as revenue_ars_yoy,
        revenue_usd as revenue_usd_yoy,
        n_clientes_activos as clientes_yoy
    from base
),

-- Mes anterior para MoM (simplificado: mismo mes anterior)
mom as (
    select
        anio,
        mes + 1 as mes_actual,
        sucursal_id,
        revenue_ars as revenue_ars_mom
    from base
    where mes < 12
    union all
    select
        anio + 1,
        1,
        sucursal_id,
        revenue_ars
    from base
    where mes = 12
),

final as (
    select
        b.anio,
        b.mes,
        b.mes_nombre,
        b.trimestre,
        b.semestre,
        b.temporada_agricola,
        b.sucursal_id,
        b.nombre_sucursal,

        -- Metricas del periodo
        b.n_transacciones,
        b.n_clientes_activos,
        b.n_productos_vendidos,
        b.unidades_vendidas,
        round(b.revenue_ars::numeric, 0)       as revenue_ars,
        round(b.revenue_usd::numeric, 2)       as revenue_usd,
        round(b.margen_ars::numeric, 0)        as margen_ars,
        round(b.ticket_promedio_ars::numeric, 0) as ticket_promedio_ars,

        -- Margen %
        case when b.revenue_ars > 0
            then round(b.margen_ars / b.revenue_ars * 100, 2)
            else 0
        end as margen_pct,

        -- YoY
        round(y.revenue_ars_yoy::numeric, 0) as revenue_ars_yoy,
        case when y.revenue_ars_yoy > 0
            then round((b.revenue_ars - y.revenue_ars_yoy) / y.revenue_ars_yoy * 100, 2)
            else null
        end as revenue_ars_crecimiento_yoy_pct,

        round(y.revenue_usd_yoy::numeric, 2) as revenue_usd_yoy,
        case when y.revenue_usd_yoy > 0
            then round((b.revenue_usd - y.revenue_usd_yoy) / y.revenue_usd_yoy * 100, 2)
            else null
        end as revenue_usd_crecimiento_yoy_pct,

        -- MoM
        round(m.revenue_ars_mom::numeric, 0) as revenue_ars_mes_anterior,
        case when m.revenue_ars_mom > 0
            then round((b.revenue_ars - m.revenue_ars_mom) / m.revenue_ars_mom * 100, 2)
            else null
        end as revenue_ars_crecimiento_mom_pct

    from base b
    left join yoy y on y.anio_actual = b.anio
                   and y.mes         = b.mes
                   and y.sucursal_id = b.sucursal_id
    left join mom m on m.anio        = b.anio
                   and m.mes_actual  = b.mes
                   and m.sucursal_id = b.sucursal_id
)

select * from final
order by anio desc, mes desc, nombre_sucursal

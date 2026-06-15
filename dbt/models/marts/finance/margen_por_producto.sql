{{
    config(
        materialized = 'table',
        tags         = ['finance', 'margin', 'producto']
    )
}}

-- Analisis de margen bruto por producto, con tendencia anual
-- Permite identificar erosion de margen y productos mas rentables

with ventas as (
    select
        producto_id,
        nombre_producto,
        producto_categoria,
        producto_subcategoria,
        clasificacion_abc         as abc,
        nombre_proveedor,
        tipo_proveedor,
        anio,
        es_completada,
        cantidad,
        total_ars,
        total_usd,
        margen_bruto_ars,
        descuento_pct,
        precio_unitario_usd,
        tc_dia
    from {{ ref('fct_ventas') }}
    where es_completada = true
),

por_producto_anio as (
    select
        producto_id,
        max(nombre_producto)       as nombre_producto,
        max(producto_categoria)    as categoria,
        max(producto_subcategoria) as subcategoria,
        max(abc)                   as clasificacion_abc,
        max(nombre_proveedor)      as proveedor,
        max(tipo_proveedor)        as tipo_proveedor,
        anio,

        count(distinct venta_id)                   as n_ventas,
        sum(cantidad)                              as unidades,
        sum(total_ars)                             as revenue_ars,
        sum(total_usd)                             as revenue_usd,
        sum(margen_bruto_ars)                      as margen_ars,
        avg(descuento_pct)                         as descuento_promedio,
        avg(precio_unitario_usd)                   as precio_usd_promedio,
        avg(tc_dia)                                as tc_promedio

    from ventas
    group by producto_id, anio
),

-- Margen del año anterior para calcular tendencia
margen_yoy as (
    select
        producto_id,
        anio + 1                        as anio_siguiente,
        margen_ars / nullif(revenue_ars, 0) as margen_pct_anterior
    from por_producto_anio
),

final as (
    select
        p.producto_id,
        p.nombre_producto,
        p.categoria,
        p.subcategoria,
        p.clasificacion_abc,
        p.proveedor,
        p.tipo_proveedor,
        p.anio,

        p.n_ventas,
        p.unidades,
        round(p.revenue_ars::numeric, 0)                    as revenue_ars,
        round(p.revenue_usd::numeric, 2)                    as revenue_usd,
        round(p.margen_ars::numeric, 0)                     as margen_ars,

        -- Margen %
        case when p.revenue_ars > 0
            then round(p.margen_ars / p.revenue_ars * 100, 2)
            else 0
        end as margen_pct,

        round(p.descuento_promedio * 100, 2)                as descuento_promedio_pct,
        round(p.precio_usd_promedio::numeric, 2)            as precio_usd_promedio,
        round(p.tc_promedio::numeric, 2)                    as tc_promedio,

        -- Margen en USD (para productos importados)
        case when p.tc_promedio > 0
            then round(p.margen_ars / p.tc_promedio, 2)
            else null
        end as margen_usd,

        -- Tendencia YoY de margen %
        round(m.margen_pct_anterior * 100, 2)               as margen_pct_anio_anterior,
        case
            when m.margen_pct_anterior is not null and p.revenue_ars > 0
            then round(
                (p.margen_ars / p.revenue_ars - m.margen_pct_anterior) * 100
            , 2)
            else null
        end as variacion_margen_pct_yoy,

        -- Clasificacion de rentabilidad
        case
            when p.margen_ars / nullif(p.revenue_ars, 0) >= 0.35 then 'Alta_Rentabilidad'
            when p.margen_ars / nullif(p.revenue_ars, 0) >= 0.20 then 'Rentabilidad_Media'
            when p.margen_ars / nullif(p.revenue_ars, 0) >= 0.10 then 'Rentabilidad_Baja'
            else 'Bajo_Umbral'
        end as clasificacion_rentabilidad

    from por_producto_anio p
    left join margen_yoy m on m.producto_id    = p.producto_id
                          and m.anio_siguiente = p.anio
)

select * from final
order by anio desc, margen_ars desc

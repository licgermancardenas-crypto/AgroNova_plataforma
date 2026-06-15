{{
    config(
        materialized = 'table',
        tags         = ['core', 'dimensions', 'producto']
    )
}}

with productos as (
    select * from {{ ref('stg_productos') }}
),

proveedores as (
    select
        proveedor_id,
        nombre_proveedor,
        tipo       as tipo_proveedor,
        pais       as pais_proveedor
    from {{ source('agronova_raw', 'dim_proveedor') }}
),

ventas_por_producto as (
    select
        producto_id,
        count(distinct venta_id)                             as total_ventas,
        sum(case when es_completada then cantidad  end)      as unidades_vendidas,
        sum(case when es_completada then total_ars end)      as revenue_total_ars,
        sum(case when es_completada then total_usd end)      as revenue_total_usd,
        sum(case when es_completada then margen_bruto_ars end) as margen_total_ars,
        avg(case when es_completada then precio_unitario_usd end) as precio_promedio_usd
    from {{ ref('stg_ventas') }}
    group by producto_id
),

-- Clasificacion ABC basada en revenue acumulado
revenue_rank as (
    select
        producto_id,
        revenue_total_ars,
        sum(revenue_total_ars) over ()                             as revenue_global,
        sum(revenue_total_ars) over (
            order by revenue_total_ars desc
            rows between unbounded preceding and current row
        )                                                          as revenue_acumulado
    from ventas_por_producto
),

abc as (
    select
        producto_id,
        case
            when revenue_acumulado / nullif(revenue_global, 0) <= 0.70 then 'A'
            when revenue_acumulado / nullif(revenue_global, 0) <= 0.90 then 'B'
            else 'C'
        end as clasificacion_abc
    from revenue_rank
),

final as (
    select
        -- Identificacion
        p.producto_id,
        p.nombre_producto,
        p.categoria,
        p.subcategoria,

        -- Proveedor
        p.proveedor_id,
        pr.nombre_proveedor,
        pr.tipo_proveedor,
        pr.pais_proveedor,

        -- Precios y margenes
        p.precio_usd_base_2016,
        p.margen_bruto_pct,
        round((p.margen_bruto_pct * 100)::numeric, 1) as margen_bruto_pct_display,

        -- Atributos
        p.rotacion,
        p.requiere_frio,
        p.activo,
        p.segmento_precio,
        p.es_alto_margen,

        -- ABC (calculado en dbt)
        coalesce(abc.clasificacion_abc, 'C') as clasificacion_abc,

        -- Metricas de ventas
        coalesce(v.total_ventas,      0) as total_ventas,
        coalesce(v.unidades_vendidas, 0) as unidades_vendidas,
        coalesce(v.revenue_total_ars, 0) as revenue_total_ars,
        coalesce(v.revenue_total_usd, 0) as revenue_total_usd,
        coalesce(v.margen_total_ars,  0) as margen_total_ars,
        v.precio_promedio_usd,

        -- Margen real (puede diferir del pct base por descuentos)
        case
            when v.revenue_total_ars > 0
            then round(v.margen_total_ars / v.revenue_total_ars * 100, 2)
            else 0
        end as margen_real_pct

    from productos p
    left join proveedores         pr on pr.proveedor_id = p.proveedor_id
    left join ventas_por_producto  v on v.producto_id   = p.producto_id
    left join abc                    on abc.producto_id = p.producto_id
)

select * from final

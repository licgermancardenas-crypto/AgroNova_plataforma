{{
    config(
        materialized = 'table',
        tags         = ['core', 'dimensions', 'vendedor']
    )
}}

with vendedores as (
    select * from {{ source('agronova_raw', 'dim_vendedor') }}
),

sucursales as (
    select
        sucursal_id,
        nombre as nombre_sucursal,
        ciudad,
        provincia,
        region_id
    from {{ source('agronova_raw', 'dim_sucursal') }}
),

regiones as (
    select region_id, nombre_region
    from {{ source('agronova_raw', 'dim_region') }}
),

ventas_por_vendedor as (
    select
        vendedor_id,
        count(distinct venta_id)                             as total_ventas,
        count(distinct cliente_id)                           as clientes_atendidos,
        sum(case when es_completada then total_ars end)      as revenue_total_ars,
        sum(case when es_completada then total_usd end)      as revenue_total_usd,
        sum(case when es_completada then margen_bruto_ars end) as margen_total_ars,
        avg(case when es_completada then total_ars end)      as ticket_promedio_ars,
        max(fecha)                                           as ultima_venta
    from {{ ref('stg_ventas') }}
    group by vendedor_id
),

final as (
    select
        -- Identificacion
        v.vendedor_id,
        v.nombre || ' ' || v.apellido as nombre_completo,
        v.nombre,
        v.apellido,
        v.email,
        v.categoria,
        v.activo,
        v.fecha_ingreso,

        -- Sucursal y region
        v.sucursal_id,
        s.nombre_sucursal,
        s.ciudad,
        s.provincia,
        s.region_id,
        r.nombre_region,

        -- Metricas de performance
        coalesce(p.total_ventas,       0) as total_ventas,
        coalesce(p.clientes_atendidos, 0) as clientes_atendidos,
        coalesce(p.revenue_total_ars,  0) as revenue_total_ars,
        coalesce(p.revenue_total_usd,  0) as revenue_total_usd,
        coalesce(p.margen_total_ars,   0) as margen_total_ars,
        p.ticket_promedio_ars,
        p.ultima_venta,

        -- Margen %
        case
            when p.revenue_total_ars > 0
            then round(p.margen_total_ars / p.revenue_total_ars * 100, 2)
            else 0
        end as margen_pct,

        -- Ranking dentro de su sucursal (para dashboards de performance)
        rank() over (
            partition by v.sucursal_id
            order by coalesce(p.revenue_total_ars, 0) desc
        ) as rank_revenue_en_sucursal

    from vendedores v
    left join sucursales          s on s.sucursal_id = v.sucursal_id
    left join regiones            r on r.region_id   = s.region_id
    left join ventas_por_vendedor p on p.vendedor_id = v.vendedor_id
)

select * from final

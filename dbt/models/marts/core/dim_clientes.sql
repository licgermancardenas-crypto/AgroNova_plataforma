{{
    config(
        materialized = 'table',
        tags         = ['core', 'dimensions', 'cliente']
    )
}}

with clientes as (
    select * from {{ ref('stg_clientes') }}
),

regiones as (
    select
        region_id,
        nombre_region,
        provincia_principal
    from {{ source('agronova_raw', 'dim_region') }}
),

ventas_resumen as (
    select
        cliente_id,
        count(distinct venta_id)                       as total_transacciones,
        sum(case when es_completada then total_ars end) as revenue_total_ars,
        sum(case when es_completada then total_usd end) as revenue_total_usd,
        max(fecha)                                     as ultima_compra,
        min(fecha)                                     as primera_compra
    from {{ ref('stg_ventas') }}
    group by cliente_id
),

final as (
    select
        -- Identificacion
        c.cliente_id,
        c.razon_social,
        c.cuit,

        -- Segmentacion
        c.segmento,
        c.ciclo_vida,
        c.tier_cliente,
        c.volumen_factor,

        -- Descripcion del tier (para dashboards)
        case c.tier_cliente
            when 'A' then 'Tier A — Top 10% (77%+ revenue)'
            when 'B' then 'Tier B — Siguiente 20%'
            when 'C' then 'Tier C — Medio 30%'
            when 'D' then 'Tier D — Largo tail 40%'
        end as tier_descripcion,

        -- Geografia
        c.provincia,
        c.region_id,
        r.nombre_region,
        r.provincia_principal as provincia_region,

        -- Ciclo de vida
        c.anio_alta,
        c.anio_baja,
        c.activo,
        c.is_churned,
        c.antiguedad_anos,

        -- Credito
        c.riesgo_crediticio,
        c.limite_credito_usd,
        c.superficie_ha,

        -- Metricas de compra (enriquecimiento desde ventas)
        coalesce(v.total_transacciones, 0)   as total_transacciones,
        coalesce(v.revenue_total_ars, 0)     as revenue_total_ars,
        coalesce(v.revenue_total_usd, 0)     as revenue_total_usd,
        v.primera_compra,
        v.ultima_compra,

        -- Dias desde ultima compra (para RFM)
        case
            when v.ultima_compra is not null
            then current_date - v.ultima_compra::date
            else null
        end as dias_desde_ultima_compra,

        -- Flag de cliente valioso (tier A o B con compras recientes)
        case
            when c.tier_cliente in ('A', 'B')
                 and c.activo = true
                 and v.ultima_compra >= current_date - interval '{{ var("rfm_recency_days") }} days'
            then true
            else false
        end as es_cliente_vip_activo

    from clientes c
    left join regiones     r on r.region_id   = c.region_id
    left join ventas_resumen v on v.cliente_id = c.cliente_id
)

select * from final

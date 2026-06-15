{{
    config(
        materialized = 'view',
        tags         = ['staging', 'logistica']
    )
}}

with source as (
    select * from {{ source('agronova_raw', 'fact_logistica') }}
),

fechas_despacho as (
    select fecha_id, fecha as fecha_despacho, ano as anio, mes, trimestre
    from {{ source('agronova_raw', 'dim_fecha') }}
),

renamed as (
    select
        l.logistica_id,

        -- FKs
        l.fecha_despacho_id,
        l.fecha_entrega_id,
        l.cliente_id,
        l.deposito_origen_id,
        l.region_destino_id,

        -- Atributos
        l.transportista,
        l.estado,
        l.dias_transito_base,
        l.dias_transito_real,
        l.costo_flete_ars,
        l.peso_kg,
        l.volumen_m3,

        -- Fecha despacho desnormalizada
        fd.fecha_despacho,
        fd.anio,
        fd.mes,
        fd.trimestre,

        -- Metricas derivadas
        l.dias_transito_real - l.dias_transito_base as dias_demora,

        case
            when l.estado = 'Entregado'
                 and l.dias_transito_real <= l.dias_transito_base then 'A_Tiempo'
            when l.estado = 'Entregado'
                 and l.dias_transito_real > l.dias_transito_base  then 'Demorado'
            when l.estado = 'Demorado'                            then 'Demorado'
            when l.estado = 'En_transito'                         then 'En_Transito'
            else 'Cancelado'
        end as resultado_entrega,

        case
            when l.peso_kg > 0 and l.costo_flete_ars > 0
            then round(l.costo_flete_ars / l.peso_kg, 2)
            else null
        end as costo_por_kg_ars

    from source l
    left join fechas_despacho fd on fd.fecha_id = l.fecha_despacho_id
)

select * from renamed

{{
    config(
        materialized = 'view',
        tags         = ['staging', 'compras']
    )
}}

with source as (
    select * from {{ source('agronova_raw', 'fact_compras') }}
),

fechas as (
    select fecha_id, fecha, ano as anio, mes, trimestre
    from {{ source('agronova_raw', 'dim_fecha') }}
),

renamed as (
    select
        c.compra_id,

        -- FKs
        c.fecha_id,
        c.proveedor_id,
        c.producto_id,
        c.deposito_destino_id,

        -- Atributos
        c.estado,
        c.nro_orden_compra,
        c.puerto_ingreso,

        -- Metricas
        c.cantidad,
        c.precio_compra_ars,
        c.precio_compra_usd,
        c.total_ars,
        c.total_usd,

        -- Fecha desnormalizada
        f.fecha,
        f.anio,
        f.mes,
        f.trimestre,

        -- Flags
        case when c.puerto_ingreso is not null then true else false end as es_importacion,
        case when c.estado = 'Recibida'        then true else false end as es_recibida

    from source c
    left join fechas f on f.fecha_id = c.fecha_id
)

select * from renamed

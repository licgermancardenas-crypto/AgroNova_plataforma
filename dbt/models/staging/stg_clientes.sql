{{
    config(
        materialized = 'view',
        tags         = ['staging', 'cliente']
    )
}}

with source as (
    select * from {{ source('agronova_raw', 'dim_cliente') }}
),

renamed as (
    select
        -- PK
        cliente_id,

        -- Identificacion
        razon_social,
        cuit,

        -- Segmentacion
        segmento,
        ciclo_vida,
        tier_cliente,

        -- Pareto
        volumen_factor,

        -- Geografia
        provincia,
        region_id,

        -- Ciclo de vida
        ano_alta          as anio_alta,
        ano_baja          as anio_baja,
        activo,

        -- Credito
        riesgo_crediticio,
        limite_credito_usd,

        -- Agro
        superficie_ha,

        -- Columnas derivadas para facilitar downstream
        case
            when ano_baja is not null then true
            else false
        end as is_churned,

        case
            when ano_baja is not null
            then ano_baja - ano_alta
            else date_part('year', current_date) - ano_alta
        end as antiguedad_anos

    from source
)

select * from renamed

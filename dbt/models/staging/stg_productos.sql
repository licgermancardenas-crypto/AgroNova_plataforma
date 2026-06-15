{{
    config(
        materialized = 'view',
        tags         = ['staging', 'producto']
    )
}}

with source as (
    select * from {{ source('agronova_raw', 'dim_producto') }}
),

renamed as (
    select
        -- PK
        producto_id,

        -- Identificacion
        nombre_producto,
        categoria,
        subcategoria,
        proveedor_id,

        -- Precios y margenes
        precio_usd_base_2016,
        margen_bruto_pct,

        -- Atributos logisticos
        rotacion,
        requiere_frio,
        activo,

        -- Clasificacion ABC inicial (se refinara en marts)
        -- Por ahora: proxy basado en precio unitario
        case
            when precio_usd_base_2016 >= 500 then 'Premium'
            when precio_usd_base_2016 >= 100 then 'Estandar'
            else 'Economico'
        end as segmento_precio,

        -- Flag de producto de alto margen (>= 30%)
        case
            when margen_bruto_pct >= 0.30 then true
            else false
        end as es_alto_margen

    from source
)

select * from renamed

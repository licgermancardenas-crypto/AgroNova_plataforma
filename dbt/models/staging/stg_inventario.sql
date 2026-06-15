{{
    config(
        materialized = 'view',
        tags         = ['staging', 'inventario']
    )
}}

with source as (
    select * from {{ source('agronova_raw', 'fact_inventario') }}
),

fechas as (
    select fecha_id, fecha, ano as anio, mes
    from {{ source('agronova_raw', 'dim_fecha') }}
),

renamed as (
    select
        i.inventario_id,

        -- FKs
        i.fecha_id,
        i.producto_id,
        i.deposito_id,

        -- Stock
        i.stock_actual,
        i.stock_minimo,
        i.stock_maximo,
        i.valor_stock_ars,
        i.merma_pct,
        i.bajo_minimo,

        -- Fecha
        f.fecha,
        f.anio,
        f.mes,

        -- Metricas derivadas
        i.stock_maximo - i.stock_actual                       as capacidad_disponible,
        round(i.stock_actual::numeric / nullif(i.stock_maximo, 0) * 100, 2)
                                                              as pct_ocupacion,

        case
            when i.stock_actual = 0                          then 'Sin_Stock'
            when i.bajo_minimo                               then 'Bajo_Minimo'
            when i.stock_actual < i.stock_minimo * 1.20      then 'Alerta'
            else 'Normal'
        end as estado_stock

    from source i
    left join fechas f on f.fecha_id = i.fecha_id
)

select * from renamed

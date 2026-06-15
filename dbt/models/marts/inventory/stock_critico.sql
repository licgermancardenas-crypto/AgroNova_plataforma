{{
    config(
        materialized = 'table',
        tags         = ['inventory', 'alertas', 'stock']
    )
}}

-- Snapshot de productos en estado critico: bajo minimo, sin stock o alta demanda
-- Modelo de "alertas de compra" para el equipo de supply chain

with ultimo_snapshot as (
    -- Solo el snapshot mas reciente por producto x deposito
    select
        producto_id,
        deposito_id,
        max(fecha_id) as ultimo_fecha_id
    from {{ ref('stg_inventario') }}
    group by producto_id, deposito_id
),

inventario_actual as (
    select i.*
    from {{ ref('stg_inventario') }} i
    inner join ultimo_snapshot u
        on  u.producto_id    = i.producto_id
        and u.deposito_id    = i.deposito_id
        and u.ultimo_fecha_id = i.fecha_id
),

-- Promedio de ventas diarias (ultimos 90 dias de datos disponibles)
ventas_diarias as (
    select
        producto_id,
        sum(cantidad)::float / count(distinct fecha_id)  as ventas_diarias_promedio,
        max(fecha_id)                                     as ultima_fecha_venta
    from {{ ref('stg_ventas') }}
    where
        es_completada = true
        and fecha_id >= (
            select max(fecha_id) - 90 from {{ ref('stg_ventas') }}
        )
    group by producto_id
),

productos as (
    select
        producto_id,
        nombre_producto,
        categoria,
        clasificacion_abc,
        rotacion_dim,
        nombre_proveedor,
        tipo_proveedor,
        requiere_frio
    from {{ ref('dim_productos') }}
),

depositos as (
    select
        deposito_id,
        nombre as nombre_deposito,
        sucursal_id
    from {{ source('agronova_raw', 'dim_deposito') }}
),

final as (
    select
        i.producto_id,
        p.nombre_producto,
        p.categoria,
        p.clasificacion_abc,
        p.rotacion_dim,
        p.nombre_proveedor,
        p.tipo_proveedor,
        p.requiere_frio,

        i.deposito_id,
        d.nombre_deposito,

        i.fecha,
        i.stock_actual,
        i.stock_minimo,
        i.stock_maximo,
        i.valor_stock_ars,
        i.estado_stock,
        i.bajo_minimo,
        i.pct_ocupacion,

        -- Velocidad de consumo
        round(coalesce(v.ventas_diarias_promedio, 0)::numeric, 2) as ventas_diarias_promedio,

        -- Dias de cobertura (cuantos dias dura el stock al ritmo actual de ventas)
        case when coalesce(v.ventas_diarias_promedio, 0) > 0
            then round(i.stock_actual::numeric / v.ventas_diarias_promedio, 1)
            else null
        end as dias_cobertura,

        -- Punto de reorden: dias en llegar el proveedor * ventas diarias
        case when coalesce(v.ventas_diarias_promedio, 0) > 0
            then round(
                case when p.tipo_proveedor = 'Internacional' then 30
                     else 7 end
                * v.ventas_diarias_promedio
            , 0)
            else i.stock_minimo
        end as punto_reorden_sugerido,

        -- Unidades a comprar para llegar al maximo
        greatest(0, i.stock_maximo - i.stock_actual) as unidades_a_comprar,

        -- Prioridad de reposicion
        case
            when i.stock_actual = 0                          then '1_Sin_Stock'
            when i.bajo_minimo and p.clasificacion_abc = 'A' then '2_Critico_A'
            when i.bajo_minimo and p.clasificacion_abc = 'B' then '3_Critico_B'
            when i.bajo_minimo                               then '4_Bajo_Minimo'
            when i.estado_stock = 'Alerta'                   then '5_Alerta'
            else '6_Normal'
        end as prioridad_reposicion

    from inventario_actual i
    left join ventas_diarias v on v.producto_id = i.producto_id
    left join productos      p on p.producto_id = i.producto_id
    left join depositos      d on d.deposito_id = i.deposito_id
    where i.estado_stock != 'Normal'  -- Solo mostrar items que requieren atencion
)

select * from final
order by prioridad_reposicion, dias_cobertura nulls first

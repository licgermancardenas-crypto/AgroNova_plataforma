{{
    config(
        materialized = 'table',
        tags         = ['inventory', 'supply-chain', 'rotacion']
    )
}}

-- Indicadores de rotacion de inventario por producto x deposito x mes
-- Rotacion = unidades vendidas / stock promedio del periodo
-- Dias de inventario = dias_en_periodo / rotacion

with inventario_mensual as (
    select
        producto_id,
        deposito_id,
        anio,
        mes,
        avg(stock_actual)       as stock_promedio,
        min(stock_actual)       as stock_minimo_mes,
        max(stock_actual)       as stock_maximo_mes,
        avg(valor_stock_ars)    as valor_stock_promedio_ars,
        sum(case when bajo_minimo then 1 else 0 end) as dias_bajo_minimo,
        count(*)                as dias_con_datos
    from {{ ref('stg_inventario') }}
    group by producto_id, deposito_id, anio, mes
),

ventas_mensuales as (
    select
        producto_id,
        anio,
        mes,
        sum(cantidad)          as unidades_vendidas,
        sum(total_ars)         as revenue_ars
    from {{ ref('stg_ventas') }}
    where es_completada = true
    group by producto_id, anio, mes
),

productos as (
    select
        producto_id,
        nombre_producto,
        categoria,
        clasificacion_abc,
        rotacion as rotacion_dim,
        nombre_proveedor
    from {{ ref('dim_productos') }}
),

depositos as (
    select
        deposito_id,
        nombre as nombre_deposito
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
        i.deposito_id,
        d.nombre_deposito,
        i.anio,
        i.mes,

        round(i.stock_promedio::numeric, 0)          as stock_promedio,
        i.stock_minimo_mes,
        i.stock_maximo_mes,
        round(i.valor_stock_promedio_ars::numeric, 0) as valor_stock_promedio_ars,
        i.dias_bajo_minimo,
        i.dias_con_datos,

        coalesce(v.unidades_vendidas, 0)             as unidades_vendidas,
        coalesce(v.revenue_ars, 0)                   as revenue_ars,

        -- Rotacion del periodo (veces que roto el stock en el mes)
        case when i.stock_promedio > 0 and v.unidades_vendidas > 0
            then round(v.unidades_vendidas::numeric / i.stock_promedio, 4)
            else 0
        end as indice_rotacion,

        -- Dias de inventario (cuantos dias de ventas cubre el stock promedio)
        case when v.unidades_vendidas > 0
            then round(
                i.stock_promedio::numeric
                / (v.unidades_vendidas::numeric / i.dias_con_datos)
            , 1)
            else null
        end as dias_de_inventario,

        -- Cobertura en % del mes
        round(i.dias_bajo_minimo::numeric / nullif(i.dias_con_datos, 0) * 100, 1)
                                                     as pct_dias_bajo_minimo,

        -- Clasificacion de rotacion real vs esperada
        case
            when v.unidades_vendidas = 0                                         then 'Sin_Movimiento'
            when i.stock_promedio = 0                                            then 'Sin_Stock'
            when v.unidades_vendidas::numeric / i.stock_promedio >= 2.0          then 'Muy_Alta'
            when v.unidades_vendidas::numeric / i.stock_promedio >= 1.0          then 'Alta'
            when v.unidades_vendidas::numeric / i.stock_promedio >= 0.50         then 'Media'
            else 'Baja'
        end as clasificacion_rotacion

    from inventario_mensual i
    left join ventas_mensuales v on v.producto_id = i.producto_id
                                and v.anio        = i.anio
                                and v.mes         = i.mes
    left join productos        p on p.producto_id = i.producto_id
    left join depositos        d on d.deposito_id = i.deposito_id
)

select * from final
order by anio desc, mes desc, indice_rotacion desc

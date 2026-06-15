{{
    config(
        materialized = 'view',
        tags         = ['staging', 'ventas']
    )
}}

with ventas as (
    select * from {{ source('agronova_raw', 'fact_ventas') }}
),

fechas as (
    select
        fecha_id,
        fecha,
        ano       as anio,
        mes,
        mes_nombre,
        trimestre,
        semestre,
        temporada_agricola,
        factor_estacional,
        es_dia_habil,
        es_feriado
    from {{ source('agronova_raw', 'dim_fecha') }}
),

joined as (
    select
        -- PK
        v.venta_id,

        -- FKs
        v.fecha_id,
        v.cliente_id,
        v.producto_id,
        v.sucursal_id,
        v.vendedor_id,

        -- Atributos de la venta
        v.canal_venta,
        v.estado,
        v.nro_factura,

        -- Metricas
        v.cantidad,
        v.precio_unitario_ars,
        v.precio_unitario_usd,
        v.descuento_pct,
        v.total_ars,
        v.total_usd,
        v.margen_bruto_ars,

        -- Dimensiones de fecha desnormalizadas (evita joins repetidos en marts)
        f.fecha,
        f.anio,
        f.mes,
        f.mes_nombre,
        f.trimestre,
        f.semestre,
        f.temporada_agricola,
        f.factor_estacional,

        -- Flags de negocio
        case when v.estado = 'Completada' then true else false end as es_completada,
        case when v.descuento_pct > 0     then true else false end as tiene_descuento,

        -- Revenue neto (sin devoluciones)
        case
            when v.estado = 'Completada' then v.total_ars
            when v.estado = 'Devuelta'   then -v.total_ars
            else 0
        end as revenue_neto_ars,

        case
            when v.estado = 'Completada' then v.total_usd
            when v.estado = 'Devuelta'   then -v.total_usd
            else 0
        end as revenue_neto_usd

    from ventas v
    left join fechas f on f.fecha_id = v.fecha_id
)

select * from joined

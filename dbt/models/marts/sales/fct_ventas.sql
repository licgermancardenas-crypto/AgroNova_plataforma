{{
    config(
        materialized = 'table',
        tags         = ['sales', 'fact', 'high-volume'],
        -- Para escalar a incremental en produccion:
        -- materialized = 'incremental',
        -- unique_key   = 'venta_id',
        -- on_schema_change = 'fail'
    )
}}

-- Fact principal de ventas: modelo "wide" listo para Power BI / Metabase
-- Evita joins en el frontend denormalizando atributos clave

with ventas as (
    select * from {{ ref('stg_ventas') }}
    {% if is_incremental() %}
        where fecha_id > (select max(fecha_id) from {{ this }})
    {% endif %}
),

clientes as (
    select
        cliente_id,
        razon_social,
        segmento,
        tier_cliente,
        ciclo_vida,
        nombre_region,
        provincia,
        is_churned
    from {{ ref('dim_clientes') }}
),

productos as (
    select
        producto_id,
        nombre_producto,
        categoria,
        subcategoria,
        clasificacion_abc,
        rotacion,
        nombre_proveedor,
        tipo_proveedor
    from {{ ref('dim_productos') }}
),

sucursales as (
    select
        sucursal_id,
        nombre as nombre_sucursal,
        provincia as provincia_sucursal
    from {{ source('agronova_raw', 'dim_sucursal') }}
),

vendedores as (
    select
        vendedor_id,
        nombre_completo as nombre_vendedor,
        categoria as categoria_vendedor
    from {{ ref('dim_vendedores') }}
),

cotizaciones as (
    select fecha_id, usd_ars_oficial
    from {{ source('agronova_raw', 'cotizaciones_externas') }}
),

final as (
    select
        -- PKs y FKs
        v.venta_id,
        v.fecha_id,
        v.cliente_id,
        v.producto_id,
        v.sucursal_id,
        v.vendedor_id,

        -- Fecha (desnormalizada desde stg_ventas)
        v.fecha,
        v.anio,
        v.mes,
        v.mes_nombre,
        v.trimestre,
        v.semestre,
        v.temporada_agricola,
        v.factor_estacional,

        -- Cliente (desnormalizado)
        c.razon_social       as cliente_razon_social,
        c.segmento           as cliente_segmento,
        c.tier_cliente,
        c.ciclo_vida         as cliente_ciclo_vida,
        c.nombre_region      as cliente_region,
        c.provincia          as cliente_provincia,
        c.is_churned         as cliente_churned,

        -- Producto (desnormalizado)
        p.nombre_producto,
        p.categoria          as producto_categoria,
        p.subcategoria       as producto_subcategoria,
        p.clasificacion_abc  as producto_abc,
        p.rotacion           as producto_rotacion,
        p.nombre_proveedor,
        p.tipo_proveedor,

        -- Sucursal (desnormalizada)
        s.nombre_sucursal,
        s.provincia_sucursal,

        -- Vendedor (desnormalizado)
        ve.nombre_vendedor,
        ve.categoria_vendedor,

        -- Transaccion
        v.canal_venta,
        v.estado,
        v.es_completada,
        v.tiene_descuento,

        -- Metricas
        v.cantidad,
        v.precio_unitario_ars,
        v.precio_unitario_usd,
        v.descuento_pct,
        v.total_ars,
        v.total_usd,
        v.margen_bruto_ars,
        v.revenue_neto_ars,
        v.revenue_neto_usd,

        -- TC del dia para dolarizacion exacta
        coalesce(cot.usd_ars_oficial, v.precio_unitario_ars / nullif(v.precio_unitario_usd, 0)) as tc_dia,

        -- Revenue dolarizado con TC real del dia
        case
            when cot.usd_ars_oficial > 0
            then round((v.revenue_neto_ars / cot.usd_ars_oficial)::numeric, 2)
            else v.revenue_neto_usd
        end as revenue_usd_tc_real,

        -- Margen %
        case
            when v.total_ars > 0
            then round((v.margen_bruto_ars / v.total_ars * 100)::numeric, 2)
            else 0
        end as margen_bruto_pct

    from ventas v
    left join clientes    c   on c.cliente_id  = v.cliente_id
    left join productos   p   on p.producto_id = v.producto_id
    left join sucursales  s   on s.sucursal_id = v.sucursal_id
    left join vendedores  ve  on ve.vendedor_id = v.vendedor_id
    left join cotizaciones cot on cot.fecha_id  = v.fecha_id
)

select * from final

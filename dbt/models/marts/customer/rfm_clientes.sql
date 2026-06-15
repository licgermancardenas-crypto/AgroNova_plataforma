{{
    config(
        materialized = 'table',
        tags         = ['customer', 'rfm', 'segmentacion']
    )
}}

-- Scoring RFM (Recencia, Frecuencia, Monetario) por cliente
-- Scores 1-5 en cada dimension; segmentos: Champions, Loyal, At_Risk, Lost, New

with ventas as (
    select
        cliente_id,
        cliente_razon_social,
        tier_cliente,
        cliente_segmento,
        cliente_region,
        is_churned                     as cliente_churned,
        es_completada,
        total_ars,
        revenue_usd_tc_real,
        margen_bruto_ars,
        fecha,
        venta_id
    from {{ ref('fct_ventas') }}
    where es_completada = true
),

-- Fecha de referencia: maximo disponible en datos (evita depender de current_date)
fecha_ref as (
    select max(fecha) as fecha_maxima from ventas
),

metricas_raw as (
    select
        v.cliente_id,
        max(v.cliente_razon_social)   as razon_social,
        max(v.tier_cliente)           as tier_cliente,
        max(v.cliente_segmento)       as segmento,
        max(v.cliente_region)         as region,
        max(v.cliente_churned)        as is_churned,

        -- R: dias desde ultima compra (menor = mas reciente = mejor)
        (fr.fecha_maxima - max(v.fecha)::date)::int as recencia_dias,

        -- F: numero de transacciones en todo el historial
        count(distinct v.venta_id)      as frecuencia,

        -- M: revenue total en ARS
        sum(v.total_ars)               as monetario_ars,
        sum(v.revenue_usd_tc_real)     as monetario_usd,
        sum(v.margen_bruto_ars)        as margen_total_ars,

        max(v.fecha)::date             as ultima_compra,
        min(v.fecha)::date             as primera_compra

    from ventas v
    cross join fecha_ref fr
    group by v.cliente_id
),

-- Scores 1-5 usando NTILE (quintiles)
-- R: score 5 = mas reciente (menor recencia_dias)
-- F: score 5 = mayor frecuencia
-- M: score 5 = mayor monetario
scores as (
    select
        *,
        6 - ntile(5) over (order by recencia_dias asc)  as r_score,
        ntile(5)     over (order by frecuencia     asc)  as f_score,
        ntile(5)     over (order by monetario_ars  asc)  as m_score
    from metricas_raw
),

final as (
    select
        s.cliente_id,
        s.razon_social,
        s.tier_cliente,
        s.segmento,
        s.region,
        s.is_churned,

        -- Metricas RFM crudas
        s.recencia_dias,
        s.frecuencia,
        round(s.monetario_ars::numeric, 0)   as monetario_ars,
        round(s.monetario_usd::numeric, 2)   as monetario_usd,
        round(s.margen_total_ars::numeric, 0) as margen_total_ars,
        s.ultima_compra,
        s.primera_compra,

        -- Scores 1-5
        s.r_score,
        s.f_score,
        s.m_score,
        s.r_score + s.f_score + s.m_score as rfm_score_total,

        -- Segmento RFM
        case
            when s.r_score >= 4 and s.f_score >= 4 and s.m_score >= 4 then 'Champions'
            when s.r_score >= 4 and s.f_score >= 3                     then 'Loyal_Customers'
            when s.r_score >= 3 and s.f_score >= 3 and s.m_score >= 3 then 'Potential_Loyalists'
            when s.r_score >= 4 and s.f_score <= 2                     then 'New_Customers'
            when s.r_score >= 3 and s.f_score <= 2 and s.m_score >= 3 then 'Promising'
            when s.r_score <= 2 and s.f_score >= 3 and s.m_score >= 3 then 'At_Risk'
            when s.r_score <= 2 and s.f_score >= 4 and s.m_score >= 4 then 'Cant_Lose_Them'
            when s.r_score <= 2 and s.f_score <= 2 and s.m_score >= 3 then 'Hibernating'
            when s.r_score <= 1 and s.f_score <= 1                     then 'Lost'
            else 'Needs_Attention'
        end as segmento_rfm,

        -- Accion recomendada
        case
            when s.r_score >= 4 and s.f_score >= 4 and s.m_score >= 4 then 'Fidelizar — programa exclusivo'
            when s.r_score <= 2 and s.f_score >= 3 and s.m_score >= 3 then 'Reactivar — oferta especial'
            when s.r_score <= 1                                         then 'Campana de recuperacion o dar de baja'
            when s.r_score >= 4 and s.f_score <= 2                     then 'Desarrollar — cross-sell'
            else 'Monitorear y nutrir'
        end as accion_recomendada,

        -- Margen %
        case when s.monetario_ars > 0
            then round(s.margen_total_ars / s.monetario_ars * 100, 2)
            else 0
        end as margen_pct

    from scores s
)

select * from final
order by rfm_score_total desc, monetario_ars desc

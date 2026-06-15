{{
    config(
        materialized = 'table',
        tags         = ['customer', 'churn', 'retencion']
    )
}}

-- Candidatos a churn: clientes activos con señales de abandono
-- No incluye clientes ya dados de baja (is_churned = true)
-- Inputs: RFM scores, frecuencia historica, tendencia de compra

with rfm as (
    select
        cliente_id,
        razon_social,
        tier_cliente,
        segmento,
        region,
        is_churned,
        recencia_dias,
        frecuencia,
        monetario_ars,
        monetario_usd,
        margen_total_ars,
        margen_pct,
        ultima_compra,
        primera_compra,
        r_score,
        f_score,
        m_score,
        rfm_score_total,
        segmento_rfm
    from {{ ref('rfm_clientes') }}
    where is_churned = false  -- Solo clientes activos
),

-- Ventas del último año y del año anterior (para ver si viene decayendo)
ventas_por_periodo as (
    select
        cliente_id,
        sum(case when anio = date_part('year', current_date)::int - 1
                 then total_ars end) as revenue_anio_pasado,
        sum(case when anio = date_part('year', current_date)::int - 2
                 then total_ars end) as revenue_dos_anios_atras,
        count(distinct case when anio = date_part('year', current_date)::int - 1
                             then mes end) as meses_activos_anio_pasado,
        max(case when anio = date_part('year', current_date)::int - 1
                 then mes end) as ultimo_mes_anio_pasado
    from {{ ref('fct_ventas') }}
    where es_completada = true
    group by cliente_id
),

final as (
    select
        r.cliente_id,
        r.razon_social,
        r.tier_cliente,
        r.segmento,
        r.region,

        -- RFM
        r.recencia_dias,
        r.frecuencia,
        round(r.monetario_ars::numeric, 0)    as monetario_ars,
        round(r.monetario_usd::numeric, 2)    as monetario_usd,
        round(r.margen_total_ars::numeric, 0) as margen_total_ars,
        r.margen_pct,
        r.ultima_compra,
        r.primera_compra,
        r.r_score,
        r.f_score,
        r.m_score,
        r.rfm_score_total,
        r.segmento_rfm,

        -- Tendencia de revenue
        coalesce(v.revenue_anio_pasado, 0)      as revenue_anio_pasado,
        coalesce(v.revenue_dos_anios_atras, 0)  as revenue_dos_anios_atras,
        v.meses_activos_anio_pasado,

        -- Caida de revenue YoY
        case
            when coalesce(v.revenue_dos_anios_atras, 0) > 0
            then round(
                (coalesce(v.revenue_anio_pasado, 0) - v.revenue_dos_anios_atras)
                / v.revenue_dos_anios_atras * 100
            , 2)
            else null
        end as variacion_revenue_yoy_pct,

        -- Score de riesgo de churn (0-100, mayor = mayor riesgo)
        round(
            -- Penalizar recencia alta (muchos dias sin comprar)
            least(r.recencia_dias::numeric / {{ var('churn_days') }} * 40, 40)
            -- Penalizar baja frecuencia (inverso al f_score)
            + (5 - r.f_score)::numeric / 4 * 30
            -- Penalizar caida de revenue YoY
            + case
                when coalesce(v.revenue_dos_anios_atras, 0) > 0
                    and coalesce(v.revenue_anio_pasado, 0) <
                        v.revenue_dos_anios_atras * 0.5 then 30
                when coalesce(v.revenue_dos_anios_atras, 0) > 0
                    and coalesce(v.revenue_anio_pasado, 0) <
                        v.revenue_dos_anios_atras * 0.8 then 15
                else 0
              end
        , 1) as churn_risk_score,

        -- Nivel de riesgo
        case
            when r.recencia_dias >= {{ var('churn_days') }}
                 and r.f_score <= 2                          then 'Critico'
            when r.recencia_dias >= {{ var('churn_days') }} * 0.75
                 and r.f_score <= 3                          then 'Alto'
            when r.recencia_dias >= {{ var('churn_days') }} * 0.50
                 or  r.f_score <= 2                          then 'Medio'
            else 'Bajo'
        end as nivel_riesgo_churn,

        -- Impacto financiero estimado (cuanto perderíamos si churna)
        round(
            r.monetario_ars
            / greatest(
                date_part('year', r.ultima_compra)::int
                - date_part('year', r.primera_compra)::int
            , 1)
        , 0) as revenue_anual_estimado_ars,

        -- Accion de retencion sugerida
        case
            when r.tier_cliente = 'A' and r.recencia_dias >= 180 then 'URGENTE: Llamada gerencial + oferta exclusiva'
            when r.tier_cliente = 'B' and r.recencia_dias >= 270 then 'ALTA: Visita comercial + descuento especial'
            when r.tier_cliente in ('A','B')                      then 'Incluir en programa de retencion VIP'
            when r.recencia_dias >= {{ var('churn_days') }}       then 'Campaña de reactivacion (email + promo)'
            else 'Monitorear — incluir en next-best-offer'
        end as accion_retencion

    from rfm r
    left join ventas_por_periodo v on v.cliente_id = r.cliente_id

    -- Solo incluir candidatos con algun riesgo real
    where r.r_score <= 3
       or r.recencia_dias >= {{ var('churn_days') }} * 0.50
)

select * from final
order by
    case nivel_riesgo_churn
        when 'Critico' then 1
        when 'Alto'    then 2
        when 'Medio'   then 3
        else 4
    end,
    tier_cliente,
    recencia_dias desc

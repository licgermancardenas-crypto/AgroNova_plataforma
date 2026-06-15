-- Macro: safe_divide
-- Evita division por cero retornando null
{% macro safe_divide(numerator, denominator) %}
    case when {{ denominator }} = 0 or {{ denominator }} is null
        then null
        else {{ numerator }}::float / {{ denominator }}
    end
{% endmacro %}

-- Macro: pct_of_total
-- Calcula el porcentaje de una columna sobre su suma total (window function)
{% macro pct_of_total(column) %}
    {{ column }} / nullif(sum({{ column }}) over (), 0) * 100
{% endmacro %}

-- Macro: clasificar_abc
-- Clasifica un item segun su porcentaje acumulado en el total
{% macro clasificar_abc(pct_acumulado_col) %}
    case
        when {{ pct_acumulado_col }} <= 0.70 then 'A'
        when {{ pct_acumulado_col }} <= 0.90 then 'B'
        else 'C'
    end
{% endmacro %}

-- Macro: rfm_segment
-- Mapea combinaciones de scores R, F, M a segmentos de clientes
{% macro rfm_segment(r, f, m) %}
    case
        when {{ r }} >= 4 and {{ f }} >= 4 and {{ m }} >= 4 then 'Champions'
        when {{ r }} >= 4 and {{ f }} >= 3                   then 'Loyal_Customers'
        when {{ r }} >= 3 and {{ f }} >= 3 and {{ m }} >= 3 then 'Potential_Loyalists'
        when {{ r }} >= 4 and {{ f }} <= 2                   then 'New_Customers'
        when {{ r }} >= 3 and {{ f }} <= 2 and {{ m }} >= 3 then 'Promising'
        when {{ r }} <= 2 and {{ f }} >= 3 and {{ m }} >= 3 then 'At_Risk'
        when {{ r }} <= 2 and {{ f }} >= 4 and {{ m }} >= 4 then 'Cant_Lose_Them'
        when {{ r }} <= 2 and {{ f }} <= 2 and {{ m }} >= 3 then 'Hibernating'
        when {{ r }} <= 1 and {{ f }} <= 1                   then 'Lost'
        else 'Needs_Attention'
    end
{% endmacro %}

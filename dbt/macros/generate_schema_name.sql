{#
  Override del macro generate_schema_name para que dbt use el schema
  exactamente como se define en dbt_project.yml, sin prefijar con el
  schema del target.

  Por defecto dbt genera: agronova_staging, agronova_core, etc.
  Con este override: staging, core, sales, finance, inventory, customer

  Para mantener el comportamiento por defecto (con prefijo), comentar
  este macro y usar el nombre de schema como "agronova_staging", etc.
#}

{% macro generate_schema_name(custom_schema_name, node) -%}
    {%- if custom_schema_name is none -%}
        {{ target.schema }}
    {%- else -%}
        {{ target.schema }}_{{ custom_schema_name | trim }}
    {%- endif -%}
{%- endmacro %}

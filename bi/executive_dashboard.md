# Executive Dashboard — AgroNova Argentina S.A.

## 1. Usuario Objetivo

| Rol | Frecuencia de uso |
|-----|------------------|
| CEO / Presidente | Diaria (morning briefing) |
| CFO | Diaria |
| Directorio / Board | Mensual |
| Gerente General | Diaria |

**Nivel de detalle**: Estratégico — tendencias y variaciones, sin granularidad transaccional.  
**Acción esperada**: Detección temprana de desvíos, validación de targets anuales, comunicación a directorio.

---

## 2. Objetivo del Negocio

Proveer una **visión unificada y en tiempo real** del estado financiero y comercial de AgroNova, permitiendo al equipo ejecutivo:

- Validar si el negocio está tracking contra el presupuesto anual
- Identificar regiones, categorías o periodos fuera de tendencia
- Comunicar resultados al directorio con datos confiables y consistentes
- Tomar decisiones de asignación de recursos entre sucursales y líneas de producto

---

## 3. KPIs Corporativos

### 3.1 Revenue

| KPI | Definición | Unidad | Target 2026 |
|-----|-----------|--------|-------------|
| Revenue Total ARS | `SUM(total_ars)` ventas completadas | ARS millones | Presupuesto anual |
| Revenue Total USD | `SUM(revenue_usd_tc_real)` | USD millones | Benchmark sectorial |
| Revenue YoY % | `(Revenue_actual - Revenue_año_anterior) / Revenue_año_anterior` | % | ≥ inflación + 5% |
| Revenue USD YoY % | Crecimiento en dólares reales | % | ≥ 3% (crecimiento real) |
| Revenue Acumulado vs Budget | `Revenue_YTD / Budget_YTD` | % | 100% |
| Revenue por Día Hábil | `Revenue_mes / dias_habiles_mes` | ARS miles | Comparable entre meses |

### 3.2 Margen y Rentabilidad

| KPI | Definición | Unidad | Target |
|-----|-----------|--------|--------|
| Margen Bruto % | `SUM(margen_bruto_ars) / SUM(total_ars)` | % | 18–22% |
| Margen Bruto ARS | `SUM(margen_bruto_ars)` completadas | ARS millones | — |
| EBITDA Estimado % | `Margen_Bruto% - Gastos_Fijos_Estimados%` | % | 8–12% |
| EBITDA ARS | `Margen_Bruto_ARS × (1 - ratio_costos_fijos)` | ARS millones | — |

> **Nota EBITDA**: AgroNova es modelo analítico; los gastos fijos no están en los datos. El EBITDA se estima como `Margen Bruto - 40%` (ratio de estructura de distribuidoras comparables del sector). Documentar esta asunción en todo reporte.

### 3.3 Crecimiento (CAGR)

| KPI | Definición | Unidad |
|-----|-----------|--------|
| CAGR Revenue ARS (5Y) | `(Revenue_2026 / Revenue_2021)^(1/5) - 1` | % |
| CAGR Revenue USD (5Y) | `(Revenue_USD_2026 / Revenue_USD_2021)^(1/5) - 1` | % |
| CAGR Clientes Activos | `(Clientes_2026 / Clientes_2021)^(1/5) - 1` | % |
| CAGR Margen Bruto ARS | Idem sobre margen total | % |

### 3.4 Mix y Concentración

| KPI | Definición | Target |
|-----|-----------|--------|
| Top 5 Clientes / Revenue Total | `Revenue top 5 / Revenue global` | < 25% (diversificación) |
| Top Región (PAM) / Revenue Total | Participación Pampeana | 55–70% |
| Top Categoría (Herbicidas) | Participación | < 40% (diversificación) |
| Clientes Activos | `COUNT DISTINCT cliente_id` con compras en los últimos 12M | ≥ 1,200 |
| Clientes Nuevos (YTD) | Primera compra en el año en curso | ≥ 200/año |

---

## 4. Visualizaciones Recomendadas

### Panel 1: Header KPIs (scorecard cards)

```
┌────────────────┬─────────────────┬────────────────┬────────────────┐
│ Revenue ARS    │ Revenue USD     │ Margen Bruto % │ EBITDA Est. %  │
│ ARS 12.4B      │ USD 11.1M       │ 19.3%          │ 8.7%           │
│ ▲ +18% YoY    │ ▲ +4.2% YoY    │ ▼ -0.8pp YoY  │ ▼ -0.3pp YoY  │
└────────────────┴─────────────────┴────────────────┴────────────────┘
```

**Tipo**: Metric Cards con variación YoY y flechas de tendencia (verde/rojo).

---

### Panel 2: Evolución Temporal

**Visualización**: Área chart + línea de tendencia  
**Eje X**: Meses (últimos 36 meses)  
**Eje Y izq.**: Revenue ARS (barras agrupadas: actual vs año anterior)  
**Eje Y der.**: Margen % (línea)  
**Highlight**: Temporadas agrícolas (Oct-Nov en verde, Jun-Jul en gris)

---

### Panel 3: Revenue YoY por Año (2016–2026)

**Visualización**: Bar chart con doble eje  
- Barras: Revenue USD real (deflactado, comparable)
- Línea: Variación YoY %
- Colores: verde si YoY > 0, rojo si YoY < 0

---

### Panel 4: Distribución Regional

**Visualización**: Treemap + donut chart  
- Treemap: Regiones → coloreadas por % revenue  
- Donut: 5 regiones (PAM, NOA, NEA, CUY, PAT) con % y monto

---

### Panel 5: Top 10 Clientes

**Visualización**: Horizontal bar chart  
- Ordenado por revenue total descendente  
- Columnas adicionales: Tier, Región, YoY %  
- Color por tier (A=verde oscuro, B=verde, C=amarillo, D=rojo)

---

### Panel 6: CAGR Waterfall

**Visualización**: Waterfall chart (5 años)  
- Punto de inicio: Revenue USD 2021  
- Barras intermedias: variación anual USD  
- Punto final: Revenue USD 2026  
- Texto: CAGR calculado

---

### Panel 7: Heatmap Mensual

**Visualización**: Heatmap (meses × años)  
- Celda: Revenue ARS del mes/año  
- Color: Escala de calor (azul-rojo)  
- Permite identificar la estacionalidad año a año visualmente

---

### Panel 8: Semáforo de Performance

**Visualización**: Tabla con semáforos (🟢🟡🔴)

| Métrica | Valor | vs Target | Estado |
|---------|-------|-----------|--------|
| Revenue YoY USD | +4.2% | ≥ 3% | 🟢 |
| Margen Bruto % | 19.3% | 18-22% | 🟢 |
| Clientes Activos | 1,187 | ≥ 1,200 | 🟡 |
| CAGR USD 5Y | 2.1% | ≥ 3% | 🔴 |

---

## 5. Tablas dbt Utilizadas

| Tabla dbt | Schema | Uso |
|-----------|--------|-----|
| `ventas_mensuales` | `agronova_sales` | Revenue mensual, YoY, MoM por sucursal |
| `ventas_por_region` | `agronova_sales` | Mix regional, evolución |
| `pareto_clientes` | `agronova_sales` | Top 10 clientes, concentración |
| `fct_ventas` | `agronova_sales` | Revenue acumulado YTD, CAGR anual |
| `margen_por_producto` | `agronova_finance` | Margen bruto por categoría |
| `margen_por_cliente` | `agronova_finance` | LTV top clientes |
| `dim_clientes` | `agronova_core` | Clientes activos, nuevos |

### Query de referencia: CAGR Revenue USD

```sql
WITH anual AS (
    SELECT
        anio,
        SUM(revenue_usd) AS revenue_usd
    FROM agronova_sales.ventas_mensuales
    GROUP BY anio
),
cagr AS (
    SELECT
        a2026.revenue_usd AS revenue_2026,
        a2021.revenue_usd AS revenue_2021,
        POWER(a2026.revenue_usd / NULLIF(a2021.revenue_usd, 0), 1.0/5) - 1 AS cagr_5y
    FROM anual a2026
    CROSS JOIN anual a2021
    WHERE a2026.anio = 2026 AND a2021.anio = 2021
)
SELECT ROUND(cagr_5y * 100, 2) AS cagr_usd_5y_pct FROM cagr;
```

### Query de referencia: EBITDA Estimado

```sql
SELECT
    anio,
    SUM(revenue_ars)                                  AS revenue_ars,
    SUM(margen_ars)                                   AS margen_bruto_ars,
    ROUND(SUM(margen_ars) / SUM(revenue_ars) * 100, 2) AS margen_bruto_pct,
    -- EBITDA estimado: Margen Bruto × (1 - 0.40 costos fijos)
    ROUND(SUM(margen_ars) * 0.60, 0)                 AS ebitda_estimado_ars,
    ROUND(SUM(margen_ars) * 0.60 / SUM(revenue_ars) * 100, 2) AS ebitda_pct
FROM agronova_sales.ventas_mensuales
GROUP BY anio
ORDER BY anio;
```

---

## 6. Frecuencia de Actualización

| Componente | Frecuencia | Método |
|-----------|-----------|--------|
| Revenue diario (acumulado) | Diaria (7:00 AM) | `dbt run --select ventas_mensuales` |
| Margen mensual | Mensual (día 3 del mes) | `dbt run --select tag:finance` |
| CAGR / Tendencias | Mensual | Cálculo automático en la query |
| Top Clientes | Semanal | `dbt run --select pareto_clientes` |
| Semáforo de alertas | Diaria | Query sobre `ventas_mensuales` |

**Pipeline recomendado**: Airflow / GitHub Actions ejecuta `dbt build --select tag:sales,tag:finance` cada madrugada. Los dashboards en Power BI o Next.js apuntan a los marts ya actualizados.

---

## 7. Filtros Globales del Dashboard

- **Período**: Selector de año + mes (o rango personalizado)
- **Sucursal**: Todas / individual
- **Región**: Todas / PAM / NOA / NEA / CUY / PAT
- **Moneda**: ARS / USD (toggle)
- **Comparativa**: vs Año anterior / vs Presupuesto (si existe)

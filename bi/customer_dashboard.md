# Customer Dashboard — AgroNova Argentina S.A.

## 1. Usuario Objetivo

| Rol | Frecuencia de uso |
|-----|------------------|
| Gerente de Cuentas / CRM | Diaria |
| Key Account Manager | Diaria |
| Director Comercial | Semanal |
| Analista de Marketing | Semanal |
| Jefe de Sucursal | Semanal |

**Nivel de detalle**: Cliente individual → segmento → total. Drill-down hasta historial de compras de un cliente específico.

---

## 2. Objetivo del Negocio

Proporcionar al equipo de cuentas **inteligencia accionable sobre el estado de la cartera de clientes**, permitiendo:

- Priorizar la atención en clientes de alto valor en riesgo de abandono
- Diseñar campañas de reactivación para clientes inactivos
- Identificar clientes con potencial de crecimiento (bajo tier pero alta frecuencia)
- Reducir la tasa de churn anual (objetivo: < 8% en clientes Tier A-B)
- Detectar patrones de comportamiento previos al abandono

---

## 3. KPIs de Clientes

### 3.1 Segmentación RFM

| KPI | Definición | Target |
|-----|-----------|--------|
| Distribución por Segmento RFM | % de clientes en cada segmento | Champions ≥ 15% |
| Score RFM Promedio | `AVG(rfm_score_total)` | ≥ 9/15 |
| Champions (R≥4, F≥4, M≥4) | Clientes de máximo valor | > 200 |
| At Risk (R≤2, F≥3, M≥3) | Clientes que se están perdiendo | < 5% cartera total |
| Lost (R≤1, F≤1) | Clientes perdidos | Monitorear tendencia |
| Score R Promedio | `AVG(r_score)` | ≥ 3.5 |

### 3.2 Clientes Nuevos y Crecimiento

| KPI | Definición | Target |
|-----|-----------|--------|
| Clientes Nuevos (YTD) | Primera compra en el año | ≥ 200 por año |
| Clientes Nuevos por Mes | COUNT con primera compra en el mes | ≥ 18/mes |
| Revenue de Clientes Nuevos | `SUM(total_ars)` first-year clients | > 5% revenue total |
| Ratio Adquisición / Churn | Nuevos / Perdidos | > 1.5x |
| Tiempo Hasta Segunda Compra | Días entre compra 1 y 2 | < 90 días |

### 3.3 Retención y Churn

| KPI | Definición | Target | Alerta |
|-----|-----------|--------|--------|
| Tasa de Churn Anual | `Clientes_perdidos / Clientes_inicio_año` | < 10% global | > 15% rojo |
| Churn Tier A | Tasa de churn clientes A | < 3% | > 5% crítico |
| Churn Tier B | Tasa de churn clientes B | < 8% | > 12% rojo |
| Clientes en Riesgo Crítico | `COUNT WHERE nivel_riesgo = 'Critico'` | < 20 activos | — |
| Revenue en Riesgo | Revenue de clientes Crítico + Alto | < 5% revenue total | — |
| Días Promedio sin Compra (churned) | `AVG(recencia_dias) WHERE churned` | — | Benchmark |

### 3.4 Frecuencia de Compra

| KPI | Definición | Benchmark |
|-----|-----------|-----------|
| Frecuencia Promedio Global | `AVG(frecuencia)` transacciones históricas | — |
| Frecuencia por Tier | `AVG(frecuencia) GROUP BY tier` | A > 50, B > 20, C > 8 |
| Clientes con 1 sola compra | "One and done" | < 15% cartera |
| Meses Activos Promedio | `AVG(meses_activos_en_historial)` | Tier A > 8/12 |
| Frecuencia en Temporada Alta | Compras Oct–Nov vs año base | > 1.5x promedio mensual |

### 3.5 Valor del Cliente

| KPI | Definición |
|-----|-----------|
| LTV ARS por Segmento | `AVG(ltv_total_ars)` por segmento RFM |
| LTV USD por Tier | `AVG(ltv_total_usd)` por tier A/B/C/D |
| Revenue por Cliente Activo | `Revenue_total / Clientes_activos` |
| Concentración Top 20% | Revenue top 20% / Revenue total |

---

## 4. Visualizaciones Recomendadas

### Panel 1: Scorecards de Cartera

```
┌──────────────────┬──────────────────┬────────────────┬────────────────┐
│ Clientes Activos │ Nuevos (30 días) │ En Riesgo Alto │ Churn YTD      │
│ 1,187            │ 23               │ 47             │ 8.3%           │
│ ▼ -13 vs mes ant │ ▼ -5 vs mes ant  │ ▲ +8 vs mes ant│ Target: < 10%  │
└──────────────────┴──────────────────┴────────────────┴────────────────┘
```

---

### Panel 2: Mapa RFM — Matriz de Segmentos

**Tipo**: Treemap o matriz de burbujas  
- 10 segmentos RFM (Champions, Loyal, At_Risk, Lost, etc.)  
- Tamaño: N° de clientes en el segmento  
- Color: Verde (Champions) → Amarillo (At_Risk) → Rojo (Lost)  
- Hover: N° clientes, Revenue total, % de cartera, Acción recomendada

---

### Panel 3: Distribución RFM — Heatmap de Scores

**Tipo**: Heatmap R × F (con M como color)  
- Eje X: F score (1–5)  
- Eje Y: R score (1–5)  
- Color de celda: M score promedio o Revenue promedio  
- Tamaño de círculo en celda: N° clientes  
- Permite ver la concentración de clientes en el espacio RFM

---

### Panel 4: Funnel de Ciclo de Vida

**Tipo**: Funnel / Sankey diagram  
```
Nuevo (0-1 año)     →  Activo (2-5 años)  →  Maduro (6+)
    2,100               1,200                  700
       ↓ churn             ↓ churn               ↓ churn
    Perdido 180         Perdido 420            Perdido 400
```
- Muestra conversión y pérdida en cada etapa del ciclo de vida
- Permite cuantificar el "leaky bucket" de la cartera

---

### Panel 5: Clientes en Riesgo — Tabla de Acción

**Tipo**: Data table priorizada  

| Cliente | Tier | Días sin compra | Revenue Anual | Riesgo | Acción |
|---------|------|----------------|---------------|--------|--------|
| El Sembrador SA | A | 187 días | ARS 4.2M | CRÍTICO | Llamada gerencial |
| La Pampa COOP | A | 143 días | ARS 3.8M | CRÍTICO | Visita + oferta |
| AgroNorte SRL | B | 310 días | ARS 1.1M | ALTO | Email + promo |

- Ordenada por impacto financiero (revenue anual × riesgo)
- Botón de exportar para CRM / campaña de emails
- Filtro: Por tier / sucursal / vendedor responsable

---

### Panel 6: Evolución de Nuevos vs Perdidos

**Tipo**: Dual bar chart mensual (últimos 24 meses)  
- Barras verdes: Clientes nuevos del mes  
- Barras rojas: Clientes perdidos del mes (con baja)  
- Línea: Saldo neto acumulado (cartera total)  
- Permite ver si la empresa está creciendo o contrayendo su cartera neta

---

### Panel 7: Histograma de Recencia

**Tipo**: Histograma de distribución  
- Eje X: Días desde última compra (bins de 30 días)  
- Eje Y: N° clientes  
- Colores por tier (A/B/C/D)  
- Líneas verticales: 90d / 180d / 365d (umbrales de alerta)  
- Permite ver la "forma" de la cartera: cargada al frente = sana, cargada atrás = problema

---

### Panel 8: Perfil de Cliente Individual (drill-down)

**Tipo**: Ficha de cliente con mini-dashboards  
Al clickear en cualquier cliente, mostrar:
- Datos maestros (segmento, tier, región, vendedor, CUIT)
- Score RFM actual (R / F / M con comparativa vs tier)
- Timeline de compras (últimas 12)
- Revenue y margen por categoría (barras)
- Tendencia de frecuencia (line chart 24 meses)
- Alerta de riesgo (semáforo)
- Acción recomendada (texto generado desde `churn_candidates`)

---

## 5. Tablas dbt Utilizadas

| Tabla dbt | Schema | Uso |
|-----------|--------|-----|
| `rfm_clientes` | `agronova_customer` | Scores, segmentos, acción recomendada |
| `churn_candidates` | `agronova_customer` | Riesgo de churn, priorización |
| `dim_clientes` | `agronova_core` | Master de clientes, tier, region |
| `pareto_clientes` | `agronova_sales` | Concentración, LTV |
| `margen_por_cliente` | `agronova_finance` | LTV USD, margen%, delta vs tier |
| `fct_ventas` | `agronova_sales` | Timeline de compras, frecuencia |

### Query: Evolución Mensual Nuevos vs Perdidos

```sql
WITH primera_compra AS (
    SELECT cliente_id, MIN(fecha_id) AS primera_fecha_id
    FROM agronova_sales.fct_ventas WHERE es_completada = true
    GROUP BY cliente_id
),
nuevos_por_mes AS (
    SELECT
        DATE_TRUNC('month', f.fecha)::date AS mes,
        COUNT(*) AS nuevos
    FROM primera_compra pc
    JOIN agronova_sales.fct_ventas f ON f.fecha_id = pc.primera_fecha_id
                                    AND f.cliente_id = pc.cliente_id
    GROUP BY 1
),
perdidos_por_mes AS (
    SELECT
        TO_DATE(anio_baja::text || '-01', 'YYYY-MM') AS mes,
        COUNT(*) AS perdidos
    FROM agronova_core.dim_clientes
    WHERE anio_baja IS NOT NULL
    GROUP BY 1
)
SELECT
    COALESCE(n.mes, p.mes) AS mes,
    COALESCE(n.nuevos, 0)  AS nuevos,
    COALESCE(p.perdidos, 0) AS perdidos,
    COALESCE(n.nuevos, 0) - COALESCE(p.perdidos, 0) AS saldo_neto
FROM nuevos_por_mes n
FULL OUTER JOIN perdidos_por_mes p ON p.mes = n.mes
ORDER BY mes;
```

---

## 6. Frecuencia de Actualización

| Componente | Frecuencia | Método |
|-----------|-----------|--------|
| Scores RFM | Semanal (lunes) | `dbt run --select rfm_clientes` |
| Churn candidates | Semanal (lunes) | `dbt run --select churn_candidates` |
| Tabla de acción (clientes en riesgo) | Diaria | Query sobre rfm + churn |
| Clientes nuevos del día | Diaria | Query sobre fct_ventas |
| Ficha individual de cliente | En tiempo real (on-demand) | Query directa |

---

## 7. Filtros del Dashboard

- **Segmento RFM**: Champions / Loyal / At_Risk / Lost / etc.
- **Tier**: A / B / C / D (multiselector)
- **Región**: PAM / NOA / NEA / CUY / PAT
- **Vendedor / KAM responsable**: Para vista personalizada del vendedor
- **Ciclo de vida**: Nuevo / Activo / Maduro / Churned
- **Nivel de riesgo churn**: Crítico / Alto / Medio / Bajo
- **Días sin compra**: Slider 0–730 días

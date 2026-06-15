# Finance Dashboard — AgroNova Argentina S.A.

## 1. Usuario Objetivo

| Rol | Frecuencia de uso |
|-----|------------------|
| CFO / Director Financiero | Diaria |
| Analista de Costos | Semanal |
| Controller | Mensual |
| Gerente de Pricing | Semanal |
| CEO | Mensual (resumen ejecutivo) |

**Nivel de detalle**: Financiero-analítico — rentabilidad por dimensión, evolución de márgenes, análisis de valor de clientes y comparativas por tier.

---

## 2. Objetivo del Negocio

Proveer al equipo financiero **visibilidad sobre la rentabilidad real** del negocio, desagregada por cliente, producto, categoría y sucursal, para:

- Detectar erosión de márgenes por producto o categoría
- Identificar clientes no rentables y ajustar condiciones comerciales
- Calcular el LTV de los clientes para priorizar inversión en retención
- Evaluar la rentabilidad de cada sucursal y tomar decisiones de estructura de costos
- Defender el pricing ante presión competitiva con datos de margen real
- Monitorear el impacto de la inflación y devaluación en el margen USD

---

## 3. KPIs Financieros

### 3.1 Margen Bruto

| KPI | Fórmula | Target | Alerta |
|-----|---------|--------|--------|
| Margen Bruto % Global | `SUM(margen_bruto_ars) / SUM(total_ars)` | 18–22% | < 15% rojo |
| Margen Bruto ARS | `SUM(margen_bruto_ars)` ventas completadas | Presupuesto | — |
| Margen Bruto USD | `SUM(margen_bruto_ars) / TC_promedio_mes` | > USD 200K/mes | — |
| Variación Margen YoY pp | `Margen%_actual - Margen%_año_anterior` | ≥ 0 pp | < -2pp rojo |
| Margen por Día Hábil | `Margen_ARS / dias_habiles` | Comparable | — |

### 3.2 Margen por Producto

| KPI | Fórmula | Target |
|-----|---------|--------|
| Margen % por Categoría | `SUM(margen) / SUM(revenue)` por categoría | Herbicidas ≥ 15%, Semillas ≥ 25% |
| Top 10 Productos por Margen ARS | `SUM(margen_bruto_ars)` ordenado desc | — |
| Productos con Margen Negativo | `COUNT(margen_bruto_ars < 0)` | = 0 |
| Erosión de Margen YoY | Δ margen% vs año anterior por producto | ≥ -2pp |
| Margen Ponderado por Rotación | `SUM(margen × rotacion_index)` | Proxy de rentabilidad real |

### 3.3 Margen por Cliente

| KPI | Fórmula | Target |
|-----|---------|--------|
| Margen % por Tier | `AVG(margen_pct)` por tier A/B/C/D | A ≥ 20%, D ≥ 12% |
| Delta vs Benchmark de Tier | `Margen_cliente% - Margen_promedio_tier%` | > 0 (por encima del tier) |
| Clientes con Margen < 10% | COUNT por tier | Tier A = 0, B < 5% |
| Clientes No Rentables | `COUNT(margen_ars < 0)` | = 0 |

### 3.4 LTV (Lifetime Value)

| KPI | Fórmula | Target |
|-----|---------|--------|
| LTV Total ARS | `SUM(total_ars)` historial completo por cliente | Tier A > ARS 50M |
| LTV Total USD | `SUM(revenue_usd_tc_real)` historial | Tier A > USD 50K |
| LTV Margen ARS | `SUM(margen_bruto_ars)` historial | Tier A > ARS 9M |
| LTV Promedio por Tier | `AVG(ltv_ars)` por tier | Benchmark |
| Revenue Anual Promedio | `LTV_ARS / años_activo` | Tier A > ARS 5M/año |
| LTV / CAC Implícito | Ratio de eficiencia de adquisición | > 5x (estimado) |

### 3.5 Rentabilidad por Sucursal

| KPI | Fórmula | Benchmark |
|-----|---------|-----------|
| Revenue por Sucursal | `SUM(total_ars) GROUP BY sucursal` | Rosario > 35% total |
| Margen por Sucursal % | `SUM(margen) / SUM(revenue)` por sucursal | 16–24% |
| Margen por Sucursal ARS | `SUM(margen_bruto_ars)` | Presupuesto |
| Ranking de Rentabilidad | `RANK() OVER (ORDER BY margen_pct DESC)` | — |

### 3.6 Impacto Inflación / TC

| KPI | Fórmula | Interpretación |
|-----|---------|---------------|
| Revenue Real USD (deflactado) | `SUM(revenue_usd_tc_real)` | Quita efecto inflación |
| Margen Real USD | `SUM(margen_bruto_ars) / TC_dia` | Margen en dólares reales |
| TC Promedio Aplicado | `AVG(tc_dia) por mes` | Seguimiento deslizamiento cambiario |
| Efecto TC en Margen | `Margen_ARS × (1/TC_actual - 1/TC_anterior)` | Ganancia/pérdida por TC |

---

## 4. Visualizaciones Recomendadas

### Panel 1: Scorecards de Margen

```
┌──────────────────┬──────────────────┬────────────────┬────────────────┐
│ Margen Bruto %   │ Margen Bruto ARS │ Margen USD     │ EBITDA Est.    │
│ 19.3%            │ ARS 238M         │ USD 212K       │ ARS 142M       │
│ ▼ -0.8pp YoY    │ ▲ +15% YoY      │ ▲ +3.1% YoY   │ 11.5%          │
└──────────────────┴──────────────────┴────────────────┴────────────────┘
```

---

### Panel 2: Waterfall de Margen por Categoría

**Tipo**: Waterfall / Bridge chart  
- Punto de partida: Revenue total del periodo  
- Barras negativas: Costo de mercadería por categoría  
- Barras positivas/negativas intermedias: Variación de margen vs año anterior  
- Punto final: Margen Bruto Total  
- Colores: Categoría → Herbicidas (verde), Fertilizantes (azul), Fungicidas (naranja), Insecticidas (violeta), Semillas (amarillo)

---

### Panel 3: Scatter Plot — Margen % vs Revenue por Producto

**Tipo**: Scatter plot  
- Eje X: Revenue total ARS (escala log)  
- Eje Y: Margen bruto %  
- Tamaño burbuja: Número de transacciones  
- Color: Clasificación ABC (A=verde, B=amarillo, C=rojo)  
- Cuadrantes:
  - Q1 (alto revenue, alto margen) = "Estrellas" → priorizar
  - Q2 (bajo revenue, alto margen) = "Nichos" → desarrollar
  - Q3 (alto revenue, bajo margen) = "Volumen" → revisar pricing
  - Q4 (bajo revenue, bajo margen) = "Candidatos a descatalogación"

---

### Panel 4: LTV Distribución por Tier

**Tipo**: Box plot + tabla resumen  
- Un box por tier (A, B, C, D)  
- Muestra: mediana, percentiles, outliers  
- Tabla debajo: N clientes, LTV promedio, LTV mediana, LTV max por tier  
- Toggle: ARS / USD

---

### Panel 5: Evolución del Margen % — Serie Histórica

**Tipo**: Line chart con banda  
- Eje X: Meses 2016–2026  
- Línea 1: Margen % global  
- Línea 2 (sombra): Margen % año anterior (comparativa)  
- Banda de color: Zona objetivo (18%–22%)  
- Anotaciones: Eventos macroeconómicos (devaluaciones, congelamiento de precios)

---

### Panel 6: Rentabilidad por Sucursal — Radar Chart

**Tipo**: Radar (spider) chart  
- 5 ejes: Revenue, Margen %, Crecimiento YoY, Clientes Activos, LTV Promedio  
- Una línea por sucursal  
- Permite comparar sucursales en múltiples dimensiones simultáneamente

---

### Panel 7: Mapa de Calor — Margen por Cliente x Categoría

**Tipo**: Heatmap cruzado  
- Filas: Top 50 clientes por revenue  
- Columnas: 5 categorías  
- Valor: Margen % en cada celda  
- Color: Rojo (< 10%) → Verde (> 25%)  
- Identifica qué clientes están "destruyendo" margen en alguna categoría

---

### Panel 8: Delta vs Tier Benchmark

**Tipo**: Bullet chart / bar chart con referencia  
- Un bar por cliente (top 30 por revenue)  
- Valor: Delta de margen vs benchmark de su tier (positivo o negativo)  
- Línea de referencia: 0 (igual al tier)  
- Color: Verde si supera, rojo si está por debajo  
- Tooltip: Nombre cliente, Tier, Margen%, Benchmark tier%

---

## 5. Tablas dbt Utilizadas

| Tabla dbt | Schema | Uso |
|-----------|--------|-----|
| `margen_por_producto` | `agronova_finance` | Margen anual, tendencia, clasificación rentabilidad |
| `margen_por_cliente` | `agronova_finance` | LTV, delta vs tier, clasificación |
| `fct_ventas` | `agronova_sales` | Margen por sucursal, TC real, detalle |
| `ventas_mensuales` | `agronova_sales` | Evolución mensual del margen |
| `abc_productos` | `agronova_sales` | Clasificación ABC con margen% |
| `dim_clientes` | `agronova_core` | Segmentación, tier, LTV histórico |
| `dim_productos` | `agronova_core` | Margen base del producto |

### Query: Scatter Plot Margen vs Revenue por Producto

```sql
SELECT
    producto_id,
    nombre_producto,
    categoria,
    clasificacion_abc,
    SUM(total_ars)                                    AS revenue_ars,
    SUM(margen_bruto_ars)                             AS margen_ars,
    SUM(margen_bruto_ars) / NULLIF(SUM(total_ars), 0) * 100 AS margen_pct,
    COUNT(DISTINCT venta_id)                          AS n_transacciones
FROM agronova_sales.fct_ventas
WHERE es_completada = true
  AND anio = 2026
GROUP BY 1, 2, 3, 4
ORDER BY revenue_ars DESC;
```

### Query: Clientes por Cuadrante de Rentabilidad

```sql
WITH metricas AS (
    SELECT
        cliente_id,
        cliente_razon_social,
        tier_cliente,
        SUM(total_ars)                                       AS revenue_ars,
        SUM(margen_bruto_ars) / NULLIF(SUM(total_ars), 0)  AS margen_pct
    FROM agronova_sales.fct_ventas
    WHERE es_completada = true AND anio = 2026
    GROUP BY 1, 2, 3
),
medianas AS (
    SELECT
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY revenue_ars) AS mediana_revenue,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY margen_pct)  AS mediana_margen
    FROM metricas
)
SELECT
    m.*,
    CASE
        WHEN m.revenue_ars >= md.mediana_revenue AND m.margen_pct >= md.mediana_margen THEN 'Estrella'
        WHEN m.revenue_ars <  md.mediana_revenue AND m.margen_pct >= md.mediana_margen THEN 'Nicho'
        WHEN m.revenue_ars >= md.mediana_revenue AND m.margen_pct <  md.mediana_margen THEN 'Volumen'
        ELSE 'Revisar'
    END AS cuadrante
FROM metricas m
CROSS JOIN medianas md;
```

---

## 6. Frecuencia de Actualización

| Componente | Frecuencia | Trigger |
|-----------|-----------|---------|
| Margen bruto global | Diaria | `dbt run --select ventas_mensuales` |
| Margen por producto | Mensual | Día 3 del mes |
| Margen por cliente / LTV | Mensual | Día 3 del mes |
| Rentabilidad por sucursal | Mensual | Día 3 del mes |
| Scatter plot productos | Mensual | Junto con ABC |

---

## 7. Filtros del Dashboard

- **Período**: Año / Trimestre / Mes / Rango personalizado
- **Sucursal**: Todas / individual (para P&L por sucursal)
- **Categoría de producto**: Multiselector
- **Tier de Cliente**: A / B / C / D
- **Clasificación ABC**: Producto A / B / C
- **Moneda**: ARS nominal / USD real
- **Tipo de Proveedor**: Nacional / Internacional (para análisis de margen por tipo de abastecimiento)

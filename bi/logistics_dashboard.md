# Logistics Dashboard — AgroNova Argentina S.A.

## 1. Usuario Objetivo

| Rol | Frecuencia de uso |
|-----|------------------|
| Jefe de Logística | Diaria |
| Encargado de Depósito (x3) | Diaria |
| Gerente de Operaciones | Semanal |
| Director Comercial | Mensual (impacto en satisfacción cliente) |
| CFO | Mensual (costos logísticos) |

**Nivel de detalle**: Operativo — despacho individual, depósito, región destino. Drill-down al evento de transporte.

---

## 2. Objetivo del Negocio

Monitorear la **eficiencia de la cadena de entrega** de AgroNova, asegurando:

- Alta tasa OTIF (On Time In Full) como diferenciador competitivo
- Control de costos de flete en relación al revenue generado
- Identificación de rutas y regiones con demoras sistemáticas
- Optimización de la distribución entre depósitos según demanda regional
- Prevención de roturas de stock por delays en cadena

---

## 3. KPIs Logísticos

### 3.1 OTIF (On Time In Full)

| KPI | Definición | Target | Alerta |
|-----|-----------|--------|--------|
| OTIF % Global | `COUNT(resultado='A_Tiempo') / COUNT(*)` | ≥ 92% | < 85% rojo |
| OTIF % por Región | OTIF segmentado por región destino | PAM ≥ 95%, NOA ≥ 88% | — |
| OTIF % por Depósito | OTIF segmentado por depósito origen | ≥ 90% cada uno | — |
| OTIF % Temporada Alta | OTIF Oct–Nov (pico de demanda) | ≥ 90% | < 80% crítico |
| Entregas Demoradas (mes) | `COUNT(resultado='Demorado')` | < 5% total despachos | — |
| Cancelaciones (mes) | `COUNT(estado='Cancelado')` | < 1% total | — |

### 3.2 Tiempos de Tránsito

| KPI | Definición | Benchmark |
|-----|-----------|-----------|
| Días de Tránsito Promedio | `AVG(dias_transito_real)` | < 4 días promedio |
| Días de Tránsito por Región | `AVG` por región destino | PAM: 2d, NOA: 7d, PAT: 9d |
| Días de Demora Promedio | `AVG(dias_demora)` solo demorados | < 2 días |
| Desvío vs Estimado | `AVG(dias_transito_real - dias_transito_base)` | ≤ 0 días (a tiempo o antes) |
| Tiempo Total (Pedido→Entrega) | `fecha_entrega - fecha_pedido` (estimado) | < 5 días PAM, < 12 días NOA |

### 3.3 Costos Logísticos

| KPI | Definición | Target |
|-----|-----------|--------|
| Costo Flete Total ARS | `SUM(costo_flete_ars)` del período | Presupuesto |
| Flete / Revenue % | `SUM(costo_flete) / SUM(revenue_ventas)` (estimado) | < 3.5% |
| Costo por Kg ARS | `SUM(costo_flete) / SUM(peso_kg)` | Benchmark por región |
| Costo por Despacho | `AVG(costo_flete_ars)` | PAM < ARS 45K, NOA < ARS 90K |
| Costo Flete YoY % | Variación nominal (esperado: ≈ inflación) | ≤ inflación + 5% |
| Costo Flete USD | `SUM(costo_flete_ars) / TC_mes` | Comparable entre años |

### 3.4 Performance por Depósito

| KPI | Definición | Target |
|-----|-----------|--------|
| Despachos por Depósito (mes) | `COUNT(*) GROUP BY deposito_origen_id` | Rosario > 50% |
| OTIF por Depósito | OTIF individual de cada centro | ≥ 90% |
| Costo Promedio de Despacho | `AVG(costo_flete)` por depósito | Benchmark |
| Regiones Servidas | Regiones que atiende cada depósito | Cobertura esperada |
| Tiempo Promedio de Despacho | Desde pedido hasta despacho (no tenemos dato exacto, proxy) | < 2 días |

### 3.5 Transportistas

| KPI | Definición |
|-----|-----------|
| OTIF por Transportista | `COUNT(A_Tiempo) / COUNT(*)` por transportista |
| Costo por Kg por Transportista | `AVG(costo_por_kg_ars)` por empresa |
| Demoras por Transportista | `AVG(dias_demora)` por empresa |
| Ranking de Transportistas | Por OTIF × costo |

---

## 4. Visualizaciones Recomendadas

### Panel 1: Scorecards OTIF

```
┌──────────────────┬───────────────────┬─────────────────┬──────────────────┐
│ OTIF Global      │ Entregas Demoradas│ Costo Flete ARS │ Días Tránsito    │
│ 91.4%            │ 8.6% (387/4,490) │ ARS 42.3M       │ 4.2 días promedio│
│ ▼ -1.2pp MoM    │ ▲ +0.8pp MoM     │ ▲ +18% YoY      │ vs 3.9d anterior │
└──────────────────┴───────────────────┴─────────────────┴──────────────────┘
```

---

### Panel 2: OTIF por Región — Bar Chart Horizontal

**Tipo**: Horizontal bar chart con línea de target  
- Una barra por región (PAM / NOA / NEA / CUY / PAT)  
- Color: Verde ≥ 92%, Amarillo 85–92%, Rojo < 85%  
- Línea vertical: 92% (target global)  
- Segunda barra (más delgada): Mismo mes año anterior  
- Tooltip: N° total despachos, N° demorados, N° a tiempo

---

### Panel 3: Evolución OTIF — Serie Temporal

**Tipo**: Line chart dual  
- Eje X: Meses (24 meses rolling)  
- Línea 1: OTIF % global  
- Línea 2: % de entregas demoradas (eje derecho, invertido)  
- Banda de color: Zona objetivo (90–100%)  
- Highlight: Temporadas agrícolas (Oct–Nov: mayor volumen, mayor presión logística)

---

### Panel 4: Distribución de Días de Tránsito — Histograma

**Tipo**: Histograma por región  
- Eje X: Días de tránsito (1 a 30)  
- Eje Y: Número de despachos  
- Colores por región (una por región)  
- Líneas verticales: Base estimada por región (benchmark)  
- Distribución sesgo-derecha = muchos despachos a tiempo + cola de demorados

---

### Panel 5: Mapa de Costos Logísticos por Región

**Tipo**: Choropleth map de Argentina  
- Regiones coloreadas por costo promedio de flete  
- Tamaño de burbuja en centroide: Número de despachos  
- Tooltip: Región, N° despachos, Costo promedio, OTIF%  
- Permite identificar rutas costosas o regiones problemáticas

---

### Panel 6: Performance de Depósitos — Radar

**Tipo**: Radar chart (spider)  
- 5 ejes: OTIF%, Costo promedio, Despachos/mes, Cobertura regional, Tiempo promedio  
- Una línea por depósito (Rosario / Córdoba / Salta)  
- Normalizado (0–100) para comparabilidad  
- Identifica el depósito "estrella" y el que necesita mejoras

---

### Panel 7: Scatter — Costo vs OTIF por Transportista

**Tipo**: Scatter plot  
- Eje X: OTIF% del transportista  
- Eje Y: Costo promedio por Kg ARS  
- Tamaño burbuja: Número de despachos  
- Q1 (alto OTIF, bajo costo) = "Socios clave"  
- Q3 (bajo OTIF, alto costo) = "Candidatos a reemplazar"

---

### Panel 8: Tabla de Despachos con Demora

**Tipo**: Data table drillable  
- Solo despachos con `resultado_entrega = 'Demorado'`  
- Columnas: Fecha despacho, Cliente, Depósito origen, Región destino, Transportista, Días base, Días real, Días demora, Costo flete  
- Ordenada por días de demora (mayor primero)  
- Filtros: Depósito / Región / Transportista / Período

---

## 5. Tablas dbt Utilizadas

| Tabla dbt | Schema | Uso |
|-----------|--------|-----|
| `stg_logistica` | `agronova_staging` | Detalle de despachos, resultado_entrega, dias_demora |
| `dim_clientes` | `agronova_core` | Región destino, segmentación |
| `fct_ventas` | `agronova_sales` | Estimación flete/revenue ratio |

### Query: OTIF por Región y Mes

```sql
SELECT
    anio,
    mes,
    r.nombre_region AS region_destino,
    COUNT(*)                                              AS total_despachos,
    COUNT(*) FILTER (WHERE resultado_entrega = 'A_Tiempo') AS a_tiempo,
    COUNT(*) FILTER (WHERE resultado_entrega = 'Demorado')  AS demorados,
    ROUND(
        COUNT(*) FILTER (WHERE resultado_entrega = 'A_Tiempo')::numeric
        / NULLIF(COUNT(*), 0) * 100
    , 2)                                                  AS otif_pct,
    ROUND(AVG(dias_demora) FILTER (WHERE resultado_entrega = 'Demorado'), 1) AS demora_promedio_dias
FROM agronova_staging.stg_logistica l
JOIN agronova.dim_region r ON r.region_id = l.region_destino_id
WHERE estado != 'Cancelado'
GROUP BY 1, 2, 3
ORDER BY anio DESC, mes DESC, total_despachos DESC;
```

### Query: Ranking de Transportistas

```sql
SELECT
    transportista,
    COUNT(*)                                              AS total_despachos,
    ROUND(
        COUNT(*) FILTER (WHERE resultado_entrega = 'A_Tiempo')::numeric
        / NULLIF(COUNT(*), 0) * 100
    , 2)                                                  AS otif_pct,
    ROUND(AVG(costo_por_kg_ars), 2)                      AS costo_kg_promedio,
    ROUND(AVG(dias_demora) FILTER (WHERE dias_demora > 0), 1) AS dias_demora_prom
FROM agronova_staging.stg_logistica
WHERE estado != 'Cancelado'
  AND transportista IS NOT NULL
GROUP BY 1
HAVING COUNT(*) >= 10
ORDER BY otif_pct DESC, costo_kg_promedio ASC;
```

---

## 6. Frecuencia de Actualización

| Componente | Frecuencia | Horario |
|-----------|-----------|---------|
| OTIF del día / semana | Diaria | 6:00 AM |
| Tabla de despachos demorados | Diaria | 6:00 AM (para gestión del día) |
| OTIF mensual por región | Mensual | Día 2 del mes |
| Costos logísticos | Mensual | Día 2 del mes |
| Ranking de transportistas | Mensual | Día 2 del mes |

---

## 7. Filtros del Dashboard

- **Período**: Semana / Mes / Trimestre / Año
- **Depósito origen**: Rosario / Córdoba / Salta
- **Región destino**: PAM / NOA / NEA / CUY / PAT
- **Transportista**: Selector individual o todos
- **Estado**: Entregado / Demorado / En tránsito / Cancelado
- **Resultado**: A_Tiempo / Demorado / En_Transito / Cancelado

# GIS Dashboard — AgroNova Argentina S.A.

## 1. Usuario Objetivo

| Rol | Frecuencia de uso |
|-----|------------------|
| Director Comercial | Semanal |
| Gerentes Regionales | Semanal |
| Director de Operaciones | Mensual |
| CEO / Directorio | Mensual (cobertura y expansión) |
| Analista de Marketing | Ad-hoc (campañas geográficas) |

**Nivel de detalle**: Geoespacial — desde el mapa nacional hasta provincia, región y punto de venta. Permite detectar zonas sin cobertura, concentración de clientes y performance regional.

---

## 2. Objetivo del Negocio

Proveer una **perspectiva geográfica** del negocio para:

- Visualizar la distribución y densidad de la cartera de clientes en el territorio
- Identificar zonas con alta densidad de producción agrícola y baja penetración de AgroNova (oportunidad)
- Monitorear la cobertura de cada sucursal y detectar "blancos" geográficos
- Planificar la apertura de nuevas sucursales o expansión de vendedores zonales
- Correlacionar revenue con geografía para identificar patrones regionales

---

## 3. KPIs Geoespaciales

### 3.1 Cobertura Comercial

| KPI | Definición | Target |
|-----|-----------|--------|
| Clientes por Provincia | `COUNT DISTINCT cliente_id GROUP BY provincia` | — |
| Provincias Activas | Provincias con ≥ 1 cliente con compra en 12M | ≥ 18 provincias |
| Densidad de Clientes | Clientes por 1,000 km² de área agrícola | Benchmark regional |
| Cobertura Regional % | `Provincias_activas / Provincias_totales` por región | > 80% en PAM |
| Revenue por Provincia | `SUM(total_ars) GROUP BY provincia_cliente` | — |

### 3.2 Heatmap de Clientes

| KPI | Definición | Uso |
|-----|-----------|-----|
| Densidad de Clientes por Zona | Concentración geográfica en mapa de calor | Identificar clusters |
| Revenue por km² | `Revenue_provincia / area_km2_agricola` | Intensidad comercial |
| Tier A por Provincia | COUNT clientes A activos por provincia | Identificar zonas de alto valor |
| Clientes sin Compra > 180d | Clientes inactivos por zona | Campañas de reactivación territorial |

### 3.3 Performance de Sucursales

| KPI | Definición |
|-----|-----------|
| Radio de Cobertura | Distancia máxima de clientes atendidos desde cada sucursal |
| Revenue por km² de cobertura | `Revenue_sucursal / Area_cobertura` |
| Clientes fuera del radio natural | Clientes que podrían ser mejor atendidos por otra sucursal |
| OTIF por zona | Correlación entre distancia y performance logística |

### 3.4 Distribución Regional

| KPI | Definición | Target |
|-----|-----------|--------|
| PAM share revenue | Revenue Pampeana / Total | 55–70% |
| NOA + NEA share | Revenue zonas norte / Total | > 15% (diversificación) |
| CUY share | Revenue Cuyo / Total | > 7% |
| PAT share | Revenue Patagonia / Total | > 3% |
| Crecimiento revenue por región | YoY% por región | NOA: ≥ +15% |

---

## 4. Visualizaciones Recomendadas

### Panel 1: Mapa Principal Interactivo (capa base)

**Tipo**: Mapa coroplético de Argentina (provincias)  
**Librería recomendada**: Leaflet.js / Mapbox GL / deck.gl  
**Capas disponibles** (toggle):
- Capa 1: Revenue por provincia (degradado de color)
- Capa 2: N° clientes activos (burbujas dimensionadas)
- Capa 3: Tier de clientes (colores por tier)
- Capa 4: Clientes en riesgo de churn (puntos rojos)
- Capa 5: Logística — despachos y demoras

**Interactividad**:
- Zoom hasta nivel provincia / departamento
- Click en provincia → panel lateral con métricas
- Hover → tooltip con Revenue, N° Clientes, Tier mix, OTIF%

---

### Panel 2: Mapa de Sucursales y Radio de Cobertura

**Tipo**: Mapa con marcadores + círculos de radio

```
[★ Rosario Hub]     Radio 400km → PAM núcleo
[★ CABA Central]    Radio 300km → PAM sur + Buenos Aires
[★ Córdoba Agro]    Radio 350km → PAM interior + NOA sur
[★ Mendoza Vinos]   Radio 500km → CUY + PAT norte
[★ Salta Norte]     Radio 600km → NOA + NEA
```

- Marcadores de sucursal con pop-up: Revenue, Clientes, OTIF, Vendedores activos
- Círculos de radio sugieren área de influencia natural
- Clientes fuera de todos los radios → zonas sin cobertura (oportunidad)

---

### Panel 3: Heatmap de Densidad de Clientes

**Tipo**: Heatmap (kernel density) sobre mapa base  
- Intensidad por concentración de clientes con lat/lon  
- Escala de color: Transparente → Azul → Amarillo → Rojo (más denso)  
- Toggle: Total clientes / Solo Tier A-B / Solo activos  
- Permite ver clusters de clientes no visibles en el choropleth por provincia

**Dato limitante**: `dim_cliente` tiene provincia pero no lat/lon individual. Se puede centrar el punto en el centroide de la provincia + jitter aleatorio para simular la distribución.

---

### Panel 4: Mapa de Calor — Revenue por Región × Categoría

**Tipo**: Mapa + panel lateral  
- Al seleccionar una región en el mapa, el panel lateral muestra:
  - Revenue por categoría (barras horizontales)
  - Top 5 clientes de la región
  - YoY de la región
  - OTIF de entregas a la región
  - Vendedores activos en la región

---

### Panel 5: Análisis de Brecha Territorial

**Tipo**: Tabla + mapa combinados  
- Muestra provincias con alto potencial agrícola y baja penetración AgroNova  
- Indicadores:
  - Superficie cultivable (datos externos INDEC)
  - Clientes AgroNova activos
  - Revenue AgroNova
  - Revenue potencial estimado (% de la producción provincial)
  - Gap de penetración

| Provincia | Ha Cultivables (est.) | Clientes AgroNova | Revenue ARS | Penetración % |
|-----------|----------------------|-------------------|-------------|---------------|
| Entre Ríos | 4.2M ha | 87 | ARS 480M | 3.2% |
| Santiago del Estero | 2.8M ha | 34 | ARS 180M | 1.8% |
| Tucumán | 1.1M ha | 45 | ARS 220M | 5.6% |

---

### Panel 6: Evolución Temporal Geográfica — Animación

**Tipo**: Mapa animado por año (slider 2016–2026)  
- Muestra cómo fue creciendo la cartera de clientes año a año  
- Permite ver expansión geográfica del negocio  
- Colores más intensos = más clientes / revenue en ese año

---

### Panel 7: Clientes en Riesgo por Zona

**Tipo**: Mapa con marcadores de alerta  
- Puntos rojos: Clientes críticos (riesgo churn 'Critico' + 'Alto')  
- Tamaño del punto: Revenue anual estimado (impacto)  
- Click → ficha del cliente con acción recomendada  
- Agrupación por zona: Permite al vendedor zonal ver su territorio

---

### Panel 8: KPIs Regionales — Tabla Comparativa

**Tipo**: Tabla detallada con sparklines

| Región | Revenue ARS | YoY% | Clientes | OTIF% | Días tránsito | Margen% |
|--------|-------------|------|----------|-------|---------------|---------|
| PAM | ARS 8.2B | +14% | 821 | 94.2% | 2.1d | 19.8% |
| NOA | ARS 1.8B | +22% | 187 | 88.4% | 7.3d | 20.1% |
| NEA | ARS 1.1B | +18% | 143 | 86.7% | 6.8d | 18.9% |
| CUY | ARS 0.9B | +11% | 112 | 91.2% | 5.2d | 21.3% |
| PAT | ARS 0.4B | +8% | 87 | 89.5% | 8.9d | 22.1% |

Sparklines por columna muestran la tendencia de los últimos 12 meses.

---

## 5. Tablas dbt Utilizadas

| Tabla dbt | Schema | Uso |
|-----------|--------|-----|
| `dim_clientes` | `agronova_core` | Provincia, región, tier, coordenadas (centroide) |
| `ventas_por_region` | `agronova_sales` | Revenue por región × categoría |
| `pareto_clientes` | `agronova_sales` | Top clientes por región |
| `fct_ventas` | `agronova_sales` | Revenue por provincia (join cliente_provincia) |
| `churn_candidates` | `agronova_customer` | Clientes en riesgo con provincia |
| `stg_logistica` | `agronova_staging` | OTIF por región destino |
| `rfm_clientes` | `agronova_customer` | Segmentos por región |

### Query: Revenue y Clientes por Provincia

```sql
SELECT
    c.provincia,
    c.region_id,
    r.nombre_region,
    COUNT(DISTINCT v.cliente_id)          AS n_clientes_activos,
    COUNT(DISTINCT CASE WHEN c.tier_cliente = 'A' THEN v.cliente_id END) AS clientes_tier_a,
    SUM(v.total_ars)                      AS revenue_ars,
    SUM(v.revenue_usd_tc_real)            AS revenue_usd,
    SUM(v.margen_bruto_ars)               AS margen_ars,
    ROUND(SUM(v.margen_bruto_ars) / NULLIF(SUM(v.total_ars), 0) * 100, 2) AS margen_pct
FROM agronova_sales.fct_ventas v
JOIN agronova_core.dim_clientes c ON c.cliente_id = v.cliente_id
JOIN agronova.dim_region r        ON r.region_id  = c.region_id
WHERE v.es_completada = true
  AND v.anio = 2026
GROUP BY c.provincia, c.region_id, r.nombre_region
ORDER BY revenue_ars DESC;
```

### Query: Clientes en Riesgo por Región (para mapa de alertas)

```sql
SELECT
    ch.cliente_id,
    ch.razon_social,
    ch.tier_cliente,
    ch.nivel_riesgo_churn,
    ch.churn_risk_score,
    ch.revenue_anual_estimado_ars,
    c.provincia,
    c.region_id,
    r.nombre_region
FROM agronova_customer.churn_candidates ch
JOIN agronova_core.dim_clientes c ON c.cliente_id = ch.cliente_id
JOIN agronova.dim_region r        ON r.region_id  = c.region_id
WHERE ch.nivel_riesgo_churn IN ('Critico', 'Alto')
ORDER BY ch.tier_cliente, ch.churn_risk_score DESC;
```

---

## 6. Frecuencia de Actualización

| Componente | Frecuencia | Método |
|-----------|-----------|--------|
| Mapa de revenue por región | Semanal | `dbt run --select ventas_por_region` |
| Mapa de clientes en riesgo | Semanal | `dbt run --select churn_candidates` |
| Brecha territorial | Mensual | Query ad-hoc + datos externos |
| OTIF por región (mapa) | Mensual | `dbt run --select stg_logistica` |
| Heatmap clientes | Mensual | `dbt run --select dim_clientes` |

---

## 7. Filtros del Dashboard

- **Año**: Selector de año (para comparativas)
- **Región**: PAM / NOA / NEA / CUY / PAT (highlight en mapa)
- **Provincia**: Drill-down desde mapa
- **Tier de Cliente**: A / B / C / D (para ver el mapa de valor)
- **Capa del mapa**: Revenue / N° Clientes / Riesgo Churn / Logística
- **Período**: Año completo / Temporada alta / Temporada baja

---

## 8. Consideraciones de Implementación

**Frontend (Next.js fase siguiente)**:
- Mapa principal: `react-leaflet` + tiles OpenStreetMap + `leaflet.heat` para heatmap
- Datos geográficos: GeoJSON de provincias argentinas (IGN Argentina)
- Proyección: EPSG:4326 (WGS84), compatible con Leaflet por defecto
- Performance: Agregar a nivel provincia (no punto por punto) para 4,000 clientes

**Power BI**:
- Usar el visual nativo "Mapa de formas" con mapa personalizado de Argentina
- Conectar a `ventas_por_region` y `dim_clientes` para las métricas

**Datos adicionales sugeridos** (no disponibles en el modelo actual):
- Superficie de lotes por cliente (disponible en `superficie_ha` de dim_cliente)
- Coordenadas lat/lon de clientes (actualmente solo se tiene provincia → centroide)

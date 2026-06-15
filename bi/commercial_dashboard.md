# Commercial Dashboard — AgroNova Argentina S.A.

## 1. Usuario Objetivo

| Rol | Frecuencia de uso |
|-----|------------------|
| Director Comercial | Diaria |
| Gerentes Regionales (5) | Diaria |
| Key Account Managers | Semanal |
| Jefes de Sucursal | Diaria |
| Analista Comercial | Ad-hoc |

**Nivel de detalle**: Táctico-operativo — ventas por producto, región, vendedor y cliente con drill-down hasta la transacción.

---

## 2. Objetivo del Negocio

Dar al equipo comercial **visibilidad en tiempo real sobre las ventas**, permitiendo:

- Monitorear el avance de cada sucursal y vendedor contra target
- Identificar oportunidades de cross-selling entre productos y clientes
- Detectar cambios en el mix de categorías (potencial señal de competencia)
- Gestionar descuentos y ticket promedio para optimizar el margen
- Tomar decisiones de acción comercial en el corto plazo (semana/mes)

---

## 3. KPIs Comerciales

### 3.1 Ventas por Categoría

| KPI | Definición | Target |
|-----|-----------|--------|
| Revenue por Categoría ARS | `SUM(total_ars) GROUP BY producto_categoria` | Benchmark anual |
| Mix de Categorías % | `Revenue_cat / Revenue_total` | Herbicidas < 35% |
| Unidades Vendidas | `SUM(cantidad) GROUP BY categoria` | — |
| Ticket Promedio por Categoría | `SUM(total_ars) / COUNT(venta_id)` | Benchmark |
| Variación YoY por Categoría | Crecimiento vs año anterior | ≥ inflación |

### 3.2 Ventas por Región y Sucursal

| KPI | Definición | Target |
|-----|-----------|--------|
| Revenue por Región | `SUM(total_ars) GROUP BY cliente_region` | Presupuesto regional |
| Participación Regional % | `Revenue_region / Revenue_total` | PAM: 55-70% |
| Revenue por Sucursal | `SUM(total_ars) GROUP BY sucursal_id` | Presupuesto sucursal |
| Variación YoY Sucursal | Crecimiento de la sucursal | ≥ 10% nominal |
| Clientes Activos por Región | COUNT DISTINCT con compras en 90 días | ≥ 240 / región PAM |

### 3.3 Pareto de Clientes

| KPI | Definición | Alerta |
|-----|-----------|--------|
| Top 20% Revenue Acumulado | `SUM revenue top 20% clientes` | < 60% = baja concentración |
| HHI de Concentración | `SUM(share_cliente²)` | > 0.15 = riesgo concentración |
| Clientes Tier A sin compra > 60d | COUNT clientes A inactivos | > 5 = alerta comercial |
| Revenue Tier A / Total | % de revenue en Tier A | 50-60% rango normal |

### 3.4 Performance de Vendedores

| KPI | Definición | Benchmark |
|-----|-----------|-----------|
| Revenue por Vendedor | `SUM(total_ars) GROUP BY vendedor_id` | Promedio sucursal |
| Clientes Atendidos | COUNT DISTINCT clientes / vendedor | ≥ 20 / mes |
| Ticket Promedio | Revenue / N° transacciones | Benchmark regional |
| Tasa de Cierre | Completadas / Total pedidos | ≥ 95% |
| Margen Generado | `SUM(margen_bruto_ars) / vendedor` | ≥ 18% |
| Ranking por Sucursal | `RANK() OVER (PARTITION BY sucursal)` | — |

### 3.5 Cross-Selling

| KPI | Definición | Target |
|-----|-----------|--------|
| Categorías por Cliente | AVG categorías distintas compradas | ≥ 2.5 |
| Clientes con 1 sola categoría | COUNT clientes "mono-categoría" | < 30% |
| Penetración Fertilizantes en clientes Herbicidas | % que compra ambas | > 50% |
| Revenue Incremental Cross-sell | Revenue nuevas categorías por cliente | +15% YoY |

### 3.6 Ticket Promedio y Descuentos

| KPI | Definición | Target |
|-----|-----------|--------|
| Ticket Promedio ARS | `AVG(total_ars) WHERE es_completada` | Benchmark mensual |
| Ticket Promedio USD | `AVG(revenue_usd_tc_real)` | Comparable entre años |
| Descuento Promedio % | `AVG(descuento_pct) * 100` | < 8% |
| Ventas con Descuento % | `COUNT(tiene_descuento=TRUE) / COUNT(*)` | < 40% |
| Impacto Descuento en Revenue | `SUM(total_ars * descuento_pct)` | < 5% revenue total |

---

## 4. Visualizaciones Recomendadas

### Panel 1: Scorecards Comerciales (header)

```
┌──────────────┬───────────────┬─────────────────┬────────────────┐
│ Revenue Mes  │ Ticket Prom.  │ Clientes Activos│ Descuento Prom │
│ ARS 1.23B    │ ARS 823K      │ 1,187           │ 5.4%           │
│ ▲ +12% MoM  │ ▲ +3% MoM    │ ▼ -2% MoM       │ ▼ vs 6.1%      │
└──────────────┴───────────────┴─────────────────┴────────────────┘
```

---

### Panel 2: Revenue por Categoría — Tendencia Mensual

**Tipo**: Stacked area chart (área apilada)  
**Eje X**: Meses (12 meses rolling)  
**Eje Y**: Revenue ARS  
**Series**: Herbicidas / Fertilizantes / Fungicidas / Insecticidas / Semillas  
**Color**: Paleta corporativa por categoría  
**Interactividad**: Click en categoría → drill-down a subcategorías y SKUs

---

### Panel 3: Mapa de Calor — Revenue por Región x Categoría

**Tipo**: Heatmap tabla  
- Filas: 5 regiones  
- Columnas: 5 categorías  
- Valor: Revenue ARS en millones  
- Color: Intensidad de ventas  
- Tooltip: YoY %, clientes activos

---

### Panel 4: Ranking de Vendedores

**Tipo**: Horizontal bar chart con rankings  
- Ordenado por Revenue Total descendente  
- Barras coloreadas por sucursal  
- Columnas: Revenue, Clientes, Ticket Prom., Margen %  
- Indicador: ▲▼ vs mes anterior  
- Filtro: Por sucursal / categoría

---

### Panel 5: Curva de Pareto de Clientes

**Tipo**: Dual-axis chart  
- Barras: Revenue por cliente (ordenado desc.)  
- Línea: % acumulado de revenue (eje Y derecho)  
- Líneas de referencia horizontal: 80% y vertical: 20%  
- Tooltip: Nombre cliente, Tier, Revenue, % acumulado

---

### Panel 6: Cross-Selling Matrix

**Tipo**: Bubble chart / matriz de co-ocurrencia  
- Eje X: Categoría A  
- Eje Y: Categoría B  
- Tamaño burbuja: Número de clientes que compran ambas  
- Color: % de penetración  

**Alternativa**: Chord diagram mostrando flujos de co-compra entre categorías.

---

### Panel 7: Evolución del Ticket Promedio

**Tipo**: Line chart con banda de confianza  
- Eje X: Meses (24 meses)  
- Línea principal: Ticket promedio ARS  
- Línea secundaria: Ticket promedio USD (eje der.)  
- Banda: ±1 desvío estándar  
- Segmentación: Por tier de cliente (A/B/C/D en colores)

---

### Panel 8: Tabla de Transacciones Recientes

**Tipo**: Data table con drill-through  
- Columnas: Fecha, Cliente, Producto, Categoría, Cantidad, Total ARS, Vendedor, Estado  
- Orden: Fecha desc.  
- Filtros: Estado, Canal, Categoría, Sucursal  
- Export: CSV / Excel

---

## 5. Tablas dbt Utilizadas

| Tabla dbt | Schema | Uso |
|-----------|--------|-----|
| `fct_ventas` | `agronova_sales` | Transacciones detalladas, ticket, descuentos |
| `ventas_mensuales` | `agronova_sales` | Tendencias mensuales por sucursal |
| `ventas_por_region` | `agronova_sales` | Mix regional × categoría |
| `pareto_clientes` | `agronova_sales` | Curva Pareto, concentración |
| `abc_productos` | `agronova_sales` | SKUs por categoría y clasificación |
| `dim_vendedores` | `agronova_core` | Performance y ranking de vendedores |
| `dim_clientes` | `agronova_core` | Segmentación, tier, estado |

### Query: Cross-Selling — Categorías por Cliente

```sql
SELECT
    cliente_id,
    COUNT(DISTINCT producto_categoria)  AS n_categorias,
    STRING_AGG(DISTINCT producto_categoria, ' | ' ORDER BY producto_categoria) AS categorias
FROM agronova_sales.fct_ventas
WHERE es_completada = true
GROUP BY cliente_id
HAVING COUNT(DISTINCT producto_categoria) >= 2
ORDER BY n_categorias DESC;
```

### Query: Vendedores vs Promedio de Sucursal

```sql
SELECT
    vendedor_id,
    nombre_vendedor,
    nombre_sucursal,
    SUM(total_ars)                                                        AS revenue_ars,
    AVG(total_ars)                                                        AS ticket_promedio,
    AVG(SUM(total_ars)) OVER (PARTITION BY sucursal_id)                  AS avg_sucursal,
    SUM(total_ars) / AVG(SUM(total_ars)) OVER (PARTITION BY sucursal_id) AS ratio_vs_promedio
FROM agronova_sales.fct_ventas
WHERE es_completada = true
  AND anio = 2026
GROUP BY vendedor_id, nombre_vendedor, nombre_sucursal, sucursal_id
ORDER BY revenue_ars DESC;
```

---

## 6. Frecuencia de Actualización

| Componente | Frecuencia | Horario |
|-----------|-----------|---------|
| Revenue del día / acumulado mes | Diaria | 7:00 AM |
| Ranking vendedores | Diaria | 7:00 AM |
| Pareto clientes | Semanal | Lunes 6:00 AM |
| Cross-selling matrix | Semanal | Lunes 6:00 AM |
| Categorías y mix | Mensual | Día 2 del mes |

---

## 7. Filtros del Dashboard

- **Período**: Mes actual / Últimos 3M / Últimos 12M / Año calendario
- **Sucursal**: Multiselector (todas por defecto)
- **Región**: PAM / NOA / NEA / CUY / PAT
- **Categoría de Producto**: Multiselector
- **Canal de Venta**: Directo / Distribuidor / E-commerce / Teléfono
- **Tier de Cliente**: A / B / C / D
- **Vendedor**: Selector individual (para vista personal del vendedor)

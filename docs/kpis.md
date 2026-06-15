# KPIs y Metricas — AgroNova Argentina S.A.

## KPIs Ejecutivos (v_kpi_ejecutivo)

| KPI | Formula | Frecuencia | Meta |
|-----|---------|-----------|------|
| Revenue Total ARS | `SUM(total_ars)` en Fact_Ventas | Mensual | +15% YoY |
| Revenue Total USD | `SUM(total_usd)` | Mensual | > USD 2M/mes |
| Margen Bruto % | `SUM(margen_bruto_ars) / SUM(total_ars)` | Mensual | 18-22% |
| Tickets Completados | `COUNT(*) WHERE estado='Completada'` | Mensual | > 95% |
| Clientes Activos | `COUNT(DISTINCT cliente_id)` en ventas del periodo | Mensual | > 1,200 |
| Ticket Promedio ARS | `SUM(total_ars) / COUNT(DISTINCT venta_id)` | Mensual | Benchmark |
| Nuevos Clientes | Clientes con primer compra en el periodo | Mensual | > 20/mes |

---

## Analisis de Clientes

### RFM (v_clientes_rfm)

| Componente | Definicion | Calculo |
|-----------|-----------|---------|
| **R** — Recencia | Dias desde ultima compra | `CURRENT_DATE - MAX(fecha)` |
| **F** — Frecuencia | Transacciones en 12 meses | `COUNT(DISTINCT venta_id)` |
| **M** — Monetario | Revenue total en 12 meses | `SUM(total_ars)` |

Segmentos RFM:
- **Champions** (R alto, F alto, M alto): clientes VIP, accion: fidelizacion
- **At Risk** (R bajo, F medio): riesgo de churn, accion: reactivacion
- **Lost** (R muy bajo, sin compras recientes): clientes perdidos
- **New** (R alto, F bajo): nuevos a desarrollar

### Pareto (v_pareto_clientes)

```sql
SUM(total_ars) OVER (ORDER BY revenue DESC ROWS UNBOUNDED PRECEDING) /
SUM(total_ars) OVER () AS pct_acumulado
```

Objetivo: identificar el 20% de clientes que generan el 80% del revenue (verificado: top 20% = 77.4%).

### Tasa de Churn

```
Churn Rate = Clientes perdidos en periodo / Clientes activos al inicio del periodo
```

Interpretacion en datos sinteticos: ~30% de los 4,000 clientes estan dados de baja a lo largo de 2016-2026.

---

## Analisis de Productos

### Clasificacion ABC (v_abc_productos)

| Clase | Criterio | Accion |
|-------|---------|--------|
| A | Top 20% por revenue acumulado | Gestion activa, stock prioritario |
| B | Siguiente 30% | Monitoreo regular |
| C | Restante 50% | Revision periodica, posible descatalogo |

### Rotacion de Inventario

```
Rotacion = Costo de mercaderia vendida / Stock promedio
Dias de inventario = 365 / Rotacion
```

Benchmarks del sector:
- **Alta rotacion**: herbicidas y fertilizantes en campana (Oct-Feb) — < 30 dias
- **Baja rotacion**: insecticidas fuera de temporada — > 90 dias

---

## Performance de Ventas

### Por Vendedor (v_performance_vendedores)

| Metrica | Formula |
|---------|---------|
| Revenue del vendedor | `SUM(total_ars) GROUP BY vendedor_id` |
| % sobre total sucursal | Revenue vendedor / Revenue sucursal |
| Ticket promedio | Revenue / COUNT(ventas) |
| Clientes atendidos | COUNT(DISTINCT cliente_id) |

### Por Region

| Metrica | Descripcion |
|---------|-------------|
| Revenue por region | Ventas de clientes en cada region |
| Penetracion de mercado | Clientes activos / Potencial estimado |
| Revenue per capita agricola | Revenue / Hectareas productivas de la region |

### Estacionalidad (v_estacionalidad)

```
Indice estacional del mes M = Revenue promedio de M / Revenue promedio mensual anual
```

Patron esperado: picos en Oct-Nov (factor ~1.6), valle en Jun-Jul (factor ~0.7).

---

## Supply Chain

### Performance de Proveedores (v_supply_chain_mensual)

| Metrica | Formula |
|---------|---------|
| Volumen comprado USD | `SUM(total_usd) WHERE proveedor = X` |
| Fill Rate | Ordenes recibidas / Ordenes pedidas |
| On-Time Delivery | `% WHERE estado = 'Recibida' AND fecha <= fecha_esperada` |
| Concentracion (HHI) | `SUM((share_proveedor)^2)` — riesgo de dependencia |

### Cobertura de Stock

```
Cobertura (dias) = Stock actual / Promedio de ventas diarias
```

- Verde: > 30 dias
- Amarillo: 15-30 dias
- Rojo: < 15 dias (bajo_minimo = TRUE)

---

## Logistica

### Performance Logistica (v_logistica_performance)

| Metrica | Formula | Benchmark |
|---------|---------|-----------|
| Dias de transito promedio | `AVG(dias_transito_real)` | < 5 dias (PAM), < 10 (NOA/NEA) |
| Tasa de entregas a tiempo | `% WHERE estado = 'Entregado' AND dias_real <= dias_base` | > 90% |
| Costo flete / Revenue | `SUM(costo_flete_ars) / SUM(total_ars)` ventas del periodo | < 3% |
| Entregas demoradas | `COUNT(*) WHERE estado = 'Demorado'` | < 5% |

---

## Metricas Dolarizadas

### Revenue en USD Real (v_ventas_dolarizadas)

Vincula `fact_ventas.fecha_id` con `cotizaciones_externas.fecha_id` para obtener el TC del dia de la venta:

```sql
total_usd_real = total_ars / usd_ars_oficial
```

Esta metrica es clave para:
- Comparar performance real entre anos de alta inflacion
- Calcular margen en dolares para productos importados
- Calcular LTV del cliente en USD

### Deflactacion

Para comparar periodos, deflactar por el factor de inflacion:
```
revenue_2016_equivalent = total_ars_2024 / 45.0
```

---

## Dashboard Ejecutivo Mensual

Vista `v_kpi_ejecutivo` consolida:

```
Mes | Revenue ARS | Revenue USD | Margen % | Clientes activos |
    | Tickets completados | Nuevos clientes | Churn del mes |
    | Stock bajo minimo (%) | Demoras logistica (%) |
```

Comparativa con mismo mes del ano anterior (YoY) y con promedio de la serie historica.

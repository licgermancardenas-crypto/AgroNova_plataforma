# Inventory Dashboard — AgroNova Argentina S.A.

## 1. Usuario Objetivo

| Rol | Frecuencia de uso |
|-----|------------------|
| Jefe de Supply Chain | Diaria |
| Encargado de Compras | Diaria |
| Jefe de Depósito (x3) | Diaria |
| Gerente de Operaciones | Semanal |
| Director Financiero | Mensual (valor del inventario) |

**Nivel de detalle**: Operativo — producto × depósito × día. Alertas en tiempo real sobre stock crítico.

---

## 2. Objetivo del Negocio

Garantizar que AgroNova tenga **disponibilidad óptima de producto** para cubrir la demanda estacional, sin exceso de capital inmovilizado, permitiendo:

- Detectar en tiempo real productos bajo mínimo o sin stock
- Priorizar órdenes de compra según clasificación ABC y urgencia
- Reducir el inventario inmovilizado (productos clase C con baja rotación)
- Asegurar cobertura adecuada antes del pico estacional (Oct–Nov)
- Controlar el valor total del stock en ARS y USD

---

## 3. KPIs de Inventario

### 3.1 Rotación de Stock

| KPI | Fórmula | Target | Benchmark |
|-----|---------|--------|-----------|
| Índice de Rotación | `Unidades_vendidas / Stock_promedio` (por mes) | > 1.0x/mes | Herbicidas temporada: > 3x |
| Días de Inventario | `Días_mes / Índice_rotación` | 15–45 días | Temporada alta < 20 días |
| Rotación Anual | `Unidades_vendidas_año / Stock_promedio_año` | > 8x para clase A | Semillas: 4–6x |
| Productos con Rotación > 3x/mes | COUNT productos alta rotación | ≥ 20% cartera | — |
| Productos Sin Movimiento (90d) | COUNT stock > 0 y ventas = 0 en 90 días | < 5% SKUs | — |

### 3.2 Stock Crítico y Alertas

| KPI | Fórmula | Alerta |
|-----|---------|--------|
| Productos Bajo Mínimo | `COUNT(bajo_minimo = TRUE)` | > 10 = alerta diaria |
| Productos Sin Stock | `COUNT(stock_actual = 0)` | > 0 = crítico |
| % Días Bajo Mínimo (mes) | `dias_bajo_minimo / dias_mes` | > 20% = problema estructural |
| Valor en Riesgo (stock crítico) | `SUM(revenue_estimado_30d)` de items en crítico | — |
| SKUs Clase A bajo mínimo | COUNT productos A con stock < mínimo | = 0 ideal |

### 3.3 Productos Inmovilizados

| KPI | Fórmula | Alerta |
|-----|---------|--------|
| Capital Inmovilizado ARS | `SUM(valor_stock_ars)` productos sin rotación en 90d | > ARS 5M |
| % Capital en Clase C | `Valor_stock_C / Valor_stock_total` | < 20% |
| Productos con Stock > 90 días sin venta | `COUNT(dias_inventario > 90)` | < 30 SKUs |
| Merma Acumulada | `SUM(merma_pct * valor_stock_ars)` | < 1% del valor total |

### 3.4 Cobertura y Capacidad

| KPI | Fórmula | Target |
|-----|---------|--------|
| Días de Cobertura por Depósito | `Stock_promedio / Ventas_diarias_promedio` | 15–45 días |
| Cobertura Pre-Temporada (Sep) | Días de cobertura proyectados a Oct | ≥ 30 días |
| Ocupación Depósito (%) | `Stock_actual_ton / Capacidad_ton` | 60–85% |
| Valor Total del Inventario ARS | `SUM(valor_stock_ars)` todos los depósitos | Presupuesto de capital |
| Valor del Inventario en USD | `SUM(valor_stock_ars) / TC_dia` | < USD 1.5M ideal |

---

## 4. Visualizaciones Recomendadas

### Panel 1: Semáforo de Stock (header)

```
┌───────────────────┬─────────────────┬──────────────────┬──────────────────┐
│ 🔴 Sin Stock      │ 🟡 Bajo Mínimo  │ 🟢 Normal        │ 💰 Valor Stock   │
│ 3 SKUs            │ 47 SKUs         │ 2,450 SKUs       │ ARS 892M         │
│ URGENTE           │ Revisar         │ OK               │ ▲ +8% vs mes ant │
└───────────────────┴─────────────────┴──────────────────┴──────────────────┘
```

---

### Panel 2: Tabla de Alertas — Stock Crítico Priorizado

**Tipo**: Data table con código de color por fila  
Columnas:
- Prioridad (1–5 con icono)
- SKU / Nombre Producto
- Categoría / ABC
- Depósito
- Stock Actual / Mínimo / Máximo
- Días de Cobertura
- Ventas Diarias Promedio
- Unidades a Comprar
- Proveedor
- Acción

Ordenada por prioridad + días de cobertura (menor primero).  
**Botón**: Exportar a orden de compra (CSV con proveedor, SKU, cantidad sugerida).

---

### Panel 3: Mapa de Calor — Rotación por Categoría × Depósito

**Tipo**: Heatmap tabla  
- Filas: 5 categorías de producto  
- Columnas: 3 depósitos (Rosario, Córdoba, Salta)  
- Valor: Índice de rotación del mes  
- Color: Azul (alta rotación) → Rojo (baja rotación / inmovilizado)

---

### Panel 4: Evolución del Inventario Total (ARS y USD)

**Tipo**: Dual-axis line chart  
- Eje X: Meses (24 meses rolling)  
- Barras: Valor stock ARS  
- Línea: Valor stock USD (eje derecho)  
- Área sombreada: Temporada alta (Oct–Feb)  
- Permite ver si la empresa "carga" inventario antes de la temporada (comportamiento esperado)

---

### Panel 5: Distribución ABC del Stock

**Tipo**: Stacked bar + donut  
- Barras: Valor de inventario por mes y clase ABC  
- Donut: Mix actual A / B / C en valor y en SKUs  
- Target visual: Clase C < 20% del valor total  
- Permite detectar desequilibrios (demasiado capital en productos C)

---

### Panel 6: Días de Inventario por SKU — Scatter

**Tipo**: Scatter plot  
- Eje X: Días de inventario (log scale)  
- Eje Y: Valor de stock ARS  
- Color: Clasificación ABC  
- Tamaño: Ventas diarias promedio  
- Líneas de referencia verticales: 30 días, 60 días, 90 días  
- Q1 (poco stock, muchos días) = error de cálculo o sin ventas  
- Q4 (mucho stock, muchos días) = capital inmovilizado de alto riesgo

---

### Panel 7: Ocupación de Depósitos — Gauge Charts

**Tipo**: 3 gauge charts (uno por depósito)  
- Rosario Central: 78% capacidad  
- Córdoba Inland: 52% capacidad  
- Salta Norte: 91% capacidad ⚠️  

Colores: Verde (50–80%), Amarillo (80–90%), Rojo (>90% o <30%).

---

### Panel 8: Proyección de Stock Pre-Temporada

**Tipo**: Line chart con proyección  
- Eje X: Meses (Sep, Oct, Nov, Dic)  
- Línea histórica: Stock promedio en mismos meses años anteriores  
- Línea actual: Stock proyectado (Stock_actual - Consumo_esperado)  
- Área de alerta: Zona por debajo del mínimo proyectado  
- Permite identificar si hay que adelantar compras antes de la temporada

---

## 5. Tablas dbt Utilizadas

| Tabla dbt | Schema | Uso |
|-----------|--------|-----|
| `stock_critico` | `agronova_inventory` | Alertas priorizadas, unidades a comprar |
| `rotacion_stock` | `agronova_inventory` | Índice de rotación, días inventario |
| `stg_inventario` | `agronova_staging` | Snapshot completo con estado_stock |
| `dim_productos` | `agronova_core` | ABC, categoría, proveedor |
| `fct_ventas` | `agronova_sales` | Ventas diarias promedio para cobertura |
| `abc_productos` | `agronova_sales` | Velocidad de venta, unidades por año |

### Query: Capital Inmovilizado por Depósito y Clase

```sql
SELECT
    i.deposito_id,
    d.nombre_deposito,
    p.clasificacion_abc,
    COUNT(DISTINCT i.producto_id)                     AS n_skus,
    SUM(i.valor_stock_promedio_ars)                   AS capital_ars,
    ROUND(SUM(i.valor_stock_promedio_ars) /
        SUM(SUM(i.valor_stock_promedio_ars)) OVER () * 100, 2) AS pct_capital
FROM agronova_inventory.rotacion_stock i
JOIN agronova_core.dim_productos p ON p.producto_id = i.producto_id
JOIN (SELECT deposito_id, nombre_deposito
      FROM agronova.dim_deposito) d ON d.deposito_id = i.deposito_id
WHERE i.anio = 2026
  AND i.clasificacion_rotacion IN ('Sin_Movimiento', 'Baja')
GROUP BY 1, 2, 3
ORDER BY capital_ars DESC;
```

### Query: Proyección de Cobertura Pre-Temporada

```sql
SELECT
    sc.producto_id,
    sc.nombre_producto,
    sc.nombre_deposito,
    sc.stock_actual,
    sc.ventas_diarias_promedio,
    sc.dias_cobertura,
    -- Simulación: ¿Cuánto stock queda en 30 días si ventas crecen 50% en temporada?
    sc.stock_actual - (sc.ventas_diarias_promedio * 1.5 * 30) AS stock_proyectado_30d,
    sc.unidades_a_comprar
FROM agronova_inventory.stock_critico sc
WHERE sc.clasificacion_abc IN ('A', 'B')
ORDER BY sc.prioridad_reposicion, sc.dias_cobertura;
```

---

## 6. Frecuencia de Actualización

| Componente | Frecuencia | Horario |
|-----------|-----------|---------|
| Alertas de stock crítico | Diaria | 6:00 AM (antes de inicio de operaciones) |
| Rotación mensual | Mensual | Día 2 del mes |
| Capital inmovilizado | Semanal | Lunes 6:00 AM |
| Proyección pre-temporada | Mensual (especial: Sep) | Día 1 de Sep y Oct |
| Ocupación depósitos | Diaria | 6:00 AM |

---

## 7. Filtros del Dashboard

- **Depósito**: Rosario / Córdoba / Salta / Todos
- **Categoría**: Herbicidas / Fertilizantes / etc.
- **Clasificación ABC**: A / B / C
- **Estado de Stock**: Sin_Stock / Bajo_Mínimo / Alerta / Normal
- **Período de análisis**: Mes actual / Últimos 3M / Año
- **Proveedor**: Para filtrar por origen de abastecimiento

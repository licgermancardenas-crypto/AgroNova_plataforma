# Metrics Catalog — AgroNova Argentina S.A.

Registro canónico de todas las métricas corporativas: definición exacta, fórmula SQL,
tabla dbt de origen y criterios de alerta. Toda visualización o reporte debe referenciar
este catálogo para garantizar que una métrica significa lo mismo en todos los dashboards.

---

## Convenciones

- **ARS**: Pesos argentinos nominales del período
- **USD**: Dólares calculados usando el TC BNA oficial del día de la transacción (`tc_dia`)
- **"Completadas"**: Ventas con `estado = 'Completada'` solamente, salvo indicación contraria
- **"Período"**: Parámetro variable (mes, trimestre, año), definido en el filtro del dashboard
- **Tablas prefix**: `agronova_sales.*`, `agronova_finance.*`, etc. (schemas dbt)

---

## 1. Métricas de Revenue

### 1.1 Revenue Total ARS

| Campo | Valor |
|-------|-------|
| **Definición** | Suma de todas las ventas completadas en el período, expresada en pesos argentinos |
| **Fórmula** | `SUM(total_ars) WHERE es_completada = true` |
| **Tabla dbt** | `agronova_sales.fct_ventas` |
| **Variantes** | Revenue Bruto (incluye Canceladas + Devueltas) |
| **Alerta** | < 90% del presupuesto mensual = amarillo; < 80% = rojo |
| **Nota** | No deflactado. Para comparativas entre años, usar Revenue USD |

### 1.2 Revenue Total USD (TC Real)

| Campo | Valor |
|-------|-------|
| **Definición** | Revenue calculado en dólares usando el tipo de cambio BNA oficial del día de cada venta |
| **Fórmula** | `SUM(revenue_usd_tc_real) WHERE es_completada = true` |
| **Tabla dbt** | `agronova_sales.fct_ventas` |
| **SQL** | `SUM(total_ars / NULLIF(tc_dia, 0))` |
| **Uso** | Comparativas interanuales; elimina el efecto de la inflación |
| **Alerta** | Crecimiento YoY USD < 0% = pérdida real de negocio |

### 1.3 Revenue Neto ARS

| Campo | Valor |
|-------|-------|
| **Definición** | Revenue considerando devoluciones como negativo |
| **Fórmula** | `SUM(revenue_neto_ars)` = Completadas (+) - Devueltas (-) |
| **Tabla dbt** | `agronova_sales.fct_ventas` (columna `revenue_neto_ars`) |
| **Diferencia con Revenue Total** | Revenue Total solo suma Completadas; Revenue Neto descuenta Devueltas |

### 1.4 Revenue YoY %

| Campo | Valor |
|-------|-------|
| **Definición** | Crecimiento porcentual del revenue vs el mismo período del año anterior |
| **Fórmula** | `(Revenue_período - Revenue_mismo_período_año_anterior) / Revenue_mismo_período_año_anterior × 100` |
| **Tabla dbt** | `agronova_sales.ventas_mensuales` (columna `revenue_ars_crecimiento_yoy_pct`) |
| **Interpretación** | En Argentina: YoY ARS positivo no implica crecimiento real. Usar YoY USD para crecimiento real |
| **Alerta** | YoY USD < 0% por 2 meses consecutivos = señal de deterioro real |

### 1.5 Revenue MoM %

| Campo | Valor |
|-------|-------|
| **Definición** | Crecimiento vs el mes inmediato anterior |
| **Fórmula** | `(Revenue_mes - Revenue_mes_anterior) / Revenue_mes_anterior × 100` |
| **Tabla dbt** | `agronova_sales.ventas_mensuales` (columna `revenue_ars_crecimiento_mom_pct`) |
| **Limitación** | Muy afectado por estacionalidad; preferir YoY para tendencias |

### 1.6 CAGR Revenue USD (n años)

| Campo | Valor |
|-------|-------|
| **Definición** | Tasa de crecimiento anual compuesta del revenue en dólares |
| **Fórmula** | `(Revenue_USD_año_final / Revenue_USD_año_inicial)^(1/n) - 1` |
| **SQL** | `POWER(revenue_usd_final / revenue_usd_inicial, 1.0 / n_anios) - 1` |
| **Tabla dbt** | `agronova_sales.ventas_mensuales` (query anual) |
| **Interpretación** | CAGR > 3% USD = crecimiento real. CAGR > 0% USD = sobrevive la inflación |
| **Target** | ≥ 3% USD (5 años) |

---

## 2. Métricas de Margen y Rentabilidad

### 2.1 Margen Bruto ARS

| Campo | Valor |
|-------|-------|
| **Definición** | Ganancia bruta después de descontar el costo de mercadería vendida |
| **Fórmula** | `SUM(margen_bruto_ars) WHERE es_completada = true` |
| **Tabla dbt** | `agronova_sales.fct_ventas` |
| **Componentes** | `margen_bruto_ars = total_ars × margen_bruto_pct_producto` |
| **Limitación** | No incluye gastos de estructura, flete ni comisiones |

### 2.2 Margen Bruto %

| Campo | Valor |
|-------|-------|
| **Definición** | Margen bruto como porcentaje del revenue neto |
| **Fórmula** | `SUM(margen_bruto_ars) / SUM(total_ars) × 100` WHERE es_completada |
| **Tabla dbt** | `agronova_sales.fct_ventas` / `agronova_sales.ventas_mensuales` |
| **Target** | 18%–22% |
| **Alerta** | < 15% = rojo; 15–17% = amarillo |

### 2.3 EBITDA Estimado

| Campo | Valor |
|-------|-------|
| **Definición** | Estimación del EBITDA aplicando un ratio de costos fijos sobre el Margen Bruto |
| **Fórmula** | `Margen_Bruto_ARS × (1 - ratio_costos_fijos)` |
| **Parámetro** | `ratio_costos_fijos = 0.40` (estructura distribuidora comparable) |
| **Advertencia** | ⚠️ Este es un proxy estimado. AgroNova no tiene datos de gastos de estructura en el modelo. No presentar como EBITDA real al directorio. Etiquetar siempre como "EBITDA Estimado (modelo)" |
| **Tabla dbt** | `agronova_sales.ventas_mensuales` (query ad-hoc) |

### 2.4 Margen por Producto %

| Campo | Valor |
|-------|-------|
| **Definición** | Margen bruto de un producto específico, como % de su revenue |
| **Fórmula** | `SUM(margen_bruto_ars) / SUM(total_ars)` agrupado por `producto_id` |
| **Tabla dbt** | `agronova_finance.margen_por_producto` |
| **Uso** | Detectar erosión de margen por producto; decisiones de pricing |

### 2.5 Delta de Margen vs Benchmark de Tier

| Campo | Valor |
|-------|-------|
| **Definición** | Diferencia entre el margen% de un cliente y el promedio de su tier (A/B/C/D) |
| **Fórmula** | `margen_pct_cliente - margen_pct_promedio_tier` |
| **Tabla dbt** | `agronova_finance.margen_por_cliente` (columna `delta_vs_tier_pct`) |
| **Interpretación** | Positivo: este cliente genera más margen que sus pares → valioso. Negativo: recibe mejores condiciones que el promedio → revisar |

---

## 3. Métricas de Clientes

### 3.1 Clientes Activos

| Campo | Valor |
|-------|-------|
| **Definición** | Clientes únicos con al menos una compra completada en los últimos 12 meses |
| **Fórmula** | `COUNT(DISTINCT cliente_id) WHERE ultima_compra >= CURRENT_DATE - 365` |
| **Tabla dbt** | `agronova_core.dim_clientes` (columna `dias_desde_ultima_compra`) |
| **Target** | ≥ 1,200 |
| **Nota** | No equivale a `activo = TRUE` en dim_cliente (eso es sin baja formal) |

### 3.2 Tasa de Churn

| Campo | Valor |
|-------|-------|
| **Definición** | % de clientes que abandonaron el negocio en el período |
| **Fórmula** | `Clientes_con_baja_en_período / Clientes_activos_inicio_período × 100` |
| **Tabla dbt** | `agronova_core.dim_clientes` (campo `anio_baja`) |
| **Target** | < 10% global; Tier A < 3% |
| **Alerta** | > 15% = crítico |

### 3.3 LTV (Lifetime Value)

| Campo | Valor |
|-------|-------|
| **Definición** | Valor total que un cliente ha generado para AgroNova a lo largo de toda su relación comercial |
| **Fórmula LTV ARS** | `SUM(total_ars)` histórico por cliente |
| **Fórmula LTV USD** | `SUM(revenue_usd_tc_real)` histórico por cliente |
| **Tabla dbt** | `agronova_finance.margen_por_cliente` (columnas `ltv_total_ars`, `ltv_total_usd`) |
| **LTV Margen** | `SUM(margen_bruto_ars)` histórico = ganancia real generada |
| **Benchmark** | Tier A > USD 50K LTV; Tier B > USD 20K |

### 3.4 Scores RFM

| Score | Definición | Fórmula | Rango |
|-------|-----------|---------|-------|
| **R (Recencia)** | Score inverso de días desde última compra | `6 - NTILE(5) OVER (ORDER BY recencia_dias ASC)` | 1–5 (5 = más reciente) |
| **F (Frecuencia)** | Score de número de transacciones históricas | `NTILE(5) OVER (ORDER BY frecuencia ASC)` | 1–5 (5 = más frecuente) |
| **M (Monetario)** | Score de revenue total histórico | `NTILE(5) OVER (ORDER BY monetario_ars ASC)` | 1–5 (5 = mayor comprador) |
| **RFM Total** | Suma de los tres scores | `r_score + f_score + m_score` | 3–15 |

### 3.5 Segmentos RFM

| Segmento | Condición | Descripción |
|----------|-----------|-------------|
| Champions | R≥4, F≥4, M≥4 | Mejores clientes: compran frecuente, reciente y mucho |
| Loyal_Customers | R≥4, F≥3 | Compran frecuente y recientemente |
| Potential_Loyalists | R≥3, F≥3, M≥3 | Perfil sólido, potencial a Champion |
| New_Customers | R≥4, F≤2 | Compraron recientemente pero pocas veces |
| Promising | R≥3, F≤2, M≥3 | Potencial alto, frecuencia a desarrollar |
| At_Risk | R≤2, F≥3, M≥3 | Buenos clientes que se están alejando |
| Cant_Lose_Them | R≤2, F≥4, M≥4 | Clientes valiosos que hace tiempo no compran |
| Hibernating | R≤2, F≤2, M≥3 | Dormidos pero con historial de valor |
| Lost | R≤1, F≤1 | Perdidos — recuperación muy difícil |
| Needs_Attention | Resto | Perfil mixto — requieren análisis individual |

### 3.6 Churn Risk Score

| Campo | Valor |
|-------|-------|
| **Definición** | Score de 0 a 100 estimando la probabilidad de abandono de un cliente activo |
| **Fórmula** | `MIN(recencia_dias / churn_days × 40, 40) + (5 - f_score) / 4 × 30 + penalización_caída_revenue` |
| **Componentes** | 40% peso recencia; 30% peso frecuencia; 30% caída de revenue YoY |
| **Tabla dbt** | `agronova_customer.churn_candidates` (columna `churn_risk_score`) |
| **Interpretación** | 0–30: Bajo; 31–60: Medio; 61–80: Alto; 81–100: Crítico |

---

## 4. Métricas de Productos

### 4.1 Clasificación ABC

| Clase | Criterio | Significado |
|-------|---------|-------------|
| **A** | SKUs que acumulan el 70% del revenue total | Alta prioridad: máximo stock, control diario |
| **B** | SKUs entre 70% y 90% del revenue acumulado | Prioridad media: stock normal, revisión semanal |
| **C** | SKUs por encima del 90% acumulado | Baja prioridad: stock mínimo, revisar vigencia |

**Tabla dbt**: `agronova_sales.abc_productos`  
**Nota**: La clasificación ABC en dbt se calcula sobre revenue real de ventas. Puede diferir de la clasificación inicial en `dim_producto` (basada en precio unitario).

### 4.2 Índice de Rotación

| Campo | Valor |
|-------|-------|
| **Definición** | Cuántas veces rota el stock en un período |
| **Fórmula** | `Unidades_vendidas_período / Stock_promedio_período` |
| **Tabla dbt** | `agronova_inventory.rotacion_stock` (columna `indice_rotacion`) |
| **Interpretación** | > 2x/mes = alta rotación; < 0.5x/mes = inventario dormido |
| **Benchmark** | Herbicidas temporada: > 3x/mes. Semillas: 0.5–1x/mes |

### 4.3 Días de Inventario

| Campo | Valor |
|-------|-------|
| **Definición** | Cuántos días de venta cubre el stock promedio actual |
| **Fórmula** | `Stock_promedio / (Ventas_período / Días_hábiles_período)` |
| **Tabla dbt** | `agronova_inventory.rotacion_stock` (columna `dias_de_inventario`) |
| **Target** | 15–45 días. < 15 = riesgo de quiebre; > 60 = sobrestock |
| **Temporada alta (Oct–Nov)** | Objetivo: ≥ 30 días de cobertura al inicio de cada mes |

---

## 5. Métricas Logísticas

### 5.1 OTIF (On Time In Full)

| Campo | Valor |
|-------|-------|
| **Definición** | % de entregas realizadas en el tiempo estipulado y con la cantidad completa |
| **Fórmula** | `COUNT(resultado_entrega = 'A_Tiempo') / COUNT(*) × 100` |
| **Tabla dbt** | `agronova_staging.stg_logistica` (columna `resultado_entrega`) |
| **Componente "On Time"** | `dias_transito_real <= dias_transito_base` |
| **Componente "In Full"** | En este modelo: se asume completo si el estado = 'Entregado'. Sin dato de cantidad parcial |
| **Target** | ≥ 92% global; ≥ 95% para clientes Tier A |
| **Alerta** | < 85% = rojo; OTIF Tier A < 90% = crítico |

### 5.2 Días de Demora Promedio

| Campo | Valor |
|-------|-------|
| **Definición** | Días adicionales sobre el tiempo estimado, solo para entregas demoradas |
| **Fórmula** | `AVG(dias_demora) WHERE resultado_entrega = 'Demorado'` |
| **Tabla dbt** | `agronova_staging.stg_logistica` (columna `dias_demora`) |
| **Target** | < 2 días de demora promedio cuando hay demora |

### 5.3 Costo Flete / Revenue %

| Campo | Valor |
|-------|-------|
| **Definición** | % del revenue que se destina a costos logísticos |
| **Fórmula** | `SUM(costo_flete_ars) / SUM(revenue_ventas_ars) × 100` (join logística con ventas por período) |
| **Tabla dbt** | Join entre `stg_logistica` y `ventas_mensuales` |
| **Limitación** | La relación directa logística-venta no está en el modelo; se estima a nivel período |
| **Target** | < 3.5% |

---

## 6. Métricas Comerciales

### 6.1 Ticket Promedio ARS

| Campo | Valor |
|-------|-------|
| **Definición** | Revenue promedio por transacción completada |
| **Fórmula** | `SUM(total_ars) / COUNT(DISTINCT venta_id) WHERE es_completada = true` |
| **Tabla dbt** | `agronova_sales.ventas_mensuales` (columna `ticket_promedio_ars`) |
| **Variante USD** | Divide por TC promedio del período |

### 6.2 Ticket Promedio USD

| Campo | Valor |
|-------|-------|
| **Definición** | Ticket promedio en dólares (comparable entre años) |
| **Fórmula** | `AVG(revenue_usd_tc_real) WHERE es_completada = true` |
| **Tabla dbt** | `agronova_sales.fct_ventas` |

### 6.3 Descuento Promedio %

| Campo | Valor |
|-------|-------|
| **Definición** | Descuento promedio otorgado sobre el precio de lista |
| **Fórmula** | `AVG(descuento_pct) × 100 WHERE es_completada = true` |
| **Tabla dbt** | `agronova_sales.fct_ventas` / `agronova_sales.ventas_mensuales` |
| **Target** | < 8%; < 12% en temporada con oferta táctica |
| **Alerta** | > 12% sistemático = problema de pricing |

### 6.4 Penetración de Categorías (Cross-Sell Index)

| Campo | Valor |
|-------|-------|
| **Definición** | Número promedio de categorías distintas compradas por cliente activo |
| **Fórmula** | `AVG(COUNT(DISTINCT producto_categoria)) GROUP BY cliente_id` |
| **Tabla dbt** | `agronova_sales.fct_ventas` (query ad-hoc) |
| **Target** | ≥ 2.5 categorías por cliente activo |
| **Interpretación** | Mayor penetración = mayor dependencia del cliente, menor riesgo de churn |

### 6.5 HHI de Concentración de Clientes

| Campo | Valor |
|-------|-------|
| **Definición** | Índice Herfindahl-Hirschman de concentración de revenue en la cartera |
| **Fórmula** | `SUM((revenue_cliente / revenue_total)²)` |
| **Tabla dbt** | `agronova_sales.pareto_clientes` |
| **Interpretación** | 0 = diversificación perfecta; 1 = un solo cliente. < 0.15 = saludable; > 0.25 = riesgo |

---

## 7. Estacionalidad y Temporadas

### 7.1 Factor Estacional Mensual

| Mes | Factor | Temporada |
|-----|--------|-----------|
| Enero | 1.30 | Siembra gruesa (soja tardía) |
| Febrero | 1.25 | Siembra gruesa |
| Marzo | 0.95 | Pre-cosecha gruesa |
| Abril | 0.85 | Cosecha gruesa |
| Mayo | 0.90 | Post-cosecha |
| Junio | 0.78 | Off (invierno) |
| Julio | 0.70 | Off — mínimo del año |
| Agosto | 0.90 | Pre-siembra fina |
| Septiembre | 1.05 | Inicio siembra fina |
| Octubre | 1.52 | Pico siembra gruesa |
| Noviembre | 1.65 | **Máximo del año** |
| Diciembre | 1.35 | Siembra tardía |

### 7.2 Índice Estacional Real

| Campo | Valor |
|-------|-------|
| **Definición** | Cociente entre el revenue real de un mes y el promedio mensual del año |
| **Fórmula** | `Revenue_mes / (Revenue_año / 12)` |
| **Uso** | Comparar si la estacionalidad real coincide con la esperada (modelo) |
| **Tabla dbt** | `agronova_sales.ventas_mensuales` (query ad-hoc) |

---

## 8. Índice de Tipos de Cambio y Macroeconomía

### 8.1 TC BNA Oficial (Promedio Mensual)

| Campo | Valor |
|-------|-------|
| **Definición** | Tipo de cambio dólar / peso aplicado al calcular revenue_usd_tc_real |
| **Fuente** | `agronova.cotizaciones_externas` (columna `usd_ars_oficial`) |
| **Uso en dbt** | `agronova_sales.fct_ventas.tc_dia` |
| **Histórico clave** | 2016: ~14.8; 2019: ~63; 2022: ~189; 2024: ~910; 2026: ~1,120 |

### 8.2 Factor de Inflación Acumulada

| Año | Factor (base 2016 = 1.0) | Uso |
|-----|--------------------------|-----|
| 2016 | 1.00x | Base |
| 2018 | 3.20x | — |
| 2020 | 9.50x | — |
| 2022 | 22.10x | — |
| 2024 | 45.00x | — |
| 2026 | 58.00x | — |

**Deflactar revenue ARS**: `Revenue_ARS_año_X / Factor_inflación_año_X × Factor_2016`  
Esto produce revenue en "pesos de 2016", comparable entre todos los años.

---

## 9. Reglas de Gobernanza de Métricas

| Regla | Descripción |
|-------|-------------|
| **Fuente única** | Cada métrica tiene una y solo una tabla dbt de referencia |
| **Consistencia** | Revenue en el Executive Dashboard = Revenue en el Commercial Dashboard (misma query, mismo filtro) |
| **Fecha de corte** | Siempre usar `fecha` de la venta, no `fecha de registro`. Ventas del último día del mes se incluyen en ese mes |
| **Devoluciones** | Por defecto, las métricas de Revenue usan `es_completada = true` (excluyen canceladas y devueltas). Documentar explícitamente cuando se incluyan |
| **USD vs ARS** | Las comparativas interanuales usan USD real (`revenue_usd_tc_real`). Las metas operativas mensuales usan ARS nominales |
| **EBITDA** | Siempre etiquetar como "estimado" o "modelo". No presentar como EBITDA contable |
| **Actualizaciones** | Las métricas calculadas en dbt se actualizan según el schedule del pipeline (ver `docs/architecture.md`). No recalcular manualmente |
| **Control de versión** | Este catálogo es un documento vivo. Cada cambio en una fórmula debe reflejarse aquí y en el modelo dbt correspondiente |

---

## 10. Glosario Rápido

| Término | Definición |
|---------|-----------|
| **ABC** | Clasificación de productos: A=top 70% revenue, B=70-90%, C=90-100% |
| **CAGR** | Compound Annual Growth Rate — tasa de crecimiento anual compuesta |
| **Churned** | Cliente con fecha de baja registrada (`año_baja IS NOT NULL`) |
| **Completada** | Venta con `estado = 'Completada'` (excluye Cancelada, Devuelta, Pendiente) |
| **EBITDA** | Earnings Before Interest, Taxes, Depreciation and Amortization |
| **HHI** | Herfindahl-Hirschman Index — índice de concentración de mercado |
| **LTV** | Lifetime Value — valor histórico total generado por un cliente |
| **OTIF** | On Time In Full — % de entregas a tiempo y completas |
| **Pareto** | Distribución 80/20: el 20% de clientes genera el 80% del revenue |
| **RFM** | Recencia / Frecuencia / Monetario — modelo de scoring de clientes |
| **TC BNA** | Tipo de cambio Banco Nación Argentina (oficial) |
| **Tier** | Clasificación de clientes: A (top 10%), B (20%), C (30%), D (40%) |
| **YYMMDD** | Formato de fecha_id usado en el modelo: ej. 20241115 = 15 Nov 2024 |
| **YoY** | Year over Year — comparativa con el mismo período del año anterior |
| **MoM** | Month over Month — comparativa con el mes inmediato anterior |
| **YTD** | Year to Date — acumulado desde el 1° de enero hasta la fecha |

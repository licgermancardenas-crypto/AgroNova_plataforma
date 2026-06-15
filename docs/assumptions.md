# Supuestos del Modelo Sintetico — AgroNova Argentina S.A.

Este documento registra los supuestos de modelado. Es critico para interpretar correctamente los datos y no confundirlos con datos reales de un ERP.

## Supuestos de Generacion

### Seed de Aleatoriedad

**SEED = 42** en todos los generadores de numpy (`np.random.default_rng(42)`). Esto garantiza que `python data/generators/generate_all.py` produce exactamente los mismos datos en cualquier maquina. Si se cambia el seed, se rompe la reproducibilidad y los tests de negocio podrian fallar.

### Volumen de Datos

| Entidad | Cantidad | Justificacion |
|---------|---------|---------------|
| Ventas | 1,500,000 | Representativo de distribuidor mediano/grande. Suficiente para BI. |
| Clientes | 4,000 | Tipico para distribuidor con cobertura nacional |
| Productos | 2,500 | SKUs incluyendo variedades, presentaciones, marcas |
| Proveedores | 15 | Concentrado (realista para este segmento) |
| Periodo | 2016-2026 | 11 anos: suficiente para tendencias y ciclos |

---

## Supuestos de Negocio

### Precios y Tipo de Cambio

Los precios se generan con la formula:
```
precio_ars = precio_usd_base_2016 * TC_año * factor_inflacion_adicional * variacion_aleatoria
```

El `TC_año` es el promedio anual del TC oficial BNA (no intradiario). Se usaron valores aproximados basados en la historia real:

| Ano | TC USD/ARS usado | Fuente |
|-----|-----------------|--------|
| 2016 | 14.8 | Promedio anual |
| 2018 | 38.0 | Post-devaluacion |
| 2019 | 63.0 | Tras PASO |
| 2020 | 81.0 | Pandemia |
| 2023 | 365.0 | Pre-licuacion |
| 2024 | 910.0 | Post-devaluacion dic 2023 |
| 2026 | 1,120.0 | Proyeccion |

**Limitacion**: No se simula TC intradiario ni brecha cambiaria en las transacciones. Todas las ventas usan el TC promedio anual, no el TC del dia de la transaccion (excepto en `v_ventas_dolarizadas` que usa cotizaciones_externas).

### Margen Bruto

El margen por producto (`margen_bruto_pct`) se asigna al generar `dim_producto` y se aplica directamente:
```
margen_bruto_ars = total_ars * margen_bruto_pct
```

**Supuesto simplificador**: el margen es constante por producto e independiente del canal, volumen, o negociacion con el cliente. En realidad, los grandes clientes (Tier A) negocian mejores margenes. Este supuesto sobreestima ligeramente el margen en clientes grandes.

### Estacionalidad

Los factores estacionales son fijos por mes (ej: Noviembre = 1.65 todos los anos). En la realidad, la estacionalidad varia segun:
- Condiciones climaticas de la campana
- Precios de commodities
- Politica cambiaria (atrasos/adelantos de siembra)

El modelo no captura estos shocks interanuales.

### Distribucion Pareto

Los `volumen_factor` se asignan una vez al generar `dim_cliente` y se aplican multiplicando la cantidad base:
```
cantidad = round(exp(Normal(1.5, 0.7)) * volumen_factor)
```

La distribucion Tier A-D produce:
- Top 20% clientes: 77.4% del revenue (verificado en audit)
- Bottom 40% (Tier D): ~6% del revenue

**Supuesto**: el factor es estatico en el tiempo. Un cliente Tier A en 2016 sigue siendo Tier A en 2026. En realidad, el tier cambia segun el crecimiento del cliente.

### Clientes Churned

~30% de los 4,000 clientes tiene `año_baja` asignado. Despues del baja, no se generan ventas para ese cliente. Sin embargo:
- El test `BR-02` permite hasta 5% de ventas post-baja (por redondeo de fechas intra-ano)
- La asignacion de baja es aleatoria, no basada en comportamiento de compra

---

## Supuestos de Integridad

### Ventas sin Domingo

Ninguna venta se genera en domingo (`es_fin_de_semana = TRUE` para Sabado/Domingo, pero el generador excluye solo Domingo). Este supuesto refleja que el agronegocio puede operar en sabado durante campana pero raramente en domingo.

### Ventas Solo en Dias Habiles

El generador selecciona fechas de un pool de dias habiles (excluye feriados nacionales y domingos). La lista de feriados es aproximada; no incluye feriados puente ni feriados provinciales.

### Logistica

Los `dias_transito_base` son:
- PAM a PAM: 1-3 dias
- PAM a NOA/NEA: 4-7 dias
- PAM a CUY: 3-5 dias
- PAM a PAT: 5-10 dias

No se modela el efecto de temporada en la logistica (congestion de caminos en cosecha, etc.).

### Inventario

El `stock_actual` en `fact_inventario` se genera independientemente de las ventas y compras. No existe una reconciliacion de entradas/salidas que garantice que el inventario sea la diferencia entre compras y ventas. Esta es una limitacion de datasets sinteticos: el inventario es coherente en sus propias reglas (stock >= 0, max >= min) pero no en relacion con el flujo comercial.

---

## Limitaciones Conocidas

1. **Sin CUIT real**: los CUIT se generan con formato valido (XX-XXXXXXXX-X) pero no pasan el algoritmo de verificacion de AFIP. No usar para pruebas de integracion con AFIP.

2. **Sin precios de lista**: no existe un `lista_precios` historico. Los precios en `fact_ventas` se calculan al momento de generacion y no hay forma de auditar si el precio del dia era "correcto".

3. **Sin jerarquia de productos**: no existe una dimension de jerarquia de producto (familia > categoria > subcategoria > SKU) como en un MDM real. La subcategoria es un string libre.

4. **Sin datos de costo de compra consistentes**: el costo en `fact_compras` y el precio de venta en `fact_ventas` no estan relacionados directamente. El margen se calcula con el `margen_bruto_pct` del producto, no como diferencia entre precio de compra y venta.

5. **Sin SCD Tipo 2**: todas las dimensiones son de Tipo 1 (snapshot actual). No existe historia de cambios (ej: un cliente que cambio de segmento, un producto que cambio de proveedor).

6. **Cotizaciones externas**: los precios de commodities (soja, urea, glifosato) son aproximaciones con ruido aleatorio sobre valores reales historicos. No usar para analisis financiero real.

---

## Criterios de Validacion Aceptados

Los siguientes criterios fueron establecidos para las pruebas automatizadas:

| Regla | Tolerancia | Razon |
|-------|-----------|-------|
| Ventas antes de alta del cliente | < 0.5% | Redondeo intra-ano en sampling |
| Ventas de clientes churned post-baja | < 5% | Idem |
| Outliers de cantidad | <= 10 en 1.5M | Colas de distribucion normal |
| Margen negativo | 0 | Restriccion dura de modelo |
| Stock negativo | 0 | Restriccion dura de modelo |
| Top 20% clientes vs revenue | >= 60% | Pareto minimo aceptable |

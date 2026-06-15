# dbt Architecture — AgroNova Analytics Engineering

## Vision General

AgroNova implementa una arquitectura **Medallion** (Bronze → Silver → Gold) usando dbt como capa de transformacion. El objetivo es separar el dato crudo del dato listo para consumo, garantizar calidad con tests automaticos, y documentar el linaje de cada metrica.

```
RAW LAYER          STAGING LAYER          MARTS LAYER
(Bronze)           (Silver)               (Gold)
─────────────────────────────────────────────────────────────────
PostgreSQL         dbt views              dbt tables
Schema: agronova   Schema: agronova_*     Schemas por dominio
Fuente: ETL Python  Limpieza + tipado      Modelos de negocio
                   Un modelo por tabla    Agregaciones + KPIs
```

---

## Capa 1: Raw Layer (Bronze)

**Donde**: Schema `agronova` en PostgreSQL / Neon  
**Como se puebla**: Pipeline ETL Python (`etl/run_pipeline.py`)  
**Que contiene**: 13 tablas tal como salieron del generador

```
dim_fecha          dim_region         dim_sucursal
dim_deposito       dim_vendedor       dim_proveedor
dim_producto       dim_cliente
fact_ventas        fact_compras       fact_inventario
fact_logistica     cotizaciones_externas
```

**Regla**: Esta capa NUNCA se modifica en dbt. Es el "registro historico" inmutable. Si una transformacion esta mal, se corrige en Staging, no en Raw.

---

## Capa 2: Staging Layer (Silver)

**Donde**: Schema `agronova_staging`  
**Materializacion**: `view` (sin costo de storage, se recalcula en cada query)  
**Responsabilidad**: limpieza ligera, renaming, tipado, columnas derivadas simples

### Modelos de Staging

| Modelo | Fuente Raw | Transformaciones |
|--------|-----------|-----------------|
| `stg_clientes` | `dim_cliente` | Rename año_alta/baja, `is_churned`, `antiguedad_anos` |
| `stg_productos` | `dim_producto` | `segmento_precio`, `es_alto_margen` |
| `stg_ventas` | `fact_ventas` + `dim_fecha` | Join con fechas, `es_completada`, `revenue_neto_ars/usd` |
| `stg_compras` | `fact_compras` + `dim_fecha` | `es_importacion`, `es_recibida` |
| `stg_inventario` | `fact_inventario` + `dim_fecha` | `estado_stock`, `pct_ocupacion`, `capacidad_disponible` |
| `stg_logistica` | `fact_logistica` + `dim_fecha` | `resultado_entrega`, `dias_demora`, `costo_por_kg_ars` |

### Principios de Staging

1. **Una fuente primaria por modelo** — `stg_ventas` puede joinear `dim_fecha` para atributos de tiempo, pero no joinea `dim_cliente` ni `dim_producto`.
2. **Sin lógica de negocio compleja** — Eso va en Marts.
3. **Todos los modelos tienen tests** — `unique`, `not_null`, `relationships`, `accepted_values`.
4. **Columnas con nombres en español** — Consistentes con el negocio.

---

## Capa 3: Marts Layer (Gold)

**Donde**: Schemas separados por dominio de negocio  
**Materializacion**: `table` (persistida, consultada directamente por Power BI y Next.js)  
**Responsabilidad**: logica de negocio, agregaciones, metricas, KPIs

### Organizacion por Dominio

```
marts/
├── core/          ─ Dimensiones enriquecidas (el "master" de cada entidad)
├── sales/         ─ Facts de ventas y reportes comerciales
├── finance/       ─ Rentabilidad y margenes
├── inventory/     ─ Rotacion y alertas de stock
└── customer/      ─ Segmentacion, RFM y churn
```

---

### core/ — Dimensiones Enriquecidas

| Modelo | Descripcion | Inputs |
|--------|-------------|--------|
| `dim_clientes` | Master de clientes con metricas de compra historicas, tier, region y flag VIP | `stg_clientes`, `stg_ventas`, `dim_region` |
| `dim_productos` | Master de productos con clasificacion ABC calculada en dbt, metricas de ventas | `stg_productos`, `stg_ventas`, `dim_proveedor` |
| `dim_vendedores` | Fuerza de ventas con sucursal, region y ranking de performance | `dim_vendedor`, `stg_ventas`, `dim_sucursal` |

### sales/ — Analytics Comerciales

| Modelo | Descripcion | Granularidad |
|--------|-------------|-------------|
| `fct_ventas` | Fact "wide" totalmente desnormalizada | Transaccion |
| `ventas_mensuales` | Revenue mensual con YoY y MoM | Anio x Mes x Sucursal |
| `ventas_por_region` | Revenue por region y categoria | Anio x Region x Categoria |
| `pareto_clientes` | Curva de Pareto con revenue acumulado % | Cliente |
| `abc_productos` | Clasificacion ABC con velocidad de venta | Producto |

### finance/ — Rentabilidad

| Modelo | Descripcion | Granularidad |
|--------|-------------|-------------|
| `margen_por_producto` | Margen anual, tendencia YoY, clasificacion | Producto x Año |
| `margen_por_cliente` | LTV, margen vs benchmark de tier | Cliente x Año |

### inventory/ — Supply Chain

| Modelo | Descripcion | Granularidad |
|--------|-------------|-------------|
| `rotacion_stock` | Indice de rotacion, dias de inventario | Producto x Deposito x Mes |
| `stock_critico` | Alertas de reposicion priorizadas | Producto x Deposito (snapshot) |

### customer/ — CRM Analytics

| Modelo | Descripcion | Granularidad |
|--------|-------------|-------------|
| `rfm_clientes` | Scoring RFM 1-5, segmentos (Champions/At_Risk/Lost...) | Cliente |
| `churn_candidates` | Clientes activos con riesgo de abandono + accion sugerida | Cliente |

---

## Linaje de Datos (DAG)

```
[RAW]                [STAGING]              [MARTS]
─────────────────────────────────────────────────────

dim_cliente    ──►  stg_clientes   ──►  dim_clientes  ──►  fct_ventas
                                   └──►  rfm_clientes ──►  churn_candidates
                                   └──►  pareto_clientes
                                   └──►  margen_por_cliente

dim_producto   ──►  stg_productos  ──►  dim_productos  ──►  fct_ventas
                                   └──►  abc_productos
                                   └──►  margen_por_producto

fact_ventas    ──►  stg_ventas     ──►  fct_ventas
dim_fecha      ──┘                 └──►  ventas_mensuales
                                   └──►  ventas_por_region

fact_inventario ──► stg_inventario ──►  rotacion_stock
                                   └──►  stock_critico

dim_vendedor   ──►  (directo)      ──►  dim_vendedores ──►  fct_ventas
dim_sucursal   ──►  (directo)      ──►  dim_vendedores
```

---

## Comandos de Ejecucion

### Instalacion

```bash
cd dbt/
pip install dbt-postgres
dbt deps        # instala paquetes (dbt_utils, codegen)
```

### Configuracion de conexion

```bash
# Copiar profiles.yml al directorio de dbt
cp dbt/profiles.yml ~/.dbt/profiles.yml

# O usar variables de entorno
export DBT_HOST=ep-XXXX.us-east-2.aws.neon.tech
export DBT_USER=agronova_etl
export DBT_PASSWORD=...
export DBT_DBNAME=neondb
```

### Ejecucion basica

```bash
# Probar conexion
dbt debug

# Correr todos los modelos
dbt run

# Correr solo staging
dbt run --select staging

# Correr un mart especifico
dbt run --select marts.sales

# Correr modelos upstream de rfm_clientes
dbt run --select +rfm_clientes

# Solo modelos que cambiaron desde el ultimo run
dbt run --select state:modified
```

### Tests

```bash
# Todos los tests
dbt test

# Tests de una capa
dbt test --select staging
dbt test --select marts.customer

# Tests de un modelo especifico
dbt test --select rfm_clientes

# Correr y testear en un solo comando
dbt build
dbt build --select +fct_ventas  # fct_ventas y todos sus dependientes
```

### Documentacion

```bash
# Generar documentacion
dbt docs generate

# Servir documentacion en el browser (localhost:8080)
dbt docs serve

# La UI muestra: linaje de datos, tests, descripciones de columnas
```

### Comandos avanzados

```bash
# Ver el DAG (dependencias)
dbt ls --select +fct_ventas --output tree

# Compilar SQL sin ejecutar
dbt compile --select rfm_clientes

# Correr solo modelos con tag especifico
dbt run --select tag:customer
dbt run --select tag:high-volume

# Fresh check: verificar que las fuentes no estan desactualizadas
dbt source freshness

# Ver el plan de ejecucion
dbt run --select state:modified+ --defer --state target/
```

---

## Estrategia de Materializacion

| Capa | Tipo | Razon |
|------|------|-------|
| Staging | `view` | Sin storage; siempre refleja el raw actual |
| `fct_ventas` | `table` | 1.5M filas; lento como view; precomputado |
| Resto de marts | `table` | Agregaciones costosas; cache en disco |
| `fct_ventas` (produccion) | `incremental` | Solo procesa filas nuevas en cada run |

### Configuracion incremental para fct_ventas

Cuando el volumen crezca o se conecte a datos en tiempo real, cambiar en `fct_ventas.sql`:

```sql
{{ config(
    materialized    = 'incremental',
    unique_key      = 'venta_id',
    on_schema_change = 'fail'
) }}
-- ...
{% if is_incremental() %}
    where fecha_id > (select max(fecha_id) from {{ this }})
{% endif %}
```

---

## Tests de Calidad

Cada modelo tiene un `schema.yml` con:

| Tipo de test | Ejemplo | Que verifica |
|-------------|---------|--------------|
| `unique` | `venta_id` | No hay duplicados |
| `not_null` | `total_ars` | Sin nulos en campos requeridos |
| `relationships` | `cliente_id` -> `dim_cliente` | Integridad referencial entre modelos dbt |
| `accepted_values` | `tier_cliente` in ['A','B','C','D'] | Valores categoricos validos |
| `dbt_utils.accepted_range` | `r_score` entre 1 y 5 | Rangos numericos validos |

### Resultado esperado

```bash
$ dbt test
[OK] 47 tests passed
[OK] 0 tests failed
[OK] 0 warnings
```

---

## Estructura de Schemas en la DB

Despues de `dbt run`, la base tendra los siguientes schemas:

```
PostgreSQL / Neon
├── agronova              ← Raw (ETL Python)
│   ├── dim_fecha
│   ├── dim_cliente
│   ├── fact_ventas       ← 1.5M filas
│   └── ...
│
├── agronova_staging      ← dbt views
│   ├── stg_clientes
│   ├── stg_ventas
│   └── ...
│
├── agronova_core         ← dbt tables
│   ├── dim_clientes
│   ├── dim_productos
│   └── dim_vendedores
│
├── agronova_sales
│   ├── fct_ventas        ← tabla wide desnormalizada
│   ├── ventas_mensuales
│   ├── pareto_clientes
│   └── abc_productos
│
├── agronova_finance
│   ├── margen_por_producto
│   └── margen_por_cliente
│
├── agronova_inventory
│   ├── rotacion_stock
│   └── stock_critico
│
└── agronova_customer
    ├── rfm_clientes
    └── churn_candidates
```

---

## Integracion con Power BI y Next.js

**Power BI**: conectar directamente a los schemas `agronova_sales`, `agronova_customer`, etc. Usar las vistas/tablas de Gold como fuente de datos. Evitar conectar al schema `agronova` (Raw) directamente.

**Next.js**: las API Routes consultan los schemas de marts:
```typescript
// Ejemplo: query de KPIs ejecutivos
const result = await db.execute(
  sql`SELECT * FROM agronova_sales.ventas_mensuales ORDER BY anio DESC, mes DESC LIMIT 12`
)
```

**Actualizacion**: ejecutar `dbt run` periodicamente (diario o semanal) para refrescar los marts. En produccion: orquestar con Airflow, Prefect, o GitHub Actions.

# Arquitectura de la Plataforma — AgroNova Argentina S.A.

## Vision General

La plataforma sigue un patron **Lakehouse simplificado** con tres capas:

```
[Generacion CSV] -> [ETL Python] -> [PostgreSQL/Neon] -> [BI/Frontend]
```

Cada capa es independiente y reemplazable: los CSVs pueden venir de un ERP real, el ETL puede correr en Airflow, y el frontend puede ser cualquier herramienta que soporte PostgreSQL.

## Stack Tecnologico

| Capa | Tecnologia | Version |
|------|-----------|---------|
| Generacion datos | Python + NumPy + Faker | 3.11+ |
| ETL | Python + pandas + SQLAlchemy | 2.x |
| Base de datos | PostgreSQL | 16 |
| Cloud DB | Neon Serverless | Free tier / Pro |
| Testing | pytest | 8.x |
| Frontend (prox.) | Next.js 15 + shadcn/ui | 15.x |
| ORM Frontend | Drizzle ORM | 0.30+ |

## Estructura del Repositorio

```
AgroNova_plataforma/
├── data/
│   ├── generators/          # Scripts de generacion sintetica
│   │   ├── config.py        # Constantes compartidas (SEED, TC, estacionalidad)
│   │   ├── 01_dim_fecha.py  # ... hasta 13_cotizaciones.py
│   │   └── generate_all.py  # Orquestador
│   ├── csv/                 # Output: 13 CSVs (~250MB total)
│   ├── sql/                 # DDL + vistas (version original)
│   └── audit/               # Script de auditoria + reporte JSON
│
├── etl/
│   ├── extract.py           # Lectura y validacion de schema
│   ├── transform.py         # Tipado, limpieza, enriquecimiento, BR checks
│   ├── load.py              # Carga a PostgreSQL via SQLAlchemy
│   └── run_pipeline.py      # Orquestador principal con logging
│
├── database/
│   ├── create_database.sql  # Schema, ENUMs, tablas con constraints
│   ├── create_indexes.sql   # 25+ indices de performance
│   ├── constraints.sql      # Constraints adicionales de negocio
│   └── load_data.sql        # COPY alternativo (para acceso local a servidor)
│
├── tests/
│   ├── conftest.py          # Fixtures session-scoped (todos los DataFrames)
│   ├── test_primary_keys.py # 15 tests: unicidad, formato, conteos
│   ├── test_foreign_keys.py # 17 tests: integridad referencial
│   ├── test_duplicates.py   # 12 tests: unicidad de campos clave
│   ├── test_nulls.py        # 20 tests: nulos requeridos y opcionales
│   └── test_business_rules.py # 30 tests: reglas de negocio (BR-01..06)
│
├── diagrams/
│   ├── erd.mmd              # Diagrama entidad-relacion (Mermaid)
│   ├── star_schema.mmd      # Esquema estrella con metricas
│   └── architecture.mmd     # Arquitectura de la plataforma
│
├── docs/
│   ├── business_context.md  # Contexto de negocio y segmentos
│   ├── architecture.md      # Este archivo
│   ├── data_dictionary.md   # Diccionario completo de datos
│   ├── kpis.md              # Definicion de KPIs y metricas
│   └── assumptions.md       # Supuestos del modelo sintetico
│
├── logs/                    # Generado en runtime (gitignored *.log)
├── pytest.ini
└── README.md
```

## Capa de Datos

### Star Schema

El modelo sigue un **star schema clasico** con:
- **8 tablas de dimension** (Fecha, Region, Sucursal, Deposito, Vendedor, Proveedor, Producto, Cliente)
- **4 tablas de hechos** (Ventas, Compras, Inventario, Logistica)
- **1 tabla de referencia externa** (Cotizaciones: TC + commodities)

### Decisiones de Diseno

**GENERATED columns vs columnas en CSV:**
- `bajo_minimo` (fact_inventario): calculado `AS (stock_actual < stock_minimo) STORED`
- `dias_transito_real` (fact_logistica): calculado desde fechas

El ETL excluye estas columnas del INSERT; la DB las calcula automaticamente.

**ENUMS PostgreSQL:**
Se definieron 6 ENUMs de dominio para garantizar integridad de valores categoricos sin overhead de join a tablas de lookup. Todos los estados, tipos y clasificaciones usan ENUMs.

**Indexes parciales:**
Los indices sobre `fact_ventas` incluyen indices parciales `WHERE estado = 'Completada'` y `WHERE activo = TRUE` para reducir el tamano del indice en ~95% y acelerar las queries mas comunes.

**Neon vs PostgreSQL local:**
- Para desarrollo: PostgreSQL local con Docker (`docker run postgres:16`)
- Para produccion/demo: Neon Free Tier (~512MB, suficiente para este dataset comprimido)
- La connection string es identica; el ETL usa `DATABASE_URL` como variable de entorno

## Capa ETL

### Flujo del Pipeline

```
run_pipeline.py
    |
    +-- extract.py (extract_all)
    |       Lee 13 CSVs con validacion de schema
    |       Fallback para nombres con/sin acento
    |
    +-- transform.py (transform_all)
    |       1. clean_strings()     — strip whitespace
    |       2. apply_dtypes()      — int8/16/32, float32/64, bool
    |       3. enrich_ventas()     — merge dimensiones de fecha
    |       4. enrich_clientes()   — is_churned derivado
    |       5. BR-01..05 checks    — stock, fechas, margenes, precios
    |
    +-- load.py (load_all)
    |       FK-safe order (dims antes que facts)
    |       Exclude columnas GENERATED y derivadas
    |       Chunked INSERT (50k para fact_ventas)
    |       TRUNCATE + reload (idempotente)
    |
    +-- verify_load() — COUNT(*) post-carga
    |
    +-- save_report() — JSON en logs/
```

### Idempotencia

El pipeline usa `TRUNCATE ... CASCADE` antes de cada carga, haciendo cada ejecucion completamente idempotente. Apto para schedulers (cron, Airflow) sin acumulacion de duplicados.

## Capa de Visualizacion (Proxima Fase)

### 10 Vistas Analiticas para Power BI

| Vista | Descripcion |
|-------|-------------|
| `v_ventas_diarias` | Revenue diario por sucursal |
| `v_clientes_rfm` | Recencia/Frecuencia/Monetario por cliente |
| `v_pareto_clientes` | Acumulado de revenue para curva Pareto |
| `v_estacionalidad` | Indices estacionales por mes y categoria |
| `v_performance_vendedores` | Revenue, margen y cantidad por vendedor |
| `v_abc_productos` | Clasificacion ABC automatica por revenue |
| `v_supply_chain_mensual` | Compras vs ventas por categoria mensual |
| `v_logistica_performance` | Dias de transito y costos por region |
| `v_ventas_dolarizadas` | Revenue en USD usando TC oficial del dia |
| `v_kpi_ejecutivo` | Dashboard ejecutivo mensual consolidado |

### Next.js Frontend

La fase siguiente construira un dashboard web con:
- Next.js 15 App Router
- shadcn/ui (Tailwind CSS)
- Tremor / Recharts para graficos
- Drizzle ORM con conexion directa a Neon
- Server Components para queries pesadas (sin estado en cliente)

## Seguridad

- **Roles PostgreSQL**: `agronova_reader` (Power BI), `agronova_etl` (pipeline)
- **Secrets**: `DATABASE_URL` via `.env` (gitignored), nunca hardcodeado
- **Neon**: SSL requerido por defecto; pooler connection para Next.js (max_connections)

## Performance

Con los 25+ indices definidos, las queries tipicas de BI sobre 1.5M filas de `fact_ventas`:

| Query tipo | Tiempo estimado |
|------------|-----------------|
| `WHERE fecha_id BETWEEN x AND y` | < 50ms |
| `GROUP BY sucursal_id, mes` | < 200ms |
| `JOIN dim_cliente WHERE tier = 'A'` | < 100ms |
| Full table scan (COUNT) | < 500ms |
| Vista v_pareto_clientes | < 2s |

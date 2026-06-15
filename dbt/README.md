# AgroNova dbt Project

Analytics Engineering layer para AgroNova Argentina S.A.
Transforma el Data Warehouse raw en modelos de negocio listos para BI.

## Stack

- **dbt-postgres** 1.8+
- **PostgreSQL 16** / Neon Serverless
- **dbt_utils** 1.1+ (tests de rango, utilidades)
- **codegen** 0.12+ (generacion de YAML desde tablas existentes)

## Estructura

```
dbt/
├── dbt_project.yml        # Configuracion del proyecto (capas, schemas, vars)
├── profiles.yml           # Conexion a PostgreSQL / Neon
├── packages.yml           # dbt_utils, codegen
├── models/
│   ├── staging/           # Silver: vistas 1:1 con tablas raw
│   │   ├── sources.yml    # Declaracion de fuentes + tests basicos
│   │   ├── schema.yml     # Tests y docs de modelos staging
│   │   └── stg_*.sql      # 6 modelos de staging
│   └── marts/
│       ├── core/          # Dimensiones enriquecidas
│       ├── sales/         # Fact + agregaciones comerciales
│       ├── finance/       # Margenes y rentabilidad
│       ├── inventory/     # Rotacion y alertas de stock
│       └── customer/      # RFM y churn
└── macros/
    ├── generate_schema_name.sql  # Override de schemas
    └── utils.sql                 # safe_divide, clasificar_abc, rfm_segment
```

## Inicio rapido

### 1. Instalar dbt

```bash
pip install dbt-postgres dbt-core
```

### 2. Configurar conexion

```bash
# Copiar profiles.yml al directorio de dbt
cp dbt/profiles.yml ~/.dbt/profiles.yml

# Configurar variables de entorno
export DBT_HOST=localhost           # o host de Neon
export DBT_USER=postgres
export DBT_PASSWORD=agronova
export DBT_DBNAME=postgres
```

Para **Neon**:
```bash
export DBT_HOST=ep-XXXX.us-east-2.aws.neon.tech
export DBT_USER=agronova_etl
export DBT_PASSWORD=<neon-password>
export DBT_DBNAME=neondb
```

### 3. Verificar conexion

```bash
cd dbt/
dbt debug
```

### 4. Instalar paquetes dbt

```bash
dbt deps
```

### 5. Ejecutar pipeline completo

```bash
# Opcion A: run + test separados
dbt run
dbt test

# Opcion B: build (run + test en un solo paso)
dbt build

# Con log detallado
dbt build --log-level info
```

### 6. Ver documentacion

```bash
dbt docs generate
dbt docs serve   # abre http://localhost:8080
```

## Comandos frecuentes

```bash
# Solo staging
dbt run --select staging

# Solo un dominio
dbt run --select marts.customer

# Un modelo y sus dependencias upstream
dbt run --select +rfm_clientes

# Un modelo y todo lo que depende de el (downstream)
dbt run --select fct_ventas+

# Solo modelos que cambiaron
dbt run --select state:modified

# Probar un modelo especifico
dbt test --select churn_candidates

# Compilar SQL (ver la query generada sin ejecutar)
dbt compile --select ventas_mensuales
cat target/compiled/agronova/models/marts/sales/ventas_mensuales.sql

# Ver el arbol de dependencias
dbt ls --select +rfm_clientes --output tree

# Verificar frescura de fuentes
dbt source freshness
```

## Variables configurables

Definidas en `dbt_project.yml`:

| Variable | Default | Descripcion |
|----------|---------|-------------|
| `raw_schema` | `agronova` | Schema de las tablas fuente |
| `start_date` | `2016-01-01` | Fecha de inicio del historial |
| `end_date` | `2026-12-31` | Fecha de fin del historial |
| `pareto_threshold` | `0.80` | Umbral de corte para analisis Pareto |
| `rfm_recency_days` | `365` | Ventana de recencia para RFM (dias) |
| `churn_days` | `365` | Dias sin compra para considerar churn |

Sobreescribir en CLI:
```bash
dbt run --vars '{"rfm_recency_days": 180, "churn_days": 270}'
```

## Schemas generados

| Schema PostgreSQL | Contenido |
|------------------|-----------|
| `agronova` | Raw (ETL Python) — no modificar |
| `agronova_staging` | Vistas de staging |
| `agronova_core` | Dimensiones enriquecidas |
| `agronova_sales` | Facts y reportes comerciales |
| `agronova_finance` | Margenes y rentabilidad |
| `agronova_inventory` | Supply chain y alertas |
| `agronova_customer` | RFM y churn |

## Tests

El proyecto tiene **47 tests** distribuidos en los `schema.yml` de cada capa:

```bash
dbt test                              # todos
dbt test --select staging             # solo staging (tests de FK e integridad)
dbt test --select marts.customer      # solo customer (RFM scores, segmentos)
```

Tipos de tests usados:
- `unique` / `not_null` — integridad basica
- `relationships` — FK entre modelos dbt
- `accepted_values` — valores categoricos validos
- `dbt_utils.accepted_range` — rangos numericos (RFM scores 1-5)

## Arquitectura completa

Ver: [`../docs/dbt_architecture.md`](../docs/dbt_architecture.md)

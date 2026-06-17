# AgroNova — Neon PostgreSQL Setup Guide

**Schema:** `agronova` | **Neon tier:** Free (512MB) | **Rows to load:** ~1.9M

---

## Resumen del flujo

```
neon.tech (crear proyecto)
   ↓
.env (pegar connection strings)
   ↓
python -m backend.scripts.apply_ddl       ← crea schema, ENUMs, tablas, índices, vistas
   ↓
python -m etl.run_pipeline --conn "$DATABASE_URL_UNPOOLED"  ← carga 1.9M filas
   ↓
python -m backend.scripts.test_connection  ← valida conteos
```

---

## Paso 1 — Crear el proyecto en Neon

1. Ir a **https://neon.tech** → Sign up / Log in.
2. **New Project:**
   - Name: `agronova`
   - Region: **South America (São Paulo)** `aws/sa-east-1` — menor latencia desde ARG.
   - PostgreSQL version: 16 (recomendado) o 15.
3. Una vez creado, ir a **Dashboard → Connection Details**.
4. Copiar **dos** connection strings:
   - **Pooled** (para la API en runtime): `postgresql://...@ep-xxx-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require`
   - **Direct / Unpooled** (para DDL y ETL): `postgresql://...@ep-xxx.sa-east-1.aws.neon.tech/neondb?sslmode=require`

> **Por qué dos URLs:** el pooler (PgBouncer) de Neon usa transaction-pooling mode. Algunos comandos DDL (`SET search_path`, `CREATE TYPE`, etc.) no funcionan bien a través del pooler — siempre usar la URL directa para DDL y ETL masivo.

---

## Paso 2 — Configurar `.env`

```bash
# desde la raíz del repo
copy .env.example .env
```

Editar `.env` y pegar las dos URLs:

```dotenv
DATABASE_URL=postgresql://user:pass@ep-xxx-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require
DATABASE_URL_UNPOOLED=postgresql://user:pass@ep-xxx.sa-east-1.aws.neon.tech/neondb?sslmode=require
DB_SCHEMA=agronova
```

---

## Paso 3 — Aplicar el DDL

```bash
python -m backend.scripts.apply_ddl
```

Este script usa `psycopg2` directamente (NO la API de SQLAlchemy text-split) para
ejecutar `data/sql/02_ddl_productivo.sql` y `data/sql/03_vistas_analiticas.sql`
como un bloque completo, lo que maneja correctamente los bloques `DO $$ BEGIN...END $$`
que crean los ENUMs (`estado_venta`, `estado_logistica`, etc.).

**Output esperado:**
```
Connecting (unpooled)...
  Applying 02_ddl_productivo.sql...  [OK]  ~2s
  Applying 03_vistas_analiticas.sql... [OK] ~1s
  Tables in schema 'agronova' (13): cotizaciones_externas, dim_cliente, ...
  ENUMs (7): canal_venta, estado_compra, estado_logistica, estado_venta, riesgo_tipo, rotacion_producto, tier_cliente
[DONE] DDL applied successfully.
```

### Alternativa (si no funciona el script): Neon SQL Editor

1. Dashboard → SQL Editor.
2. Pegar el contenido de `data/sql/02_ddl_productivo.sql` → Run.
3. Pegar el contenido de `data/sql/03_vistas_analiticas.sql` → Run.

---

## Paso 4 — Cargar los datos (ETL)

```bash
python -m etl.run_pipeline --conn "%DATABASE_URL_UNPOOLED%"
```

El pipeline (extract → transform → load → verify) carga las 13 tablas en orden FK-safe.

**Tiempos estimados en Neon free tier (sa-east-1 desde ARG):**

| Tabla | Filas | Est. tiempo |
|---|---|---|
| Dims (7 tablas) | ~6,600 | <5s |
| fact_compras | 150,000 | ~30s |
| fact_inventario | 39,600 | ~10s |
| fact_logistica | 200,000 | ~40s |
| **fact_ventas** | **1,500,000** | **~5-8 min** |
| cotizaciones_externas | 2,870 | <5s |
| **TOTAL** | **1,903,064** | **~10-12 min** |

> `fact_ventas` es la tabla más grande. El pipeline usa chunksize=50,000 y
> `method="multi"` para eficiencia. No interrumpir durante la carga.

### Dry-run primero (recomendado)

```bash
python -m etl.run_pipeline --dry-run
```

Esto valida extract + transform sin tocar la DB (~13s). Ya fue ejecutado y pasó ✓.

---

## Paso 5 — Validar

```bash
python -m backend.scripts.test_connection
```

**Output esperado post-carga:**

```
Connecting (schema='agronova', timeout=15s)...
OK — connected in 0.8s
  PostgreSQL 16.x on x86_64-pc-linux-gnu...

Row counts (13 tables):
  cotizaciones_externas             2,870
  dim_cliente                       4,000
  dim_deposito                          3
  dim_fecha                         4,018
  dim_producto                      2,500
  dim_proveedor                        15
  dim_region                            5
  dim_sucursal                          5
  dim_vendedor                         48
  fact_compras                    150,000
  fact_inventario                  39,600
  fact_logistica                  200,000
  fact_ventas                   1,500,000
```

---

## Estimación de almacenamiento Neon free tier

| Objeto | Est. tamaño en Postgres |
|---|---|
| fact_ventas (datos + índices) | ~220–260 MB |
| fact_logistica | ~25 MB |
| fact_compras | ~18 MB |
| fact_inventario | ~8 MB |
| Dims + cotizaciones | ~5 MB |
| Vistas (no ocupan storage) | 0 |
| **Total estimado** | **~280–310 MB** |

Límite Neon free tier: **512MB** → hay margen suficiente para las 13 tablas más índices.

---

## Limitaciones del free tier a tener en cuenta

- **Compute suspend:** Neon suspende el compute (~5 min de inactividad). El primer
  request luego del suspend tarda 1–3s en "despertar". `test_connection.py` tiene
  timeout generoso por esto.
- **1 compute unit (0.25 vCPU):** la carga de fact_ventas puede tardar más que en
  un server propio. No es un error, es el throttle del free tier.
- **Branches de Neon:** podés crear branches (como git branches) para testear el
  pipeline ML sin afectar producción → Dashboard → Branches → New Branch.

---

## Troubleshooting

| Error | Causa probable | Solución |
|---|---|---|
| `FATAL: endpoint is disabled` | Free tier inactivo | Ir al dashboard → Activate |
| `SSL connection required` | Falta `?sslmode=require` | Agregar al connection string |
| `schema "agronova" does not exist` | DDL no aplicado | Correr `python -m backend.scripts.apply_ddl` |
| `ENUM already exists` | DDL ya fue aplicado | Ignorar, el DDL usa `IF NOT EXISTS` |
| `could not connect` primer request | Cold start Neon | Esperar 3–5s, reintentar |
| Carga lenta en fact_ventas | Free tier CPU limit | Normal, esperar ~8min |

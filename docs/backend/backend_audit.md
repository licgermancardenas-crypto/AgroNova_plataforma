# AgroNova Backend Audit — Neon Readiness (Sprint V3-Stabilize)

**Fecha:** 2026-06-16
**Branch:** `feature/backend-api`
**Alcance:** Auditoría de `backend/` previo a conectar PostgreSQL/Neon real.

---

## 1. Estructura actual de `backend/`

```
backend/
├── main.py                    FastAPI app, 14 rutas registradas
├── core/
│   ├── config.py               Settings (paths, DATABASE_URL=None hoy, CORS)
│   └── db.py                   Engine/SessionLocal scaffold — SIN USAR por ningún router
├── models/
│   └── orm.py                  3 modelos SQLAlchemy (Cliente, Sucursal, Venta) — INCOMPLETOS/INCORRECTOS (ver §3)
├── schemas/                    Pydantic response models (kpis, gis, ml, logistics, common)
├── services/
│   ├── kpis_service.py          Lee data/csv/ vía gis.geo_utils (pandas, real)
│   ├── gis_service.py            Lee data/gis_outputs/*.json + web/public/data/geo/*.json
│   ├── logistics_service.py       Lee data/gis_outputs/*.json + llama gis.routing_engine en vivo
│   └── ml_service.py              Placeholder estático (sin modelo entrenado)
├── api/routers/                health, kpis, gis, ml, logistics
└── requirements.txt             fastapi, uvicorn, pydantic, sqlalchemy, httpx, pytest, pandas
```

**Ningún endpoint depende de una base de datos hoy.** Todos los datos vienen de
`data/csv/*.csv` (vía `gis/geo_utils.py`) o `data/gis_outputs/*.json` (generados
por el pipeline GIS). `backend/core/db.py` existe pero no se importa desde
ningún router ni servicio — es scaffolding inerte.

## 2. Dependencias instaladas vs. necesarias

| Paquete | Instalado | Necesario para Neon | Nota |
|---|---|---|---|
| fastapi | 0.137.1 | — | OK |
| pydantic | 2.13.4 | — | OK |
| sqlalchemy | 2.0.51 | — | OK, pero sin driver de Postgres |
| uvicorn | 0.49.0 | — | OK |
| pandas | 3.0.0 | — | OK, usado por servicios actuales y por todo `etl/` |
| python-dotenv | 1.2.2 | Sí | Ya instalado (dependencia transitiva de `uvicorn[standard]`), nunca usado |
| **psycopg2-binary / psycopg** | **No instalado** | **Sí — bloqueante** | `create_engine("postgresql://...")` falla sin driver |

## 3. Compatibilidad con el modelo estrella original — hallazgo crítico

El repo **ya tiene** un DDL completo y un pipeline ETL para Neon, escritos en
una sesión anterior y **nunca ejecutados** (no hay `logs/` ni evidencia de
carga real):

- `data/sql/01_ddl_schema.sql` — DDL simple
- `data/sql/02_ddl_productivo.sql` — DDL productivo: schema `agronova`, ENUMs,
  CHECK constraints, columnas `GENERATED`, comentarios. **Es la fuente de
  verdad real**, no `backend/models/orm.py`.
- `data/sql/03_vistas_analiticas.sql` — vistas para BI (`v_ventas_diarias`,
  `v_clientes_rfm`, etc.)
- `data/sql/04_carga_csv.sql` — carga vía `COPY` (server-side, no aplica a Neon)
- `data/sql/05_neon_setup.sql` — instrucciones de proyecto Neon, extensiones,
  pooler, límites del free tier (~512MB; `Fact_Ventas` sola ocupa ~200-300MB)
- `etl/extract.py`, `transform.py`, `load.py`, `run_pipeline.py`,
  `load_postgres.py` — pipeline completo de carga vía `pandas.to_sql()`

**`backend/models/orm.py` (escrito en la sesión anterior, sin consultar el DDL)
no es compatible con este esquema real:**

| Campo | `orm.py` actual | DDL real (`02_ddl_productivo.sql`) | Confirmado en CSV |
|---|---|---|---|
| `dim_cliente.cliente_id` | `Integer` | `VARCHAR(7)`, regex `^C[0-9]{5}$` | `"C00001"` ✅ DDL tiene razón |
| `dim_producto.producto_id` | *(no existe en orm.py)* | `VARCHAR(6)`, regex `^P[0-9]{4}$` | `"P0001"` |
| `fact_ventas.venta_id` | `Integer` | `BIGINT` | 1.5M filas → necesita BIGINT |
| `fact_ventas.producto_id` | `Integer`, sin FK | `VARCHAR(6)` FK a `dim_producto` | — |
| Schema | ninguno (`public` implícito) | `agronova` | — |
| `dim_cliente` | 7 columnas | 15 columnas (falta `ciclo_vida`, `año_alta/baja`, `riesgo_crediticio`, `tier_cliente`, `volumen_factor`, `cuit`, etc.) | — |
| `dim_sucursal` | 3 columnas | 10 columnas (falta `provincia`, `region_id`, `estado`, etc.) | — |
| Tablas faltantes | — | `dim_fecha`, `dim_region`, `dim_deposito`, `dim_vendedor`, `dim_proveedor`, `fact_compras`, `fact_inventario`, `fact_logistica`, `cotizaciones_externas` | — |
| Columnas `GENERATED` | no contempladas | `fact_inventario.bajo_minimo`, `fact_logistica.dias_transito_real` | Confirmado en `etl/load.py` (se excluyen del INSERT) |

**Conclusión:** `orm.py` se reescribe completo en esta auditoría para reflejar
`02_ddl_productivo.sql` 1:1 (13 tablas, schema `agronova`, tipos correctos,
FKs, columnas generadas documentadas como no-insertables).

El DDL en sí **es coherente con los CSV reales** — se verificó contra
`Dim_Cliente.csv`, `Dim_Producto.csv`, `Dim_Vendedor.csv`, `Dim_Sucursal.csv`,
`Dim_Depósito.csv`, `Dim_Proveedor.csv`, `Dim_Región.csv`, `Dim_Fecha.csv`,
`Fact_Compras.csv`, `Fact_Inventario.csv`, `Cotizaciones_Externas.csv`
(formatos de ID, nombres de columnas y tipos coinciden).

## 4. Qué falta para conectar Neon de verdad

1. **Proyecto Neon real** — no existe `DATABASE_URL` en ningún `.env` (no hay
   `.env` en el repo). Esto es responsabilidad del usuario (crear proyecto en
   neon.tech, copiar el connection string).
2. **Driver Postgres** — `psycopg2-binary` no está instalado.
3. **Carga de datos** — `etl/load_postgres.py` o `etl/run_pipeline.py` nunca
   se ejecutaron. Una vez creado el proyecto Neon, correr
   `python -m etl.run_pipeline --conn "$DATABASE_URL"` (o `--dry-run` primero)
   para poblar las 13 tablas.
4. **Infraestructura del backend** (esta sesión): `backend/core/database.py`,
   `.env.example`, `backend/repositories/`, `backend/scripts/test_connection.py`
   — ver §6.

## 5. Lo que NO se hace en esta sesión

Por instrucción explícita: **no se reemplaza ningún endpoint CSV por DB**, no
se crea un proyecto Neon, no se cargan datos. Esta sesión solo construye la
infraestructura de conexión (engine, sesión, repositorios vacíos, script de
diagnóstico) para que migrar sea un cambio aislado por endpoint el día que
exista `DATABASE_URL`.

## 6. Infraestructura agregada en esta sesión

- `backend/core/database.py` — reemplaza `backend/core/db.py` (mismo rol,
  nombre alineado con el pedido). Carga `.env` vía `python-dotenv`. Si
  `DATABASE_URL` no está seteada, `engine`/`SessionLocal` quedan en `None` —
  ningún router se rompe porque ninguno los importa todavía.
- `backend/models/orm.py` — reescrito completo, 13 tablas, `schema="agronova"`.
- `backend/repositories/` — un repositorio por tabla principal
  (`cliente_repository.py`, `venta_repository.py`, `producto_repository.py`,
  `logistica_repository.py`), con queries básicas (`get_all`, `get_by_id`,
  paginación). No los usa ningún servicio todavía.
- `.env.example` — `DATABASE_URL` (pooled) + `DATABASE_URL_UNPOOLED` (para
  migraciones), siguiendo la convención de `05_neon_setup.sql`.
- `backend/scripts/test_connection.py` — `python -m backend.scripts.test_connection`:
  reporta versión de Postgres y conteo de filas por tabla en el schema
  `agronova`, o un error claro si falta `DATABASE_URL` o el driver.

## 7. Qué endpoints migrar primero (recomendación)

Orden por **menor riesgo / mayor valor**, no por dependencia técnica (todos
son independientes entre sí):

1. **`GET /api/kpis`** — hoy hace agregación pandas sobre `Fact_Ventas.csv`
   completo (1.5M filas) en cada request. Es el endpoint más lento y el que
   más se beneficia de mover la agregación a SQL (`SUM`/`AVG` con índices en
   `fecha_id`, ya creados en el DDL). Migración aislada: un solo servicio,
   una sola query.
2. **`GET /api/logistics/risk`** y **`GET /api/logistics/costs`** — hoy leen
   JSON pre-generado por `gis/cost_model.py`. Bajo riesgo porque el JSON ya
   está versionado como fallback; se puede migrar a una query SQL que
   replique la misma lógica y comparar resultados antes de cortar el JSON.
3. **`GET /api/gis/provincias`** y **`coverage`** — listas planas de 24 filas,
   fáciles de migrar a una vista (`v_*` ya existen en `03_vistas_analiticas.sql`
   para varias de estas agregaciones).

**Dejar para después:** `hotspots` y `territories` (GeoJSON con geometría
calculada por GeoPandas/Voronoi — no hay tipo geometry en el DDL actual, eso
requeriría PostGIS, fuera de alcance de esta fase) y `/api/logistics/routes`
(usa `gis.routing_engine.cliente_routing_assignment()`, que recalcula en vivo
sobre datos ya en memoria — migrarlo no ahorra nada hasta que el dataset
crezca).

## 8. Qué tablas del DW conviene mapear primero

1. **`fact_ventas` + `dim_cliente` + `dim_producto` + `dim_sucursal`** —
   cubren `/api/kpis` y la futura migración de revenue/margen/churn. Es el
   80% del valor de negocio.
2. **`dim_fecha`** — necesaria como JOIN para casi cualquier agregación
   temporal; trivial de cargar (una sola tabla, sin FKs salientes).
3. **`fact_logistica` + `dim_deposito` + `dim_region`** — para
   `/api/logistics/risk` y `costs`.
4. **Dejar para el final:** `fact_compras`, `fact_inventario`,
   `cotizaciones_externas` — ninguna tiene un endpoint que las consuma hoy.

## 9. Riesgos de la migración

- **Neon free tier = 512MB.** `fact_ventas` (1.5M filas) sola estimada en
  200-300MB según `05_neon_setup.sql`. Cargar las 13 tablas completas puede
  acercarse al límite — conviene cargar incremental (dims + `fact_ventas`
  primero) y medir antes de cargar el resto.
- **Columnas `GENERATED` (`bajo_minimo`, `dias_transito_real`)** deben
  excluirse explícitamente del INSERT/COPY — ya lo maneja `etl/load.py`, pero
  cualquier carga manual nueva tiene que recordar esto o falla.
- **IDs como `VARCHAR` con regex CHECK** (`C00001`, `P0001`) — si algún
  generador o servicio nuevo produce IDs fuera de ese patrón, el INSERT
  falla duro (constraint), no silenciosamente.
- **`fact_ventas` no tiene partición** — a 1.5M filas hoy es manejable, pero
  cualquier filtro sin usar `fecha_id`/`cliente_id`/`producto_id` (los únicos
  indexados) puede ser lento en el tier gratuito (CPU compartida).
- **Doble fuente de verdad temporal** — mientras los endpoints sigan leyendo
  CSV/JSON y la DB exista en paralelo, hay riesgo de que ambos diverjan
  (CSV no se actualiza, DB sí, o viceversa). Recomendado: migrar un endpoint
  a la vez y eliminar la ruta CSV de ese endpoint en el mismo PR, no dejar
  ambas rutas vivas indefinidamente.
- **Conexión serverless de Neon (cold start / suspend)** — el plan free
  suspende el compute tras inactividad; el primer request después de un
  rato de inactividad puede tardar varios segundos en "despertar" la DB.
  `test_connection.py` debe tolerar esto con un timeout generoso, no asumir
  latencia de DB always-on.
- **`backend/models/orm.py` no se usa para crear las tablas en esta fase**
  (la carga real, cuando ocurra, debería usar `02_ddl_productivo.sql` vía
  `etl/run_pipeline.py`, que ya tiene los ENUMs y CHECKs que SQLAlchemy
  `Base.metadata.create_all()` no replicaría fielmente). Mezclar ambos
  caminos (DDL manual + `create_all()`) podría crear el esquema dos veces de
  forma inconsistente — usar uno u otro, no los dos.

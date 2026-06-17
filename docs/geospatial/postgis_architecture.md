# Spatial Database Layer — PostGIS (Sprint GIS-05)

Capa de base de datos espacial preparada sobre PostgreSQL/PostGIS, complementaria
a la capa GeoPandas en proceso (GIS-03/GIS-04). No requiere todavía una instancia
real: scripts SQL, módulo de carga y pruebas quedan listos para que activarla sea
`CREATE EXTENSION postgis;` + ejecutar el loader.

Sin PostGIS real ejecutándose. Sin Google Maps API, ArcGIS ni Earth Engine.

## 1. Por qué PostGIS

La capa GeoPandas (`gis/geodataframes.py`, `spatial_operations.py`,
`voronoi_analysis.py`, `hotspot_analysis.py`) resuelve el análisis espacial
**en proceso**: cada ejecución de `generate_analytics.py` relee los CSV
completos, reconstruye las geometrías y vuelve a calcular buffers, Voronoi y
KDE desde cero, exportando el resultado a archivos `.geojson`/`.json`
estáticos que el frontend consume tal cual. Funciona bien para informes
batch, pero tiene tres límites:

1. **No hay consultas ad-hoc.** Si alguien necesita "¿qué clientes caen a
   menos de 80 km de Tandil?" con un radio que no es 50/100/150, hay que
   tocar código Python y volver a corPath el pipeline completo.
2. **No hay join nativo con el resto del Data Warehouse.** `fact_ventas`,
   `dim_cliente`, etc. viven en PostgreSQL (Neon, ver `database/`); el
   análisis espacial vive en memoria de Python. Cruzar "revenue real por
   provincia según geometría" hoy exige stitchear dos pipelines (SQL +
   Python) en vez de una sola consulta.
3. **No escala a acceso concurrente.** Un dashboard o API que reciba
   tráfico real necesita que la geometría esté indexada y servida por un
   motor de base de datos, no recalculada por proceso Python en cada
   request.

PostGIS resuelve los tres puntos: las geometrías quedan persistidas, con
índice GIST, en la misma base PostgreSQL que ya alberga el Data Warehouse
(`database/create_database.sql`, schema `agronova`). Las consultas
espaciales (`ST_Contains`, `ST_Intersects`, `ST_DWithin`, `ST_Distance`) se
ejecutan vía SQL estándar, con el planner de Postgres aprovechando el índice
espacial — y pueden unirse en la misma query con `fact_ventas` o
`dim_cliente` sin pasar por Python.

## 2. Diferencia con GeoPandas

| | GeoPandas (GIS-03/04, actual) | PostGIS (GIS-05, preparado) |
|---|---|---|
| Dónde vive la geometría | En memoria, por proceso Python | Persistida en PostgreSQL, columna `geometry` |
| Cuándo se calcula | Cada corrida de `generate_analytics.py` (batch) | Una vez al cargar (`postgis_loader.py`); las vistas se recalculan por consulta |
| Cómo se consulta | Funciones Python (`coverage_buffers()`, etc.) | SQL (`SELECT ... FROM vw_clientes_cobertura`) |
| Índice espacial | Ninguno — GEOS recorre la geometría en memoria | GIST, usado automáticamente por el planner |
| Acceso concurrente | No pensado para esto (un proceso, un resultado) | Nativo — cualquier cliente SQL puede consultar a la vez |
| Join con el Data Warehouse | Manual, en Python, releyendo CSV | Nativo, mismo motor SQL que `fact_ventas`/`dim_cliente` |
| Costo de iteración | Bajo (Shapely/SciPy, sin infraestructura) | Requiere una instancia Postgres con la extensión PostGIS |

Ninguna reemplaza a la otra: GeoPandas sigue siendo el lugar correcto para
prototipar análisis nuevos (KDE, Voronoi, calibración de constantes — ver
`docs/geospatial/spatial_science.md`). PostGIS es el lugar correcto para
**servir** ese análisis ya validado a consultas en vivo.

## 3. Arquitectura actual vs. futura

**Actual (GIS-01 a GIS-04):**

```
CSV (data/csv/)
  -> gis/*.py (GeoPandas/Shapely/SciPy, en proceso)
  -> data/gis_outputs/*.json|*.geojson (archivos estáticos)
  -> web/public/data/gis_outputs/ (mirror)
  -> Leaflet (frontend, lee JSON estático)
```

Todo el cálculo ocurre en batch, offline, antes de que el frontend pida
nada. El frontend nunca dispara una consulta espacial — solo lee archivos.

**Futura (cuando se active esta capa con una instancia real):**

```
CSV (data/csv/)
  -> gis/geodataframes.py (GeoDataFrames, sin cambios)
  -> gis/postgis_loader.py (sync)
  -> PostgreSQL + PostGIS, schema agronova
       spatial_sucursales / spatial_depositos / spatial_clientes / spatial_provincias
       (índices GIST + vistas vw_*)
  -> (futuro, fuera de este sprint) API que consulta las vistas directamente
  -> Frontend
```

El loader (`gis/postgis_loader.py`) es el único puente entre ambas capas:
lee los mismos `GeoDataFrame` que ya construye `geodataframes.py` y los
sincroniza a las tablas `spatial_*`. No se modifica `dim_cliente`,
`dim_sucursal`, `dim_depósito` ni ninguna tabla del Data Warehouse existente
(`database/create_database.sql`) — las tablas espaciales son un anexo
referenciado por clave foránea, no un reemplazo.

Activación futura, en orden:

1. Tener una instancia PostgreSQL accesible (Neon u otra) con permisos de
   superusuario para crear la extensión.
2. `psql $DATABASE_URL -f database/postgis/01_enable_postgis.sql`
3. `psql $DATABASE_URL -f database/postgis/02_spatial_tables.sql`
4. `psql $DATABASE_URL -f database/postgis/03_spatial_indexes.sql`
5. `psql $DATABASE_URL -f database/postgis/04_spatial_views.sql`
6. `python -m gis.postgis_loader` (lee `DATABASE_URL` del entorno, sincroniza
   las 4 tablas `spatial_*`)

Nada de esto se ejecuta en este sprint — los scripts y el loader quedan
escritos y listos, no aplicados contra ninguna base.

## 4. Tablas espaciales (`database/postgis/02_spatial_tables.sql`)

| Tabla | Geometría | Referencia |
|---|---|---|
| `spatial_sucursales` | `geometry(Point, 4326)` | `agronova.dim_sucursal(sucursal_id)` |
| `spatial_depositos` | `geometry(Point, 4326)` | `agronova.dim_deposito(deposito_id)` |
| `spatial_clientes` | `geometry(Point, 4326)` | `agronova.dim_cliente(cliente_id)` |
| `spatial_provincias` | `geometry(MultiPolygon, 4326)` | sin FK (catálogo propio, 24 provincias) |

Las cuatro guardan `latitud`/`longitud` (`DOUBLE PRECISION`) además de `geom`
— igual que `dim_sucursal`/`dim_deposito` ya guardan `lat`/`lon` planos hoy:
permite leer coordenadas sin `ST_X`/`ST_Y` para consumidores que no hablan
PostGIS, y mantiene paridad con el patrón ya usado en el Data Warehouse
(`database/create_database.sql`). SRID 4326 (WGS-84) en las cuatro, igual
que `CRS_WGS84` en `gis/geodataframes.py` — la reproyección a `EPSG:5347`
para cálculos métricos (buffers, distancias) se hace al vuelo en cada query
vía `::geography` (ver sección 6), no se persiste una segunda copia
proyectada.

**Límite de datos heredado**: `spatial_clientes.geom` es el centroide de la
provincia del cliente, no su ubicación real — la misma limitación que
`clientes_gdf()` documenta en `spatial_science.md` (`Dim_Cliente.csv` no
tiene lat/lon por cliente). Las consultas que siguen son exactas a nivel
provincia, no de cliente individual.

## 5. Índices (`03_spatial_indexes.sql`)

Un índice **GIST** por columna `geom` (las cuatro tablas) — es el índice
espacial estándar de PostGIS, soporta `ST_Contains`, `ST_Intersects`,
`ST_DWithin` y el operador KNN `<->` eficientemente. Se agregan además
índices B-Tree sobre las columnas de FK (`spatial_clientes.cliente_id`,
etc.) para los joins con `fact_ventas`/`dim_cliente` que no son espaciales.

## 6. Vistas espaciales (`04_spatial_views.sql`)

| Vista | Qué responde |
|---|---|
| `vw_clientes_cobertura` | Para cada cliente, distancia (km) a la sucursal más cercana y el bucket de cobertura (`<=50/100/150 km`, `>150 km`) — equivalente SQL de `real_coverage_by_client()` (GIS-04). |
| `vw_revenue_provincia` | Revenue (`fact_ventas.total_ars`) agregado por provincia vía `ST_Contains(provincia, cliente)` — join espacial directo entre geometría y el Data Warehouse, algo que GeoPandas no puede hacer sin releer `Fact_Ventas.csv` en Python. |
| `vw_hotspots` | Densidad de clientes por provincia con el mismo criterio de percentil 97 calibrado en `hotspot_analysis.py` (GIS-04) — marca `es_hotspot = TRUE` para las provincias en el percentil ≥97 de clientes. |
| `vw_expansion_targets` | Provincias cuyo centroide cae fuera de los anillos de 150 km de toda sucursal (`NOT ST_DWithin(..., 150000)`) — equivalente SQL de `candidate_branches()`. |

Las cuatro vistas reproducen, en SQL, un cálculo que ya fue diseñado y
calibrado en Python (GIS-03/04) — no son un análisis nuevo, son la misma
lógica servida desde la base en vez de desde un archivo estático.

## 7. Consultas de ejemplo

Asumiendo las tablas y vistas ya cargadas (`schema agronova`):

**`ST_Contains` — ¿qué provincia contiene a un cliente?**

```sql
SELECT sp.nombre AS provincia
FROM agronova.spatial_clientes sc
JOIN agronova.spatial_provincias sp
  ON ST_Contains(sp.geom, sc.geom)
WHERE sc.cliente_id = 'C00001';
```

**`ST_Intersects` — sucursales cuyo anillo de 100 km toca una provincia dada:**

```sql
SELECT su.nombre
FROM agronova.spatial_sucursales su
JOIN agronova.spatial_provincias sp
  ON sp.nombre = 'Santa Fe'
WHERE ST_Intersects(
  ST_Buffer(su.geom::geography, 100000)::geometry,
  sp.geom
);
```

**`ST_Buffer` — anillo de 50 km alrededor de cada sucursal (equivalente a `coverage_buffers()` de GIS-04):**

```sql
SELECT su.sucursal_id, su.nombre,
       ST_Buffer(su.geom::geography, 50000)::geometry AS buffer_50km
FROM agronova.spatial_sucursales su;
```

**`ST_Distance` — distancia real (metros) de un cliente a la sucursal más cercana:**

```sql
SELECT sc.cliente_id,
       su.nombre AS sucursal_mas_cercana,
       ST_Distance(sc.geom::geography, su.geom::geography) AS distancia_m
FROM agronova.spatial_clientes sc
CROSS JOIN LATERAL (
  SELECT nombre, geom
  FROM agronova.spatial_sucursales
  ORDER BY geom <-> sc.geom
  LIMIT 1
) su
WHERE sc.cliente_id = 'C00001';
```

El operador `<->` (KNN, "vecino más cercano") en el `ORDER BY` del
`LATERAL` es lo que permite que esta consulta use el índice GIST en vez de
calcular la distancia contra las 5 sucursales una por una — la misma idea
que `nearest_branch_assignment()` (GIS-03) calcula en Python con Haversine,
aquí resuelta por el índice espacial de Postgres.

Nota sobre `::geography`: todas las distancias/buffers en metros castean
`geometry` (plano, SRID 4326, en grados) a `geography` (esférico, en
metros) antes de operar — el mismo motivo por el que `gis/geodataframes.py`
reproyecta a `EPSG:5347` antes de un buffer: operar directamente en grados
distorsiona con la latitud.

## 8. `gis/postgis_loader.py`

Único módulo Python de este sprint. Responsabilidades:

- Leer los `GeoDataFrame` ya construidos por `geodataframes.py`
  (`sucursales_gdf()`, `depositos_gdf()`, `clientes_gdf()`, `provincias_gdf()`).
- Adaptar columnas al esquema de cada tabla `spatial_*` (renombrar
  `lat`/`lon` → `latitud`/`longitud`, seleccionar solo las columnas
  relevantes).
- Insertar/sincronizar contra PostGIS vía `GeoDataFrame.to_postgis()`
  (reemplazo completo de la tabla en cada sync — los datos de origen son
  CSV estáticos, no hay necesidad de upsert incremental).

Las dependencias de conexión (`sqlalchemy`, `geoalchemy2`, `psycopg2`) se
importan de forma diferida (dentro de las funciones, no al tope del
módulo) — ninguna está instalada todavía en este entorno, y el módulo debe
poder importarse e inspeccionarse sin ellas. Solo fallan, con un mensaje
claro, si efectivamente se intenta conectar a una base.

## 9. Limitaciones conocidas

1. No hay instancia PostGIS real corriendo — todo este sprint es código y
   SQL preparados, no verificados contra un servidor.
2. `spatial_clientes` hereda la limitación de centroide-por-provincia ya
   documentada en GIS-04 (`spatial_science.md`).
3. Las vistas `vw_hotspots`/`vw_expansion_targets` reproducen en SQL la
   lógica calibrada en Python (percentil 97, radio 150 km) pero no el KDE
   completo de `hotspot_analysis.py` — son una aproximación por conteo,
   suficiente para una vista SQL liviana, no un remplazo del cálculo KDE.
4. Sin Google Maps API, ArcGIS ni Earth Engine — fuera de alcance de este
   sprint y de los siguientes hasta que se indique lo contrario.

# GIS-17 — PostGIS Spatial Intelligence

## Overview

Sprint GIS-17 adds native PostGIS spatial queries to AgroNova's backend, enabling sub-millisecond geometric operations on the Neon PostgreSQL instance (sa-east-1). All endpoints have CSV/JSON fallback when PostGIS is unavailable.

---

## Spatial Functions Used

### ST_Contains(A, B)
Tests whether geometry A **completely contains** geometry B (B lies entirely inside A, no boundary touch).

```sql
-- Used in hotspot_intersections: check if a province polygon contains a hotspot point
SELECT provincia FROM spatial_provincias sp
JOIN vw_hotspots h
  ON ST_Contains(sp.geom, ST_SetSRID(ST_MakePoint(h.longitud, h.latitud), 4326))
```

**Use case:** Confirm a hotspot centroid belongs to a specific province polygon.

---

### ST_Intersects(A, B)
Returns TRUE if geometries A and B share any point (boundary or interior). Opposite of ST_Disjoint.

```sql
-- Used in provinces_intersecting_buffers: find provinces touched by sucursal buffer
SELECT DISTINCT sp.nombre FROM spatial_provincias sp
JOIN spatial_sucursales ss
  ON ST_Intersects(sp.geom, ST_Buffer(ss.geom::geography, 150000)::geometry)
```

**Use case:** Which provinces fall within 150 km of any sucursal? Useful for coverage analysis and territory overlap detection.

---

### ST_DWithin(A, B, distance)
Returns TRUE if A is within `distance` of B. With `::geography` cast, distance is in **meters**. Uses GIST index automatically — far faster than `ST_Distance < threshold`.

```sql
-- Used in clients_within_radius and coverage_analysis_db
SELECT cliente_id FROM spatial_clientes sc
WHERE ST_DWithin(
  sc.geom::geography,
  ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography,
  150000  -- 150 km in meters
)
```

**Use case:** Count clients covered by each sucursal at a configurable radius. `/api/spatial/coverage?radius_km=150`

---

### ST_Distance(A, B)
Returns the exact distance between two geometries. With `::geography`, result is in meters.

```sql
SELECT ST_Distance(geom::geography,
  ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography) / 1000.0 AS distance_km
FROM spatial_sucursales
```

**Use case:** Return exact distance (km) in nearest-branch and nearest-depot responses.

---

### KNN Operator `<->`
PostgreSQL/PostGIS KNN (K-nearest-neighbor) operator. Unlike `ORDER BY ST_Distance(...)`, `<->` uses the **GIST index** directly — no full scan.

```sql
SELECT * FROM spatial_sucursales
ORDER BY geom <-> ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)
LIMIT 1
```

**Use case:** `/api/spatial/nearest` — instant nearest-branch and nearest-depot queries.

---

## GeoPandas vs PostGIS

| Aspect | GeoPandas (Python) | PostGIS (SQL) |
|--------|-------------------|---------------|
| Where runs | Application server | Database engine |
| Scale | 10k–100k rows in RAM | Millions of rows via indexes |
| GIST indexes | Not applicable | Sub-millisecond with `<->`, ST_DWithin |
| Network call | None (in-process) | Round-trip to Neon (~5 ms) |
| Best for | GeoDataFrame transforms, ETL, map rendering | Server-side filtering, nearest queries |
| Used in AgroNova | GIS-05 (postgis_loader.py), test_postgis_spatial.py | GIS-17 spatial endpoints |

GeoPandas loads spatial data into Python memory — excellent for one-time transforms and writing to PostGIS tables. PostGIS queries run inside the database where data already lives and indexes are pre-built.

---

## Schema (SRID 4326 / WGS84)

```sql
-- spatial_sucursales
CREATE TABLE agronova.spatial_sucursales (
  sucursal_id   SMALLINT PRIMARY KEY,
  nombre        VARCHAR(60),
  provincia     VARCHAR(50),
  latitud       NUMERIC(10,6),
  longitud      NUMERIC(10,6),
  geom          GEOMETRY(Point, 4326)
);
CREATE INDEX idx_spatial_sucursales_geom ON agronova.spatial_sucursales USING GIST (geom);

-- spatial_depositos  — same structure, deposito_id
-- spatial_clientes   — cliente_id CHAR(6), provincia, lat/lon, geom Point
-- spatial_provincias — provincia_id, nombre, macro_region, geom MultiPolygon
```

---

## Endpoints (GIS-17)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/spatial/status` | GET | PostGIS version, extension, table row counts |
| `/api/spatial/coverage?radius_km=150` | GET | Clients covered per sucursal (ST_DWithin) |
| `/api/spatial/nearest?lat=-34.61&lon=-58.37` | GET | Nearest branch + top-3 depots (KNN `<->`) |
| `/api/spatial/hotspots` | GET | Hotspots intersected with province polygons (ST_Contains) |
| `/api/spatial/overlaps` | GET | Province pairs sharing sucursal buffers (ST_Intersects) |

All endpoints return `{"mode": "postgis" | "fallback", ...}`. Mode is `"fallback"` when PostGIS extension is not installed or spatial tables are empty.

---

## Frontend: Spatial Tab

The right-panel **"Spatial"** tab shows:
- **POSTGIS STATUS** — live ✓ / ⚑ FALLBACK badge per table
- **Cobertura** — clients covered per sucursal from PostGIS
- **Nearest Query** — interactive lat/lon input → nearest branch + depots
- **Hotspots** — ST_Contains intersections with province polygons
- **Solapamientos** — territorial overlap pairs

---

## Performance

- **GIST indexes** on all `spatial_*` geometry columns prevent full scans
- `<->` KNN operator uses GIST directly (no `ORDER BY ST_Distance` scan)
- `ST_DWithin(::geography, ::geography, meters)` uses GIST via bounding-box pre-filter
- `ST_Buffer(::geography, meters)::geometry` preserves meter-accurate buffers

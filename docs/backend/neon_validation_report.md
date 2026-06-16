# AgroNova — Neon Validation Report

**Generado:** 2026-06-16 19:35:22  
**Schema:** `agronova` | **PostgreSQL:** PostgreSQL 16.14 (daf32eb) on x86_64-pc-linux-gnu  
**Tiempo de consulta:** 2.1s  
**Último ETL registrado:** 170.5s

---

## Conteo de registros

| Tabla | DB | CSV esperado | Δ | Estado |
|---|---:|---:|---:|---|
| `cotizaciones_externas` | 2,870 | 2,870 | +0 | ✅ OK |
| `dim_cliente` | 4,000 | 4,000 | +0 | ✅ OK |
| `dim_deposito` | 3 | 3 | +0 | ✅ OK |
| `dim_fecha` | 4,018 | 4,018 | +0 | ✅ OK |
| `dim_producto` | 2,500 | 2,500 | +0 | ✅ OK |
| `dim_proveedor` | 15 | 15 | +0 | ✅ OK |
| `dim_region` | 5 | 5 | +0 | ✅ OK |
| `dim_sucursal` | 5 | 5 | +0 | ✅ OK |
| `dim_vendedor` | 48 | 48 | +0 | ✅ OK |
| `fact_compras` | 150,000 | 150,000 | +0 | ✅ OK |
| `fact_inventario` | 39,600 | 39,600 | +0 | ✅ OK |
| `fact_logistica` | 200,000 | 200,000 | +0 | ✅ OK |
| `fact_ventas` | 1,500,000 | 1,500,000 | +0 | ✅ OK |
| **TOTAL** | **1,903,064** | **1,903,064** | +0 | ✅ |

---

## Tamaño por tabla

| Tabla | Tamaño total (datos + índices) | Bytes |
|---|---:|---:|
| `fact_ventas` | 345 MB | 361,250,816 |
| `fact_logistica` | 32 MB | 33,636,352 |
| `fact_compras` | 22 MB | 23,142,400 |
| `fact_inventario` | 6936 kB | 7,102,464 |
| `dim_cliente` | 1224 kB | 1,253,376 |
| `dim_fecha` | 672 kB | 688,128 |
| `dim_producto` | 544 kB | 557,056 |
| `cotizaciones_externas` | 432 kB | 442,368 |
| `dim_proveedor` | 48 kB | 49,152 |
| `dim_vendedor` | 40 kB | 40,960 |
| `dim_deposito` | 32 kB | 32,768 |
| `dim_region` | 32 kB | 32,768 |
| `dim_sucursal` | 24 kB | 24,576 |
| **TOTAL SCHEMA** | **408 MB** | — |

---

## Objetos de base de datos

- **Tablas:** 13
- **Vistas analíticas:** 10
- **ENUMs:** `canal_venta`, `estado_compra`, `estado_logistica`, `estado_venta`, `riesgo_tipo`, `rotacion_producto`, `tier_cliente`

---

## Estimación de uso Neon free tier

- **Usado:** 408 MB / 512 MB
- **Estado:** ✅ Dentro del límite free tier

---

## Próximos pasos

1. **Migrar `GET /api/kpis`** — swappear `kpis_service.py` a `VentaRepository`.
   - Revenue y margen ya tienen el SQL equivalente en `backend/repositories/venta_repository.py`.
   - OTIF en `backend/repositories/logistica_repository.py`.
2. **Migrar `GET /api/logistics/risk` y `/costs`** — leer desde `fact_logistica` en lugar de JSON.
3. **Migrar `GET /api/gis/provincias` y `/coverage`** — usar vistas `v_*` de `03_vistas_analiticas.sql`.
4. Dejar para después: `/hotspots`, `/territories` (requieren PostGIS), `/api/logistics/routes`.

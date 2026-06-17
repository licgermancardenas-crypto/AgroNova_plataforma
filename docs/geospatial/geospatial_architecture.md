# AgroNova v2.0 — Geospatial Intelligence Architecture

**Branch:** `feature/geospatial-v2`  
**Fecha:** 2026-06-15  
**Autor:** Germán Cárdenas — Director, AgroNova Argentina S.A.

---

## 1. Visión y Objetivo

La capa geoespacial de AgroNova v2.0 convierte datos de clientes, ventas y logística en inteligencia territorial accionable. Permite detectar zonas sin cobertura, identificar patrones de concentración geográfica, y planificar expansión comercial con base en datos reales del negocio.

**Restricciones arquitectónicas:** No requiere PostGIS, Google Maps API, ArcGIS ni Google Earth Engine. Toda la capa analítica corre en Python puro con pandas, math y json. La visualización usa react-leaflet (ya presente en v1.0).

---

## 2. Estructura de Directorios

```
AgroNova_plataforma/
├── gis/                          # Módulos de análisis geoespacial (Python)
│   ├── __init__.py
│   ├── geo_utils.py              # Catálogo de provincias, CRS, distancias, loaders
│   ├── coverage_analysis.py      # Cobertura por sucursal, gaps, asignación óptima
│   ├── spatial_analysis.py       # Revenue/clientes por provincia y macro-región
│   ├── heatmaps.py               # Datos para Leaflet.heat y coropléticos
│   └── download_geodata.py       # Descarga y simplificación de GeoJSONs
│
├── data/
│   ├── csv/                      # Fact tables y dimensiones (generadas)
│   │   ├── Fact_Ventas.csv       # 1.5M filas — revenue desde 2016
│   │   ├── Fact_Logística.csv    # Entregas con OTIF y demoras
│   │   ├── Dim_Cliente.csv       # 4,000 clientes con provincia
│   │   ├── Dim_Sucursal.csv      # 5 sucursales con lat/lon
│   │   └── Dim_Región.csv        # 5 regiones operativas
│   │
│   └── geojson/                  # Cartografía base
│       ├── provincias.geojson    # Centroides (Georef API) — 24 features, Points
│       ├── provincias_poly.geojson # Polígonos reales (IGN WFS) — 52 MB, MultiPolygon
│       ├── departamentos.geojson  # Centroides departamentales (Georef API) — ~526 features
│       ├── municipios_2022.geojson# Gobiernos locales INDEC Censo 2022 — 2,313 features
│       ├── c2022_codigos_*.xlsx   # Codebooks INDEC Censo 2022
│       └── c2022_gobiernos_locales.xlsx
│
└── docs/geospatial/
    └── geospatial_architecture.md  # Este documento
```

---

## 3. Fuentes de Datos Geoespaciales

| Archivo | Fuente | Geometría | Resolución | Uso |
|---------|--------|-----------|------------|-----|
| `provincias.geojson` | Georef API (datos.gob.ar) | Point (centroide) | Nacional | Marcadores, labels, lookup |
| `provincias_poly.geojson` | IGN WFS ign:provincia | MultiPolygon | 52 MB alta res | Coropléticos server-side |
| `departamentos.geojson` | Georef API | Point (centroide) | ~526 dptos | Drill-down departamental |
| `municipios_2022.geojson` | INDEC Censo 2022 | MultiPoint | 2,313 municipios | Resolución local |
| `c2022_codigos_*.xlsx` | INDEC Censo 2022 | — | Nacional | Codebooks, joins |

### CRS
- **EPSG:4326 (WGS-84):** Formato de todos los archivos. Compatible con Leaflet por defecto.
- **EPSG:5347 (POSGAR 2007 Faja 5):** Solo para análisis de distancias en metros en AMBA/PBA. No se usa en esta capa.

### Códigos INDEC
Formato `in1` (2 dígitos): `02`=CABA, `06`=Buenos Aires, `14`=Córdoba, `82`=Santa Fe, etc.  
Ver `geo_utils.PROVINCE_CATALOGUE` para el mapping completo código → nombre → centroide.

---

## 4. Módulos Python

### 4.1 `geo_utils.py` — Core Utilities

**Constantes:**
- `PROVINCE_CATALOGUE` — 24 provincias con código INDEC, nombre canónico y centroide (lat/lon)
- `MACRO_REGION` — mapping provincia → `PAM | NOA | NEA | CUY | PAT`
- `PROVINCE_AGR_HA_M` — hectáreas cultivables estimadas por provincia (MAGyP)
- `ARGENTINA_BBOX` — bounding box nacional

**Funciones clave:**
| Función | Descripción |
|---------|-------------|
| `normalize_province(name)` | Normaliza variantes de nombre a forma canónica |
| `province_centroid(province)` | Devuelve `(lat, lon)` para una provincia |
| `get_macro_region(province)` | Devuelve PAM / NOA / NEA / CUY / PAT |
| `haversine_km(lat1,lon1,lat2,lon2)` | Distancia en km sin dependencias externas |
| `provincias_geojson()` | Carga centroides con fallback al catálogo |
| `provincias_poly_geojson()` | Carga polígonos IGN (requiere archivo local) |
| `load_clientes()` | CSV con `provincia_norm` y `macro_region` ya calculados |
| `load_ventas()` | CSV con `anio` derivado de `fecha_id` y filtro `Facturada` |
| `load_logistica()` | CSV con columna `otif` calculada |

### 4.2 `coverage_analysis.py` — Cobertura Comercial

**Entradas:** `Dim_Sucursal.csv`, `Dim_Cliente.csv`, `PROVINCE_CATALOGUE`  
**Radios por defecto (km):** Rosario 400 · Pergamino 350 · Tandil 300 · Río Cuarto 350 · Paraná 450

| Función | Output |
|---------|--------|
| `coverage_by_sucursal(radii)` | Provincias dentro del radio + km² cubiertos por sucursal |
| `client_coverage_analysis(radii)` | Cada cliente con sucursal más cercana, distancia y flag `in_coverage` |
| `nearest_sucursal(lat, lon)` | Sucursal más cercana a un punto WGS-84 |
| `coverage_gap_provinces()` | Provincias con potencial agropecuario sin clientes activos |
| `sucursal_client_stats()` | Agregado de clientes por sucursal: count, tiers, % activos |
| `overlap_analysis(radii)` | Provincias cubiertas por más de una sucursal (conflictos) |

### 4.3 `spatial_analysis.py` — Análisis Espacial

**Entradas:** `Fact_Ventas.csv`, `Dim_Cliente.csv`, `Fact_Logística.csv`, `Dim_Región.csv`

| Función | Output |
|---------|--------|
| `revenue_by_province(anio)` | Revenue, margen y clientes por provincia + centroide |
| `revenue_by_province_year()` | Frames anuales 2016–2026 para animación temporal |
| `clients_by_province()` | Mix de tiers, activos y superficie por provincia |
| `regional_kpis(anio)` | KPIs por macro-región: revenue share, margen, n_clientes |
| `logistica_otif_by_region()` | OTIF% y días tránsito por región operativa |
| `territorial_gap_analysis()` | Gap score por provincia: potencial vs penetración actual |
| `churn_risk_by_province()` | Clientes en riesgo/churned con impacto en revenue por provincia |

### 4.4 `heatmaps.py` — Generadores de Heatmap

**Salidas compatibles con Leaflet.heat:** `[lat, lon, intensity]`

| Función | Output |
|---------|--------|
| `client_heatmap(tier_filter, only_active)` | Nube de puntos por cliente (centroide + jitter) |
| `surface_weighted_heatmap()` | Intensidad proporcional a superficie_ha del cliente |
| `revenue_heatmap(anio, normalize)` | Coroplético por provincia, intensity [0,1] |
| `client_density_heatmap()` | Densidad: clientes activos / M ha cultivables |
| `temporal_heatmap_series(metric)` | Dict {año: frames} para slider 2016–2026 |
| `logistics_delay_heatmap()` | Demora promedio y OTIF% por región destino |

---

## 5. Modelo de Datos Geoespacial

### Dimensiones geográficas

```
AgroNova (5 provincias activas)         Argentina (24 provincias totales)
├── Buenos Aires    40% clientes         ├── PAM: BA, SF, CBA, ER, LP
├── Santa Fe        25% clientes         ├── NOA: SA, JU, TU, CA, LR, SE
├── Córdoba         22% clientes         ├── NEA: CH, FO, CO, MI
├── Entre Ríos      10% clientes         ├── CUY: ME, SJ, SL
└── La Pampa         3% clientes         └── PAT: NQ, RN, CB, SC, TF
```

### 5 Regiones Operativas (Dim_Región)

| ID | Nombre | Provincia Principal | Cultivo | Revenue % |
|----|--------|--------------------|---------| ---------|
| 1 | Litoral Norte | Santa Fe | Soja / Girasol | 28% |
| 2 | Pampa Norte | Buenos Aires Norte | Maíz / Soja | 25% |
| 3 | Pampa Sur | Buenos Aires Sur | Trigo / Girasol | 17% |
| 4 | Centro Oeste | Córdoba Sur | Maíz / Soja | 22% |
| 5 | Mesopotamia | Entre Ríos | Soja / Arroz | 8% |

### 5 Sucursales (Dim_Sucursal)

| ID | Nombre | Lat | Lon | Radio |
|----|--------|-----|-----|-------|
| 1 | Rosario | -32.9442 | -60.6505 | 400 km |
| 2 | Pergamino | -33.8895 | -60.5736 | 350 km |
| 3 | Tandil | -37.3217 | -59.1332 | 300 km |
| 4 | Río Cuarto | -33.1307 | -64.3499 | 350 km |
| 5 | Paraná | -31.7319 | -60.5238 | 450 km |

---

## 6. Casos de Uso — Roadmap de Implementación

### 6.1 Cobertura Comercial *(Sprint v2.1)*

**Objetivo:** Visualizar la cobertura territorial de cada sucursal y detectar clientes fuera de radio.

**Implementación:**
```python
from gis.coverage_analysis import coverage_by_sucursal, client_coverage_analysis

df_suc  = coverage_by_sucursal()           # provincias dentro de cada radio
df_cli  = client_coverage_analysis()       # cada cliente: in_coverage T/F
gaps    = coverage_gap_provinces()         # provincias sin cobertura + ha cultivables
```

**Frontend:** Panel 2 del GIS Dashboard — marcadores de sucursal + círculos de radio en react-leaflet. Click en círculo → clientes en esa zona.

**KPIs:**
- Clientes dentro de radio / total
- Provincias sin cobertura con potencial > 1M ha
- Cliente más lejano por sucursal

---

### 6.2 Expansión Territorial *(Sprint v2.1)*

**Objetivo:** Identificar las próximas provincias para expansión de vendedores o apertura de sucursal.

**Implementación:**
```python
from gis.spatial_analysis import territorial_gap_analysis

gaps = territorial_gap_analysis()
# gap_score = agr_ha_m / penetracion_idx (mayor = mayor oportunidad)
# Top 5: Santiago del Estero, Chaco, Corrientes, Salta, Misiones
```

**Output para CEO:** Ranking de provincias por brecha territorial (gap_score), con revenue actual vs potencial estimado basado en hectáreas cultivables.

---

### 6.3 Heatmap de Concentración de Clientes *(Sprint v2.1)*

**Objetivo:** Visualizar dónde se concentran los clientes de valor (Tier A/B) en el mapa.

**Implementación:**
```python
from gis.heatmaps import client_heatmap

points_all   = client_heatmap()                   # todos los clientes
points_ab    = client_heatmap(tier_filter=['A','B'])  # solo premium
points_activo = client_heatmap(only_active=True)  # solo activos
```

**Frontend:** Panel 3 — `leaflet.heat` plugin. Toggle entre capas (todos / Tier A-B / solo activos). Usa jitter (±0.18°) para simular distribución intra-provincial.

---

### 6.4 Optimización Logística *(Sprint v2.2)*

**Objetivo:** Correlacionar distancia geográfica con OTIF y demoras para identificar zonas problemáticas.

**Implementación:**
```python
from gis.heatmaps import logistics_delay_heatmap
from gis.spatial_analysis import logistica_otif_by_region

delay_map = logistics_delay_heatmap()     # avg_demora + otif_pct por región con coordenadas
otif_reg  = logistica_otif_by_region()   # comparativa de regiones
```

**KPIs geoespaciales:**
- OTIF% por macro-región (PAM target > 94%, NOA/NEA > 88%)
- Días tránsito promedio vs distancia a depósito más cercano
- Zonas con demora > 2 días sistémica

---

### 6.5 Análisis de Concentración Geográfica *(Sprint v2.2)*

**Objetivo:** Detectar dependencia excesiva del negocio en pocas provincias y planificar diversificación.

**Implementación:**
```python
from gis.spatial_analysis import regional_kpis, revenue_by_province

kpis    = regional_kpis()       # PAM share, NOA/NEA growth
rev_prov = revenue_by_province() # granularidad provincial
```

**Alertas estratégicas configurables:**
- PAM share > 80%: riesgo de concentración → trigger expansión NOA/NEA
- NOA YoY% < 10%: under-performance → alerta al Director Comercial
- Provincia con n_clientes < 5 y agr_ha_m > 2M: oportunidad no capturada

---

### 6.6 Animación Temporal de Expansión *(Sprint v2.3)*

**Objetivo:** Narrar visualmente el crecimiento geográfico de AgroNova desde 2016 hasta hoy.

**Implementación:**
```python
from gis.heatmaps import temporal_heatmap_series

frames = temporal_heatmap_series(metric='revenue')
# Dict {2016: [...], 2017: [...], ..., 2026: [...]}
# Cada año: lista de {provincia, lat, lon, value, intensity}
```

**Frontend:** Panel 6 — slider de años. Cada frame actualiza la intensidad del coroplético. Muestra expansión desde PAM core hacia NOA/NEA a lo largo del tiempo.

---

## 7. Stack Técnico

### Python (analysis layer)
```
pandas >= 2.0          # DataFrames, aggregations
geopandas >= 0.14      # (opcional) para simplificar provincias_poly.geojson
shapely >= 2.0         # (opcional) para geometric operations
openpyxl >= 3.1        # Lectura de .xlsx de codebooks INDEC
```

No se requieren: PostGIS, GDAL, QGIS, ArcGIS, Google Maps API.

### Frontend (visualización)
```
react-leaflet 4.x      # Ya instalado en v1.0
leaflet.heat           # Plugin para heatmaps — agregar en Sprint v2.1
@geoman-io/leaflet-geoman  # (Sprint v2.3) para edición de zonas
```

### GeoJSON para frontend (choropleth)
El archivo `provincias_poly.geojson` (52 MB) es demasiado pesado para el navegador.  
**Simplificación recomendada** antes de enviarlo al frontend:
```python
import geopandas as gpd
gdf = gpd.read_file("data/geojson/provincias_poly.geojson")
gdf_simple = gdf.copy()
gdf_simple["geometry"] = gdf.simplify(tolerance=0.01, preserve_topology=True)
gdf_simple.to_file("data/geojson/provincias_simple.geojson", driver="GeoJSON")
# Resultado esperado: ~800 KB — apto para web
```

---

## 8. API JSON — Formato de Salida

Todos los módulos Python producen datos que se serializan como JSON para consumo del frontend Next.js.

### Formato coroplético (province-level)
```json
{
  "provincia_norm": "Córdoba",
  "macro_region": "PAM",
  "lat": -32.1448,
  "lon": -63.802,
  "revenue_ars": 1234567890.0,
  "n_clientes": 189,
  "agr_ha_m": 8.2,
  "intensity": 0.847
}
```

### Formato heatmap (Leaflet.heat)
```json
[[lat, lon, intensity], [lat, lon, intensity], ...]
```

### Formato cobertura
```json
{
  "sucursal_id": 1,
  "nombre": "Rosario",
  "lat": -32.9442,
  "lon": -60.6505,
  "radius_km": 400,
  "provincias_in_radius": ["Buenos Aires", "Santa Fe", "Entre Ríos", "Córdoba"],
  "n_provincias": 4,
  "km2_covered_approx": 502655
}
```

---

## 9. Integración con v1.0

La capa geoespacial v2.0 **no modifica** el frontend existente de v1.0.

**Punto de integración planificado:**
- `web/app/gis/page.tsx` — página GIS existente recibe nuevos datos desde el módulo Python
- Los datos Python se exponen como JSON estático en `web/public/data/geo/` (build-time) o vía API route (`web/app/api/geo/`)
- El `LeafletMap.tsx` existente se extiende con capas adicionales (cobertura, heatmap)

**Sin cambios requeridos en:**
- Componentes existentes
- Rutas existentes
- Design system
- Mock data de v1.0 (queda para fallback)

---

## 10. Deuda Técnica Conocida

| Item | Impacto | Solución futura |
|------|---------|----------------|
| `Dim_Cliente` no tiene lat/lon individual | Heatmap usa centroide provincial + jitter | Enriquecer CSV con geocoding a nivel ciudad |
| `provincias_poly.geojson` 52MB | No apto para frontend directo | Generar `provincias_simple.geojson` con geopandas.simplify(0.01) |
| Georef API devuelve Points, no polígonos | Para análisis provincial solo centroides | OK para v2.1; polígonos disponibles vía IGN |
| Regiones operativas ≠ macro-regiones | Joins manuales requeridos | Tabla de crosswalk región_id → macro_region |
| Sin tests para módulos GIS | Riesgo en producción | Agregar `tests/test_gis_*.py` en Sprint v2.2 |

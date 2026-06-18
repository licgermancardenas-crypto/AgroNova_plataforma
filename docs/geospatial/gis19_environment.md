# GIS-19 — Satellite & Environmental Intelligence

## Objetivo

Incorporar una capa de inteligencia ambiental y climática: scoring de sequía, riesgo pluvial, aptitud agrícola y score climático compuesto para todas las provincias argentinas.

---

## Arquitectura

```
backend/services/environment_service.py
  ├── drought_index()
  ├── rainfall_risk()
  ├── crop_suitability()
  ├── climate_score()
  ├── all_scores()
  └── generate_environment_json() → web/public/data/gis_outputs/environment_scores.json
         │
         ▼
backend/schemas/environment.py
  ProvinceEnvironment, EnvironmentScoresResponse,
  DroughtRankingResponse, RainfallRankingResponse
         │
         ▼
backend/api/routers/environment.py
  GET /api/environment/scores
  GET /api/environment/drought
  GET /api/environment/rainfall
         │
         ▼
web/components/gis/EnvironmentPanel.tsx
  Tab "Env" → sub-tabs: Clima · Sequía · Lluvia · Aptitud
```

---

## FASE 1 — Servicio

### Fuentes de datos

Valores basados en climatología oficial argentina:

| Fuente | Uso |
|--------|-----|
| SMN (Servicio Meteorológico Nacional) | Precipitación media anual por provincia |
| INTA | Aptitud agrícola por región |
| INDEC + Atlas Conurbano | Cobertura territorial |

### Campos por provincia

| Campo | Rango | Descripción |
|-------|-------|-------------|
| `rainfall_mm_yr` | 100–1800 mm | Precipitación media anual |
| `rainfall_score` | 0–100 | Score pluvial (mayor = más lluvia) |
| `drought_risk` | 0–100 | Riesgo de sequía (mayor = más crítico) |
| `suitability_score` | 0–100 | Aptitud agrícola compuesta |
| `climate_score` | 0–100 | Score climático integrado |

### Macro-regiones y rangos típicos

| Región | Precipitación | Sequía | Aptitud |
|--------|--------------|--------|---------|
| PAM — Pampeana | 500–1200 mm | 12–58 | 60–92 |
| NEA — Noreste   | 1000–1800 mm | 6–48  | 68–80 |
| NOA — Noroeste  | 280–850 mm  | 38–80 | 40–80 |
| CUY — Cuyo      | 100–450 mm  | 60–90 | 52–68 |
| PAT — Patagonia | 180–500 mm  | 28–76 | 22–52 |

---

## FASE 2 — Endpoints

| Endpoint | Ordenamiento | Descripción |
|----------|-------------|-------------|
| `GET /api/environment/scores` | inserción | Todos los scores por provincia |
| `GET /api/environment/drought` | `drought_risk` DESC | Más crítico primero |
| `GET /api/environment/rainfall` | `rainfall_score` ASC | Menor lluvia = mayor riesgo hídrico primero |

Todos los endpoints leen de `_PROVINCE_ENV` (en memoria). Sin DB, sin archivos externos.

---

## FASE 3 — Frontend

`web/components/gis/EnvironmentPanel.tsx` — 4 sub-tabs:

- **Clima**: ranking por climate_score con mini-barras verdes
- **Sequía**: ranking por drought_risk con colores semáforo (verde/naranja/rojo)
- **Lluvia**: ranking por rainfall_score con mm/año y barras azules
- **Aptitud**: top 12 por suitability_score + cultivos dominantes

Diseño HUD existente (glass, tactical-text, colores primary #22C55E). Esqueleto de carga durante fetch.

---

## FASE 4 — Nuevos basemaps

Se agregó `osm_topo` (OpenTopoMap) al selector:

```typescript
// web/types/index.ts
export type BasemapId = "dark" | "voyager" | "esri_gray" | "osm_hot" | "esri_imagery" | "osm_topo";

// web/components/map/LeafletMap.tsx BASEMAPS
osm_topo: {
  label: "OpenTopoMap",
  url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
  attribution: "...",
}
```

Basemaps ya existentes (no requirieron cambio): `voyager` (Carto Voyager), `esri_imagery` (Esri World Imagery).

---

## Integración futura (no implementada en GIS-19)

### Sentinel-2 (ESA Copernicus)

Sentinel-2 es un satélite de observación de la Tierra de la ESA que captura imágenes multiespectrales de 13 bandas a 10–60 m de resolución. Para AgroNova:

- **Bandas clave**: B04 (Red), B08 (NIR) → cálculo de NDVI
- **NDVI** (Normalized Difference Vegetation Index): `(NIR - Red) / (NIR + Red)`
  - NDVI > 0.5 → vegetación densa / cultivo activo
  - NDVI 0.2–0.5 → pasto / rastrojo
  - NDVI < 0.2 → suelo desnudo / sequía
- **Frecuencia**: revisita cada 5 días (combinando Sentinel-2A y 2B)
- **Caso de uso AgroNova**: alertas de estrés hídrico por partido/departamento, monitoreo de campaña en tiempo real

### Google Earth Engine (GEE)

GEE es una plataforma de análisis geoespacial en la nube de Google con acceso a > 70 petabytes de datos satelitales:

```javascript
// Ejemplo: NDVI medio por provincia en los últimos 30 días
var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterDate(ee.Date.now().advance(-30, 'day'), ee.Date.now())
  .filterBounds(argentina)
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
  .median();

var ndvi = s2.normalizedDifference(['B8', 'B4']).rename('NDVI');
```

**Integración con AgroNova**: exportar GeoJSON de zonas NDVI < 0.2 → cargar como capa `hotspots_ndvi` en el mapa Leaflet.

### ArcGIS Living Atlas

ArcGIS Living Atlas of the World (Esri) provee:

- `World Drought Indicator` — índice PDSI global, actualización mensual
- `World Precipitation` — precipitación interpolada CHIRPS
- `Argentina Soil Capacity` — capacidad de campo por suelo

Acceso vía REST:
```
https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/
  World_Drought_Indicator/FeatureServer/0/query
  ?where=country='ARG'&outFields=*&f=geojson
```

**Nota**: requiere cuenta ArcGIS Online (Esri). Plan Developer gratuito disponible para prototipado.

---

## Notas de implementación

- **Sin APIs externas**: todos los datos son valores estáticos calibrados por macro-región, consistentes con climatología argentina.
- **Idempotente**: `generate_environment_json()` se ejecuta en import y escribe a disco; no falla si los directorios ya existen.
- **Fallback**: el frontend captura errores de fetch y muestra "API no disponible" sin crash.

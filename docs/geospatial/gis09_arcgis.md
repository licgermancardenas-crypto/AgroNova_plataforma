# GIS-09 — ArcGIS Integration Foundation

**Branch:** `feature/geospatial-v2`
**Date:** 2026-06-18
**Build:** ✓ 0 errors · `/gis` 16.2 kB · `ƒ /api/arcgis/status` dynamic

---

## Objetivo

Integrar ArcGIS de forma incremental y desacoplada como capa adicional al stack GIS existente (Leaflet + react-leaflet). El sistema sigue funcionando en **modo local** si `ARCGIS_API_KEY` no está configurada, sin romper nada de GIS-08.

---

## 1. ArcGIS REST API

ArcGIS ofrece servicios GIS vía REST endpoints que no requieren instalar el SDK de JavaScript en el frontend. Se consumen directamente con `requests` (Python) o `fetch` (Next.js).

### Endpoints principales

| Servicio | URL base | Requiere API Key |
|----------|----------|-----------------|
| World Geocoder | `geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer` | Sí |
| World Route | `route.arcgis.com/arcgis/rest/services/World/Route/NAServer/Route_World` | Sí |
| Service Areas | `route.arcgis.com/arcgis/rest/services/World/ServiceAreas/NAServer/ServiceArea_World` | Sí |
| Basemaps | `server.arcgisonline.com/arcgis/rest/services/World_Imagery` | No (tiles XYZ) |
| Feature Layers | `services.arcgis.com/{org}/arcgis/rest/services/{name}/FeatureServer` | Según config |

### Autenticación

```
GET /findAddressCandidates?SingleLine=...&token=ARCGIS_API_KEY&f=json
```

El token se pasa como query param `token=`. Para producción, usar **OAuth 2.0** con `client_id` + `client_secret` para obtener tokens de corta duración.

---

## 2. Geocoding

**Módulo:** `gis/arcgis/geocoding.py`

### Flujo

```
geocode("Rosario, Santa Fe")
    ↓ ARCGIS_API_KEY presente?
    ├── Sí → POST /World/GeocodeServer/findAddressCandidates
    │         → { lat: -32.9468, lon: -60.6393, score: 100, source: "arcgis" }
    └── No → lookup en _CITY_COORDS + PROVINCE_CATALOGUE (offline)
              → { lat: -32.9468, lon: -60.6393, score: 85, source: "local" }
```

### Resultado de prueba (Req-4)

```json
{"address": "Rosario, Santa Fe", "lat": -32.9468, "lon": -60.6393, "score": 85.0, "source": "local"}
{"address": "Buenos Aires",      "lat": -34.6037, "lon": -58.3816, "score": 85.0, "source": "local"}
{"address": "Mendoza",           "lat": -32.8895, "lon": -68.8458, "score": 85.0, "source": "local"}
```

### Fallback offline

- **Ciudades:** 20 ciudades principales de Argentina (coordenadas exactas)
- **Provincias:** 24 provincias desde `geo_utils.PROVINCE_CATALOGUE` (centroides INDEC)
- **Default:** centroide de Argentina (-34, -64) con score 0

---

## 3. Routing

**Módulo:** `gis/arcgis/routing.py`

### ArcGIS World Route Service

- Multi-waypoint route optimization
- Devuelve: distancia total, tiempo de viaje, geometría GeoJSON (LineString)
- Modo local: aproximación Haversine × 0.65 (factor road-network) a 80 km/h promedio

### Ejemplo

```python
route([
    {"name": "Buenos Aires", "lat": -34.603, "lon": -58.381},
    {"name": "Rosario",      "lat": -32.947, "lon": -60.639},
    {"name": "Córdoba",      "lat": -31.413, "lon": -64.181},
])
# → { total_km: 740.5, total_min: 555.4, source: "local" }
```

---

## 4. Service Areas

**Módulo:** `gis/arcgis/service_areas.py`

### Concepto

Un **service area** (área de servicio) es un polígono que representa la zona accesible desde un punto de origen dentro de N minutos de manejo en red vial. A diferencia de un buffer circular simple, usa la red de calles real (cuando hay API key).

### ArcGIS World Service Areas endpoint

```
POST /World/ServiceAreas/NAServer/ServiceArea_World/solveServiceArea
  facilities = FeatureSet con lat/lon
  defaultBreaks = "30 60 120"   (minutos)
  travelMode = {"type": "AUTOMOBILE"}
  returnPolygons = true
```

### Modo local (sin API key)

Genera círculos geodésicos aproximados con radio = velocidad × tiempo × factor:

```
radio_30min  = 80 km/h × 0.5h × 0.65 = 26 km
radio_60min  = 80 km/h × 1.0h × 0.65 = 52 km
radio_120min = 80 km/h × 2.0h × 0.65 = 104 km
```

El factor **0.65** compensa que en red vial la distancia real es ~35% mayor que en línea recta.

### Outputs generados (Req-5)

```
data/gis_outputs/
├── service_area_Puerto_Rosario_-32.947_-60.639.geojson
├── service_area_Sucursal_Buenos_Aires_-34.603_-58.381.geojson
├── service_area_Sucursal_Rosario_-32.947_-60.639.geojson
├── service_area_Sucursal_Córdoba_-31.413_-64.181.geojson
├── service_area_Sucursal_Tucumán_-26.808_-65.218.geojson
├── service_area_Sucursal_Mendoza_-32.889_-68.846.geojson
└── service_areas_all.geojson   ← consolidado 15 polígonos (5 suc × 3 breaks)
```

Cada archivo es un GeoJSON `FeatureCollection` con 3 features (30/60/120 min).

**Copiado a:** `web/public/data/gis_outputs/service_areas_all.geojson` (25 KB)

---

## 5. Isochrones

**Módulo:** `gis/arcgis/service_areas.py` — función `compute_isochrone()`

Las **isochrones** (isolíneas de tiempo) son conceptualmente idénticas a los service areas. En ArcGIS usan el mismo endpoint `solveServiceArea` con distintos parámetros:

| Parámetro | Service Area | Isochrone |
|-----------|-------------|-----------|
| `defaultBreaks` | minutos de drive-time | minutos de walk/bike/drive |
| `travelMode` | AUTOMOBILE | WALKING, BICYCLING, AUTOMOBILE |
| `outputType` | Polígono | Polígono (igual) |

### Backend listo — frontend pendiente GIS-10

El backend puede generar isochrones vía `compute_isochrone()`. La visualización sobre el mapa Leaflet se planea para **GIS-10** (layer `IsochroneLayer.tsx`).

---

## 6. Configuración por variables de entorno

**Módulo:** `gis/arcgis/config.py`

```bash
# .env.local (Next.js) o entorno del proceso Python
ARCGIS_API_KEY=your_api_key_here
ARCGIS_BASE_URL=https://geocode.arcgis.com/arcgis/rest/services
```

### Comportamiento por modo

| Config | Geocoding | Routing | Service Areas | Frontend |
|--------|-----------|---------|--------------|---------|
| Sin key | Local (INDEC) | Haversine | Círculos geodésicos | "MODO LOCAL" |
| Con key | ArcGIS World | ArcGIS Route | ArcGIS SA | "ARCGIS LIVE" |

---

## 7. Frontend — Pestaña ArcGIS

**Componente:** `web/components/gis/ArcGISPanel.tsx`  
**API route:** `web/app/api/arcgis/status/route.ts` → `GET /api/arcgis/status`

### Panel muestra

- **Estado API**: badge "ARCGIS LIVE" / "MODO LOCAL"
- **Geocoding**: fuente, cobertura, resultado de prueba "Rosario, Santa Fe"
- **Service Areas**: cantidad de polígonos cargados, instalaciones, breaks, colores
- **Capabilities**: tabla OK/PENDIENTE/FUTURO por capacidad
- **Roadmap GIS-09 → GIS-14**: estado de cada sprint
- **Hint de configuración**: instrucciones para activar API cuando está en modo local

### Acceso

Tab "ArcGIS" en el panel derecho del dashboard GIS (`/gis`).

---

## 8. Futuro: ArcGIS Maps SDK for JavaScript

El **ArcGIS Maps SDK** (anteriormente ArcGIS API for JavaScript) permite:

| Feature | REST API actual | ArcGIS JS SDK |
|---------|----------------|---------------|
| Geocoding | ✓ | ✓ + autosuggestions |
| Routing | ✓ | ✓ + turn-by-turn UI |
| Service Areas | ✓ | ✓ + animaciones |
| WebMap (.webmap) | — | ✓ |
| Scene View 3D | — | ✓ |
| Feature Layers en vivo | — | ✓ |
| Offline / PWA | — | ✓ |
| Sketch / edición | — | ✓ |

### Integración en Next.js (planificada GIS-11)

```tsx
// next.config.ts — excluir del SSR
const nextConfig = {
  transpilePackages: ["@arcgis/core"],
};

// Uso con dynamic import
const MapView = dynamic(() => import("@arcgis/core/views/MapView"), { ssr: false });
```

El SDK pesa ~4 MB (bundle), por eso se mantiene como import dinámico lazy. La ruta actual con Leaflet + REST API directa es suficiente para GIS-09 a GIS-10.

---

## Estructura de archivos GIS-09

```
gis/arcgis/
├── __init__.py          ← exports: config, geocoding, routing, service_areas
├── config.py            ← ARCGIS_API_KEY, BASE_URL, helpers is_configured()/mode()
├── geocoding.py         ← geocode(), batch_geocode(), local fallback
├── routing.py           ← route(), local Haversine fallback
└── service_areas.py     ← compute_service_area(), compute_isochrone(), compute_batch()

web/
├── app/
│   └── api/arcgis/status/
│       └── route.ts     ← GET /api/arcgis/status → ArcGISStatus JSON
└── components/gis/
    └── ArcGISPanel.tsx  ← tab "ArcGIS" en el dashboard /gis

data/gis_outputs/
└── service_areas_all.geojson  ← 15 polígonos pre-generados (5 suc × 3 breaks)

web/public/data/gis_outputs/
└── service_areas_all.geojson  ← copia para servir desde Next.js
```

---

## Validación

```bash
# Test geocoding (Req-4)
python -m gis.arcgis.geocoding
# → Rosario, Santa Fe: lat=-32.9468, lon=-60.6393

# Test service areas (Req-5)
python -m gis.arcgis.service_areas --all
# → 6 archivos GeoJSON generados en data/gis_outputs/

# Build frontend
cd web && npm run build
# → 0 errores · /gis 16.2 kB · ƒ /api/arcgis/status (dynamic)
```

# GIS-14 — ArcGIS Live Services

**Sprint:** GIS-14  
**Branch:** feature/geospatial-v2  
**Status:** Completed

---

## Objetivo

Conectar ArcGIS Location Services y elevar AgroNova a una plataforma GIS enterprise, manteniendo fallback local completo cuando no hay API key.

---

## Arquitectura

```
.env (ARCGIS_API_KEY)
       │
       ▼
gis/arcgis/config.py          ← Lee la key; expone CONFIG singleton
       │
       ├─ gis/arcgis/geocoding.py          (GIS-09) forward geocode + local fallback
       ├─ gis/arcgis/geocoding_live.py     (GIS-14) geocode_address(), reverse_geocode()
       │
       ├─ gis/arcgis/routing.py            (GIS-09) route cálculo + Haversine fallback
       ├─ gis/arcgis/routing_live.py       (GIS-14) calculate_route(), route_distance(), travel_time()
       │
       ├─ gis/arcgis/service_areas.py      (GIS-09) batch generation + local_approx fallback
       └─ gis/arcgis/service_areas_live.py (GIS-14) generate_service_areas(), refresh_all(), get_status()

web/app/api/arcgis/status/route.ts    ← Expanded ArcGISStatus interface
web/app/api/arcgis/geocode/route.ts   ← NEW: forward + reverse geocoding API
web/components/gis/ArcGISPanel.tsx    ← ONLINE/OFFLINE badge, service details, geocoding tester
```

---

## Endpoints ArcGIS REST

### Geocoding

| Endpoint | URL |
|---|---|
| Forward | `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates` |
| Reverse  | `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode` |

Parámetros clave:
- `token`: ARCGIS_API_KEY
- `countryCode=ARG`: limitar a Argentina
- `langCode=es`: respuestas en español
- `maxLocations=1`: solo el mejor candidato

### Routing

| Endpoint | URL |
|---|---|
| Route   | `https://route.arcgis.com/arcgis/rest/services/World/Route/NAServer/Route_World/solve` |

### Service Areas

| Endpoint | URL |
|---|---|
| Service Area | `https://route.arcgis.com/arcgis/rest/services/World/ServiceAreas/NAServer/ServiceArea_World/solveServiceArea` |

Breaks configurados: **30 / 60 / 120 minutos** (drive-time).

---

## Fallbacks locales

Cada capa tiene fallback independiente — la app funciona sin ARCGIS_API_KEY:

| Servicio | Fallback |
|---|---|
| Forward geocoding | Tabla 20 ciudades argentinas (CITY_COORDS) |
| Reverse geocoding | Euclidean distance a ciudad más cercana de CITY_COORDS |
| Routing | Haversine distance + velocidad media 80 km/h |
| Service areas | Círculos concéntricos (radio = vel × tiempo) por instalación |

---

## API endpoints Next.js

### `GET /api/arcgis/status`

Retorna `ArcGISStatus`:

```typescript
{
  configured: boolean;            // true si ARCGIS_API_KEY presente
  mode: "arcgis" | "local";
  api_key_masked: string | null;  // "…XXXX"
  active_services: number;
  geocoding_active: boolean;
  geocoding_source: "arcgis_live" | "local_indec";
  routing_ready: boolean;
  routing_source: "arcgis_live" | "local_haversine";
  isochrones_ready: boolean;
  service_areas: number;          // polygon count from GeoJSON
  service_areas_sucursales: number;
  service_areas_source: "arcgis_live" | "local_approx";
  last_updated: string | null;    // ISO mtime of service_areas_all.geojson
  capabilities: { geocoding, routing, service_areas, isochrones, feature_layers, scene_view, offline_maps };
  message: string;
}
```

### `GET /api/arcgis/geocode`

```
?q=Rosario, Santa Fe        → forward geocode
?lat=-32.94&lon=-60.63      → reverse geocode
```

Retorna `GeocodeResult`:

```typescript
{
  address: string;
  lat: number;
  lon: number;
  score: number;       // 0–100
  source: "arcgis" | "local";
}
```

---

## Módulos Python nuevos (GIS-14)

### `gis/arcgis/geocoding_live.py`

```python
geocode_address(address: str) -> GeocodeResult
reverse_geocode(lat: float, lon: float) -> GeocodeResult
```

### `gis/arcgis/routing_live.py`

```python
calculate_route(from_loc, to_loc) -> RouteResult
route_distance(from_loc, to_loc) -> float   # km
travel_time(from_loc, to_loc) -> float      # min
multi_stop_route(*waypoints) -> RouteResult
```

### `gis/arcgis/service_areas_live.py`

```python
generate_service_areas(facilities=None, breaks_min=None) -> list[ServiceAreaResult]
refresh_all() -> dict          # re-genera y guarda ALL_SA_PATH
get_status() -> dict           # lee ALL_SA_PATH, cuenta features y mtime
```

---

## ArcGISPanel (FASE 6)

Mejoras respecto a GIS-09:

- **Badge ONLINE/OFFLINE** con pulsing dot animado
- **Conteo de servicios activos** (e.g., "4 servicios activos")
- **API key masked** visible cuando configurada
- **Por-servicio LIVE/LOCAL badges**: Geocoding, Routing, Service Areas
- **Live geocoding tester**: input → `GET /api/arcgis/geocode` → muestra resultado con coordenadas y badge de fuente
- **Drive-time legend**: 30/60/120 min con colores verde/naranja/rojo
- **Capabilities matrix**: 8 capacidades con estado OK/FUTURO
- **Roadmap GIS**: GIS-09 → GIS-16, GIS-14 marcado como activo
- **Config hint**: instrucciones para activar ArcGIS Live cuando está en modo local

---

## Límites del free tier

| Recurso | Límite gratuito |
|---|---|
| Geocoding | 20.000 req/mes |
| Routing | 5.000 req/mes |
| Service Areas | 5.000 req/mes |
| Basemaps | 2.000.000 tiles/mes |

Fuente: developers.arcgis.com/pricing

---

## Activación

```bash
# 1. Obtener API key gratuita en developers.arcgis.com
# 2. Agregar en .env (o .env.local)
ARCGIS_API_KEY=your_api_key_here

# 3. Reiniciar servidor de desarrollo
npm run dev
```

El panel GIS mostrará automáticamente "ARCGIS LIVE" con servicios activos.

---

## Dependencias nuevas

Ninguna — GIS-14 usa únicamente `fetch` (nativo en Next.js) y `requests` (ya instalado en el entorno Python).

---

## Integración con el mapa

ArcGIS actúa como **capa adicional** — no reemplaza Leaflet ni Deck.gl:

```
Leaflet (base navigation + GeoJSON layers)
  └─ Deck.gl overlay (3D extrusion, arcs, beams)         ← GIS-13
       └─ ArcGIS data layer (geocoding, routing, SA)     ← GIS-14
```

Los datos ArcGIS alimentan la API Python que genera los GeoJSONs estáticos usados por Leaflet.

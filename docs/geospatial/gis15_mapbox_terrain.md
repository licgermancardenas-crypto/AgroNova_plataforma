# GIS-15 — Mapbox GL + Terrain Intelligence

**Sprint:** GIS-15  
**Branch:** feature/geospatial-v2  
**Status:** Completed

---

## Objetivo

Agregar Mapbox GL JS como motor visual avanzado sin reemplazar Leaflet. El usuario puede conmutar entre motores en tiempo real sin recargar.

---

## Arquitectura híbrida

```
AgroNova GIS
  ├── Motor LEAFLET (default)
  │     Leaflet + react-leaflet + GeoJSON propio
  │     └── Deck.gl overlay (GIS-13): 3D extrusion, arcs, beams
  │
  └── Motor MAPBOX (opcional — requiere token)
        MapboxTerrainView.tsx
        ├── Estilo base: satellite-streets-v12
        ├── Terrain 3D (DEM mapbox.mapbox-terrain-dem-v1)
        ├── Hillshade personalizado (verde AgroNova)
        ├── Sky layer atmospheric
        ├── Fog layer (espacio oscuro)
        ├── 3D Buildings (fill-extrusion, minzoom 9)
        └── Province KPI choropleth (mismo GeoJSON + colores)
```

**Estado compartido entre motores:**
- `selectedProvince` — selección de provincia
- `selectedMetric` — métrica KPI activa
- `selectedYear` — año temporal
- `allKpis` — datos KPI del año seleccionado

---

## Configuración

### 1. Obtener token

Token gratuito en: [account.mapbox.com](https://account.mapbox.com/)  
El plan gratuito incluye 50.000 map loads/mes.

### 2. Variables de entorno

```bash
# .env o .env.local
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1...
```

### 3. Fallback automático

Si `NEXT_PUBLIC_MAPBOX_TOKEN` está vacío:
- El botón "MAPBOX" en el engine selector muestra "TOKEN FALTANTE" y queda deshabilitado
- La app sigue funcionando 100% con Leaflet
- No hay errores ni warnings en consola

---

## Componentes nuevos/modificados

| Archivo | Acción |
|---|---|
| `web/lib/mapbox-config.ts` | Config singleton: `MAPBOX_TOKEN`, `isMapboxConfigured()`, `getMapboxTokenMasked()` |
| `web/components/gis/MapboxTerrainView.tsx` | Componente principal Mapbox |
| `web/app/gis/page.tsx` | Engine selector, estado `mapEngine/showTerrain/showSatellite`, HUD v6.0 |
| `web/types/index.ts` | Tipo `MapEngine = "leaflet" \| "mapbox"` |
| `web/next.config.ts` | `transpilePackages: ["mapbox-gl"]` |

---

## MapboxTerrainView — features implementados

### FASE 2 — Mapa base
- **Estilo:** `satellite-streets-v12`
- **Centro inicial:** Argentina (-64, -38)
- **Zoom:** 4, Pitch: 40°, Bearing: -8°
- **Controles:** NavigationControl (top-right), AttributionControl (compact)

### FASE 3 — Terrain real
- **DEM source:** `mapbox://mapbox.mapbox-terrain-dem-v1` (512px tiles, maxzoom 14)
- **Terrain exaggeration:** 1.5× (toggle: `showTerrain`)
- **Hillshade:** shadow `#071209`, highlight `#4ADE80` (brand green), exaggeration 0.4, illumination 335°
- **Sky layer:** atmospheric, sun intensity 12
- **Fog:** dark-green space (`#071209`), horizon-blend 0.04, star-intensity 0.5

### FASE 4 — 3D Buildings
- **Source:** `composite` (Mapbox vector tiles), layer `building`
- **Filter:** `extrude = true`
- **Type:** `fill-extrusion`, minzoom 9
- **Color:** `#1A3D20` (brand dark green), opacity 0.7
- **Height:** interpolated at zoom 9–9.5

### FASE 5 — Sincronización de estado
- **Province fill:** GeoJSON con `_color` property pre-calculada por `provinceColor()`
- **Update on metric/KPI change:** `source.setData(enriched)` — no rebuild layers
- **Selected highlight:** `setPaintProperty` con Mapbox expression `['case', ['==', ['get', 'nombre'], sel], ...]`
- **Satellite toggle:** itera todas las capas `type: raster` y alterna visibility
- **Province labels:** `symbol` layer con tipografía DIN Offc Pro Medium

---

## Engine selector (FASE 6)

**Ubicación:** floating pill top-left del mapa y sección en LeftPanel

```
[ ◆ LEAFLET ]  [ ◈ MAPBOX ]
```

- Sin reload — swap instantáneo de componentes React
- Estado `mapEngine: MapEngine` en `page.tsx`
- Leaflet se desmonta al cambiar a Mapbox, Mapbox se desmonta al volver (memoria limpia)

---

## HUD (FASE 7)

**Title bar del mapa** muestra:

| Elemento | Motor |
|---|---|
| `ARGENTINA · GIS HYBRID INTELLIGENCE v6.0` | siempre |
| Año + HISTÓRICO badge | siempre |
| `MAPBOX` badge (verde lima) | solo Mapbox activo |
| `TERRAIN` badge (verde) | Mapbox + showTerrain |
| `SAT` badge (azul) | Mapbox + showSatellite |
| `NO-TOKEN` badge (naranja) | Mapbox sin token |
| `Sprint GIS-15` | siempre |

**Badges bottom-right** (Mapbox mode):
- Terrain 3D, Satellite, Hillshade, Sky Layer, 3D Buildings

---

## Costos Mapbox Free Tier

| Recurso | Límite gratuito |
|---|---|
| Map loads (web) | 50.000 / mes |
| Tile requests | 750.000 / mes |
| Geocoding | 100.000 req / mes |
| Directions | 100.000 req / mes |

Fuente: [mapbox.com/pricing](https://www.mapbox.com/pricing)

Para AgroNova (uso interno), el free tier es suficiente.

---

## Ventajas del motor Mapbox vs Leaflet

| Feature | Leaflet | Mapbox GL |
|---|---|---|
| Terrain 3D con DEM | ✗ | ✓ |
| Hillshade realista | ✗ | ✓ |
| Sky + fog | ✗ | ✓ |
| 3D Buildings | via Deck.gl | ✓ nativo |
| Rotation smooth | via Deck.gl | ✓ nativo |
| Satellite imagery | ESRI (tile) | Mapbox (vector+raster) |
| Custom expressions | ✗ | ✓ Paint expressions |
| Rendimiento > 10k features | Moderado | Excelente (WebGL) |
| Requiere token | ✗ (free tiles) | ✓ |

---

## Fallbacks

| Caso | Comportamiento |
|---|---|
| Sin `NEXT_PUBLIC_MAPBOX_TOKEN` | Botón MAPBOX deshabilitado, UI muestra "TOKEN FALTANTE" |
| Error en init map | LoadingOverlay persiste; no crash en Leaflet |
| `geoData` null | Province layer no se agrega; mapa funciona sin choropleth |
| `showTerrain` off | `setTerrain(null)` + hillshade visibility "none" |
| `showSatellite` off | Todas las capas `type:raster` visibility "none" |

---

## Stack técnico

```
mapbox-gl v3.x      ← core GL engine
No @types/mapbox-gl ← v3 ships bundled types
transpilePackages   ← mapbox-gl en next.config.ts
dynamic import      ← ssr: false (como Leaflet)
```

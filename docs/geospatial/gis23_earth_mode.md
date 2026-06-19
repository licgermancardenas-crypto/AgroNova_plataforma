# GIS-23 — Earth Mode & Cinematic Navigation

## Objetivo

Agregar un tercer motor de mapa "Earth" con navegación cinematográfica: atmósfera espacial, pitch dinámico, auto-rotación, presets de cámara y FlyTo inteligente al seleccionar provincias.

---

## Arquitectura

```
web/types/index.ts
  ├── MapEngine: "leaflet" | "mapbox" | "earth"   ← extendido GIS-23
  └── CameraTarget: { center, zoom, pitch, bearing, duration }  ← nuevo GIS-23

web/components/gis/MapboxTerrainView.tsx
  ├── Props nuevas: engineMode, pitch, autoRotate, targetCamera
  ├── Effect: engineMode → setFog() + sky paint (verde vs azul espacial)
  ├── Effect: pitch → map.easeTo({ pitch, duration: 600 })
  ├── Effect: autoRotate → requestAnimationFrame(spin @ 0.04°/frame)
  └── Effect: targetCamera → map.flyTo({ ...target, essential: true })

web/app/gis/page.tsx
  ├── CAMERA_PRESETS: 9 presets (ARG, PAM, NOA, NEA, CUYO, PAT, ROS, BUE, RST)
  ├── State: pitch (40°), autoRotate (false), targetCamera (null)
  ├── handleCameraPreset() → setPitch + setTargetCamera
  ├── FlyTo effect: on selectedProvince + mapbox/earth engine → setTargetCamera
  ├── LeftPanel: pitch slider, auto-rotate toggle, preset grid 3×3
  ├── Engine pill flotante: 3 botones (◆ LEAFLET | ◈ MAPBOX | ◉ EARTH)
  └── Footer: GIS v9.0 · GIS-23 · "◉ EARTH MODE" label

docs/geospatial/gis23_earth_mode.md  ← este archivo
```

---

## FASE 1 — Earth Engine Mode

"Earth" reutiliza `MapboxTerrainView` con prop `engineMode="earth"`. No hay duplicación de componentes.

El tercer botón aparece:
1. En el `LeftPanel` (grid 3 columnas, accent azul `#38BDF8`)
2. En el floating pill overlay del mapa

Cuando `mapEngine === "earth"`, el componente Mapbox recibe `engineMode="earth"` y reactivamente cambia la atmósfera.

---

## FASE 2 — Atmósfera y Night Mode

### Mapbox mode (verde oscuro, terreno agrícola)
```js
setFog({
  color:            "rgb(7, 18, 9)",
  "high-color":     "#122A14",
  "horizon-blend":  0.04,
  "space-color":    "#071209",
  "star-intensity": 0.5,
  range:            [0.5, 10],
})
sky: { "sky-atmosphere-color": "rgba(7,18,9,1.0)", "halo-color": "rgba(34,197,94,0.1)" }
```

### Earth mode (noche espacial, azul profundo)
```js
setFog({
  color:            "rgb(5, 8, 20)",
  "high-color":     "#0a1428",
  "horizon-blend":  0.10,      // más atmósfera
  "space-color":    "#000a18",
  "star-intensity": 0.92,      // estrellas más brillantes
  range:            [0.4, 7],  // fog más cercano
})
sky: { "sky-atmosphere-color": "rgba(5,8,20,1.0)", "halo-color": "rgba(14,165,233,0.18)" }
```

---

## FASE 3 — Navegación Cinematográfica

### Pitch slider (0°–80°)
- Slider en LeftPanel, sección "Cámara Cinemática"
- Al mover: `setPitch(value)` → efecto en `MapboxTerrainView` llama `map.easeTo({ pitch, duration: 600 })`
- Default: 40° (vista oblicua suave)

### Auto-Rotación
- Toggle en LeftPanel
- En MapboxTerrainView: `requestAnimationFrame` loop incrementando bearing 0.04°/frame (~144°/min)
- El loop se detiene al desmontar o al `autoRotate = false`

---

## FASE 4 — FlyTo Inteligente

Al seleccionar una provincia (click en mapa o en panel):
```typescript
setTargetCamera({
  center:   [selected.lon, selected.lat],
  zoom:     mapEngine === "earth" ? 7 : 6.5,
  pitch,          // pitch actual del slider
  bearing:  0,
  duration: 2800, // ms
})
```

Solo activa en motores `"mapbox"` y `"earth"`. En Leaflet no hay flyTo Mapbox.

---

## FASE 5 — Camera Presets

| Preset | Centro | Zoom | Pitch | Bearing | Duración |
|--------|--------|------|-------|---------|----------|
| ARG (Argentina) | -64, -38 | 3.8 | 45° | -8° | 3000ms |
| PAM (Pampeana) | -62, -34 | 5.5 | 35° | 0° | 2500ms |
| NOA (Noroeste) | -65, -25 | 5.5 | 40° | 10° | 2500ms |
| NEA (Noreste) | -58, -27 | 5.5 | 35° | -5° | 2500ms |
| CUYO | -68, -32 | 5.5 | 50° | 15° | 2500ms |
| PAT (Patagonia) | -68, -47 | 4.5 | 40° | -10° | 3000ms |
| ROS (Rosario) | -60.65, -32.95 | 10 | 60° | 20° | 4000ms |
| BUE (Buenos Aires) | -58.38, -34.6 | 10 | 60° | -15° | 4000ms |
| ↩RST (Reset) | -64, -38 | 4 | 0° | 0° | 2000ms |

Al hacer clic en un preset: `setPitch(target.pitch)` + `setTargetCamera(target)`.

---

## FASE 6 — HUD v7

### Title pill del mapa
- Earth mode: fondo `rgba(5,8,20,0.82)`, borde cyan `rgba(56,189,248,0.22)`, box-shadow cyan
- Badge `◉ EARTH` en `#38BDF8` con text-shadow glow
- Badge `↻ SPIN` cuando `autoRotate` activo
- Versión actualizada a `v9.0`

### Footer
- Engine label: `◉ EARTH MODE` en `#38BDF8` / `MAPBOX TERRAIN` en gris / `LEAFLET OSM`
- Versión: `GIS v9.0 · GIS-23`

### Botones de motor (floating pill)
- Cada engine tiene accent propio: leaflet/mapbox → `#22C55E`, earth → `#38BDF8`
- Box-shadow al activar: `0 0 10px ${accent}20`

---

## FASE 7 — Night Mode

Automático cuando `engineMode === "earth"`: la atmósfera azul profunda actúa como night mode nativo. No requiere toggle separado.

---

## FASE 8 — Performance

`MapboxTerrainView` ya estaba en dynamic import con SSR deshabilitado:
```tsx
const MapboxTerrainView = dynamic(() => import("@/components/gis/MapboxTerrainView"), { ssr: false })
```

First Load JS `/gis`: **246 kB** (sin cambio significativo respecto a GIS-20).

Los 4 nuevos efectos en `MapboxTerrainView` son ops nativas Mapbox GL — sin render React adicional.

---

## Leaflet vs Mapbox vs Earth

| Característica | Leaflet | Mapbox 3D | Earth |
|----------------|---------|-----------|-------|
| Tile source | OSM/Esri/Carto | Mapbox satellite-streets | Mapbox satellite-streets |
| Terrain 3D | No (Deck.gl overlay) | ✓ DEM exaggeration 1.5× | ✓ DEM exaggeration 1.5× |
| Atmósfera | No | Sky verde + fog tenue | Sky azul espacial + fog profundo |
| Estrellas | No | 0.5 intensity | 0.92 intensity |
| Pitch dinámico | No | Slider 0–80° | Slider 0–80° |
| Auto-rotación | No | ✓ | ✓ |
| FlyTo province | No | ✓ 2800ms | ✓ 2800ms (zoom 7) |
| Camera presets | No | ✓ 9 presets | ✓ 9 presets |
| Night mode | No | No | ✓ automático |
| Token requerido | No | ✓ | ✓ |

---

## Notas de implementación

- `autoRotate` usa `requestAnimationFrame` (no `setInterval`) para sincronizarse con el vsync del browser y evitar frame drops.
- `targetCamera` se crea como nuevo objeto en cada invocación → React detecta el cambio y el efecto flyTo siempre se ejecuta, incluso si se hace clic en el mismo preset dos veces seguidas.
- El efecto de pitch (`map.easeTo`) puede coexistir con `map.flyTo` (targetCamera): flyTo tiene prioridad (interrumpe easeTo en curso) porque se llama después.
- `engineMode === "earth"` cambia solo fog/sky. El estilo base Mapbox (`satellite-streets-v12`) es el mismo en ambos modos para mantener la cobertura de capas vectoriales.

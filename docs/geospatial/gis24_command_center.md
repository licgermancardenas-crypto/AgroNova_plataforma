# GIS-24 — Command Center & Global Search Intelligence

## Objetivo

Transformar AgroNova en un verdadero centro de comando geoespacial con búsqueda global, paleta de comandos tipo VSCode, minimapa interactivo, bookmarks persistentes y tour cinematográfico automatizado.

---

## Arquitectura

```
web/components/gis/
  ├── GlobalSearchBar.tsx     ← búsqueda unificada sobre 60+ items
  ├── CommandPalette.tsx      ← modal ⌘K con 60+ comandos agrupados
  ├── MiniMap.tsx             ← SVG Argentina con dots de KPI
  └── BookmarkPanel.tsx       ← vistas guardadas en localStorage

web/app/gis/page.tsx
  ├── TOUR_STOPS[6]           ← paradas cinematográficas
  ├── RIGHT_TABS_LIST         ← tabs del panel derecho (reutilizado en palette)
  ├── showPalette / Ctrl+K   ← handler global de teclado
  ├── tourPlaying / tourStep ← automaton de tour mode
  ├── showMiniMap             ← toggle minimapa
  ├── currentCamera           ← tracking de la cámara actual (bookmarks)
  ├── handleSearchSelect()    ← seleccionar resultado → flyTo + panel
  ├── handleBookmarkLoad()    ← cargar bookmark → setMapEngine + flyTo
  └── paletteCommands useMemo ← 60+ comandos dinámicos

docs/geospatial/gis24_command_center.md  ← este archivo
```

---

## FASE 1 — Global Search Bar

**Componente**: `GlobalSearchBar.tsx`

**Fuentes de datos**:

| Tipo | Cantidad | Campos |
|------|----------|--------|
| Provincias | 24 | nombre, macro_region, lat, lon |
| Sucursales | 5 | nombre, lat, lng (AgroNova mock) |
| Depósitos | 5 | nombre, lat, lng |
| Municipios | 20 | label, sublabel, lat, lon (static) |

**Búsqueda**: case-insensitive + normalización NFD (ignora acentos). Ej: buscar "cordoba" encuentra "Córdoba".

**UI**: Input con icono ✈, dropdown con grupos titulados (PROVINCIAS / SUCURSALES / DEPÓSITOS / MUNICIPIOS), navegación con ↑↓ + Enter + Escape.

**Integrado en**: TopHUD entre TimeSlider y botón ⌘K. Dynamic import con skeleton loading.

---

## FASE 2 — FlyTo Search

Al seleccionar un resultado de búsqueda (`handleSearchSelect`):

1. Si tipo = "provincia" → `setSelected(kpi)` → abre ProvinceDetailPanel
2. En motores Mapbox/Earth → `setTargetCamera({...})` con zoom adaptativo:
   - municipio: zoom 10
   - provincia: zoom 6.5
   - sucursal/depósito: zoom 9
   - duración: 2500ms

---

## FASE 3 — Command Palette (Ctrl+K)

**Componente**: `CommandPalette.tsx`
**Atajo**: `Ctrl+K` (o `Cmd+K` en Mac) — handler global en `window.addEventListener("keydown")`
**Alternativa**: Botón `⌘K` en el TopHUD

### Grupos de comandos

| Grupo | Comandos | Ejemplo |
|-------|----------|---------|
| Métrica | 4 | `Métrica: Revenue` |
| Motor | 3 | `Motor: ◉ Earth Mode` |
| Capa | ~20 | `Capa: Choroplético ● ON` |
| Provincia | 24 | `→ Buenos Aires — PAM` |
| Panel | 10 | `Panel: ArcGIS Live` |
| Cámara | 9 | `Cámara: PATAGONIA` |
| Tour | 2 | `▶ Iniciar Tour Cinematográfico` |
| Vista | 1 | `Mostrar Minimapa` |

**Total**: ~73 comandos dinámicos (varía con estado actual de capas).

### Búsqueda interna
El input filtra por `label`, `description`, y `group` con normalización NFD.

### Navegación
- ↑↓ → mueve el ítem resaltado
- ↵ → ejecuta el comando + cierra
- ESC → cierra sin ejecutar
- Click fuera → cierra

---

## FASE 4 — MiniMap

**Componente**: `MiniMap.tsx`

**Implementación**: SVG estático de Argentina (36 puntos de polígono simplificado) + dots dinámicos por provincia.

**Coordenadas**: sistema propio — bounding box Argentina [-73.5 a -52.8 lon, -55.3 a -21.5 lat] → SVG 130×182px.

**Dots**:
- Radio 2.2px (4px si seleccionada)
- Color: gradiente verde (alta performance) → naranja-rojo (baja/churn)
- Provincia seleccionada: ring externo + drop-shadow

**Interacción**: click en dot → `onProvinceClick(kpi)` → selecciona provincia + abre ProvinceDetailPanel + (si engine Mapbox/Earth) flyTo.

**Toggle**: botón 🔖 en la barra flotante top-left del mapa.

---

## FASE 5 — Bookmarks

**Componente**: `BookmarkPanel.tsx`

**Persistencia**: `localStorage` key `agronova_gis_bookmarks_v1`

**Bookmarks de fábrica** (no borrables):

| Nombre | Engine | Centro | Zoom | Pitch |
|--------|--------|--------|------|-------|
| Operación Nacional | Mapbox | -64, -38 | 3.8 | 45° |
| Pampeana | Mapbox | -62, -34 | 5.5 | 35° |
| Patagonia | Earth | -68, -47 | 4.5 | 40° |
| Rosario Hub | Earth | -60.65, -32.95 | 10 | 60° |

**Guardado**: botón "GUARDAR" → input de nombre → Enter. Guarda `currentCamera` (última posición known) + engine actual.

**Carga**: click en bookmark → `handleBookmarkLoad` → `setMapEngine(entry.engine)` + `handleCameraPreset(entry.camera)`.

**Borrado**: ícono 🗑 al hover (solo en bookmarks personalizados).

**Ubicación en UI**: sección en LeftPanel, visible cuando engine = Mapbox o Earth.

---

## FASE 6 — Tour Mode

**Activación**: botón `▶ TOUR` en la barra flotante del mapa (solo engines Mapbox/Earth) o comando en palette.

**Paradas**:

| # | Destino | Zoom | Pitch | Bearing | Duración |
|---|---------|------|-------|---------|----------|
| 1 | Buenos Aires | 9 | 60° | -15° | 4000ms |
| 2 | Córdoba | 9 | 55° | 10° | 3500ms |
| 3 | Rosario | 9 | 55° | 20° | 3500ms |
| 4 | NOA | 5.5 | 45° | 10° | 3000ms |
| 5 | Patagonia | 5 | 40° | -10° | 3500ms |
| 6 | Argentina completa | 3.8 | 45° | -8° | 3000ms |

**Mecanismo**: `useEffect([tourPlaying, tourStep])` → `setTargetCamera(stop)` → `setTimeout(stop.duration + 2800ms)` → siguiente parada.

El botón muestra el nombre de la parada actual durante el tour: `⏸ Córdoba`.

Si el engine es Leaflet al iniciar el tour, se cambia automáticamente a Mapbox.

---

## FASE 7 — HUD v8

Mejoras visuales en el title pill del mapa:
- Earth: fondo `rgba(5,8,20,0.82)` + borde cyan + box-shadow glow
- Badge `◉ EARTH` con text-shadow
- Badge `↻ SPIN` cuando auto-rotación activa
- Versión `v9.0 · GIS-23` (actualizado en GIS-23)

Footer Command Center:
- Engine label: `◉ EARTH MODE` en `#38BDF8`
- Versión: `GIS v9.0 · GIS-23`

---

## FASE 8 — Performance

Todos los componentes nuevos usan `dynamic()` con `ssr: false`:

| Componente | Estrategia | Impacto |
|------------|------------|---------|
| GlobalSearchBar | dynamic + skeleton loading | async chunk |
| CommandPalette | dynamic (solo cuando abierto) | async chunk |
| MiniMap | dynamic (toggle) | async chunk |
| BookmarkPanel | dynamic (toggle según engine) | async chunk |

`/gis` First Load JS: **246 kB → 252 kB** (+6 kB). Aceptable para 4 features completos.

---

## Uso rápido

| Acción | Cómo |
|--------|------|
| Buscar provincia | Escribir en barra superior |
| Abrir palette | Ctrl+K o botón ⌘K |
| Cambiar métrica | Palette → "Métrica: ..." |
| Ir a provincia | Palette → "→ Tucumán" |
| Ver minimapa | Botón 🔖 o "Mostrar Minimapa" en palette |
| Iniciar tour | Botón ▶ TOUR (Mapbox/Earth only) |
| Guardar vista actual | LeftPanel → Bookmarks → GUARDAR |
| Cargar bookmark | Click en el bookmark |

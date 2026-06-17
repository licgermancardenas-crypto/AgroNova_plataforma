# GIS-08 — Real World Layers & Professional Cartography

**Branch:** `feature/geospatial-v2`
**Date:** 2026-06-17
**Build:** ✓ 0 errors · `/gis` 14.4 kB · 12/12 static pages

---

## Objetivo

Transformar el dashboard GIS de datos de negocio puro a una plataforma GIS profesional con capas del mundo real, similar a ArcGIS Operations Dashboard, John Deere Operations Center y Climate FieldView.

---

## Capas implementadas

### 1. Departamentos de Argentina — `DepartamentosLayer.tsx`
- **Fuente:** `data/geojson/departamentos.geojson` (101 KB, INDEC Censo 2022)
- **Copiado a:** `web/public/data/geojson/departamentos.geojson`
- **Features:** 529 departamentos
- **Properties usadas:** `nombre`, `provincia.nombre`
- **Estilo:** borde verde fino (0.5px, opacity 0.30), sin fill
- **Interacción:** tooltip hover con nombre + provincia; hover intensifica borde

### 2. Municipios — `MunicipiosLayer.tsx`
- **Fuente:** `data/geojson/municipios_2022.geojson` (1,010 KB, IGN BAHRA 2022)
- **Copiado a:** `web/public/data/geojson/municipios_2022.geojson`
- **Features:** 2,313 municipios / gobiernos locales
- **Geometría:** MultiPoint (centroides)
- **Properties usadas:** `nam`, `gna`, `nam_prov`
- **Clustering:** grid-based, zoom-aware
  - Zoom < 8: clusters azules con conteo
  - Zoom ≥ 8: marcadores individuales por municipio
- **Color:** azul `#0EA5E9` (diferenciado de sucursales verdes)

### 3. Red Vial Nacional — `VialLayer.tsx`
- **Fuente:** Hardcoded (no existe archivo de rutas en el repo)
- **Rutas implementadas:**
  | ID | Ruta | Tipo | Tramo |
  |----|------|------|-------|
  | 1 | RN 9 | Nacional Primaria | BA → Rosario → Córdoba → Salta → Jujuy |
  | 2 | RN 7 | Nacional Primaria | BA → San Luis → Mendoza |
  | 3 | RN 3 | Nacional Primaria | BA → Bahía Blanca → Comodoro → Río Gallegos |
  | 4 | RN 14 | Nacional Secundaria | Zárate → Concordia → Posadas |
  | 5 | RN 34 | Nacional Secundaria | Santa Fe → Santiago → Tucumán → Jujuy |
  | 6 | RN 40 | Nacional Secundaria | Neuquén → Mendoza → La Rioja |
- **Colores:** primaria `#E8A020`, secundaria `#A3E635`
- **Exporta:** `VIAL_ROUTES`, `ROUTE_COLOR` para uso externo

### 4. Puertos y Nodos Logísticos — `PuertosLayer.tsx`
- **Fuente:** Dataset hardcoded (5 nodos)
- **Nodos:**
  | Puerto | Tipo | Capacidad | Lat/Lon |
  |--------|------|-----------|---------|
  | Rosario (Up-River) | Terminal Granaria | 80M ton/año | -32.947, -60.640 |
  | San Lorenzo / San Martín | Terminal Granaria | 60M ton/año | -32.748, -60.732 |
  | Bahía Blanca | Puerto Principal | 25M ton/año | -38.718, -62.266 |
  | Quequén | Puerto Fluvial | 12M ton/año | -38.571, -58.735 |
  | Buenos Aires | Puerto Principal | 15M ton/año | -34.603, -58.381 |
- **Iconografía:** diamante rotado, tamaño proporcional a capacidad, color por tipo
- **Popup completo:** tipo, capacidad, operador, granos principales

### 5. Sucursales / Depósitos / Clientes — Diferenciación visual
- **Sucursal:** círculo verde `#22C55E` con glow (icono 20px)
- **Depósito:** cuadrado azul `#0EA5E9` con glow (icono 18px)
- **Clientes:** cluster **naranja** `#F97316` (antes verde — cambiado para diferenciación)

### 6. Selector de Basemap
- 5 opciones disponibles:
  | ID | Nombre | URL base |
  |----|--------|----------|
  | `dark` | Dark Matter | `cartocdn.com/dark_all` |
  | `voyager` | Carto Voyager | `cartocdn.com/rastertiles/voyager` |
  | `esri_gray` | Esri Gray | `arcgisonline.com/Canvas/World_Light_Gray_Base` |
  | `osm_hot` | OSM Humanitario | `tile.openstreetmap.fr/hot` |
  | `esri_imagery` | Esri Satélite | `arcgisonline.com/World_Imagery` |
- Selector en panel izquierdo; `TileLayer` recarga con `key={basemap}` para forzar re-render

### 7. Leyenda Avanzada — `MapLegendAdvanced.tsx`
- **Ubicación:** `web/components/gis/MapLegendAdvanced.tsx`
- Muestra solo capas activas
- Símbolos diferenciados por tipo: círculo, cuadrado, línea, diamante, dashed
- Gradiente de choropleth (invertido para churn)
- Sub-leyenda de tipos de puerto y categorías viales
- Glassmorphism con `backdrop-filter: blur(12px)`

### 8. Escala y Coordenadas — `ScaleCoordsControl.tsx`
- `<ScaleControl>` de react-leaflet (métricas, posición bottom-left)
- Overlay de coordenadas del mouse: LAT / LON a 4 decimales + zoom actual
- Toggle ON/OFF desde panel de capas (key: `coords`)

### 9. HUD Profesional
- Paneles con `backdrop-filter: blur`
- Bordes finos con `rgba(34,197,94,0.10-0.18)`
- Box shadows de glow suave
- Indicador de estado con glow en tiempo real
- Organización de capas en 3 grupos: Análisis / Territorio Real / Marcadores
- Status bar rediseñado: basemap activo, fuentes de datos, conteo

### 10. Performance
- Solo se carga `provincias_simple.geojson` (656 KB) para coroplético
- `provincias_poly.geojson` (106 MB) ignorado
- Departamentos: 101 KB — siempre ligero
- Municipios: 1 MB — lazy fetch, solo renderiza al activar
- Todos los layers usan `if (!visible) return` para no renderizar cuando OFF

---

## Archivos nuevos

| Archivo | Descripción |
|---------|-------------|
| `web/components/map/DepartamentosLayer.tsx` | Layer de departamentos |
| `web/components/map/MunicipiosLayer.tsx` | Municipios con clustering zoom-aware |
| `web/components/map/VialLayer.tsx` | Red vial nacional (6 rutas) |
| `web/components/map/PuertosLayer.tsx` | 5 puertos/nodos logísticos |
| `web/components/map/ScaleCoordsControl.tsx` | Escala + coordenadas mouse |
| `web/components/gis/MapLegendAdvanced.tsx` | Leyenda profesional avanzada |
| `web/public/data/geojson/departamentos.geojson` | 529 departamentos (101 KB) |
| `web/public/data/geojson/municipios_2022.geojson` | 2.313 municipios (1 MB) |

## Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `web/components/map/LeafletMap.tsx` | +6 nuevos layers, basemap selector, icons mejorados |
| `web/components/map/ClientClusterLayer.tsx` | Clusters orange → `#F97316` |
| `web/app/gis/page.tsx` | 11 toggles de capa, basemap selector, HUD v3.0 |
| `web/types/index.ts` | `RouteRiskLevel`, `BasemapId`, `BasemapDef`, `PuertoNode`, `VialRouteType` |
| `web/lib/routing.ts` | Fix: `RiskLevel` → `RouteRiskLevel` |

---

## Estado de layers por defecto al cargar

| Capa | Default | Razón |
|------|---------|-------|
| Coroplético | ON | KPI principal siempre visible |
| Sucursales | ON | Datos operativos clave |
| Depósitos | ON | Datos operativos clave |
| Clientes | ON | Visualización comercial |
| Coords | ON | UX profesional |
| Todos los demás | OFF | Performance / on demand |

---

## Inventario GeoJSON público post-GIS-08

```
web/public/data/
├── geo/
│   ├── provincias_simple.geojson   656 KB  (coroplético)
│   └── province_kpis.json            8 KB
├── geojson/                                ← NUEVO
│   ├── departamentos.geojson        101 KB
│   └── municipios_2022.geojson    1,010 KB
└── gis_outputs/
    ├── candidate_branches.geojson     4 KB
    ├── coverage_buffers.geojson     100 KB
    ├── hotspots.geojson             218 KB
    ├── territories.geojson          630 KB
    └── [16 JSON analíticos]
```

**Total en public/:** ~2.8 MB de GeoJSON (todos <10 MB ✓)

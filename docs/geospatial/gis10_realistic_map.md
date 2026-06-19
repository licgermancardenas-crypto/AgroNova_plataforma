# GIS-10 — Realistic Cartography & Layer Orchestration

**Branch:** `feature/geospatial-v2`
**Date:** 2026-06-18
**Build:** ✓ 0 errors · `/gis` 16.4 kB

---

## Objetivo

Convertir el mapa en una experiencia más cercana a ArcGIS Dashboard:
verificar que todos los GeoJSON del repositorio estén siendo renderizados,
agregar control de capas completo, mejorar tooltips con KPIs reales,
y añadir hover/highlight en todas las capas.

---

## FASE 1 — Auditoría y capas faltantes

### Inventario de GeoJSON vs. renderizado pre-GIS-10

| Archivo | Geometría | Features | Pre-GIS-10 | GIS-10 |
|---|---|---|---|---|
| `provincias_simple.geojson` | Polygon | 24 | ✓ ChoroplethLayer | ✓ |
| `departamentos.geojson` | Polygon | 529 | ✓ DepartamentosLayer | ✓ |
| `municipios_2022.geojson` | MultiPoint | 2.313 | ✓ MunicipiosLayer | ✓ |
| `hotspots.geojson` | Polygon | 4 | ✗ | ✓ **HotspotsLayer** |
| `coverage_buffers.geojson` | Polygon | 15 | ✗ | ✓ **CoverageBuffersLayer** |
| `territories.geojson` | Polygon | 5 | ✗ | ✓ **TerritoriesLayer** |
| `candidate_branches.geojson` | Point | 5 | ✗ | ✓ **CandidateBranchesLayer** |
| `service_areas_all.geojson` | Polygon | 15 | ✗ | ✓ **ServiceAreasLayer** |
| Rutas nacionales | LineString | 6 | ✓ VialLayer (hardcoded) | ✓ |
| Puertos | Point | 5 | ✓ PuertosLayer (hardcoded) | ✓ |

**5 capas nuevas creadas en GIS-10.**

---

## FASE 2 — Control de capas

### Grupos en el panel izquierdo

| Grupo | Capas |
|---|---|
| Análisis | Coroplético, Heatmap, Radios Cobertura |
| Territorio Real | Departamentos, Municipios, Red Vial, Puertos |
| Marcadores | Sucursales, Depósitos, Clientes |
| **GIS Outputs** *(nuevo)* | Hotspots, Territorios, Buffers Cobertura, Candidatas, Service Areas |
| Basemap | Dark Matter / Carto Voyager / Esri Gray / OSM HOT / Esri Satélite |

### Estado por defecto

```typescript
layers = {
  choropleth: true, sucursales: true, depositos: true, clientes: true, coords: true,
  // Todo lo demás OFF — el usuario activa lo que necesita
}
```

---

## FASE 3 — Tooltips mejorados

### HotspotsLayer

| Campo | Valor |
|---|---|
| Intensidad | `intensity_score × 100` % (coloreado según nivel) |
| Clientes | `n_clientes` |
| Área | `area_km2` km² |
| Provincia | `dominant_provincia` |

Color dinámico: amarillo (#E8A020) → rojo (#E03E3E) según score.

### TerritoriesLayer

| Campo | Valor |
|---|---|
| Nombre | `nombre` de la sucursal |
| Clientes | `n_clientes_territorio` |
| Área | `area_km2` km² |
| Provincias | lista `provincias[]` |

Cada territorio tiene color único por `sucursal_id` (5 colores: verde/azul/limón/naranja/violeta).

### CoverageBuffersLayer

| Campo | Valor |
|---|---|
| Sucursal | `nombre` |
| Radio | `radius_km` km |

### CandidateBranchesLayer

| Campo | Valor |
|---|---|
| Ciudad | `ciudad_candidata` |
| Provincia | `provincia` |
| Región | `macro_region` |
| Oportunidad | `opportunity_score × 100` % |
| Gap Score | `gap_score` |
| Agro | `agr_ha_m` M ha |

Icono: cuadrado rotado 45° (diamante), tamaño proporcional a `opportunity_score`.

### ServiceAreasLayer

| Campo | Valor |
|---|---|
| Instalación | `facility` |
| Alcance | 30 min / 1 hora / 2 horas |
| Radio aprox. | `radius_km` km |
| Fuente | `source` (arcgis / local_approx) |

Colores: verde (#22C55E) = 30 min, naranja (#E8A020) = 60 min, rojo (#E03E3E) = 120 min.
Ordenadas de mayor a menor break (120 min debajo, 30 min encima).

### ChoroplethLayer (ya existente, tooltip completo pre-GIS-10)

| Campo | Valor |
|---|---|
| Revenue | `revenue_ars` |
| Part. % | `revenue_pct` |
| Clientes | `n_activos / n_clientes` |
| Margen | `margen_pct` % |
| OTIF | `otif_pct` % (verde/naranja/rojo) |
| Riesgo Churn | `churn_score × 100` % |
| Métrica activa | valor según selector |

---

## FASE 4 — Hover & Highlight

Todas las capas nuevas implementan:

```typescript
lyr.on({
  mouseover(e) {
    (e.target as L.Path).setStyle({ fillOpacity: HIGH, weight: THICK });
    (e.target as L.Path).bringToFront();
  },
  mouseout(e) {
    (e.target as L.Path).setStyle({ fillOpacity: LOW, weight: THIN });
  },
});
```

| Capa | Normal fillOpacity | Hover fillOpacity | Normal weight | Hover weight |
|---|---|---|---|---|
| HotspotsLayer | 0.28 | 0.55 | 1.5 | 2.5 |
| TerritoriesLayer | 0.08 | 0.22 | 2 | 3 |
| CoverageBuffersLayer | 0.04 | 0.14 | 1 | 2 |
| ServiceAreasLayer | 0.07 | 0.22 | 1.5 | 2.5 |
| CandidateBranchesLayer | N/A (markers) | popup on click | — | — |

---

## Arquitectura de capas (orden de render)

```
z-bottom  ServiceAreasLayer      → 15 polígonos (30/60/120 min drive)
          TerritoriesLayer       → 5 territorios por sucursal
          CoverageBuffersLayer   → 15 buffers por sucursal × radio
          HotspotsLayer          → 4 zonas calientes comerciales
          DepartamentosLayer     → 529 departamentos (borde fino)
          ChoroplethLayer        → 24 provincias (fill KPI)
          HeatmapLayer           → círculos de calor
          VialLayer              → 6 rutas nacionales
          Circle radios          → cobertura sucursales
          Polyline rutas         → rutas logísticas
          PuertosLayer           → 5 puertos logísticos
          CandidateBranchesLayer → 5 candidatas expansión
          MunicipiosLayer        → 2.313 municipios (clustering)
          Sucursales markers     → 5 sucursales (verde)
          Depósitos markers      → depósitos (azul)
z-top     ClientClusterLayer     → clientes (naranja, clustering)
```

---

## Archivos modificados

```
web/components/map/
├── HotspotsLayer.tsx          ← NUEVO
├── TerritoriesLayer.tsx       ← NUEVO
├── CoverageBuffersLayer.tsx   ← NUEVO
├── CandidateBranchesLayer.tsx ← NUEVO
├── ServiceAreasLayer.tsx      ← NUEVO
└── LeafletMap.tsx             ← +5 imports +5 props +5 mounts

web/components/gis/
└── MapLegendAdvanced.tsx      ← +5 entradas (hotspots/territorios/buffers/candidatos/serviceareas)

web/app/gis/
└── page.tsx                   ← +GIS_OUTPUT_LAYERS +GIS Outputs panel +16 props → LeafletMap

docs/geospatial/
└── gis10_realistic_map.md     ← ESTE ARCHIVO
```

---

## Validación

```bash
cd web && npm run build
# → 0 errores · /gis 16.4 kB
```

Todas las 10 fuentes de datos del repo están ahora accesibles desde el mapa.

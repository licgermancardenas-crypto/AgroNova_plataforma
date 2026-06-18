# GIS-13 — WebGL & 3D Intelligence

**Branch:** `feature/geospatial-v2`
**Date:** 2026-06-18
**Build:** ✓ 0 errors · `/gis` 25.4 kB (deck.gl en chunk async — no impacta First Load JS)

---

## Objetivo

Llevar el mapa a una experiencia estilo ArcGIS + Deck.gl: provincias extruidas en 3D, arcos animados entre sucursales y provincias, pulsos de expansión en zonas de alto gap, y heatmap de gradiente suave.

---

## FASE 1 — Instalación de Deck.gl

```bash
cd web && npm install @deck.gl/core @deck.gl/layers @deck.gl/react
```

Los tres paquetes residen en el chunk async generado por el `dynamic(() => import("@/components/map/LeafletMap"), { ssr: false })`. No afectan el First Load JS de `/gis`.

---

## FASE 2 — Extruded Choropleth

**Componente interno:** `DeckOverlay.tsx` → capa `GeoJsonLayer`

| Propiedad | Valor |
|---|---|
| `extruded` | `true` |
| `wireframe` | `true` (bordes verdes finos) |
| `getElevation` | `t × MAX_ELEV[metric3D]` — normalizado 0→1 por métrica |
| `getFillColor` | Verde oscuro→verde brillante (revenue/clientes/margen/otif) · Verde→rojo (churn) |

Elevaciones máximas por métrica:

| Métrica | Max. Elevación |
|---|---|
| revenue | 700.000 m |
| clientes | 500.000 m |
| margen | 300.000 m |
| churn | 350.000 m |
| otif | 280.000 m |

### Modo 3D

Cuando `mode3D = true`:
- DeckGL viewport aplica `pitch: 45°, bearing: -10°`
- Leaflet sigue siendo master de la navegación (pan/zoom)
- `ChoroplethLayer` renderiza con `fillOpacity: 0` y `weight: 0` → invisible pero clickable

---

## FASE 3 — Flow Arcs (Sucursal → Provincia)

**Capa:** `ArcLayer` en `DeckOverlay.tsx`

Para cada sucursal se calculan las **2 provincias más cercanas** por distancia euclidiana lat/lon. Se dibuja un arco curvo (`getHeight: 0.4`) de la sucursal a cada provincia.

Color del arco según OTIF de la provincia destino:
- OTIF ≥ 93%: verde `rgb(34,197,94)`
- OTIF 88–92%: naranja `rgb(232,160,32)`
- OTIF < 88%: rojo `rgb(224,62,62)`

El ancho varía con el revenue_pct de la provincia (`max(1, revPct × 0.55)`, cap 8px).

---

## FASE 4 — Expansion Beams

**Capa:** `ScatterplotLayer` en `DeckOverlay.tsx`

Top 8 provincias por `gap_score > 3` reciben un halo pulsante animado.

```typescript
score = min(1, kpi.gap_score / 12)

getRadius = score × 110.000 × (1 + 0.32 × sin(phase + score × 7.5))
```

Paleta por score:
| Score | Color |
|---|---|
| > 0.7 | Rojo `#E03E3E` |
| 0.5–0.7 | Naranja `#E8A020` |
| < 0.5 | Verde limón `#A3E635` |

**Animación:** Timer `setInterval(80ms)` → ~12fps. Corre solo cuando `showBeams = true`.

---

## FASE 5 — Heatmap Mejorado

**Archivo:** `web/components/map/HeatmapLayer.tsx`

Reemplazo del círculo único por **tres capas concéntricas** por provincia:

| Capa | Radio | Opacidad |
|---|---|---|
| Outer halo | 70.000–350.000 m | 0.025 + t×0.045 |
| Mid-ring | 25.000–120.000 m | 0.06 + t×0.10 |
| Core peak (t > 0.45) | 8.000–40.000 m | 0.12 + t×0.18 |

El solapamiento de halos crea un efecto de densidad gaussiana sin WebGL. Los anillos exteriores suaves imitan el blur de heatmaps WebGL convencionales.

---

## FASE 6 — Toggle 2D/3D

**Control:** `LayerBtn "Modo 3D"` en el panel izquierdo → sección **WebGL 3D**.

| Estado | Leaflet | Deck.gl |
|---|---|---|
| `mode3D = false` | Coroplético normal visible | DeckGL plano (pitch=0) |
| `mode3D = true` | Coroplético invisible (clickable) | DeckGL extruido (pitch=45, bearing=-10) |

Leaflet conserva pan/zoom en ambos modos. DeckGL sincroniza su viewport desde `map.on("move")` en cada frame.

**Controles del panel WebGL 3D:**

| Control | Efecto |
|---|---|
| Modo 3D | Activa extrusión + pitch 45° |
| Flow Arcos | Arcos sucursal→provincia (funciona en 2D y 3D) |
| Exp. Beams | Halos pulsantes en zonas de alto gap (funciona en 2D y 3D) |
| Métrica 3D | Revenue / Clientes / Margen / Churn (solo afecta altura 3D) |

---

## FASE 7 — Performance

`DeckOverlay.tsx` separa el memo de capas estáticas del de capas animadas:

```typescript
// Solo se recalcula cuando cambia métrica/datos/modo
const staticLayers = useMemo(() => [...], [mode3D, geoData, kpiMap, metric3D, allKpis, showArcs, flowData]);

// Se recalcula en cada tick de animación (80ms), no arrastra las capas estáticas
const beamLayer    = useMemo(() => ..., [showBeams, beamData, animTime]);

const layers = useMemo(() => [...staticLayers, beamLayer ? [beamLayer] : []], [staticLayers, beamLayer]);
```

Deck.gl usa `updateTriggers` para que solo `getRadius` se re-evalue en cada tick, sin reconstruir la geometría.

---

## Arquitectura DeckOverlay

```
LeafletMap.tsx (dynamic, ssr:false)
└── <MapContainer>
    └── <DeckOverlay>          ← React-Leaflet context (useMap())
        │   useEffect: crea <div> en map.getContainer(), setPortalTarget
        │   useEffect: map.on("move") → setViewState
        │   useMemo: kpiMap, flowData, beamData, staticLayers, beamLayer
        └── createPortal(
              <DeckGL viewState layers controller={false} />,
              portalTarget     ← position:absolute; inset:0; z-index:400; pointer-events:none
            )
```

El portal evita conflictos de z-index con el SVG de Leaflet. `pointer-events:none` preserva la navegación de Leaflet en todo momento.

---

## Archivos modificados / creados

```
web/
├── components/map/
│   ├── DeckOverlay.tsx         ← NUEVO — WebGL overlay (GeoJsonLayer, ArcLayer, ScatterplotLayer)
│   ├── LeafletMap.tsx          ← + show3D, show3DArcs, showBeams, metric3D props + <DeckOverlay>
│   ├── ChoroplethLayer.tsx     ← + mode3D prop → transparent en 3D, clickable always
│   └── HeatmapLayer.tsx        ← triple-layer gradient (outer + mid-ring + core)
└── app/gis/
    └── page.tsx                ← 4 nuevos estados + sección WebGL en LeftPanel + GIS-13 labels

web/package.json / package-lock.json
    ← @deck.gl/core @deck.gl/layers @deck.gl/react
```

---

## Build

```
✓ Compiled successfully in 87s
✓ Generating static pages (12/12)
/gis  25.4 kB  242 kB First Load JS

deck.gl resuelve en chunk async — no infla First Load JS.
```

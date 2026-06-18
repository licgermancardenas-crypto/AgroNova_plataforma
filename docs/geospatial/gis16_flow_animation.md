# GIS-16 — Live Logistics & Flow Animation

**Sprint:** GIS-16  
**Branch:** feature/geospatial-v2  
**Status:** Completed

---

## Objetivo

Convertir el mapa en un sistema de inteligencia logística dinámica con partículas animadas, simulación de vehículos, métricas en vivo y controles de animación.

---

## Arquitectura

```
GIS-16 Animation System (Leaflet mode only)
  ├── FlowAnimationLayer.tsx   — Canvas overlay: partículas de flujo
  ├── VehicleLayer.tsx         — Canvas overlay: simulación de vehículos
  └── LiveMetricsPanel.tsx     — Panel métricas en vivo (setInterval 3s)
```

Todos los overlays de canvas se montan como `null`-render components dentro de `<MapContainer>` usando `useMap()` para acceder a la instancia de Leaflet y `requestAnimationFrame` para el loop de animación.

---

## Componentes

### FlowAnimationLayer (FASES 1 + 4)

**Archivo:** `web/components/gis/FlowAnimationLayer.tsx`

**Funcionamiento:**
- Canvas z-index 450, `pointer-events:none`
- Hasta 64 partículas activas (sucursales × top-8 provincias por revenue)
- Cada partícula: trail gradiente + head glow radial + core opaco
- OTIF color: verde `#22C55E` (≥93%), amarillo `#E8A020` (88-93%), rojo `#E03E3E` (<88%)
- Progress 0→1 lineal, wrap-around al llegar a 1
- En pausa: redibuja posiciones actuales (para correcto pan/zoom del mapa)
- Pulse rings: sucursales (siempre) + provincias con `gap_score > 7` o `otif_pct < 88`
- useMemo para pre-computar partículas solo cuando cambian `sucursales` o `allKpis`
- Refs estables para hot-loop: `playingRef`, `speedRef`, `pulseOnRef` — evitan stale closures

**Props:**
```typescript
interface FlowAnimationLayerProps {
  sucursales: SucursalMarker[];
  allKpis:    ProvinceKPI[];
  playing:    boolean;
  speed:      1 | 2;
  showPulse:  boolean;
}
```

### VehicleLayer (FASE 2)

**Archivo:** `web/components/gis/VehicleLayer.tsx`

**Funcionamiento:**
- Canvas z-index 451 (encima de FlowAnimationLayer)
- Un vehículo por ruta activa (`activo: true`)
- Movimiento bouncing (ida-vuelta sobre la ruta)
- Rendering: halo glow + body (triángulo cabina + rect trailer) orientado en la dirección del movimiento
- Dashed line muestra el trayecto completo de la ruta (dimmed 18% opacity)
- Label del origen de la ruta visible junto al vehículo

**Props:**
```typescript
interface VehicleLayerProps {
  routes:  GISRoute[];
  playing: boolean;
  speed:   1 | 2;
}
```

### LiveMetricsPanel (FASES 3 + 5)

**Archivo:** `web/components/gis/LiveMetricsPanel.tsx`

**Funcionamiento:**
- setInterval cada 3 segundos (cuando `playing = true`)
- Jitter ±0.6% en OTIF para simular fluctuación real
- Métricas mostradas: envíos activos, rutas críticas, OTIF promedio, riesgo logístico
- Risk bar: barra de progreso verde→naranja→rojo
- Route status table: NORMAL/RIESGO/CRÍTICO por ruta activa
- Tick counter de actualización

**Aparece en:**
1. Floating bottom-left del mapa cuando `showFlows || showVehicles`
2. Tab "Live" del panel derecho (siempre disponible)

---

## Controles de animación (FASE 6)

**Ubicación:** floating bottom-center del mapa (solo Leaflet mode, solo cuando hay capas activas)

```
[ GAUGE ] ANIM  [ ⏸ PAUSE ]  [ x1 ]  [ x2 ]
```

- **PLAY/PAUSE**: toggle `animPlaying`
- **x1 / x2**: multiplica el `speed` de cada partícula/vehículo

---

## Integración con page.tsx

### Estado nuevo
```typescript
const [showFlows,    setShowFlows]    = useState(false);
const [showVehicles, setShowVehicles] = useState(false);
const [showPulse,    setShowPulse]    = useState(true);
const [animPlaying,  setAnimPlaying]  = useState(true);
const [animSpeed,    setAnimSpeed]    = useState<1 | 2>(1);
```

### Props nuevos a LeafletMap
```tsx
showFlows={showFlows}
showVehicles={showVehicles}
showPulse={showPulse}
animPlaying={animPlaying}
animSpeed={animSpeed}
```

### LeftPanel — sección Animaciones
Toggle layers: Flow Particles, Vehículos, Pulsos Hotspot.

### HUD
Badge `FLOWS` cuando hay capas de animación activas.

### Right panel tab
Nuevo tab `"Live"` muestra `<LiveMetricsPanel />` siempre.

---

## Performance (FASE 7)

| Técnica | Descripción |
|---|---|
| `useMemo` | Partículas y pulse rings recomputados solo si cambian sucursales/kpis |
| `useRef` para state mutable | Posiciones/progress en refs, nunca en state — no re-render por frame |
| `useRef` para callbacks | `playingRef`, `speedRef` — estables en el hot loop |
| Canvas en lugar de SVG | Sin overhead de reconciliación React por frame |
| `pointer-events: none` | Canvas no interfiere con clicks del mapa |
| Limit 64 partículas | Cap para mantener >60 FPS en hardware estándar |
| Cleanup de RAF | `cancelAnimationFrame` en el return del useEffect |

---

## OTIF Colors

| Valor | Color | Estado |
|---|---|---|
| ≥ 93% | `#22C55E` verde | NORMAL |
| 88-93% | `#E8A020` naranja | RIESGO |
| < 88% | `#E03E3E` rojo | CRÍTICO |

---

## Restricciones

- Solo funciona en **motor Leaflet** (no Mapbox). Los canvas overlays requieren `useMap()` de react-leaflet.
- No usa APIs externas — toda la data viene de `mock-data.ts`.
- Compatible con Deck.gl: z-index 450/451 para canvas (Deck.gl usa z-index 400).

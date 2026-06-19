# GIS-12 — Temporal Intelligence

**Branch:** `feature/geospatial-v2`
**Date:** 2026-06-18
**Build:** ✓ 0 errors · `/gis` 25 kB (vs 24.8 kB en GIS-11)

---

## Objetivo

Agregar la dimensión temporal al mapa GIS. El usuario puede navegar entre 2016 y 2026 con un slider o dejar el mapa en Play para ver la evolución animada año a año.

---

## FASE 1 — TimeSlider

**Componente:** `web/components/gis/TimeSlider.tsx`

Slider horizontal integrado en el header táctico entre los KPI chips y los indicadores de status.

### Controles

| Elemento | Acción |
|---|---|
| `◀◀` | Retrocede 1 año, detiene el Play |
| Slider | Drag a cualquier año 2016-2026 |
| `▶▶` | Avanza 1 año, detiene el Play |
| `▶` / `⏸` | Play/Pause automático |

### Visual

- **Año badge**: font-mono 15px, color gradiente del verde oscuro (2016) al verde brillante (2026)
- **Track**: fondo `#1A3D20`, fill del color del año seleccionado
- **Ticks**: marcas en años pares (2016, 2018, 2020, 2022, 2024, 2026)
- **Thumb**: punto circular con `border-color: col` y glow suave

---

## FASE 2 — Historical Province Data

**Archivo:** `web/lib/timeseries.ts`  
**Snapshot:** `web/public/data/geo/province_timeseries.json` (91 KB, 24 prov × 11 años)

### Modelo de crecimiento

2026 = baseline (datos de `PROVINCE_KPIS`). Años anteriores se computan por reversión compuesta:

```
revenue_año = revenue_2026 / (1 + revRate × (1 + seed × 0.05)) ^ yearsBack

revRate por macro-región:
  PAM: 28%/yr  CUY: 25%/yr
  NOA: 32%/yr  PAT: 22%/yr
  NEA: 30%/yr
```

**Otras métricas:**

| Métrica | Tendencia hacia el pasado |
|---|---|
| n_activos | Divide por `(1 + cliRate)^n` (9-11%/yr por región) |
| margen_pct | -0.12 pct-pts/yr (márgenes mejoraron) |
| otif_pct | -0.65 pct-pts/yr (logística mejoró) |
| churn_score | +0.015/yr (retención mejoró) |

**Semilla per-provincia:** `sin(lat × 0.31 + lon × 0.07)` — introduce variación ±5% para evitar datos monótonos.

### Funciones exportadas

```typescript
getKpisByYear(year: number): ProvinceKPI[]
getNationalTotalsForYear(year: number): NationalTotals
getLowCoverageForYear(year: number): ProvinceKPI[]
yoyGrowth(kpi, metric, year): { pct: number; absolute: number } | null
getKpiForYear(kpi, year): ProvinceKPI
```

### Generador de JSON

```bash
node scripts/generate-timeseries.js > web/public/data/geo/province_timeseries.json
```

---

## FASE 3 — Mapa dependiente del tiempo

**`page.tsx`** (GISPage):

```typescript
const currentKpis    = useMemo(() => getKpisByYear(selectedYear),            [selectedYear]);
const nationalTotals = useMemo(() => getNationalTotalsForYear(selectedYear), [selectedYear]);
const lowCoverage    = useMemo(() => getLowCoverageForYear(selectedYear),    [selectedYear]);
```

`currentKpis` se propaga a:

| Consumidor | Prop |
|---|---|
| `LeafletMap` | `allKpis` → ChoroplethLayer, HeatmapLayer, MapLegend |
| `LeftPanel` | `currentKpis` → top5 list |
| `RightPanel` | `nationalTotals`, `lowCoverage` |
| `ProvinceDetailPanel` | `allKpis`, `year` |
| `MapStatisticsPanel` | `kpis`, `nationalTotals` |

### Sincronización de selección de provincia

Al cambiar el año, si hay una provincia seleccionada, el `kpi` del panel se actualiza automáticamente a los valores del nuevo año:

```typescript
const selectedNameRef = useRef<string | null>(null);

useEffect(() => {
  if (!selectedNameRef.current) return;
  const updated = currentKpis.find(k => k.nombre === selectedNameRef.current);
  if (updated) setSelected(updated);
}, [currentKpis]);
```

---

## FASE 4 — Playback automático

En `TimeSlider.tsx`, el botón Play/Pause controla un `setInterval` de 900ms que avanza el año automáticamente.

```typescript
const play = () => {
  setPlaying(true);
  intervalRef.current = setInterval(() => {
    if (yearRef.current >= YEAR_MAX) { stop(); return; }
    setYear(yearRef.current + 1);
  }, 900);
};
```

`yearRef` se mantiene sincronizado con `year` en cada render para evitar stale closures dentro del interval.

Cuando llega a 2026, se detiene solo.

---

## FASE 5 — Tendencias YoY

**`ProvinceDetailPanel.tsx`** muestra badges `+N.N%` / `-N.N%` junto a cada KPI:

```typescript
const yoyRev  = year > YEAR_MIN ? yoyGrowth(kpi, "revenue",  year) : null;
const yoyCli  = year > YEAR_MIN ? yoyGrowth(kpi, "clientes", year) : null;
const yoyMar  = year > YEAR_MIN ? yoyGrowth(kpi, "margen",   year) : null;
const yoyOtif = year > YEAR_MIN ? yoyGrowth(kpi, "otif",     year) : null;
const yoyChr  = year > YEAR_MIN ? yoyGrowth(kpi, "churn",    year) : null;
```

Reglas de color del badge:
- `|pct| < 0.5%` → gris (`#7A9C7A`) — cambio insignificante
- Positivo y "bueno" → verde (`#22C55E`)
- Positivo y "malo" (churn, invert=true) → rojo (`#E03E3E`)

El año actual se muestra en el header del panel: `{kpi.macro_region} · {ha}M ha · {year}`.

---

## FASE 6 — Animated Transitions

### Choropleth CSS transition

`globals.css`:
```css
.leaflet-interactive {
  transition: fill 0.45s ease, fill-opacity 0.45s ease,
              stroke 0.3s ease, stroke-width 0.25s ease;
}
```

Cuando Leaflet llama `setStyle()` al reconstruir el coroplético con los nuevos KPIs del año seleccionado, los paths SVG transfieren suavemente el color anterior al nuevo.

### Year badge pulse

```css
@keyframes year-pulse {
  0%   { opacity: 1; }
  25%  { opacity: 0.55; transform: scale(0.97); }
  60%  { opacity: 1;  transform: scale(1.01); }
  100% { opacity: 1;  transform: scale(1); }
}
```

Aplicado al badge del año en `TimeSlider` cada vez que cambia (via `useState + useEffect + setTimeout 600ms`).

### ProvinceDetailPanel fade

```css
@keyframes temporal-fade {
  from { opacity: 0; transform: translateY(2px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

Aplicado con `key={${kpi.nombre}-${year}}` — React desmonta/remonta el componente cuando cambia el año, forzando la animación.

---

## Indicadores de contexto temporal

| Ubicación | Contenido |
|---|---|
| Header táctico | TimeSlider (año + play/pause + slider) |
| HUD central del mapa | Badge año activo + "HISTÓRICO" si < 2026 |
| Status bar (derecha) | `Año: YYYY` + badge "HISTÓRICO" |
| ProvinceDetailPanel | Año en el subtítulo de la provincia |

---

## Archivos modificados / creados

```
web/
├── lib/
│   └── timeseries.ts               ← NUEVO — motor de datos temporales
├── components/
│   └── gis/
│       ├── TimeSlider.tsx          ← NUEVO — slider + play/pause
│       ├── ProvinceDetailPanel.tsx ← + year, allKpis, yoy badges
│       └── MapStatisticsPanel.tsx  ← + kpis, nationalTotals props
│   └── map/
│       └── LeafletMap.tsx          ← + allKpis prop (remove direct import)
├── app/
│   ├── gis/page.tsx                ← useMemo, selectedYear, TimeSlider, wiring
│   └── globals.css                 ← CSS transitions + animations
└── public/data/geo/
    └── province_timeseries.json    ← NUEVO — snapshot 91KB

scripts/
└── generate-timeseries.js          ← NUEVO — generador del JSON snapshot
```

---

## Build

```bash
cd web && npm run build
# → 0 errores · /gis 25 kB
```

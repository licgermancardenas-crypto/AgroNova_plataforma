# GIS-25 — Province Comparison Mode

## Objetivo

Agregar un modo de análisis ejecutivo side-by-side entre dos provincias, convirtiendo AgroNova GIS en una herramienta de decisión territorial.

---

## Arquitectura

```
web/components/gis/
  └── ComparisonPanel.tsx     ← Panel completo (selector, métricas, mini charts)

web/components/map/
  ├── ChoroplethLayer.tsx     ← compareProvinceA/B props + dimming + refs
  └── LeafletMap.tsx          ← compareProvinceA/B pass-through

web/app/gis/
  └── page.tsx                ← compareA/B state, tab "cmp", wiring
```

---

## FASE 1 — Province Selector

**Componente interno**: `ProvinceSelector` (dentro de `ComparisonPanel.tsx`)

- Input searchable con filtro en tiempo real (case-insensitive)
- Dropdown con las 24 provincias + región
- `onBlur` con delay 160ms para capturar `onMouseDown` del dropdown
- Selector A: accent `#22C55E` (verde)
- Selector B: accent `#0EA5E9` (azul)
- Botón `⇄` swap intercambia A y B

---

## FASE 2 — ComparisonPanel

Tab "Cmp" en el panel derecho (11° tab).

### Secciones

| Sección       | Métricas                                          |
|---------------|---------------------------------------------------|
| COMERCIAL     | Revenue ARS, Clientes Act., Margen %, Ticket Prom.|
| LOGÍSTICA     | OTIF %, Riesgo Log. (score derivado), Activos/Total|
| CLIENTES      | Churn Risk %, Growth YoY, Gap Score               |
| AMBIENTAL     | Sequía Risk, Flood Risk (rainfall proxy), Climate Score |
| INTELIGENCIA  | Opportunity Score, Expansion Score, Ranking Nac.  |

### Riesgo Logístico (derivado)

```
risk = (100 - otif_pct) × 0.6 + churn_score × 100 × 0.4
```
Rango 0–100. Menor = mejor.

### Datos externos

| Dataset | Fuente | Campo de match |
|---------|--------|----------------|
| Ambiental | `/data/gis_outputs/environment_scores.json` | `province` |
| Opportunity | `/data/gis_outputs/opportunity_score.json` | `provincia` |
| Expansion | `/data/gis_outputs/expansion_targets.json` | `provincia` |

Todos se cargan una vez en `useEffect` al montar.

---

## FASE 3 — Barras comparativas

Componente interno `CmpRow`:

- Barra A: verde si ganadora, gris oscuro si perdedora
- Barra B: azul si ganadora, azul oscuro si perdedora
- Ancho de barra proporcional a `value / max(valA, valB)`
- Badge diff `+X%` / `-X%` con color contextual
- Estrella `★` en el ganador
- `higherIsBetter=false` para métricas inversas (churn, riesgo)

---

## FASE 4 — Mini charts

Componente interno `MiniChart`:

- 3 gráficos de línea: Revenue ARS, Clientes Activos, OTIF %
- Rango temporal: 2016–2026 (11 puntos)
- Fuente: `getKpiForYear(baseKPI, year)` desde `timeseries.ts`
- Línea A: `#22C55E`, Línea B: `#0EA5E9`
- Motor: Recharts `LineChart`, altura 46px

---

## FASE 5 — Compare Mode en mapa

Modificaciones en `ChoroplethLayer.tsx`:

### Props nuevos

```typescript
compareProvinceA?: string | null;
compareProvinceB?: string | null;
```

### Lógica de estilo

| Condición | fillOpacity | color borde | weight |
|-----------|-------------|-------------|--------|
| Provincia A | 0.92 | `#22C55E` | 2.5 |
| Provincia B | 0.92 | `#0EA5E9` | 2.5 |
| Resto (compare active) | 0.07 | `#1A3D20` | 0.4 |
| Seleccionada (sin compare) | 0.95 | `#22C55E` | 2.5 |
| Normal | 0.72 | `#1A3D20` | 0.8 |

### Stale closure fix

Los handlers `mouseover`/`mouseout` y `getStyle` leen de refs en lugar de props directamente:

```typescript
const selRef  = useRef(selectedProvince);
const cmpARef = useRef(compareProvinceA);
const cmpBRef = useRef(compareProvinceB);
// sincronizados con useEffect individuales
```

Esto garantiza que los handlers capturan siempre el valor más reciente.

---

## FASE 6 — Quick compare buttons

```typescript
const QUICK_PAIRS = [
  { label: "BsAs / Cba",  a: "Buenos Aires", b: "Córdoba"    },
  { label: "SF / ER",     a: "Santa Fe",     b: "Entre Ríos" },
  { label: "PAM / NOA",   a: "Buenos Aires", b: "Salta"       },
  { label: "Cba / Mza",   a: "Córdoba",      b: "Mendoza"     },
];
```

Grid 2×2 en la sección de selección.

---

## FASE 7 — Indicadores en HUD

- Badge `⬡ CMP` en cyan en el título del mapa cuando compareA o compareB están activos
- Footer: versión actualizada a `GIS v10.0 · GIS-25`

---

## Versión

`/gis` First Load JS: **246 kB → 253 kB** (+7 kB). Bundle aceptable para 11 features completos en el panel derecho.

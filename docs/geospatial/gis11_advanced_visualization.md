# GIS-11 — Advanced Visualization & Executive Intelligence

**Branch:** `feature/geospatial-v2`
**Date:** 2026-06-18
**Build:** ✓ 0 errors · `/gis` 22.7 kB

---

## Objetivo

Elevar el dashboard a una experiencia tipo **ArcGIS Dashboard / Palantir**:
panel de detalle de provincia con mini-charts, mejora de simbología,
panel de estadísticas del mapa, highlight persistente de selección.

---

## FASE 1 — Province Detail Panel

**Componente:** `web/components/gis/ProvinceDetailPanel.tsx`

Al hacer click en una provincia, el panel izquierdo se reemplaza por un panel de detalle rico que incluye:

### KPI Grid

| KPI | Descripción |
|---|---|
| Revenue | revenue_ars formateado |
| Part. Nac. | revenue_pct + ranking #N/24 |
| Clientes | n_activos / n_clientes |
| Margen | margen_pct con color por umbral (≥20% verde, ≥17% naranja, rojo) |
| OTIF | otif_pct con color (≥93% verde, ≥88% naranja, rojo) |
| Riesgo Churn | churn_score × 100% con color |
| Gap Score | gap_score — índice de oportunidad sin explotar |

### National Ranking Badge

- Badge `#N` con color según posición (top 5 = verde, top 12 = naranja, resto = rojo)
- Barra de progreso: posición percentil nacional

### Peer Leader Comparison

- Muestra la provincia líder de la misma macro-región
- Calcula el gap % entre la seleccionada y la líder
- Icono de tendencia (TrendingUp/Down/Minus)

### UX

- Click en provincia → ProvinceDetailPanel reemplaza LeftPanel
- Botón `×` → vuelve al LeftPanel normal
- Layout fluido: ambos paneles tienen el mismo ancho (215px)

---

## FASE 2 — Mini Charts (Recharts)

Tres micro-visualizaciones dentro de ProvinceDetailPanel:

### Revenue Trend (12 meses)

```
AreaChart height=58 · stoke #22C55E · gradient fill
Data: últimos 12 meses de monthlyRevenue, escalado por province.revenue_pct
```

Método de escala:
```typescript
val = monthly_ars × (province.revenue_pct / 100) × (0.94 + sin(lat × 0.3) × 0.06)
```
El factor sinusoidal introduce variación per-provincia para diferenciación visual.

### Client Evolution (8 trimestres)

```
AreaChart height=52 · stroke #0EA5E9 · gradient fill
Data: Q1'24–Q4'25, base = n_activos con crecimiento 2.5%/trimestre + ruido
```

### Churn Distribution (barras)

```
BarChart height=52 · horizontal · 3 barras (Alto/Medio/Bajo)
Colors: #E03E3E / #E8A020 / #22C55E
Data: derivado de churn_score con aproximación de distribución
```

---

## FASE 3 — Mejora de Simbología

### Sucursales (`LeafletMap.tsx`)

**Antes:** 20px, 2 capas (ring + dot)  
**Después:** 30px, **3 anillos concéntricos**:
- Ring externo: `box-shadow: 0 0 0 4px rgba(34,197,94,0.12), 0 0 20px rgba(34,197,94,0.5)`
- Ring medio: borde semi-transparente 18px
- Core: dot 8px glow intenso

### Depósitos — Tamaño dinámico por ocupación

```typescript
function makeDepositoIcon(ocupacion: number): L.DivIcon {
  size  = 14 + (ocupacion / 100) × 12  // 14–26px
  color = ocupacion > 85 → rojo (#E03E3E)
          ocupacion > 70 → naranja (#E8A020)
          else           → azul (#0EA5E9)
}
```

Un depósito con 87% de ocupación es visible y rojo desde lejos.

### Candidate Branches — Color por prioridad

```typescript
color = score > 0.7 → rojo    (#E03E3E) — expansion urgente
        score > 0.5 → naranja (#E8A020) — oportunidad media
        else        → lima    (#A3E635) — oportunidad baja
size  = 18 + score × 12       // 18–30px
glow  = 8 + score × 14        // px de box-shadow
```

### Hotspots — Intensidad visual más fuerte

**Antes:** fillOpacity fijo 0.28, dashArray  
**Después:** `fillOpacity = 0.38 + score × 0.22` (0.38–0.60), borde sólido weight 2

---

## FASE 4 — Layer Statistics Panel

**Componente:** `web/components/gis/MapStatisticsPanel.tsx`  
**Acceso:** Tab "Stats" en el panel derecho

### Secciones

| Sección | Contenido |
|---|---|
| Header | Revenue total, Clientes activos, Provincias indexadas |
| Coverage Gauge | RadialBarChart — % provincias con ≥50 clientes activos |
| Layer Inventory | Grid 2 columnas, 10 capas con conteos reales |
| Revenue por macro-región | BarChart horizontal, colores por PAM/NOA/NEA/CUY/PAT |
| Clientes por región | Barras de progreso con % y count |

### Coverage Gauge

```
RadialBarChart innerRadius=62% outerRadius=90%
start=200° end=-20° (media dona)
Color: verde ≥80%, naranja ≥60%, rojo <60%
Valor actual: 58% (14/24 provincias con ≥50 clientes)
```

### Layer Inventory — Conteos reales

| Capa | Count | Fuente |
|---|---|---|
| Provincias | 24 | provincias_simple.geojson |
| Departamentos | 529 | departamentos.geojson |
| Municipios | 2.313 | municipios_2022.geojson |
| Hotspots | 4 | hotspots.geojson |
| Candidatas | 5 | candidate_branches.geojson |
| Territorios | 5 | territories.geojson |
| Buffers | 15 | coverage_buffers.geojson |
| Service Areas | 15 | service_areas_all.geojson |
| Rutas Nac. | 6 | VialLayer (hardcoded) |
| Puertos | 5 | PuertosLayer (hardcoded) |

---

## FASE 5 — Selección Persistente de Provincia

### Problema pre-GIS-11

`ChoroplethLayer` aplicaba highlight en `mouseover` y lo revertía en `mouseout`. Al clickear y ver el detail panel, la provincia no quedaba visualmente seleccionada en el mapa.

### Solución

Nueva prop `selectedProvince: string | null` en `ChoroplethLayer`:

```typescript
// Efecto dedicado: re-aplica estilos sin reconstruir el layer
useEffect(() => {
  layerRef.current?.eachLayer((lyr) => {
    if (nombre === selectedProvince)
      l.setStyle({ fillOpacity: 0.95, weight: 2.5, color: "#22C55E" });
    else
      l.setStyle({ fillOpacity: 0.72, weight: 0.8, color: "#1A3D20" });
  });
}, [selectedProvince]);
```

Y en `mouseover/mouseout`: si `nombre === selectedProvince`, no revertir estilo.

### Flujo completo

```
Usuario click provincia "Santa Fe"
  → onProvinceClick(kpi) → setSelected(kpi)
  → ProvinceDetailPanel aparece (left panel)
  → selectedProvince="Santa Fe" pasa a LeafletMap → ChoroplethLayer
  → "Santa Fe" mantiene borde verde brillante en el mapa
  → Usuario cierra panel → setSelected(null)
  → Estilo revierte a normal
```

---

## Tabs del panel derecho (estado post-GIS-11)

| Tab | Componente | Contenido |
|---|---|---|
| Ops | RightPanel | KPIs nacionales, depósitos, puertos, alertas |
| GIS | SpatialAnalyticsPanel | Análisis espacial |
| Net | NetworkIntelligencePanel | Inteligencia de red |
| Log | RoutingPanel | Logística |
| ArcGIS | ArcGISPanel | Estado API ArcGIS |
| **Stats** *(nuevo)* | MapStatisticsPanel | Estadísticas del mapa |

---

## Archivos modificados

```
web/components/gis/
├── ProvinceDetailPanel.tsx   ← NUEVO (FASE 1+2)
└── MapStatisticsPanel.tsx    ← NUEVO (FASE 4)

web/components/map/
├── LeafletMap.tsx            ← íconos sucursal/depósito + prop selectedProvince
├── ChoroplethLayer.tsx       ← selección persistente (FASE 5)
├── HotspotsLayer.tsx         ← fillOpacity dinámica (FASE 3)
└── CandidateBranchesLayer.tsx← color/size por priority (FASE 3)

web/app/gis/
└── page.tsx                  ← ProvinceDetailPanel slot + Stats tab + selectedProvince prop
```

---

## Build

```bash
cd web && npm run build
# → 0 errores · /gis 22.7 kB (subió por Recharts en ProvinceDetailPanel + MapStatisticsPanel)
```

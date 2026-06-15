# AgroNova v1.0 — Frontend Architecture

**Stack:** Next.js 15 · TypeScript · Tailwind CSS · Recharts · React-Leaflet  
**Deploy:** Vercel (static + edge)  
**Fecha:** 2026-06-15  

---

## 1. Estructura de directorios

```
web/
├── app/                    # Next.js App Router — 9 páginas
│   ├── layout.tsx          # Root layout: html lang="es" dark, metadata, globals.css
│   ├── page.tsx            # /  → Executive Dashboard
│   ├── comercial/page.tsx  # /comercial → Revenue, Pareto, Top Clientes
│   ├── finanzas/page.tsx   # /finanzas → Márgenes, LTV, Scatter productos
│   ├── clientes/page.tsx   # /clientes → RFM, Churn, Risk table
│   ├── inventario/page.tsx # /inventario → Alertas stock, Rotación, Depósitos
│   ├── logistica/page.tsx  # /logistica → OTIF, Transportistas, Tendencia
│   ├── gis/page.tsx        # /gis → Mapa Leaflet + paneles tácticos (16 KB)
│   ├── ml/page.tsx         # /ml → Modelos, Forecast, Recomendaciones
│   ├── copilot/page.tsx    # /copilot → Placeholder "en desarrollo"
│   └── globals.css         # Tokens CSS globales, glassmorphism, animaciones
│
├── components/
│   ├── layout/
│   │   ├── AppLayout.tsx   # Wrapper principal: sidebar + header + main
│   │   ├── Header.tsx      # Barra superior fija (título, búsqueda, notif)
│   │   └── Sidebar.tsx     # Navegación colapsable (260px / 64px)
│   ├── charts/
│   │   ├── AreaRevenueChart.tsx  # Área dual-eje ARS/USD
│   │   ├── DonutChart.tsx        # Donut con tooltip y leyenda
│   │   ├── ForecastChart.tsx     # Área + líneas de forecast 30/90/180d
│   │   ├── HorizontalBar.tsx     # Barras horizontales comparativas
│   │   ├── OTIFChart.tsx         # Bar + Radar para OTIF regional
│   │   └── ParetoChart.tsx       # Barras + línea acumulada 80/20
│   ├── map/
│   │   └── LeafletMap.tsx        # Mapa interactivo de Argentina
│   └── ui/
│       ├── glass-card.tsx        # GlassCard, CardHeader, Divider
│       └── kpi-card.tsx          # KPICard, StatBadge, AlertBadge
│
├── hooks/
│   └── use-sidebar.ts      # SidebarContext, useSidebar, useSidebarState
│
├── lib/
│   ├── formatters.ts       # fmtARS, fmtUSD, fmtPct, fmtNumber, tierColor, etc.
│   ├── mock-data.ts        # 20 exports de datos sintéticos (23 KB)
│   └── utils.ts            # cn(), lerp(), clamp(), pct()
│
└── types/
    └── index.ts            # 19 interfaces TypeScript del dominio
```

---

## 2. Jerarquía de componentes

```
RootLayout (layout.tsx)
└── AppLayout (components/layout/AppLayout.tsx)
    ├── SidebarContext.Provider
    ├── Sidebar (nav, 9 items, collapse, badge)
    ├── Header (title, search, notifications, live indicator)
    └── <main> (contenido de cada página)
        ├── KPICard × N
        ├── GlassCard
        │   ├── CardHeader
        │   └── [chart | table | custom content]
        └── ...
```

### Páginas y sus componentes clave

| Página | Charts | Tablas | Notas |
|--------|--------|--------|-------|
| `/` (Inicio) | AreaRevenueChart, HorizontalBar | Alerts list | 2 KPI rows |
| `/comercial` | HorizontalBar × 2, ParetoChart, AreaRevenueChart | Top 10 clientes | |
| `/finanzas` | ScatterChart (inline), HorizontalBar | Top 8 por LTV | ScatterChart no está en components/ — está inline en la página |
| `/clientes` | DonutChart × 2, BarChart (inline) | High-risk clientes | |
| `/inventario` | HorizontalBar × 2 | Stock alerts, Capital inmovilizado | |
| `/logistica` | OTIFBarChart, OTIFRadar, LineChart (inline) | Regiones, Transportistas | LineChart inline |
| `/gis` | — | — | LeafletMap + TacStat + LeftPanel + RightPanel (todos inline) |
| `/ml` | DonutChart, ForecastChart | Recomendaciones, Inventario riesgo | |
| `/copilot` | — | — | Static placeholder |

**Nota:** `ScatterChart` y `LineChart` están implementados directamente en las páginas con Recharts, sin componente wrapper. Esto rompe la abstracción del directorio `components/charts/`.

---

## 3. Sistema de datos

### Fuente actual: Mock Data
Todos los datos provienen de `lib/mock-data.ts`. No hay llamadas a API, fetch, ni `useEffect` de carga de datos. Los datos son estáticos en el bundle JS.

### Contratos de datos (types/index.ts)
```
KPISummary           → kpiSummary
MonthlyRevenue[]     → monthlyRevenue (48 meses, 2023-2026)
RegionData[]         → regions (5 regiones ARG)
Cliente[]            → clientes (20 empresas)
RFMSegmentData[]     → rfmSegments (5 segmentos)
ChurnDistribution[]  → churnDistribution (3 niveles)
Producto[]           → productos (20 productos)
StockAlert[]         → stockAlerts (8 alertas)
RotacionData[]       → rotacionData (15 registros)
OTIFData[]           → otifData (5 regiones)
TransportistaData[]  → transportistas (6 carriers)
SucursalMarker[]     → sucursales (5 sucursales)
DepositoMarker[]     → depositos (3 depósitos)
ClienteMapMarker[]   → clienteMarkers (15 clientes geo)
ProvinceHeat[]       → provinceHeat (10 provincias)
GISRoute[]           → gisRoutes (5 rutas)
ForecastPoint[]      → forecastData (12 puntos)
RecommendationItem[] → recommendations (6 clientes con 3 rec cada uno)
Vendedor[]           → vendedores (8 vendedores)
AlertItem[]          → alerts (6 alertas operativas)
```

---

## 4. State management

El estado de la aplicación es minimal, gestionado con React Context y `useState` local.

### SidebarContext
```
useSidebarState() → { collapsed, toggle, setCollapsed }
AppLayout → SidebarContext.Provider
├── Sidebar → useSidebar() → { collapsed, toggle }
└── Header  → useSidebar() → { collapsed }
```

Solo el estado del sidebar necesita estado global. El resto de estados son locales a cada página.

### Estado local por página
- **GIS page:** 5 `useState` (showRadios, showClients, showHeat, showRoutes, selectedProvince)
- **Otras páginas:** Sin estado (render puro sobre mock data)

---

## 5. Sistema de estilos

### Capas de estilo
1. **`tailwind.config.ts`** — Tokens semánticos (colores, tipografía, animaciones, shadows)
2. **`globals.css`** — Clases utilitarias custom (`.glass`, `.glass-elevated`, `.tactical`, scrollbar, animaciones CSS)
3. **Clases Tailwind** — Aplicadas directamente en JSX via `cn()`
4. **Inline styles** — Solo para valores dinámicos (colores de datos de charts, `marginLeft` del sidebar)

### Paleta de colores
```
bg-bg-base:       #030A04  (fondo principal)
bg-bg-surface:    #071008  (cards de primer nivel)
bg-bg-elevated:   #0C1E0F  (cards elevadas)

primary:          #22C55E  (verde principal)
secondary:        #A3E635  (lime acento)
cyan accent:      #0DB87E  (variante teal)

text-primary:     #DCE8DC  (texto principal)
text-secondary:   #7A9C7A  (texto secundario)
text-muted:       #3E5C3E  (texto de apoyo)

danger:           #E03E3E
warning:          #E8A020
success:          #0DB87E
```

### Tema de charts (Recharts)
El estilo de tooltips (`background: "#0C1220", border: "1px solid #1A2540", borderRadius: 8, fontSize: 11`) está duplicado en los 6 chart components. Candidato a extracción en `lib/chart-theme.ts`.

---

## 6. Routing

Next.js App Router con file-system routing. No hay rutas dinámicas (`[param]`), rutas paralelas, ni intercepting routes. Todas las rutas son estáticas.

```
/            → app/page.tsx
/comercial   → app/comercial/page.tsx
/finanzas    → app/finanzas/page.tsx
/clientes    → app/clientes/page.tsx
/inventario  → app/inventario/page.tsx
/logistica   → app/logistica/page.tsx
/gis         → app/gis/page.tsx
/ml          → app/ml/page.tsx
/copilot     → app/copilot/page.tsx
```

---

## 7. Carga de assets

| Asset | Método | Nota |
|-------|--------|------|
| Fuentes (Inter, JetBrains Mono) | `@import` en globals.css | Bloquea render; debería migrar a `next/font` |
| Leaflet CSS | `import 'leaflet/dist/leaflet.css'` en LeafletMap | Correcto |
| Leaflet JS | `dynamic(() => import(...), { ssr: false })` | Correcto para SSR |
| Tiles del mapa | CartoDB dark (`https://{s}.basemaps...`) | CDN externo |
| Íconos Leaflet | `divIcon` con HTML/CSS inline | Sin dependencia de imágenes |

---

## 8. Configuración de deploy (Vercel)

El `vercel.json` existe en `web/`. La configuración de Next.js en `next.config.ts` es presumiblemente default para un proyecto estático. No hay middleware, no hay API Routes en v1.0.

---

## 9. Deuda técnica identificada

### Crítica (bloquea v1.1)
- No hay capa de datos real — todo es mock. La v1.1 require una API layer (FastAPI o Next.js API Routes).
- No hay manejo de errores (`ErrorBoundary`) — cuando se conecte a datos reales, cualquier fallo de red romperá la UI silenciosamente.

### Importante (afecta calidad)
- `ScatterChart` y `LineChart` implementados inline en páginas (Finanzas, Logística) — inconsistente con el directorio `components/charts/`.
- GIS `page.tsx` tiene 16 KB con componentes locales que deberían extraerse.
- No hay `DataTable` component — tablas duplicadas en 5 páginas.
- Sin loading states / skeletons.

### Menor (polish)
- Fuentes vía `@import` en lugar de `next/font`.
- CSS custom properties de layout no consumidas.
- `lerp()`, `clamp()`, `pct()` potencialmente muertos.

---

## 10. Invariantes del diseño (no cambiar sin revisión)

- **Dark mode permanente:** `className="dark"` en `<html>`. No es un toggle. Es una decisión de producto.
- **Sidebar collapse state:** El contexto vive en `AppLayout`; todos los ajustes de layout dependen de él.
- **Mock data como source of truth:** Hasta que exista una API, toda la data pasa por `lib/mock-data.ts`. No duplicar datos en las páginas.
- **`cn()` como único punto de merge de clases:** No concatenar strings directamente con `+` o template literals para Tailwind.
- **Tipos centralizados:** Toda nueva interfaz de dominio va a `types/index.ts`, no inline en páginas.

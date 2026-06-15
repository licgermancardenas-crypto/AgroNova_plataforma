# AgroNova v1.0 — UI/Frontend Audit

**Fecha:** 2026-06-15  
**Revisor:** Claude Code (Sonnet 4.6) — Auditoría de hardening pre-release  
**Alcance:** 9 páginas, 14 componentes, 6 charts, 3 archivos lib, 1 hook  

---

## 1. Fortalezas detectadas

| # | Fortaleza |
|---|-----------|
| 1 | Sistema de tokens de color centralizado en `tailwind.config.ts` — todos los colores pasan por nombres semánticos (`primary`, `danger`, `text-muted`, etc.) |
| 2 | TypeScript centralizado en `types/index.ts` — 19 interfaces, todas las páginas las consumen; no hay tipos inline ad-hoc |
| 3 | `cn()` usa `clsx + tailwind-merge` correctamente — evita conflictos de clases Tailwind |
| 4 | `GlassCard + CardHeader` son el patrón de composición más consistente del código — todas las páginas lo usan de forma uniforme |
| 5 | `KPICard` con sistema de accents cubre todos los casos de uso (blue, cyan, green, warning, danger) |
| 6 | LeafletMap usa `dynamic(() => import(...), { ssr: false })` — correcto para evitar errores SSR de Leaflet |
| 7 | Sidebar collapse usa React Context — evita prop-drilling a través del árbol de layout |
| 8 | `"use client"` correctamente colocado en todos los componentes interactivos |
| 9 | `formatters.ts` cubre todos los casos de formato (ARS compacto, USD, %, fechas en español) sin repetición |
| 10 | La página Copilot tiene un placeholder bien diseñado — comunica "en desarrollo" sin parecer rota |
| 11 | Mock data completamente tipado contra `types/index.ts` — type-safe de punta a punta |
| 12 | Dark mode forzado vía `className="dark"` en `<html>` — intencional y limpio para un portfolio producto |
| 13 | Las animaciones CSS (scan, glow, shimmer) son coherentes con el lenguaje visual "tactical" |
| 14 | `AppLayout` ajusta `padding-left` automáticamente al estado del sidebar — sin layout shifts groseros |

---

## 2. Problemas detectados

### 2.1 Código duplicado — ALTA PRIORIDAD

**P01 — Tooltip style object repetido en los 6 chart components**  
Archivo: `AreaRevenueChart`, `DonutChart`, `HorizontalBar`, `ForecastChart`, `OTIFChart`, `ParetoChart`  
```ts
// Este objeto aparece 6 veces, verbatim:
contentStyle={{ background: "#0C1220", border: "1px solid #1A2540", borderRadius: 8, fontSize: 11 }}
```
Fix: Extraer a `lib/chart-theme.ts` como `CHART_TOOLTIP_STYLE`.

**P02 — No existe componente `<DataTable>`**  
El markup `<table className="w-full text-xs"> <thead>... <tbody>...` está copy-paste en:
- `app/clientes/page.tsx`
- `app/comercial/page.tsx`
- `app/finanzas/page.tsx`
- `app/logistica/page.tsx`
- `app/inventario/page.tsx`

Cada uno tiene variantes menores (columnas diferentes) pero la estructura `thead/tbody`, el `tr-hover`, el `border-b border-border-subtle` y el `overflow-x-auto` son idénticos.  
Fix: Crear `components/ui/data-table.tsx` con props `columns[]` y `rows[]`.

**P03 — Patrón badge inline duplicado en 5+ páginas**  
```tsx
<span className="px-2 py-0.5 rounded text-2xs font-semibold bg-primary-dim text-primary-light border border-primary-DEFAULT/30">
```
Existe `StatBadge` y `AlertBadge` en `kpi-card.tsx` pero no se usan para este caso.  
Fix: Ampliar `StatBadge` o crear `<TierBadge tier={c.tier}>` en `components/ui/`.

**P04 — `criticalCount` recalculado en cada render del Header**  
```ts
const criticalCount = alerts.filter(a => a.type === "danger").length;
```
Fix: `useMemo(() => alerts.filter(a => a.type === "danger").length, [])`.

---

### 2.2 Código muerto — MEDIA PRIORIDAD

**P05 — `lerp()` y `clamp()` en `lib/utils.ts` no se usan**  
Son utilidades de interpolación matemática que no aparecen referenciadas en ningún componente. Candidatos a eliminación.

**P06 — `pct()` en `lib/utils.ts` no se usa**  
Las páginas calculan porcentajes inline: `(c.churn_probability * 100).toFixed(0)`. La función `pct()` nunca se importa.

**P07 — CSS custom properties `--sidebar-width` y `--header-height` no se consumen**  
Definidas en `globals.css`:
```css
:root { --sidebar-width: 240px; --header-height: 56px; }
```
El sidebar usa `w-60` (240px) hardcodeado en Tailwind. El header usa `h-14` (56px). Las variables CSS no se usan en ningún componente. Si cambia el tamaño del sidebar, hay que actualizarlo en dos lugares.  
Fix: Eliminar las variables CSS y documentar los valores en un comentario en `tailwind.config.ts`, o bien consumirlas desde `AppLayout` y `Header` como `style={{ marginLeft: 'var(--sidebar-width)' }}`.

**P08 — `KPICard` prop `size` nunca se pasa en ninguna página**  
El componente soporta `sm | md | lg` pero todas las instancias usan el default.  
Decisión: si no está planificada su variación, simplificar el componente quitando el prop.

**P09 — `setCollapsed` expuesto por `useSidebarState` nunca se usa externamente**  
Solo `toggle()` se llama desde `Sidebar.tsx`. `setCollapsed` está expuesto en el contexto pero ningún componente lo consume.

**P10 — `Divider` exportado desde `glass-card.tsx` aparentemente sin uso**  
Verificar con grep antes de eliminar.

**P11 — Import `TrendingUp` en `app/gis/page.tsx` no se renderiza**  
Se importa pero el componente que lo usaría no está presente en el JSX visible.

---

### 2.3 Anti-patrones de React — ALTA PRIORIDAD

**P12 — Mutación DOM directa en GIS page (rompe el modelo React)**  
```ts
// app/gis/page.tsx
document.getElementById('gis-clock')?.textContent = new Date().toLocaleTimeString(...)
```
Esto muta el DOM directamente fuera de React, causando:
- Inconsistencia con el virtual DOM
- Pérdida del valor en re-renders
- Imposibilidad de pruebas unitarias del reloj

Fix:
```tsx
const [time, setTime] = useState('');
useEffect(() => {
  const id = setInterval(() => setTime(new Date().toLocaleTimeString('es-AR', { hour12: false })), 1000);
  return () => clearInterval(id);
}, []);
// En JSX: <span>{time}</span>
```

**P13 — `DonutChart` calcula `total` sin `useMemo`**  
```ts
const total = data.reduce((s, d) => s + d.value, 0); // en cada render
```
Fix: `const total = useMemo(() => data.reduce((s, d) => s + d.value, 0), [data])`.

**P14 — Ningún chart usa `React.memo()`**  
Los 6 chart components re-renderizan en cada actualización del padre. En un dashboard con estado (GIS tiene 5 `useState`) esto causa re-renders innecesarios.

---

### 2.4 GIS page — MEDIA PRIORIDAD

**P15 — `LeftPanel` y `RightPanel` son componentes grandes definidos inline en `page.tsx`**  
El archivo pesa 16.6 KB. Estos dos paneles son componentes complejos (60-80 líneas cada uno) que deberían estar en `components/gis/LeftPanel.tsx` y `components/gis/RightPanel.tsx`.

**P16 — Coordenadas hardcodeadas no se actualizan con el mapa**  
```tsx
<span>-34.2845, -61.9321</span> {/* nunca cambia */}
```
El usuario al mover el mapa espera ver coordenadas dinámicas. Fix: usar el evento `onMove` de React-Leaflet para actualizar estado.

**P17 — Zoom level hardcodeado en la status bar**  
```tsx
<span>Zoom: 5</span> {/* siempre 5 */}
```
Fix: capturar zoom via `useMapEvents` de react-leaflet.

**P18 — No hay placeholder de carga del mapa**  
`dynamic(() => import(...), { ssr: false })` retorna `null` mientras carga, causando layout shift.  
Fix: agregar `loading: () => <div className="w-full h-full flex items-center justify-center text-text-muted">Cargando mapa…</div>` al `dynamic()`.

---

### 2.5 Responsive design — MEDIA PRIORIDAD

**P19 — GIS page layout se rompe en pantallas < 1024px**  
El layout de 3 columnas (`200px | flex-1 | 180px`) no tiene breakpoints responsive. En tablet o móvil los paneles laterales aplastan el mapa.  
Fix mínimo: ocultar paneles laterales en `<lg` con `hidden lg:block` y agregar un drawer/toggle.

**P20 — Header `marginLeft` via inline style no usa transición**  
```tsx
style={{ marginLeft: collapsed ? 64 : 240 }}
```
El sidebar tiene `transition-all duration-300` pero el Header cambia bruscamente.  
Fix: `style={{ marginLeft: collapsed ? 64 : 240, transition: 'margin-left 300ms ease' }}`.

**P21 — Tablas sin `overflow-x-auto` wrapper consistente**  
Logística (tabla transportistas) y Finanzas (clientes por LTV) no tienen wrapper `overflow-x-auto`, lo que puede romper el layout en mobile.

---

### 2.6 Accesibilidad — MEDIA PRIORIDAD

**P22 — Botones icon-only sin `aria-label`**  
- Botón de notificaciones (campana) en `Header.tsx`
- Botón de collapse del sidebar en `Sidebar.tsx`

Fix:
```tsx
<button aria-label="Ver notificaciones">
<button aria-label={collapsed ? "Expandir sidebar" : "Colapsar sidebar"}>
```

**P23 — Sidebar no usa `<nav>` landmark**  
La barra lateral usa `<aside>` o `<div>`. Debería ser:
```tsx
<nav aria-label="Navegación principal">
```

**P24 — Tablas de datos sin `<caption>` ni `aria-label`**  
Las 5 tablas de datos no tienen `<caption>` ni `aria-describedby`, lo que dificulta la navegación con screen readers.

**P25 — `text-2xs` (10px) puede fallar WCAG AA**  
El texto de subtítulos y badges a 10px sobre colores `text-muted` probablemente no alcanza la relación de contraste 4.5:1 requerida para texto pequeño.

**P26 — Focus rings probablemente eliminados**  
Las clases Tailwind de botones usan `outline-none` sin reemplazo visible de focus. Verificar con navegación por teclado.

---

### 2.7 Performance — BAJA PRIORIDAD

**P27 — Fuentes cargadas via `@import` en `globals.css`**  
```css
@import url('https://fonts.googleapis.com/css2?family=Inter...');
```
Esto bloquea el render. Next.js 15 tiene `next/font/google` que hace subsetting automático, preload, y elimina el bloqueo de render.  
Fix: reemplazar el `@import` por:
```tsx
// app/layout.tsx
import { Inter, JetBrains_Mono } from 'next/font/google'
const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })
```

**P28 — `AreaRevenueChart` aplica `filter` hardcodeado sobre los datos**  
```ts
const slice = data.filter((_, i) => i % 2 === 0); // descarta 50% de los puntos
```
Reduce la resolución visual del gráfico sin que el usuario lo sepa. Documentar o eliminar.

**P29 — Sin Suspense boundaries ni skeletons para charts**  
Todos los charts aparecen en el mount inicial sin estado de carga. En conexiones lentas o cuando se conecte a la API real, habrá flash de layout vacío.

---

### 2.8 Inconsistencias visuales — BAJA PRIORIDAD

**P30 — Color púrpura en segmento `Alto_Valor` rompe la paleta**  
```ts
{ segment: "Alto_Valor", color: "#9B59B6" }  // púrpura
```
Todos los otros segmentos usan verdes y naranjas. Este púrpura no existe en `tailwind.config.ts`. Propuesta: `#0EA5E9` (cyan) o `#E8A020` (ámbar).

**P31 — Leyendas de charts no tienen estilo unificado**  
`DonutChart` usa círculos pequeños con label inline. `HorizontalBar` no tiene leyenda. `OTIFRadar` tiene leyenda de Recharts. No hay un componente `<ChartLegend>` compartido.

**P32 — Copilot page menciona `claude-opus-4-8` hardcodeado**  
El modelo quedará desactualizado. Mover a una constante en `lib/config.ts` o simplemente poner "Claude API".

---

## 3. Estados vacíos — MEDIA PRIORIDAD

| Página | Tabla/Sección | Estado vacío actual | Fix recomendado |
|--------|--------------|-------------------|-----------------|
| Clientes | "Riesgo Crítico" | Tabla vacía sin mensaje | `<EmptyState message="Sin clientes en riesgo crítico" />` |
| Inventario | "Capital Inmovilizado" | Sin manejo | Misma solución |
| Comercial | Top 10 Clientes | Sin manejo | Misma solución |
| Logística | Ranking Transportistas | Sin manejo | Misma solución |
| Copilot | Chat | ✅ Bien manejado | — |

---

## 4. Naming — BAJA PRIORIDAD

| Elemento | Nombre actual | Propuesta |
|----------|--------------|-----------|
| `web/hooks/use-sidebar.ts` | Exporta Context + Hook + State Hook | Renombrar a `sidebar-context.ts` o separar en dos archivos |
| `TacStat` en GIS page | Nombre interno cryptic | `GISStat` o `TacticalChip` con JSDoc |
| `LeftPanel` / `RightPanel` en GIS | Componentes locales sin extraer | `GISControlPanel` / `GISAnalyticsPanel` en `components/gis/` |
| `StockPriority` tipo | `"1_Sin_Stock"`, `"2_Critico_A"` | El prefijo numérico es útil para sort pero inusual; documentar el porqué |

---

## 5. Resumen ejecutivo de issues

| Prioridad | Cantidad | Items |
|-----------|----------|-------|
| 🔴 Alta | 5 | P01, P02, P12, P13, P14 |
| 🟡 Media | 16 | P03, P04, P15–P19, P20–P21, P22–P26, P30 |
| 🟢 Baja | 11 | P05–P11, P27–P29, P31–P32 |
| **Total** | **32** | |

---

## 6. Quick wins (< 30 min cada uno)

1. Extraer `CHART_TOOLTIP_STYLE` a `lib/chart-theme.ts` — elimina 6 duplicados (P01)
2. Agregar `aria-label` a los 2 botones icon-only (P22)
3. Agregar `<nav aria-label>` al Sidebar (P23)
4. Fix del reloj en GIS con `useState` (P12)
5. `useMemo` en DonutChart total (P13)
6. Agregar `loading:` al `dynamic()` del mapa (P18)
7. Corregir color de `Alto_Valor` a cyan (P30)
8. Wrapper `overflow-x-auto` en las tablas que lo faltan (P21)

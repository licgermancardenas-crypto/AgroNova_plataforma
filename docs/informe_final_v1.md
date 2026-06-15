# AgroNova v1.0 — Informe Final de Hardening

**Fecha:** 2026-06-15  
**Alcance:** Auditoría visual, arquitectura frontend, deuda técnica, roadmap v2.0  

---

## Fortalezas detectadas

**Sistema de diseño sólido.**  
Tailwind config con tokens semánticos bien nombrados, design language glassmorphism/tactical coherente en las 9 páginas, paleta de color verde/tierra consistente (con una excepción: el segmento `Alto_Valor` usa púrpura que rompe la paleta). El componente `GlassCard + CardHeader` funciona como unidad de composición confiable en todo el producto.

**TypeScript bien aplicado.**  
19 interfaces centralizadas en `types/index.ts`. Las páginas no definen tipos inline. El mock data está completamente tipado contra esas interfaces. Ningún `any` detectado. La función `cn()` usa `clsx + tailwind-merge` correctamente.

**Arquitectura de layout limpia.**  
`AppLayout → SidebarContext → Header/Sidebar/main` es un patrón claro. El collapse del sidebar con Context evita prop-drilling. El routing de Next.js App Router está bien aprovechado.

**Cobertura funcional completa.**  
9 páginas activas cubren todos los dominios del negocio (Comercial, Finanzas, Clientes, Inventario, Logística, GIS, ML, Copilot). El placeholder del Copilot comunica el roadmap sin verse roto. La página GIS con Leaflet y modo táctico es el highlight visual más memorable del portfolio.

**Formatters reutilizables.**  
`fmtARS`, `fmtUSD`, `fmtPct`, `tierColor`, `riskColor` cubren todos los casos de formato del negocio sin repetición.

---

## Oportunidades de mejora

### Eliminar en < 1 semana

| Item | Impacto | Esfuerzo |
|------|---------|----------|
| Extraer `CHART_TOOLTIP_STYLE` a `lib/chart-theme.ts` | Elimina 6 duplicados exactos | 15 min |
| `aria-label` en botón notificaciones y collapse | Accesibilidad básica | 10 min |
| `<nav aria-label="Navegación principal">` en Sidebar | Accesibilidad básica | 5 min |
| Fix reloj GIS: `document.getElementById` → `useState` | Anti-patrón React | 20 min |
| `useMemo` en DonutChart total | Performance correcta | 5 min |
| Placeholder de carga en `dynamic()` del mapa Leaflet | Elimina layout shift | 15 min |
| Corregir color `Alto_Valor` de `#9B59B6` a cyan | Consistencia visual | 5 min |
| `overflow-x-auto` en tablas de Logística y Finanzas | Layout no se rompe en mobile | 10 min |

### Mejorar en 1-2 sprints

- **Crear `<DataTable>` component:** Las 5 tablas de datos son markup duplicado. Un componente con `columns[]` + `rows[]` reduce ~200 líneas de JSX repetido y centraliza el hover/border styling.
- **Extraer `LeftPanel` y `RightPanel` de GIS:** El archivo `gis/page.tsx` tiene 16 KB porque contiene componentes locales de 60-80 líneas cada uno. Moverlos a `components/gis/` reduce la complejidad perceptible del archivo.
- **Agregar estados vacíos:** 4 tablas (Clientes, Inventario, Comercial, Logística) no manejan el caso de resultado vacío. Un componente `<EmptyState>` simple con ícono y mensaje resuelve todos.
- **Migrar fuentes a `next/font`:** Los `@import` de Google Fonts en `globals.css` bloquean el render. `next/font/google` hace preload automático y subsetting, mejorando LCP.
- **`React.memo()` en charts:** Todos los chart components re-renderizan en cada actualización del padre. Especialmente relevante en GIS que tiene 5 `useState`.

---

## Deuda técnica pendiente

| Deuda | Severidad | Descripción |
|-------|-----------|-------------|
| Sin capa de datos real | Crítica | Todo el producto corre sobre mock data estático en el bundle. Cualquier backend en v1.1 requiere refactorizar el data-fetching de las 9 páginas. |
| Sin `ErrorBoundary` | Alta | Si falla cualquier chart o fetch, la página entera rompe silenciosamente. |
| ScatterChart / LineChart inline | Media | Implementados directamente en páginas de Finanzas y Logística, fuera del directorio `components/charts/`. Crea inconsistencia con el patrón del resto del código. |
| CSS vars `--sidebar-width` / `--header-height` sin consumir | Baja | Definidas en globals.css, nunca usadas. El sidebar usa `w-60` hardcodeado. Si alguien cambia el tamaño del sidebar, tiene que actualizarlo en dos lugares. |
| `lerp()`, `clamp()`, `pct()` en utils.ts | Baja | Probablemente código muerto. Verificar y eliminar. |
| Coordenadas y zoom GIS hardcodeados | Baja | El display táctico muestra `-34.2845, -61.9321` y `Zoom: 5` fijos, nunca actualizados. |
| No hay skeletons / loading states | Baja | Cuando el proyecto conecte a una API real, los charts aparecerán vacíos hasta que llegue la respuesta. |

---

## Recomendaciones para v2.0

### Arquitectura de datos
Implementar una capa de abstracción de datos clara antes de cualquier otra cosa. El patrón recomendado:
```
Next.js API Routes (o FastAPI externo)
  ↓
Custom hooks: useClientes(), useKPIs(), useInventario()
  ↓
Páginas (solo presentación, sin lógica de datos)
```
Esto permite que las páginas actuales funcionen con datos reales con cambios mínimos: reemplazar las importaciones de `lib/mock-data.ts` por los hooks.

### Componentes faltantes en v2.0
- `<DataTable columns rows>` — unificar las 5 tablas actuales
- `<EmptyState icon message>` — estados vacíos consistentes
- `<SkeletonCard>` / `<SkeletonChart>` — loading states
- `<ErrorBoundary>` — captura de errores por sección
- `<DateRangePicker>` — filtro de fechas que hoy ninguna página tiene
- `components/gis/GISControlPanel.tsx` — extraer de gis/page.tsx

### Performance en v2.0
- `React.memo()` en los 6 chart components
- `useMemo` en cálculos derivados de datos (totales, filtros)
- `React.lazy + Suspense` por página (code splitting)
- Migración a `next/font` para Inter y JetBrains Mono

### Accesibilidad en v2.0
- Audit con axe-core o Lighthouse accessibility
- Focus visible en todos los elementos interactivos
- `role="table"` + `<caption>` en tablas de datos
- Test de contraste en texto `text-2xs` sobre fondos muted
- Navegación por teclado en el mapa GIS

### Testing en v2.0
El proyecto tiene 111 tests de Python para el backend, pero ningún test del frontend. Para v2.0:
- Unit tests con Vitest + React Testing Library para KPICard, GlassCard, formatters
- Integration tests por página con Playwright
- Visual regression con Chromatic o Percy

### Autenticación y multi-tenancy (v2.0+)
El proyecto actualmente muestra datos de "Germán Cárdenas, Director" hardcodeado en el Sidebar. Para un producto real:
- NextAuth.js o Clerk para autenticación
- El perfil de usuario debe venir de la sesión
- El sidebar badge con 47 clientes debe venir de una query real, no de mock data

---

## Métricas del frontend (estimadas)

| Métrica | Valor actual | Target v2.0 |
|---------|-------------|-------------|
| Páginas activas | 9 | 9 + autenticación |
| Componentes | 14 | ~20 (+DataTable, EmptyState, Skeletons) |
| Chart components | 6 (+ 2 inline) | 8 (todos extraídos) |
| Duplicaciones detectadas | 32 issues | 0 críticas, < 5 menores |
| TypeScript errors | 0 | 0 |
| Bundle inicial | ~230 KB | < 200 KB (con lazy loading) |
| Tests frontend | 0 | > 30 |

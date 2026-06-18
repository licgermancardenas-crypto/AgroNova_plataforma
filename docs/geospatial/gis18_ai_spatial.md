# GIS-18 — AI Spatial Intelligence

## Objetivo

Transformar el GIS de AgroNova de una herramienta de **visualización** en una de **decisión**: cada endpoint devuelve recomendaciones accionables derivadas de los datos GIS existentes, sin modelos ML externos ni mocks.

---

## Arquitectura

```
data/gis_outputs/          web/public/data/geo/
  expansion_recommendations.json   province_kpis.json
  opportunity_score.json           province_timeseries.json
  churn_by_province.json
  coverage_score.json
  route_risk.json
  transport_costs.json
         │
         ▼
backend/services/ai_spatial_service.py
         │
         ▼
backend/api/routers/ai_spatial.py
  GET /api/ai/expansion
  GET /api/ai/forecast
  GET /api/ai/churn-risk
  GET /api/ai/opportunities
         │
         ▼
web/components/gis/AISpatialPanel.tsx
  Tab "AI" → sub-tabs: Expansión · Forecast · Riesgo · Matrix
```

---

## FASE 1 — Funciones del servicio

### `expansion_recommendations()`

**Datos:** `expansion_recommendations.json` (5 candidatas ya rankeadas) + `opportunity_score.json` + `transport_costs.json`

**Algoritmo:**
1. Para cada candidata, estima **capex** en función de la distancia a la sucursal más cercana:
   ```
   capex_mard_ars = (50 + dist_km × 0.15) × 1.20
   ```
   El multiplicador 1.20 incluye capital de trabajo.

2. Estima **revenue anual** conservador: `agr_ha_m × 180_000_000 × 0.60` (60 % del potencial teórico basado en provincias activas).

3. Calcula ROI y payback:
   ```
   roi_pct     = (annual_rev / capex) × 100
   payback_yrs = capex / annual_rev
   ```

4. Asigna prioridad: ALTA si expansion_score ≥ 62, MEDIA ≥ 57, BAJA resto.

5. Genera `ai_rationale` con datos reales de la candidata.

**Output:** lista rankeada con capex, ROI, payback, prioridad y justificación.

---

### `revenue_forecast_province()`

**Datos:** `province_timeseries.json` (años 2016-2024 por provincia)

**Algoritmo:** Regresión OLS lineal (sin numpy — cálculo puro Python):

```python
slope     = Σ(xi - x̄)(yi - ȳ) / Σ(xi - x̄)²
intercept = ȳ - slope × x̄
forecast  = max(0, intercept + slope × year)
```

CAGR observado: `(revenue_end / revenue_start)^(1/n) - 1`

Clasificación de tendencia:
- CRECIENTE: CAGR ≥ 4 %
- DECRECIENTE: CAGR ≤ -2 %
- ESTABLE: resto

Confianza según cantidad de años con datos:
- ALTA: ≥ 6 años
- MEDIA: 3-5 años
- BAJA: < 3 años

**Output:** proyecciones 2025-2029 ordenadas por forecast_2027 descendente.

---

### `churn_geographic_risk()`

**Datos:** `churn_by_province.json` + `route_risk.json` + `coverage_score.json`

**Algoritmo:** Score compuesto con pesos:

```
geo_risk_score = 0.40 × churn_score
              + 0.30 × logistics_risk_mean
              + 0.30 × coverage_gap_pct
```

- `churn_score`: tasa de abandono histórica (0–1) de `churn_by_province.json`
- `logistics_risk_mean`: promedio de `pct_demorado / 100` sobre todos los depósitos en `route_risk.json`
- `coverage_gap_pct`: `1 - coverage_score / 100`; para provincias sin presencia = 1.0 (gap total)

Umbrales de etiquetado:
| Score | Etiqueta |
|-------|----------|
| > 0.45 | ALTO |
| 0.30–0.45 | MEDIO |
| < 0.30 | BAJO |
| 0 clientes | SIN DATOS |

**Acciones recomendadas** según etiqueta + contexto.

---

### `opportunity_matrix()`

**Datos:** `opportunity_score.json` + `churn_by_province.json` + `revenue_density.json`

**Algoritmo:** Matriz 2×2 estilo BCG adaptada al agro:

```
Eje X: opportunity_score (0–100) — potencial de mercado
Eje Y: penetracion_idx normalizado (0–100) — presencia actual
```

Umbral de corte: 50 en ambos ejes.

| Cuadrante | Condición | Acción |
|-----------|-----------|--------|
| **INVEST** | Alta opp, baja pen | Mercado virgen → abrir sucursal / zona comercial |
| **GROW**   | Alta opp, alta pen | Mercado activo con potencial → escalar cartera |
| **DEFEND** | Baja opp, alta pen | Mercado maduro → proteger share, mejorar margen |
| **MONITOR**| Baja opp, baja pen | No priorizar → monitorear |

Score compuesto: `0.6 × opportunity_score + 0.4 × penetracion_norm`

---

## FASE 2 — Endpoints

| Endpoint | Descripción |
|----------|-------------|
| `GET /api/ai/expansion` | Top candidatas con capex/ROI/payback |
| `GET /api/ai/forecast` | Proyección revenue 2025-2029 por provincia |
| `GET /api/ai/churn-risk` | Riesgo geográfico compuesto |
| `GET /api/ai/opportunities` | Matriz 2×2 oportunidad × penetración |

Todos los endpoints funcionan sin DB (leen archivos JSON locales). Fallback automático si falta algún archivo: retorna lista vacía.

---

## FASE 3 — Frontend (tab "AI")

`web/components/gis/AISpatialPanel.tsx` — 4 sub-tabs:

- **Expansión**: lista expandible con capex, ROI, payback, rationale
- **Forecast**: barras con CAGR + proyección 2027→2029
- **Riesgo**: semáforo por provincia (ALTO/MEDIO/BAJO/SIN DATOS)
- **Matrix**: grid 2×2 con conteos por cuadrante + lista de provincias

Diseño HUD existente (glass, tactical-text, colores primary #22C55E).

---

## Notas de implementación

- **Sin numpy**: OLS implementado en Python puro para compatibilidad con Python 3.14.
- **Sin mocks**: todos los valores provienen de archivos GIS output generados por el pipeline existente.
- **Fallback transparente**: si un archivo JSON no existe, el endpoint devuelve `items: []` sin error 500.
- **Capex modelo**: estimación de referencia basada en infraestructura de sucursales existentes. No incluye costos de terreno, habilitaciones ni personal.

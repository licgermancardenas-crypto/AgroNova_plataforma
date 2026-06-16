# AgroNova v2.0 — Spatial Analytics (Sprint GIS-02)

Capa de análisis espacial de negocio sobre la base GIS existente. Calcula 5 scores por provincia a partir de datos reales (`data/csv/Dim_Cliente.csv`, `Dim_Sucursal.csv`, ventas) — sin mocks, sin PostGIS, sin APIs externas.

Módulos: `gis/spatial_scores.py`, `gis/opportunity_analysis.py`, `gis/expansion_analysis.py`, generados por `gis/generate_analytics.py` → `data/gis_outputs/*.json`.

---

## 1. Coverage Score (`coverage_score.json`)

**Qué mide:** qué tan bien cubierta está una provincia por la red comercial actual de AgroNova.

**Fórmula (0–100):**
```
coverage_score = active_ratio * 40
                + proximity_factor * 30
                + penetration * 20
                + present * 10

active_ratio     = clientes_activos / clientes_totales        (0..1)
proximity_factor = max(0, 1 - distancia_min_a_sucursal_km / 700)
penetration       = min(clientes_activos / 200, 1)
present           = 1 si tiene clientes activos, 0 si no
```

**Supuestos:**
- 700 km es la distancia más allá de la cual la proximidad a una sucursal deja de aportar (radio operativo razonable para logística agro en Argentina).
- 200 clientes activos se considera "saturación" de la red para fines de scoring (no es un techo real de capacidad).
- La distancia se mide en línea recta (haversine) desde el centroide provincial a la sucursal más cercana — no contempla rutas reales.

**Interpretación:**
| Rango | Etiqueta |
|---|---|
| 80–100 | Sólida |
| 60–79 | Media |
| 40–59 | Incipiente |
| 0–39 | Sin Cobertura |

**Uso comercial:** priorizar refuerzo de sucursales/depósitos en provincias "Incipiente" antes de abrir nuevas plazas; detectar provincias con clientes pero sin infraestructura cercana (gap logístico, no solo comercial).

---

## 2. Opportunity Score (`opportunity_score.json`)

**Qué mide:** potencial de negocio no explotado en una provincia, combinando tamaño del mercado agrícola con la penetración actual de AgroNova.

**Fórmula (0–100):**
```
opportunity_score = agr_potential * 45
                   + revenue_gap  * 30
                   + client_gap   * 15
                   + share_gap    * 10

agr_potential = min(agr_ha_m / max(agr_ha_m_max_nacional, 1), 1)
revenue_gap   = 1 - min(revenue_ars / max(revenue_ars_max_nacional, 1), 1)
client_gap    = 1 - min(n_activos / max(n_activos_max_nacional, 1), 1)
share_gap     = 1 - penetracion_idx_normalizado
```
Todos los componentes se acotan a [0, 1] antes de ponderar. Si `agr_ha_m = 0`, el score es 0 (no hay oportunidad agrícola real).

**Supuestos:**
- `agr_ha_m` (hectáreas agrícolas, millones) es un proxy de potencial de mercado — no datos satelitales ni catastro real, sino estimación por provincia ya cargada en `geo_utils.PROVINCE_AGR_HA_M`.
- Una provincia con mucha tierra agrícola pero bajo revenue/clientes tiene gap alto → score alto (oportunidad).
- Una provincia con alto revenue actual ya está "capturada" → gap bajo aunque tenga mucha tierra.

**Interpretación:**
| Rango | Etiqueta |
|---|---|
| 80–100 | Alta Oportunidad |
| 60–79 | Oportunidad Moderada |
| 40–59 | Oportunidad Baja |
| 0–39 | Mercado Maduro |

**Uso comercial:** input directo para priorizar campañas comerciales y fuerza de ventas hacia provincias de "Alta Oportunidad" antes que reforzar mercados ya maduros.

---

## 3. Expansion Index (`expansion_targets.json`)

**Qué mide:** prioridad de expansión territorial, cruzando potencial agrícola sin explotar con la presencia comercial actual.

**Fórmula:**
```
gap_score = agr_ha_m * (1 - min(n_activos / 200, 1))     # acotado a [0, agr_ha_m]
expansion_score = opportunity_score * min(gap_score / max(agr_ha_m, 1e-6), 1)
```

> **Nota técnica:** el módulo `spatial_analysis.py` ya tenía una función `territorial_gap_analysis()` con `gap_score = agr_ha / max(penetracion_idx, 1e-6)`. Esa fórmula explota a millones cuando `penetracion_idx = 0` (provincia sin revenue), porque divide por un epsilon en vez de acotar. `expansion_analysis.py` NO reutiliza esa función — calcula su propio `gap_score`, naturalmente acotado entre 0 y las hectáreas agrícolas totales de la provincia.

**Clasificación:**
| Prioridad | Condición |
|---|---|
| Alta | `agr_ha_m ≥ 1.0M` Y `gap_score ≥ 1.0` Y `n_activos ≤ 150` |
| Media | `agr_ha_m ≥ 0.3M` Y (`gap_score ≥ 0.3` O `n_activos ≤ 300`) |
| Baja | resto |

**Supuestos:**
- 200 clientes activos = penetración "plena" para fines de este índice (mismo supuesto que Coverage Score, por consistencia).
- Provincias sin agro (`agr_ha_m = 0`, ej. CABA) siempre caen en Baja.

**Uso comercial:** lista accionable de provincias candidatas a apertura de sucursal/depósito o campaña de adquisición agresiva. Ejemplo real detectado: Chaco, Santiago del Estero, Corrientes y Salta — alto potencial agrícola (1.8M–3.2M ha) y cero clientes activos.

---

## 4. Densidad Comercial / Revenue Density (`revenue_density.json`)

**Qué mide:** intensidad comercial por unidad de superficie.

**Fórmula:**
```
revenue_density = revenue_ars / area_km2          (ARS / km²)
density_score    = revenue_density / max(revenue_density) * 100
```
`area_km2` usa superficies oficiales IGN por provincia (constantes en `spatial_scores.PROVINCE_AREA_KM2`).

**Supuestos:**
- CABA se excluye del ranking por distorsión urbana (203 km², cualquier revenue allí infla la densidad artificialmente).
- No corrige por densidad poblacional ni uso real del suelo — es revenue total / área total.

**Uso comercial:** identifica provincias donde, además del volumen de revenue, hay alta eficiencia territorial (poca área para mucho negocio) — útil para benchmarking de eficiencia de red logística entre provincias de tamaño dispar.

---

## 5. Churn Geográfico (`churn_by_province.json`)

**Qué mide:** riesgo de pérdida de clientes agregado por provincia.

**Fórmula:**
```
churn_rate = (n_churned + n_en_riesgo) / n_total
```

**Clasificación:**
| Nivel | Condición |
|---|---|
| Low | `churn_rate ≤ 0.25` |
| Medium | `0.25 < churn_rate ≤ 0.35` |
| High | `churn_rate > 0.35` |
| Sin Datos | provincia sin clientes registrados (sin presencia comercial) |

**Supuestos:**
- Se itera sobre las 24 provincias del catálogo (`geo_utils.PROVINCE_CATALOGUE`), no solo las que aparecen en `Dim_Cliente.csv` — así se distingue "churn bajo" de "sin presencia", que son situaciones de negocio muy distintas.
- `n_en_riesgo` y `n_churned` provienen del campo `ciclo_vida` del cliente.

**Uso comercial:** monitoreo de salud comercial por región; cruzar con Coverage Score — una provincia con cobertura sólida y churn alto indica problema de servicio/calidad, no de alcance.

---

## Hallazgo de negocio (dato real, no sintético)

Solo 5 de las 24 provincias argentinas tienen presencia comercial de AgroNova (Buenos Aires, Santa Fe, Córdoba, Entre Ríos, La Pampa) — las mismas donde están las 5 sucursales. Las 19 provincias restantes tienen potencial agrícola relevante (Chaco 3.2M ha, Santiago del Estero 2.8M ha, Corrientes 2.0M ha, Salta 1.8M ha) y cero clientes: son exactamente las señales que Expansion Index y Opportunity Score están diseñados para capturar. Dentro de las 5 provincias activas, el churn es uniformemente "Low" (14%–21%), lo que sugiere que el negocio actual es sano pero la huella territorial es angosta.

## Alcance y límites de este sprint

- No se integró PostGIS, Google Maps, ArcGIS ni Google Earth Engine — todo el cálculo es pandas + haversine sobre CSVs locales.
- Los JSON se sirven estáticos desde `web/public/data/gis_outputs/` y se consumen client-side vía `fetch()` — no hay backend/API nueva.
- Para regenerar los outputs tras cambios en los CSV: `python -m gis.generate_analytics` desde la raíz del repo, y copiar los 5 JSON a `web/public/data/gis_outputs/`.

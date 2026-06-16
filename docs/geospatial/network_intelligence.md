# Network Intelligence (Sprint GIS-03)

Análisis logístico-territorial de la red comercial de AgroNova: matriz de
distancias, asignación a sucursal/depósito más cercano, distribución de
cobertura por radios, score de eficiencia logística, clustering territorial
y recomendaciones de expansión.

Módulos: `gis/network_analysis.py`, `gis/logistics_analysis.py`,
`gis/territorial_clustering.py`. Orquestación: `gis/generate_analytics.py`.
Sin PostGIS, sin Google Maps API, sin ArcGIS, sin Earth Engine — toda
distancia se calcula con Haversine puro (`gis/geo_utils.haversine_km`).

## Supuesto base: proxy de centroide provincial

`Dim_Cliente.csv` no tiene latitud/longitud por cliente. La columna `ciudad`
es una etiqueta sintética repetida idénticamente en las 24 provincias (no es
un geocódigo real — confirmado por inspección en GIS-02). Por lo tanto:

- Cada cliente se ubica en el **centroide de su provincia**
  (`gu.PROVINCE_CATALOGUE`), el mismo proxy usado en GIS-02 para
  `coverage_score.min_dist_suc_km`.
- Todos los clientes de una misma provincia comparten exactamente la misma
  distancia a cada sucursal/depósito.
- El clustering territorial opera sobre 24 puntos (centroides de provincia),
  no sobre coordenadas individuales de cliente.

Esta limitación se documenta explícitamente en cada output JSON y en los
docstrings de cada módulo — no se inventan coordenadas de cliente.

## 1. Distance Matrix — `gis/network_analysis.py::distance_matrix()`

Calcula distancia Haversine (km) en tres tramos, sólo entre las 5 provincias
comercialmente activas (con al menos 1 cliente) y la red física:

- `provincia_sucursal`: provincia (proxy cliente) ↔ cada una de las 5 sucursales
- `provincia_deposito`: provincia (proxy cliente) ↔ cada uno de los 3 depósitos
- `deposito_sucursal`: depósito ↔ sucursal

Output: `data/gis_outputs/distance_matrix.json` (espejo en
`web/public/data/gis_outputs/`).

**Nota de red**: sólo 3 de las 5 sucursales tienen depósito propio
(Rosario→depósito 1, Pergamino→depósito 2, Río Cuarto→depósito 4).
Mapeo en `DEPOSITO_SUCURSAL_MAP = {1: 1, 2: 2, 3: 4}`. Tandil y Paraná no
tienen depósito asociado.

## 2. Nearest Branch Assignment — `nearest_branch_assignment()`

Para cada provincia activa, encuentra la sucursal y el depósito más
cercanos por Haversine y agrega:

- `n_clientes`: clientes asignados geométricamente (por cercanía)
- `km_promedio`, `km_maximo`: distancia promedio/máxima a esa sucursal/depósito
- `n_clientes_real` (sólo en `by_sucursal`): conteo real desde
  `Dim_Cliente.sucursal_id_asignada` — la asignación comercial vigente, **no**
  derivada de distancia.

Output: `data/gis_outputs/nearest_branch.json`.

### Interpretación: divergencia geométrica vs. real

`n_clientes` (geométrico) y `n_clientes_real` (asignación comercial) difieren
sistemáticamente. Ejemplo: el centroide de Buenos Aires está a 145 km de
Tandil pero a 310 km de Pergamino — sin embargo Pergamino atiende clientes
reales de Buenos Aires. Rosario y Pergamino muestran `n_clientes = 0`
geométrico (ninguna provincia activa tiene su centroide más cerca de ellas
que de Tandil/Paraná/Río Cuarto) pero `n_clientes_real` de 1099 y 1012
respectivamente. Esta brecha es información útil: indica que la asignación
comercial actual no sigue pura proximidad geográfica — probablemente
responde a capacidad, historia comercial o disponibilidad de depósito.

## 3. Coverage Radius Analysis — `gis/logistics_analysis.py::coverage_radius_distribution()`

Clasifica la distancia de cada provincia activa a su sucursal más cercana en
4 buckets:

| Bucket | Rango |
|---|---|
| `0-50 km` | [0, 50) |
| `50-100 km` | [50, 100) |
| `100-200 km` | [100, 200) |
| `> 200 km` | [200, ∞) |

Devuelve distribución nacional (% de clientes por bucket) y detalle por
provincia. Output: `data/gis_outputs/coverage_distribution.json`.

## 4. Logistics Efficiency Score — `logistics_efficiency_score()`

Score compuesto 0–100 por sucursal, ponderado:

```
score = 35 · otif_pct
      + 25 · proximity_factor   = max(0, 1 − km_promedio / 700)
      + 20 · transit_factor     = max(0, 1 − dias_transito_prom / 10)
      + 20 · served_factor      = min(n_clientes / 1000, 1)
```

- `otif_pct` y `dias_transito_prom` vienen de `Fact_Logística`, agregados
  por depósito de origen y mapeados a su sucursal vía
  `DEPOSITO_SUCURSAL_MAP`.
- `km_promedio` y `n_clientes` vienen de `nearest_branch_assignment()`.
- Tope de 700 km y 10 días son los mismos caps usados en GIS-02
  (`coverage_score_by_province`) y un valor generoso (~3× el promedio real
  de tránsito observado de 2.5–3.5 días), respectivamente.

**Etiquetas**: Excelente (≥80) · Buena (≥60) · Mejorable (≥40) · Crítica (<40)
· **Sin Datos Logísticos** (sucursal sin depósito propio — Tandil, Paraná).

No se fabrica un score estimado para sucursales sin depósito: se etiquetan
explícitamente como sin datos, siguiendo el principio de no inventar cifras.

Output: `data/gis_outputs/logistics_score.json`.

## 5. Territorial Clustering — `gis/territorial_clustering.py::territorial_clusters()`

KMeans (`k=5`, `random_state=42`, `n_init=10`) sobre los 24 centroides
provinciales (lat/lon). Cada cluster se enriquece con:

- `n_activos_total`: suma de clientes activos en las provincias del cluster
- `agr_ha_m_total`: potencial agrícola combinado (millones de hectáreas)
- `avg_dist_sucursal_km`: distancia promedio a la sucursal más cercana

**Etiqueta de cluster**:
- `Cluster Comercial Activo` — tiene clientes activos
- `Zona Aislada de Alto Potencial` — sin clientes, ≥3.0M ha agrícolas combinadas
- `Zona Periférica de Bajo Potencial` — sin clientes, bajo potencial agrícola

Output: `data/gis_outputs/territorial_clusters.json`.

## 6. Expansion Recommendations — `expansion_recommendations(top_n=5)`

Reutiliza el **Expansion Index** de GIS-02
(`gis/expansion_analysis.py::expansion_index_by_province`), toma las
provincias con `expansion_priority == "Alta"` ordenadas por
`expansion_score` descendente, y mapea cada una a su ciudad capital/principal
(`PROVINCE_CAPITAL`, ej.: Salta→Salta, Chaco→Resistencia, Santiago del
Estero→Santiago del Estero, Corrientes→Corrientes).

Cada recomendación incluye una justificación textual generada con: potencial
agrícola, clientes activos actuales (0 por definición de "Alta prioridad"),
opportunity score, distancia a la sucursal más cercana y el cluster
territorial al que pertenece.

**Caveat de coordenadas**: la ciudad candidata reutiliza el centroide de la
provincia (mismo `PROVINCE_CATALOGUE` de GIS-02) — es una aproximación a la
ubicación real de la capital, no un geocódigo preciso de la ciudad.

Output: `data/gis_outputs/expansion_recommendations.json`.

## Casos de uso

- **Planificación de depósitos**: `nearest_branch.json` + `distance_matrix.json`
  identifican qué sucursales cargan clientes lejanos sin depósito propio
  (Tandil, Paraná) — candidatas a depósito nuevo.
- **Diagnóstico de eficiencia**: `logistics_score.json` rankea sucursales por
  desempeño combinado (servicio + proximidad + tránsito + volumen), separando
  honestamente las que no tienen datos suficientes.
- **Priorización de expansión**: `expansion_recommendations.json` da una
  lista corta y justificada de ciudades candidatas (Salta, Resistencia,
  Santiago del Estero, Corrientes, etc.) para discutir con comercial/logística.
- **Detección de zonas aisladas**: `territorial_clusters.json` separa
  clusters con alto potencial agrícola pero cero presencia comercial —
  oportunidades de red no capturadas por el análisis cliente-a-cliente.

## Limitaciones conocidas

1. Proxy de centroide provincial (no hay lat/lon por cliente) — toda
   distancia de cliente es una aproximación a nivel provincia.
2. Clustering KMeans opera sobre 24 puntos (provincias), no sobre la
   distribución real de clientes dentro de cada provincia.
3. `logistics_score` depende de `Fact_Logística`, que sólo cubre depósitos
   con operación registrada (3 de 5 sucursales).
4. Coordenadas de "ciudad candidata" en expansion_recommendations son el
   centroide provincial, no un geocódigo específico de la ciudad.

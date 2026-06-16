# Routing & Logistics Optimization Engine (Sprint GIS-06)

Capa de ruteo y optimización logística sobre la red existente (5 sucursales,
3 depósitos, 5 provincias comercialmente activas). Extiende
`network_analysis.py` (GIS-03) y `logistics_analysis.py` (GIS-04) con
tiempo/costo estimado por ruta, simulación de flota, riesgo de ruta y
simulación de apertura de 4 sucursales nuevas.

Sin Google Maps API, ArcGIS ni Earth Engine. Sin PostGIS real ejecutándose
(GIS-05 sigue sin instancia activa). Trabaja `feature/geospatial-v2`, no
toca `main`, no se despliega a producción.

## 1. Módulos

- **`gis/cost_model.py`** — constantes de costo/tiempo calibradas desde
  `Fact_Logística.csv` (200.000 filas), usadas para estimar rutas que hoy no
  existen (provincias sin sucursal).
- **`gis/fleet_simulation.py`** — tamaño de flota simulado por depósito
  (camiones necesarios, utilización) y carga de depósitos (saturación
  relativa).
- **`gis/routing_engine.py`** — asignación cliente → sucursal/depósito más
  cercano con tiempo estimado, y simulación de apertura de sucursales en
  Salta, Chaco (Resistencia), Corrientes y Santiago del Estero.

## 2. Misma limitación de datos que el resto de la capa GIS

`Dim_Cliente.csv` no tiene latitud/longitud por cliente — toda distancia usa
el centroide de provincia como proxy (igual que GIS-02/03/04). Esto es
deliberado y documentado desde GIS-02: a nivel provincia es la única
granularidad geográfica real disponible en el Data Warehouse.

## 3. Calibración de costos — qué es dato real y qué es asunción

| Constante | Valor | Origen |
|---|---|---|
| `COST_PER_KG_ARS` | ≈ 21.52 ARS/kg | **Dato real**: media de `costo_flete_ars / peso_kg` en las 200.000 filas de Fact_Logística. Distribución ajustada (8-35 ARS/kg) — driver confiable. |
| `AVG_SPEED_KMH` | 60.0 km/h | **Asunción documentada**, no calibrada desde los datos (ver §4). |
| `COST_PER_KM_ARS` | ≈ 34.07 ARS/km | **Aproximación**: promedio ponderado de ARS/km implícito sobre 15 pares depósito×región_destino. Ruidoso (rango 17-89 ARS/km por par) — usado solo para fines relativos/de simulación (ahorro de expansión), no como tarifa autoritativa. |
| `avg_peso_kg_envio()` | ≈ 502.4 kg | **Dato real**: media de `peso_kg`, usado como payload default. |
| `envios_promedio_cliente_anio()` | ≈ 4.55 | **Dato real, robusto**: 200.000 filas / 4.000 clientes únicos / 11 años — exactamente 50 envíos/cliente en toda la serie (2016-2026), perfectamente uniforme. Usado para proyectar volumen en provincias sin clientes hoy. |
| `TRUCK_CAPACITY_KG` | 28.000 kg | **Asunción documentada**: capacidad de carga neta de un semirremolque estándar para carga agro en Argentina. No hay datos de flota/vehículos en el Data Warehouse para calibrar esto. |
| `VIAJES_POR_CAMION_DIA` | 2.0 | **Asunción documentada**: un camión completa ~2 rutas de reparto regional por día en promedio. |

## 4. Por qué `AVG_SPEED_KMH` no se calibró desde los datos

Se intentó derivar una velocidad implícita real: distancia haversine entre
el depósito de origen y el centroide de la provincia destino, dividida por
`dias_transito_real × 24h`, agregada por par depósito×región. El resultado
fue ~6 km/h ponderado — implausible para transporte de carga por ruta.

La causa: `dias_transito_real` incluye tiempo de despacho/consolidación, no
solo tiempo de manejo, y los legs "región local" (depósito entregando dentro
de su propia provincia) dominan el conteo de filas con un piso casi fijo de
~1.16 días sin importar la (poca) distancia real involucrada. Calibrar
velocidad contra ese campo habría heredado ese piso y producido una
constante sin sentido físico. `AVG_SPEED_KMH = 60.0` queda como asunción
explícita (promedio típico de ruta de carga argentina, mezclando tramos de
autopista y caminos rurales/última milla) — documentada aquí en vez de
disfrazada de calibración.

## 5. Riesgo de ruta — `route_risk()`

`incidencia_score = pct_demorado + 2 × pct_devuelto` — un envío Devuelto pesa
el doble que uno Demorado, porque representa una entrega fallida, no solo
tardía. Con solo 3 depósitos y 3 tipos de envío, el ranking Alto/Medio/Bajo
es **relativo** entre esos pocos grupos (el de mayor score es "Alto", el
menor "Bajo") — no hay volumen suficiente para fijar umbrales absolutos con
significancia estadística. Mismo patrón de calibración por percentil/ranking
relativo ya usado en GIS-04 (`hotspot_analysis.py`) para n chico.

## 6. Carga de depósitos — `depot_load()`

`turnover_ratio = peso_diario_promedio_ton / capacidad_ton`
(`capacidad_ton` viene de `Dim_Depósito.csv`: Rosario 12.000, Pergamino
8.000, Río Cuarto 7.500). Mide cuántos días tardaría el throughput diario
promedio en llenar la capacidad de almacenamiento del depósito — un proxy de
saturación relativa. Con solo 3 depósitos, "Saturado (relativo)" /
"Subutilizado (relativo)" es un ranking entre esos 3, no un umbral absoluto
de capacidad logística de la industria.

## 7. Simulación de flota — `simulate_fleet_by_deposito()`

El tamaño de flota se dimensiona por **envíos/día** (dato real, calibrado),
no por tonelaje: el envío promedio (~502 kg) está muy por debajo de la
capacidad de un camión (28 t), así que la flota está limitada por cantidad
de paradas de reparto, no por peso transportado. `camiones_necesarios` usa
`math.ceil(viajes_diarios / VIAJES_POR_CAMION_DIA)`, con un piso de 1 camión
por depósito.

## 8. Simulación de expansión — `simulate_expansion()`

Simula la apertura de una sucursal nueva en cada una de las 4 provincias
nombradas por el sprint: Salta, Chaco (Resistencia), Corrientes y Santiago
del Estero. AgroNova no tiene presencia real en estas 4 provincias hoy (0
clientes en `Dim_Cliente.csv`) — todos los valores son **calculados, no
medidos**.

- **`ahorro_km`** — distancia actual centroide-de-provincia → sucursal más
  cercana, que se eliminaría al abrir una sucursal local.
- **`reduccion_tiempo_horas`** — `ahorro_km / AVG_SPEED_KMH`.
- **`mejora_proximidad_pts`** — delta en el componente de proximidad del
  Logistics Efficiency Score existente (25 pts, cap 700 km —
  `logistics_analysis.py`). **No es una proyección literal de mejora de
  OTIF.** Se verificó el score real de las 3 sucursales con depósito
  asociado: Río Cuarto (159.3 km promedio, 88.0% OTIF), Pergamino (0.0 km,
  88.1% OTIF), Rosario (0.0 km, 87.9% OTIF) — el OTIF real se mantiene
  prácticamente plano (~88%) sin importar la distancia. Con n=3 y varianza
  casi nula, ajustar una regresión distancia→OTIF sería estadísticamente
  deshonesto. `mejora_proximidad_pts` se reporta explícitamente como un
  **proxy** del potencial de mejora (mayor proximidad estructural a un punto
  de despacho), no como una proyección de OTIF.
- **`nuevos_clientes_potenciales`** — `gap_score` (hectáreas agrícolas sin
  cubrir, `expansion_analysis.py`) × densidad real de clientes/Mha
  agregada de las 5 provincias activas.
- **`envios_potenciales_anio`** — `nuevos_clientes_potenciales ×
  envios_promedio_cliente_anio()`.
- **`reduccion_costos_ars_anual`** — `ahorro_km × cost_per_km_ars() ×
  envios_potenciales_anio` — aproximado, hereda el ruido de
  `cost_per_km_ars()` (ver §3).

## 9. Outputs

| Archivo | Función | Contenido |
|---|---|---|
| `data/gis_outputs/transport_costs.json` | `cost_model.transport_costs_by_route()` | Costo/tiempo estimado por sucursal y por depósito, para las 5 provincias activas. |
| `data/gis_outputs/depot_load.json` | `fleet_simulation.depot_load()` | Turnover ratio y estado de carga por depósito. |
| `data/gis_outputs/route_risk.json` | `cost_model.route_risk()` | Incidencia de demoras/devoluciones por depósito y por tipo de envío. |
| `data/gis_outputs/expansion_simulations.json` | `routing_engine.simulate_expansion()` | Simulación de apertura de sucursal en las 4 provincias del sprint. |

Los 4 archivos se generan desde `gis/generate_analytics.py` (`run_all()`) y
se espejan a `web/public/data/gis_outputs/` para la pestaña "Routing" del
dashboard GIS (`web/components/gis/RoutingPanel.tsx`).

## 10. Frontend

Pestaña "Routing" agregada a `web/app/gis/page.tsx` (4to valor de
`rightTab`, junto a "ops"/"analytics"/"network"). Muestra costo logístico
estimado, carga de depósitos, riesgo de rutas e impacto de las 4 sucursales
candidatas — mismo patrón de fetch (`Promise.all` sobre los 4 JSON) y de UI
(glass-card, `tactical-text`, iconos `lucide-react`) que
`NetworkIntelligencePanel.tsx` (GIS-04).

## 11. Tests

`tests/test_routing_engine.py` — corre contra los datos reales del Data
Warehouse (sin mocks), validando rangos y consistencia estructural en vez de
valores fijos: estructura de cada output, no-negatividad de costos/tiempos,
cobertura de las 4 provincias de expansión, exactamente un depósito
"Saturado" y uno "Subutilizado" entre los 3, orden descendente de
`reduccion_costos_ars_anual`, etc.

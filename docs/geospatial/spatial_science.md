# Spatial Science Layer (Sprint GIS-04)

Capa geométrica real sobre la red comercial de AgroNova: GeoDataFrames,
buffers, cobertura geométrica (point-in-polygon), territorios Voronoi,
hotspots por densidad de kernel (KDE) y verificación geométrica de
candidatos de expansión.

Módulos: `gis/geodataframes.py`, `gis/spatial_operations.py`,
`gis/voronoi_analysis.py`, `gis/hotspot_analysis.py`. Orquestación:
`gis/generate_analytics.py`. Dependencias nuevas: `geopandas`, `shapely`,
`scipy`. Sin PostGIS, sin Google Maps API, sin ArcGIS, sin Earth Engine —
toda la geometría se calcula en proceso con GeoPandas/Shapely/SciPy puro.

## 1. GeoDataFrames — `gis/geodataframes.py`

Convierte las 4 entidades core en `geopandas.GeoDataFrame`:

| Función | Filas | Geometría |
|---|---|---|
| `sucursales_gdf()` | 5 | Point, lat/lon real (`Dim_Sucursal.csv`) |
| `depositos_gdf()` | 3 | Point, lat/lon real (`Dim_Depósito.csv`) |
| `provincias_gdf()` | 24 | Polygon/MultiPolygon, límites IGN |
| `clientes_gdf()` | 4000 | Point, centroide de provincia (proxy) |

**CRS**: todo se construye en `EPSG:4326` (WGS-84, `CRS_WGS84`). Las
operaciones métricas (buffers, áreas, KDE) reproyectan a `EPSG:5347`
(POSGAR 2007 / Argentina 5, meridiano central -60°), elegido porque 4 de
las 5 sucursales (Rosario, Pergamino, Tandil, Paraná) están a menos de
1.5° del meridiano central; Río Cuarto (-64.35°) es la más alejada (~4.3°)
e incurre algo más de distorsión de escala Transverse Mercator, pero un
buffer de prueba de 50 km reproduce el área ideal π·r² con un error
&lt;0.2% — suficiente para esta red sin recurrir a PostGIS.

**Supuesto de cliente**: igual que en GIS-02/03, `Dim_Cliente.csv` no tiene
lat/lon por cliente — cada cliente toma el centroide de su provincia. Los
4000 puntos de `clientes_gdf()` se apilan exactamente en 5 ubicaciones (una
por provincia activa), lo que se explota deliberadamente en el cálculo de
hotspots (ver sección 7).

**Recorte continental**: `provincias_gdf(clip_to_continental=True)`
(default) recorta cada provincia a `geo_utils.ARGENTINA_BBOX` antes de
devolverla. El polígono de Tierra del Fuego en el archivo IGN incluye el
reclamo antártico argentino y llega hasta -90° de latitud; reproyectado a
una Transverse Mercator (POSGAR) esa coordenada genera valores NaN/inf que
corrompen cualquier `union`/`intersects` posterior — no solo para Tierra
del Fuego, para *todas* las provincias del cálculo. El recorte al bbox
continental ya usado por el coroplético del frontend resuelve esto sin
introducir un límite nuevo.

## 2-3. Buffers — `gis/spatial_operations.py::coverage_buffers()`

Círculos de 50 / 100 / 150 km alrededor de cada sucursal. El buffer se
construye en `EPSG:5347` (metros) y se reproyecta a `EPSG:4326` para
exportar — un buffer hecho directamente en grados sería una elipse, no un
círculo, y se distorsionaría con la latitud.

Output: `data/gis_outputs/coverage_buffers.geojson` (15 features: 5
sucursales × 3 radios).

## 4. Cobertura geométrica real — `real_coverage_by_client()`

Para cada cliente (punto), test real de pertenencia (`Polygon.contains`)
contra la unión de buffers en cada radio — no la clasificación por
distancia Haversine de `coverage_distribution.json` (GIS-03). Es un
chequeo geométrico independiente de aquel cálculo.

Resultado: 3880/4000 clientes (97%) caen dentro del anillo de 150 km;
los 120 clientes de La Pampa quedan fuera de todo buffer. Coincide
prácticamente con la distribución de GIS-03, validando ambos cálculos por
métodos independientes (distancia analítica vs. geometría real).

Output: `data/gis_outputs/real_coverage.json`.

## 5. Voronoi Territories — `gis/voronoi_analysis.py::voronoi_territories()`

`shapely.voronoi_polygons()` sobre los 5 puntos de sucursal, extendido al
envelope de Argentina (`extend_to=country_boundary`) para que las celdas de
borde no queden sin acotar, y recortado a la unión real de las 24
provincias (continentales). Cada polígono resultante es el territorio
teórico que cubriría esa sucursal bajo asignación pura por vecino más
cercano — geométricamente independiente del `nearest_branch_assignment()`
de GIS-03 (que usa distancia Haversine sobre centroides, no un diagrama de
Voronoi real).

**Simplificación**: recortar contra el polígono IGN de resolución completa
hereda cada vértice del borde provincial compartido, y los bordes
provinciales vecinos que no comparten vértices idénticos dejan miles de
fragmentos microscópicos ("slivers") en las costuras. Una de las celdas
(Tandil) salió en 85 MB de MultiPolygon antes de aplicar
`simplify(3000, preserve_topology=True)` (tolerancia de 3 km, despreciable
a la escala de un territorio multi-provincial de cientos de miles de km²).
Tras simplificar, el archivo completo pesa ~630 KB.

Cada feature incluye `area_km2`, `n_clientes_territorio` (spatial join
contra `clientes_gdf`) y la lista de `provincias` que la celda toca.

Output: `data/gis_outputs/territories.geojson`.

## 6-7. Hotspots comerciales — `gis/hotspot_analysis.py::commercial_hotspots()`

KDE 2D (`scipy.stats.gaussian_kde`) sobre los 4000 puntos de cliente en
`EPSG:5347` (metros, para que el ancho de banda sea métrico). Como los
clientes están apilados en sus 5 centroides provinciales, el KDE pondera
automáticamente por *cantidad* de clientes sin necesitar un vector de pesos
manual: una provincia con 1564 clientes aporta 1564 veces la masa de
densidad de una con 1.

- Evalúa la densidad en una grilla regular sobre Argentina continental
  (80 celdas en el eje más largo).
- Se probó primero un umbral del percentil 90, pero la masa dominante de
  Buenos Aires (39% de los clientes) hace que ese umbral fusione las 5
  provincias activas en un solo blob indiferenciado de 4000 clientes — no
  aporta información. Se subió al **percentil 97** (el 3% de celdas más
  densas), que separa consistentemente 4 hotspots distintos.
- Las celdas "calientes" supervivientes se bufferizan 40 km y se disuelven
  (`shapely.ops.unary_union`) en polígonos discretos.
- `intensity_score` = densidad pico del polígono normalizada contra la
  densidad máxima global (100 = el punto más denso del país).

Resultado con los datos actuales: 4 hotspots — Buenos Aires (100.0, 1564
clientes), Santa Fe+Entre Ríos fusionados por proximidad (63.4, 1385
clientes), Córdoba (58.9, 931 clientes), La Pampa (7.6, 120 clientes). Los
4000 clientes quedan repartidos exactamente entre los 4 hotspots.

Output: `data/gis_outputs/hotspots.geojson`.

## 8. Candidatos a nueva sucursal — `candidate_branches()`

Capa de verificación geométrica sobre `expansion_recommendations()` de
GIS-03: para cada ciudad recomendada (Salta, Resistencia, Santiago del
Estero, Corrientes, etc.), un test real `Polygon.contains()` (Shapely) sobre
la unión de los anillos exteriores de 150 km — en vez de confiar en la
distancia Haversine al sucursal más cercana ya almacenada en la
recomendación.

Con los datos actuales, los 5 candidatos top quedan `fuera_cobertura_150km:
true` — ninguno está dentro del alcance de 150 km de ninguna sucursal
existente, lo que refuerza geométricamente la recomendación de negocio.

Output: `data/gis_outputs/candidate_branches.geojson`.

## Casos de uso

- **Validación cruzada**: `real_coverage.json` confirma con geometría real
  (point-in-polygon) lo que GIS-03 calculó con distancia Haversine —
  detecta si algún resultado anterior dependía de un error de cálculo.
- **Negociación de límites territoriales**: `territories.geojson` da el
  reparto teórico "vecino más cercano" entre sucursales, útil para discutir
  si la asignación comercial real (`Dim_Cliente.sucursal_id_asignada`)
  debería acercarse más a la geometría.
- **Priorización de hotspots**: `hotspots.geojson` rankea concentraciones
  reales de clientes por intensidad — útil para decidir dónde reforzar
  logística antes que dónde expandir.
- **Confirmación de expansión**: `candidate_branches.geojson` certifica
  geométricamente que las ciudades candidatas de GIS-03 están realmente
  fuera de la cobertura actual, no solo lejos en una métrica de distancia.

## Limitaciones conocidas

1. `clientes_gdf()` apila 4000 puntos en solo 5 ubicaciones (centroides de
   provincia) — todo análisis de densidad/cobertura es exacto a nivel
   provincia, no de cliente individual.
2. `EPSG:5347` es la mejor proyección *para esta red* (sucursales
   concentradas en Pampa/Litoral); no sería apropiada para análisis
   geométrico en Patagonia o el NOA profundo sin reevaluar el meridiano
   central.
3. El umbral de percentil 97 y el radio de fusión de 40 km en
   `commercial_hotspots()` se calibraron contra los 5 puntos de cliente
   actuales; si la base de clientes creciera a más provincias activas,
   estos valores deberían recalibrarse (documentado como constantes al
   inicio de `hotspot_analysis.py`).
4. `provincias_gdf()` recorta el reclamo antártico argentino por
   necesidad técnica (ver sección 1) — ningún resultado de este sprint
   contempla el territorio antártico.

-- =============================================================================
-- AgroNova v2.0 — Spatial Database Layer (Sprint GIS-05)
-- 04_spatial_views.sql
-- Vistas espaciales — version SQL de los calculos ya validados en Python
-- (gis/spatial_operations.py, gis/hotspot_analysis.py — Sprint GIS-04).
-- No son un analisis nuevo: sirven la misma logica calibrada desde la base
-- en vez de desde un archivo .geojson estatico. Ejecutar DESPUES de
-- 03_spatial_indexes.sql.
-- =============================================================================

SET search_path TO agronova, public;

-- ── vw_clientes_cobertura ─────────────────────────────────────────────────────
-- Para cada cliente: sucursal mas cercana, distancia en km, y bucket de
-- cobertura — equivalente SQL de real_coverage_by_client() (GIS-04).
-- El operador <-> en el ORDER BY del LATERAL usa el indice GIST (KNN),
-- evita comparar contra las 5 sucursales con un CROSS JOIN + agregacion.
CREATE OR REPLACE VIEW vw_clientes_cobertura AS
SELECT
    sc.cliente_id,
    sc.provincia,
    suc.sucursal_id   AS sucursal_mas_cercana_id,
    suc.nombre         AS sucursal_mas_cercana,
    ROUND((suc.distancia_m / 1000.0)::numeric, 1) AS distancia_km,
    CASE
        WHEN suc.distancia_m <= 50000  THEN '<= 50 km'
        WHEN suc.distancia_m <= 100000 THEN '<= 100 km'
        WHEN suc.distancia_m <= 150000 THEN '<= 150 km'
        ELSE '> 150 km'
    END AS bucket_cobertura
FROM spatial_clientes sc
CROSS JOIN LATERAL (
    SELECT su.sucursal_id, su.nombre,
           ST_Distance(su.geom::geography, sc.geom::geography) AS distancia_m
    FROM spatial_sucursales su
    ORDER BY su.geom <-> sc.geom
    LIMIT 1
) suc;
COMMENT ON VIEW vw_clientes_cobertura IS 'Cliente -> sucursal mas cercana + bucket 50/100/150 km (equivalente SQL de real_coverage_by_client)';

-- ── vw_revenue_provincia ──────────────────────────────────────────────────────
-- Revenue agregado por provincia via join espacial (ST_Contains) entre
-- spatial_clientes y spatial_provincias, cruzado con fact_ventas — algo que
-- la capa GeoPandas no puede hacer sin releer Fact_Ventas.csv en Python.
CREATE OR REPLACE VIEW vw_revenue_provincia AS
SELECT
    sp.provincia_id,
    sp.nombre               AS provincia,
    sp.macro_region,
    COUNT(DISTINCT fv.cliente_id) AS n_clientes_con_compras,
    COUNT(fv.venta_id)            AS n_ventas,
    SUM(fv.total_ars)             AS revenue_ars,
    SUM(fv.margen_bruto_ars)      AS margen_bruto_ars
FROM spatial_provincias sp
JOIN spatial_clientes sc ON ST_Contains(sp.geom, sc.geom)
JOIN fact_ventas fv      ON fv.cliente_id = sc.cliente_id
WHERE fv.estado = 'Completada'
GROUP BY sp.provincia_id, sp.nombre, sp.macro_region;
COMMENT ON VIEW vw_revenue_provincia IS 'Revenue de fact_ventas agregado por provincia via join espacial ST_Contains';

-- ── vw_hotspots ───────────────────────────────────────────────────────────────
-- Densidad de clientes por provincia, marcando como hotspot las provincias
-- en el percentil >=97 — mismo umbral calibrado en hotspot_analysis.py (GIS-04),
-- aproximado aqui por conteo en vez de KDE completo (ver limitacion en
-- postgis_architecture.md seccion 9).
CREATE OR REPLACE VIEW vw_hotspots AS
WITH conteo AS (
    SELECT sp.provincia_id, sp.nombre, sp.macro_region,
           COUNT(sc.cliente_id) AS n_clientes
    FROM spatial_provincias sp
    LEFT JOIN spatial_clientes sc ON ST_Contains(sp.geom, sc.geom)
    GROUP BY sp.provincia_id, sp.nombre, sp.macro_region
),
umbral AS (
    SELECT percentile_cont(0.97) WITHIN GROUP (ORDER BY n_clientes) AS p97
    FROM conteo
    WHERE n_clientes > 0
)
SELECT c.provincia_id, c.nombre, c.macro_region, c.n_clientes,
       (c.n_clientes > 0 AND c.n_clientes >= u.p97) AS es_hotspot
FROM conteo c, umbral u
ORDER BY c.n_clientes DESC;
COMMENT ON VIEW vw_hotspots IS 'Densidad de clientes por provincia, percentil 97 como umbral de hotspot (aproximacion SQL de commercial_hotspots)';

-- ── vw_expansion_targets ──────────────────────────────────────────────────────
-- Provincias cuyo centroide cae fuera del anillo de 150 km de toda sucursal
-- existente — equivalente SQL de candidate_branches() (GIS-04), a nivel
-- provincia en vez de ciudad candidata puntual.
CREATE OR REPLACE VIEW vw_expansion_targets AS
SELECT
    sp.provincia_id,
    sp.nombre AS provincia,
    sp.macro_region,
    sp.latitud,
    sp.longitud,
    NOT EXISTS (
        SELECT 1
        FROM spatial_sucursales su
        WHERE ST_DWithin(su.geom::geography, sp.geom::geography, 150000)
    ) AS fuera_cobertura_150km
FROM spatial_provincias sp
ORDER BY fuera_cobertura_150km DESC, sp.nombre;
COMMENT ON VIEW vw_expansion_targets IS 'Provincias fuera de 150 km de toda sucursal (equivalente SQL de candidate_branches, a nivel provincia)';

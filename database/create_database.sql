-- =============================================================================
-- AgroNova Argentina S.A. — Creacion de base de datos y schema
-- Objetivo: Preparar el entorno PostgreSQL / Neon para la plataforma BI
-- Ejecutar como superuser (postgres) ANTES que el resto de scripts
-- =============================================================================

-- ── 1. Base de datos ──────────────────────────────────────────────────────────
-- En Neon la DB viene creada; solo ejecutar localmente si es necesario
-- CREATE DATABASE agronova
--     WITH ENCODING = 'UTF8'
--          LC_COLLATE = 'es_AR.UTF-8'
--          LC_CTYPE   = 'es_AR.UTF-8'
--          TEMPLATE   = template0;

-- ── 2. Schema propio (aislamiento del schema public) ─────────────────────────
CREATE SCHEMA IF NOT EXISTS agronova;
COMMENT ON SCHEMA agronova IS 'Data Warehouse AgroNova Argentina S.A. — OLAP + BI layer';

-- ── 3. Roles y permisos ───────────────────────────────────────────────────────
-- Rol solo lectura para Power BI / Metabase
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'agronova_reader') THEN
        CREATE ROLE agronova_reader NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'agronova_etl') THEN
        CREATE ROLE agronova_etl NOLOGIN;
    END IF;
END $$;

GRANT USAGE ON SCHEMA agronova TO agronova_reader, agronova_etl;
GRANT SELECT ON ALL TABLES IN SCHEMA agronova TO agronova_reader;
GRANT SELECT, INSERT, UPDATE, TRUNCATE ON ALL TABLES IN SCHEMA agronova TO agronova_etl;
ALTER DEFAULT PRIVILEGES IN SCHEMA agronova
    GRANT SELECT ON TABLES TO agronova_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA agronova
    GRANT SELECT, INSERT, UPDATE, TRUNCATE ON TABLES TO agronova_etl;

-- ── 4. Extensiones ────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS btree_gin;

-- ── 5. ENUMs de dominio ───────────────────────────────────────────────────────
SET search_path TO agronova;

CREATE TYPE estado_venta     AS ENUM ('Completada','Cancelada','Devuelta','Pendiente');
CREATE TYPE canal_venta      AS ENUM ('Directo','Distribuidor','E-commerce','Telefono');
CREATE TYPE estado_compra    AS ENUM ('Recibida','Pendiente','Cancelada','En_transito');
CREATE TYPE estado_logistica AS ENUM ('Entregado','En_transito','Pendiente','Demorado','Cancelado');
CREATE TYPE rotacion_producto AS ENUM ('Alta','Media','Baja');
CREATE TYPE riesgo_tipo       AS ENUM ('Bajo','Medio','Alto','Critico');
CREATE TYPE tier_cliente       AS ENUM ('A','B','C','D');

-- ── 6. Tablas de dimensiones ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dim_fecha (
    fecha_id            INT         PRIMARY KEY,
    fecha               DATE        NOT NULL UNIQUE,
    año                 SMALLINT    NOT NULL CHECK (año BETWEEN 2016 AND 2030),
    semestre            SMALLINT    NOT NULL CHECK (semestre IN (1,2)),
    trimestre           SMALLINT    NOT NULL CHECK (trimestre BETWEEN 1 AND 4),
    mes                 SMALLINT    NOT NULL CHECK (mes BETWEEN 1 AND 12),
    mes_nombre          VARCHAR(20) NOT NULL,
    semana_iso          SMALLINT    NOT NULL,
    dia_mes             SMALLINT    NOT NULL CHECK (dia_mes BETWEEN 1 AND 31),
    dia_semana          SMALLINT    NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
    dia_nombre          VARCHAR(20) NOT NULL,
    es_fin_de_semana    BOOLEAN     NOT NULL DEFAULT FALSE,
    es_feriado          BOOLEAN     NOT NULL DEFAULT FALSE,
    es_dia_habil        BOOLEAN     NOT NULL DEFAULT TRUE,
    temporada_agricola  VARCHAR(30),
    factor_estacional   FLOAT       NOT NULL CHECK (factor_estacional > 0)
);
COMMENT ON TABLE dim_fecha IS 'Dimension tiempo con calendario agricola argentino';

CREATE TABLE IF NOT EXISTS dim_region (
    region_id           SMALLINT    PRIMARY KEY,
    nombre_region       VARCHAR(50) NOT NULL,
    provincia_principal VARCHAR(50) NOT NULL,
    area_km2            NUMERIC(10,2),
    potencial_agricola  VARCHAR(20)
);
COMMENT ON TABLE dim_region IS 'Regiones geograficas de operacion (PAM, NOA, NEA, CUY, PAT)';

CREATE TABLE IF NOT EXISTS dim_sucursal (
    sucursal_id         SMALLINT    PRIMARY KEY,
    nombre              VARCHAR(80) NOT NULL,
    ciudad              VARCHAR(50),
    provincia           VARCHAR(50) NOT NULL,
    region_id           SMALLINT    NOT NULL REFERENCES dim_region(region_id),
    lat                 FLOAT,
    lon                 FLOAT,
    superficie_m2       INT         CHECK (superficie_m2 > 0),
    activa              BOOLEAN     NOT NULL DEFAULT TRUE
);
COMMENT ON TABLE dim_sucursal IS 'Sucursales fisicas de AgroNova (Rosario, CABA, Cordoba, Mendoza, Salta)';

CREATE TABLE IF NOT EXISTS dim_deposito (
    deposito_id         SMALLINT    PRIMARY KEY,
    nombre              VARCHAR(80) NOT NULL,
    sucursal_id         SMALLINT    NOT NULL REFERENCES dim_sucursal(sucursal_id),
    capacidad_ton       INT         NOT NULL CHECK (capacidad_ton > 0),
    lat                 FLOAT,
    lon                 FLOAT,
    activo              BOOLEAN     NOT NULL DEFAULT TRUE
);
COMMENT ON TABLE dim_deposito IS 'Centros logisticos con capacidad en toneladas';

CREATE TABLE IF NOT EXISTS dim_vendedor (
    vendedor_id         SMALLINT    PRIMARY KEY,
    nombre              VARCHAR(50) NOT NULL,
    apellido            VARCHAR(50) NOT NULL,
    email               VARCHAR(100) NOT NULL UNIQUE,
    sucursal_id         SMALLINT    NOT NULL REFERENCES dim_sucursal(sucursal_id),
    categoria           VARCHAR(30) NOT NULL,
    activo              BOOLEAN     NOT NULL DEFAULT TRUE,
    fecha_ingreso       DATE
);
COMMENT ON TABLE dim_vendedor IS 'Fuerza de ventas por sucursal';

CREATE TABLE IF NOT EXISTS dim_proveedor (
    proveedor_id        SMALLINT    PRIMARY KEY,
    nombre_proveedor    VARCHAR(100) NOT NULL UNIQUE,
    tipo                VARCHAR(20)  NOT NULL CHECK (tipo IN ('Nacional','Internacional')),
    pais                VARCHAR(50)  NOT NULL,
    moneda_facturacion  CHAR(3)      NOT NULL DEFAULT 'ARS',
    activo              BOOLEAN      NOT NULL DEFAULT TRUE
);
COMMENT ON TABLE dim_proveedor IS '15 proveedores: 9 nacionales + 6 internacionales';

CREATE TABLE IF NOT EXISTS dim_producto (
    producto_id             CHAR(5)     PRIMARY KEY CHECK (producto_id ~ '^P[0-9]{4}$'),
    nombre_producto         VARCHAR(120) NOT NULL UNIQUE,
    categoria               VARCHAR(50)  NOT NULL,
    subcategoria            VARCHAR(60),
    proveedor_id            SMALLINT     REFERENCES dim_proveedor(proveedor_id),
    precio_usd_base_2016    FLOAT        NOT NULL CHECK (precio_usd_base_2016 > 0),
    margen_bruto_pct        FLOAT        NOT NULL CHECK (margen_bruto_pct BETWEEN 0 AND 1),
    rotacion                rotacion_producto NOT NULL DEFAULT 'Media',
    requiere_frio           BOOLEAN      NOT NULL DEFAULT FALSE,
    activo                  BOOLEAN      NOT NULL DEFAULT TRUE
);
COMMENT ON TABLE dim_producto IS '2500 SKUs agroquimicos y semillas';

CREATE TABLE IF NOT EXISTS dim_cliente (
    cliente_id          CHAR(6)     PRIMARY KEY CHECK (cliente_id ~ '^C[0-9]{5}$'),
    razon_social        VARCHAR(120) NOT NULL,
    cuit                VARCHAR(13)  NOT NULL UNIQUE CHECK (cuit ~ '^[0-9]{2}-[0-9]{8}-[0-9]$'),
    segmento            VARCHAR(30)  NOT NULL,
    ciclo_vida          VARCHAR(20)  NOT NULL,
    provincia           VARCHAR(50),
    region_id           SMALLINT     REFERENCES dim_region(region_id),
    año_alta            SMALLINT     NOT NULL CHECK (año_alta BETWEEN 2016 AND 2026),
    año_baja            SMALLINT     CHECK (año_baja > año_alta AND año_baja <= 2026),
    activo              BOOLEAN      NOT NULL DEFAULT TRUE,
    riesgo_crediticio   riesgo_tipo  NOT NULL DEFAULT 'Bajo',
    limite_credito_usd  FLOAT        CHECK (limite_credito_usd >= 0),
    volumen_factor      FLOAT        NOT NULL DEFAULT 1.0 CHECK (volumen_factor > 0),
    tier_cliente        tier_cliente NOT NULL DEFAULT 'C',
    superficie_ha       INT          CHECK (superficie_ha > 0)
);
COMMENT ON TABLE dim_cliente IS '4000 clientes: grandes productores, cooperativas, distribuidores, pymes';
COMMENT ON COLUMN dim_cliente.volumen_factor IS 'Factor de escala Pareto (A=8-20x, B=2-8x, C=0.5-2x, D=0.05-0.5x)';
COMMENT ON COLUMN dim_cliente.tier_cliente IS 'A=10% clientes, 77%+ revenue; B=20%; C=30%; D=40%';

-- ── 7. Tablas de hechos ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cotizaciones_externas (
    fecha               DATE        PRIMARY KEY,
    fecha_id            INT         NOT NULL REFERENCES dim_fecha(fecha_id),
    usd_ars_oficial     FLOAT       NOT NULL CHECK (usd_ars_oficial > 0),
    usd_ars_blue        FLOAT       CHECK (usd_ars_blue > 0),
    soja_cbot_usd_ton   FLOAT       CHECK (soja_cbot_usd_ton > 0),
    maiz_cbot_usd_ton   FLOAT       CHECK (maiz_cbot_usd_ton > 0),
    trigo_cbot_usd_ton  FLOAT       CHECK (trigo_cbot_usd_ton > 0),
    urea_fob_usd_ton    FLOAT       CHECK (urea_fob_usd_ton > 0),
    glifosato_usd_lt    FLOAT       CHECK (glifosato_usd_lt > 0)
);
COMMENT ON TABLE cotizaciones_externas IS 'TC diario BNA + commodities CBOT para analisis dolarizados';

CREATE TABLE IF NOT EXISTS fact_ventas (
    venta_id                BIGINT      PRIMARY KEY,
    fecha_id                INT         NOT NULL REFERENCES dim_fecha(fecha_id),
    cliente_id              CHAR(6)     NOT NULL REFERENCES dim_cliente(cliente_id),
    producto_id             CHAR(5)     NOT NULL REFERENCES dim_producto(producto_id),
    sucursal_id             SMALLINT    NOT NULL REFERENCES dim_sucursal(sucursal_id),
    vendedor_id             SMALLINT    NOT NULL REFERENCES dim_vendedor(vendedor_id),
    canal_venta             canal_venta NOT NULL DEFAULT 'Directo',
    estado                  estado_venta NOT NULL DEFAULT 'Completada',
    cantidad                INT         NOT NULL CHECK (cantidad > 0),
    precio_unitario_ars     FLOAT       NOT NULL CHECK (precio_unitario_ars > 0),
    precio_unitario_usd     FLOAT       NOT NULL CHECK (precio_unitario_usd > 0),
    descuento_pct           FLOAT       NOT NULL DEFAULT 0 CHECK (descuento_pct BETWEEN 0 AND 0.20),
    total_ars               FLOAT       NOT NULL CHECK (total_ars > 0),
    total_usd               FLOAT       NOT NULL CHECK (total_usd > 0),
    margen_bruto_ars        FLOAT       NOT NULL CHECK (margen_bruto_ars >= 0),
    nro_factura             VARCHAR(20)
);
COMMENT ON TABLE fact_ventas IS '1.500.000 transacciones 2016-2026 con estacionalidad agricola';

CREATE TABLE IF NOT EXISTS fact_compras (
    compra_id               INT         PRIMARY KEY,
    fecha_id                INT         NOT NULL REFERENCES dim_fecha(fecha_id),
    proveedor_id            SMALLINT    NOT NULL REFERENCES dim_proveedor(proveedor_id),
    producto_id             CHAR(5)     NOT NULL REFERENCES dim_producto(producto_id),
    deposito_destino_id     SMALLINT    NOT NULL REFERENCES dim_deposito(deposito_id),
    estado                  estado_compra NOT NULL DEFAULT 'Recibida',
    cantidad                INT         NOT NULL CHECK (cantidad > 0),
    precio_compra_ars       FLOAT       NOT NULL CHECK (precio_compra_ars > 0),
    precio_compra_usd       FLOAT       CHECK (precio_compra_usd > 0),
    total_ars               FLOAT       NOT NULL CHECK (total_ars > 0),
    total_usd               FLOAT       CHECK (total_usd > 0),
    nro_orden_compra        VARCHAR(20),
    puerto_ingreso          VARCHAR(50)
);
COMMENT ON TABLE fact_compras IS 'Ordenes de compra a los 15 proveedores';

CREATE TABLE IF NOT EXISTS fact_inventario (
    inventario_id           BIGINT      PRIMARY KEY,
    fecha_id                INT         NOT NULL REFERENCES dim_fecha(fecha_id),
    producto_id             CHAR(5)     NOT NULL REFERENCES dim_producto(producto_id),
    deposito_id             SMALLINT    NOT NULL REFERENCES dim_deposito(deposito_id),
    stock_actual            INT         NOT NULL CHECK (stock_actual >= 0),
    stock_minimo            INT         NOT NULL CHECK (stock_minimo >= 0),
    stock_maximo            INT         NOT NULL CHECK (stock_maximo >= stock_minimo),
    valor_stock_ars         FLOAT       NOT NULL CHECK (valor_stock_ars >= 0),
    merma_pct               FLOAT       NOT NULL DEFAULT 0 CHECK (merma_pct BETWEEN 0 AND 0.10),
    bajo_minimo             BOOLEAN GENERATED ALWAYS AS (stock_actual < stock_minimo) STORED,
    UNIQUE (fecha_id, producto_id, deposito_id)
);
COMMENT ON TABLE fact_inventario IS 'Snapshot diario de inventario por producto y deposito';
COMMENT ON COLUMN fact_inventario.bajo_minimo IS 'GENERATED: TRUE cuando stock_actual < stock_minimo';

CREATE TABLE IF NOT EXISTS fact_logistica (
    logistica_id            BIGINT      PRIMARY KEY,
    fecha_despacho_id       INT         NOT NULL REFERENCES dim_fecha(fecha_id),
    fecha_entrega_id        INT         REFERENCES dim_fecha(fecha_id),
    cliente_id              CHAR(6)     NOT NULL REFERENCES dim_cliente(cliente_id),
    deposito_origen_id      SMALLINT    NOT NULL REFERENCES dim_deposito(deposito_id),
    region_destino_id       SMALLINT    NOT NULL REFERENCES dim_region(region_id),
    transportista           VARCHAR(80),
    estado                  estado_logistica NOT NULL DEFAULT 'Entregado',
    dias_transito_base      SMALLINT    NOT NULL CHECK (dias_transito_base BETWEEN 1 AND 30),
    dias_transito_real      SMALLINT    GENERATED ALWAYS AS (
                                dias_transito_base +
                                CASE WHEN fecha_entrega_id IS NOT NULL
                                     THEN 0
                                     ELSE 0 END
                            ) STORED,
    costo_flete_ars         FLOAT       NOT NULL CHECK (costo_flete_ars > 0),
    peso_kg                 FLOAT       CHECK (peso_kg > 0),
    volumen_m3              FLOAT       CHECK (volumen_m3 > 0)
);
COMMENT ON TABLE fact_logistica IS 'Despachos y entregas con seguimiento de transito';
COMMENT ON COLUMN fact_logistica.dias_transito_real IS 'GENERATED: base + demora calculada';

COMMENT ON TABLE cotizaciones_externas IS 'TC oficial BNA + commodities agricolas CBOT para dolarizacion de ventas';

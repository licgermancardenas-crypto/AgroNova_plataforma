-- ============================================================
-- AgroNova Argentina S.A. - DDL Productivo
-- PostgreSQL 14+ / Neon
-- Incluye: schema, tipos, PKs, FKs, checks, indices, comentarios
-- ============================================================

CREATE SCHEMA IF NOT EXISTS agronova;
SET search_path TO agronova;

-- ── Enums para columnas categoricas clave ─────────────────────────

DO $$ BEGIN
    CREATE TYPE estado_venta AS ENUM ('Facturada','Entregada','Cancelada','Pendiente');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE canal_venta AS ENUM ('Comercial Directo','Portal B2B','Televentas');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE estado_compra AS ENUM ('Recibida','En tránsito','Pendiente','Cancelada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE estado_logistica AS ENUM ('Entregado','En tránsito','Demorado','Devuelto');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE rotacion_producto AS ENUM ('Alta','Media','Baja');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE riesgo_tipo AS ENUM ('Bajo','Medio','Alto');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE tier_cliente AS ENUM ('A','B','C','D');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Tablas de dimensiones ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dim_fecha (
    fecha_id              INTEGER       PRIMARY KEY
        CONSTRAINT ck_fecha_id CHECK (fecha_id BETWEEN 20160101 AND 20261231),
    fecha                 DATE          NOT NULL UNIQUE,
    año                   SMALLINT      NOT NULL CHECK (año BETWEEN 2016 AND 2026),
    semestre              SMALLINT      NOT NULL CHECK (semestre IN (1, 2)),
    trimestre             SMALLINT      NOT NULL CHECK (trimestre BETWEEN 1 AND 4),
    mes                   SMALLINT      NOT NULL CHECK (mes BETWEEN 1 AND 12),
    mes_nombre            VARCHAR(20)   NOT NULL,
    semana_iso            SMALLINT      NOT NULL CHECK (semana_iso BETWEEN 1 AND 53),
    dia_año               SMALLINT      NOT NULL CHECK (dia_año BETWEEN 1 AND 366),
    dia_semana            SMALLINT      NOT NULL CHECK (dia_semana BETWEEN 1 AND 7),
    dia_semana_nombre     VARCHAR(15)   NOT NULL,
    es_feriado            BOOLEAN       NOT NULL DEFAULT FALSE,
    es_fin_de_semana      BOOLEAN       NOT NULL DEFAULT FALSE,
    es_dia_habil          BOOLEAN       NOT NULL DEFAULT TRUE,
    temporada             VARCHAR(20)   NOT NULL,
    temporada_agricola    VARCHAR(60)   NOT NULL,
    factor_estacional     NUMERIC(5,4)  NOT NULL CHECK (factor_estacional > 0)
);

COMMENT ON TABLE dim_fecha IS 'Dimension tiempo 2016-2026 con calendario agricola argentino';
COMMENT ON COLUMN dim_fecha.factor_estacional IS 'Peso de demanda mensual: pico Oct-Nov (siembra verano), Apr-May (cosecha)';

-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dim_region (
    region_id                     SMALLINT     PRIMARY KEY,
    nombre_region                 VARCHAR(60)  NOT NULL,
    provincia_principal           VARCHAR(50)  NOT NULL,
    ciudades                      TEXT,
    superficie_km2                INTEGER      CHECK (superficie_km2 > 0),
    hectareas_prod_estimadas      INTEGER      CHECK (hectareas_prod_estimadas > 0),
    cultivo_principal             VARCHAR(60),
    peso_comercial_pct            NUMERIC(5,4) CHECK (peso_comercial_pct BETWEEN 0 AND 1)
);

COMMENT ON TABLE dim_region IS '5 regiones comerciales de AgroNova en la Region Centro Argentina';

-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dim_sucursal (
    sucursal_id           SMALLINT     PRIMARY KEY,
    nombre                VARCHAR(60)  NOT NULL,
    provincia             VARCHAR(50)  NOT NULL,
    region_id             SMALLINT     NOT NULL REFERENCES dim_region(region_id),
    lat                   NUMERIC(10,6) CHECK (lat BETWEEN -90 AND 90),
    lon                   NUMERIC(10,6) CHECK (lon BETWEEN -180 AND 180),
    fecha_apertura        DATE,
    superficie_m2         INTEGER      CHECK (superficie_m2 > 0),
    empleados_totales     SMALLINT     CHECK (empleados_totales >= 0),
    estado                VARCHAR(20)  NOT NULL DEFAULT 'Activa'
);

COMMENT ON TABLE dim_sucursal IS '5 sucursales: Rosario, Pergamino, Tandil, Rio Cuarto, Parana';

-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dim_deposito (
    deposito_id           SMALLINT     PRIMARY KEY,
    nombre                VARCHAR(60)  NOT NULL,
    sucursal_id           SMALLINT     NOT NULL REFERENCES dim_sucursal(sucursal_id),
    lat                   NUMERIC(10,6),
    lon                   NUMERIC(10,6),
    capacidad_ton         INTEGER      CHECK (capacidad_ton > 0),
    fecha_habilitacion    DATE,
    tipo                  VARCHAR(60),
    muelles_carga         SMALLINT     CHECK (muelles_carga >= 0),
    temperatura_controlada BOOLEAN     DEFAULT FALSE,
    certificaciones       TEXT,
    estado                VARCHAR(20)  DEFAULT 'Operativo'
);

COMMENT ON TABLE dim_deposito IS '3 centros logisticos: Rosario (12kt), Pergamino (8kt), Rio Cuarto (7.5kt)';

-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dim_vendedor (
    vendedor_id           INTEGER      PRIMARY KEY,
    nombre                VARCHAR(60)  NOT NULL,
    apellido              VARCHAR(60)  NOT NULL,
    email                 VARCHAR(120) UNIQUE,
    telefono              VARCHAR(30),
    sucursal_id           SMALLINT     NOT NULL REFERENCES dim_sucursal(sucursal_id),
    zona_asignada         VARCHAR(60),
    categoria             VARCHAR(20)  CHECK (categoria IN ('Junior','Semi Senior','Senior','Key Account')),
    año_ingreso           SMALLINT     CHECK (año_ingreso >= 2012),
    activo                BOOLEAN      DEFAULT TRUE,
    salario_base_ars_2016 INTEGER      CHECK (salario_base_ars_2016 > 0)
);

COMMENT ON TABLE dim_vendedor IS '48 vendedores distribuidos en 5 sucursales, 4 categorias';

-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dim_proveedor (
    proveedor_id          SMALLINT     PRIMARY KEY,
    nombre_proveedor      VARCHAR(100) NOT NULL UNIQUE,
    tipo                  VARCHAR(20)  NOT NULL CHECK (tipo IN ('Nacional','Internacional')),
    pais                  VARCHAR(50),
    provincia             VARCHAR(50),
    ciudad                VARCHAR(50),
    puerto_ingreso        VARCHAR(80),
    moneda_operacion      VARCHAR(5)   CHECK (moneda_operacion IN ('ARS','USD','EUR','BRL')),
    categorias_supply     TEXT,
    plazo_entrega_dias    SMALLINT     CHECK (plazo_entrega_dias > 0),
    condicion_pago        VARCHAR(40),
    calificacion          NUMERIC(3,1) CHECK (calificacion BETWEEN 1 AND 5),
    activo                BOOLEAN      DEFAULT TRUE
);

COMMENT ON TABLE dim_proveedor IS '15 proveedores: 9 nacionales (ARG) + 6 internacionales (BR/US/CN/DE)';

-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dim_producto (
    producto_id               VARCHAR(6)   PRIMARY KEY
        CONSTRAINT ck_prod_id CHECK (producto_id ~ '^P[0-9]{4}$'),
    nombre_producto           VARCHAR(120) NOT NULL,
    categoria                 VARCHAR(40)  NOT NULL,
    subcategoria              VARCHAR(60)  NOT NULL,
    unidad_medida             VARCHAR(30),
    precio_usd_base_2016      NUMERIC(12,2) CHECK (precio_usd_base_2016 > 0),
    margen_bruto_pct          NUMERIC(6,4)  CHECK (margen_bruto_pct BETWEEN 0 AND 1),
    proveedor_id_principal    SMALLINT     REFERENCES dim_proveedor(proveedor_id),
    rotacion                  rotacion_producto,
    requiere_frio             BOOLEAN      DEFAULT FALSE,
    estacionalidad_alta       TEXT,
    activo                    BOOLEAN      DEFAULT TRUE
);

COMMENT ON TABLE dim_producto IS '2.500 productos en 5 categorias: Fertilizantes, Fitosanitarios, Semillas, Nutricion Vegetal, Tecnologia Agricola';

-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dim_cliente (
    cliente_id                VARCHAR(7)   PRIMARY KEY
        CONSTRAINT ck_cli_id CHECK (cliente_id ~ '^C[0-9]{5}$'),
    razon_social              VARCHAR(150) NOT NULL,
    segmento                  VARCHAR(40)  NOT NULL,
    ciclo_vida                VARCHAR(30),
    provincia                 VARCHAR(50),
    ciudad                    VARCHAR(60),
    sucursal_id_asignada      SMALLINT     REFERENCES dim_sucursal(sucursal_id),
    año_alta                  SMALLINT     CHECK (año_alta BETWEEN 2010 AND 2026),
    año_baja                  SMALLINT     CHECK (año_baja IS NULL OR año_baja > año_alta),
    activo                    BOOLEAN      DEFAULT TRUE,
    riesgo_crediticio         riesgo_tipo,
    superficie_ha             INTEGER      CHECK (superficie_ha IS NULL OR superficie_ha > 0),
    email                     VARCHAR(120),
    telefono                  VARCHAR(30),
    cuit                      VARCHAR(15),
    volumen_factor            NUMERIC(8,4) DEFAULT 1.0
        CONSTRAINT ck_vol_factor CHECK (volumen_factor > 0),
    tier_cliente              tier_cliente
);

COMMENT ON TABLE dim_cliente IS '4.000 clientes con ciclo de vida, tier Pareto (A-D) y volumen_factor para concentracion 80/20';
COMMENT ON COLUMN dim_cliente.volumen_factor IS 'Factor multiplicador de cantidad: tier A=8-20x, B=2-8x, C=0.5-2x, D=0.05-0.5x';
COMMENT ON COLUMN dim_cliente.tier_cliente   IS 'A=top10%, B=sig20%, C=sig30%, D=bot40% segun volumen de compra';

-- ── Tablas de hechos ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fact_ventas (
    venta_id              BIGINT        PRIMARY KEY,
    fecha_id              INTEGER       NOT NULL REFERENCES dim_fecha(fecha_id),
    cliente_id            VARCHAR(7)    NOT NULL REFERENCES dim_cliente(cliente_id),
    producto_id           VARCHAR(6)    NOT NULL REFERENCES dim_producto(producto_id),
    sucursal_id           SMALLINT      NOT NULL REFERENCES dim_sucursal(sucursal_id),
    vendedor_id           INTEGER       NOT NULL REFERENCES dim_vendedor(vendedor_id),
    cantidad              INTEGER       NOT NULL CHECK (cantidad > 0),
    precio_unitario_ars   NUMERIC(16,2) NOT NULL CHECK (precio_unitario_ars > 0),
    precio_unitario_usd   NUMERIC(12,2) NOT NULL CHECK (precio_unitario_usd > 0),
    descuento_pct         NUMERIC(6,4)  NOT NULL DEFAULT 0
        CHECK (descuento_pct BETWEEN 0 AND 0.5),
    total_ars             NUMERIC(18,2) NOT NULL CHECK (total_ars >= 0),
    total_usd             NUMERIC(14,2) NOT NULL CHECK (total_usd >= 0),
    margen_bruto_ars      NUMERIC(18,2) CHECK (margen_bruto_ars >= 0),
    canal                 canal_venta,
    estado                estado_venta
);

COMMENT ON TABLE fact_ventas IS '1.500.000 transacciones de venta 2016-2026 con estacionalidad agricola e inflacion ARS';

-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fact_compras (
    compra_id                 BIGINT        PRIMARY KEY,
    fecha_id                  INTEGER       NOT NULL REFERENCES dim_fecha(fecha_id),
    proveedor_id              SMALLINT      NOT NULL REFERENCES dim_proveedor(proveedor_id),
    producto_id               VARCHAR(6)    NOT NULL REFERENCES dim_producto(producto_id),
    deposito_destino_id       SMALLINT      NOT NULL REFERENCES dim_deposito(deposito_id),
    cantidad                  INTEGER       NOT NULL CHECK (cantidad > 0),
    precio_unitario_usd       NUMERIC(12,2) NOT NULL CHECK (precio_unitario_usd > 0),
    precio_unitario_ars       NUMERIC(16,2) NOT NULL CHECK (precio_unitario_ars > 0),
    descuento_proveedor_pct   NUMERIC(6,4)  DEFAULT 0 CHECK (descuento_proveedor_pct BETWEEN 0 AND 0.5),
    total_usd                 NUMERIC(14,2) NOT NULL CHECK (total_usd >= 0),
    total_ars                 NUMERIC(18,2) NOT NULL CHECK (total_ars >= 0),
    plazo_entrega_dias        SMALLINT      CHECK (plazo_entrega_dias > 0),
    estado                    estado_compra
);

COMMENT ON TABLE fact_compras IS '150.000 ordenes de compra a 15 proveedores 2016-2026';

-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fact_inventario (
    inventario_id         BIGINT        PRIMARY KEY,
    fecha_id              INTEGER       NOT NULL REFERENCES dim_fecha(fecha_id),
    producto_id           VARCHAR(6)    NOT NULL REFERENCES dim_producto(producto_id),
    deposito_id           SMALLINT      NOT NULL REFERENCES dim_deposito(deposito_id),
    stock_actual          INTEGER       NOT NULL DEFAULT 0 CHECK (stock_actual >= 0),
    stock_minimo          INTEGER       CHECK (stock_minimo >= 0),
    stock_maximo          INTEGER       CHECK (stock_maximo >= 0),
    bajo_minimo           BOOLEAN       GENERATED ALWAYS AS (stock_actual < stock_minimo) STORED,
    valor_stock_ars       NUMERIC(18,2) CHECK (valor_stock_ars >= 0),
    valor_stock_usd       NUMERIC(14,2) CHECK (valor_stock_usd >= 0),
    merma_pct             NUMERIC(6,4)  DEFAULT 0 CHECK (merma_pct BETWEEN 0 AND 1),
    UNIQUE (fecha_id, producto_id, deposito_id)
);

COMMENT ON TABLE fact_inventario IS 'Snapshots mensuales de stock por deposito. bajo_minimo: columna generada automaticamente';

-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fact_logistica (
    logistica_id          BIGINT        PRIMARY KEY,
    fecha_despacho_id     INTEGER       NOT NULL REFERENCES dim_fecha(fecha_id),
    cliente_id            VARCHAR(7)    NOT NULL REFERENCES dim_cliente(cliente_id),
    deposito_origen_id    SMALLINT      NOT NULL REFERENCES dim_deposito(deposito_id),
    region_destino_id     SMALLINT      NOT NULL REFERENCES dim_region(region_id),
    transportista         VARCHAR(60),
    tipo_envio            VARCHAR(20)   CHECK (tipo_envio IN ('Terrestre','Ferroviario','Fluvial')),
    peso_kg               INTEGER       CHECK (peso_kg > 0),
    dias_transito_base    SMALLINT      CHECK (dias_transito_base > 0),
    dias_demora           SMALLINT      DEFAULT 0 CHECK (dias_demora >= 0),
    dias_transito_real    SMALLINT
        GENERATED ALWAYS AS (dias_transito_base + dias_demora) STORED,
    costo_flete_ars       NUMERIC(14,2) CHECK (costo_flete_ars >= 0),
    estado                estado_logistica
);

COMMENT ON TABLE fact_logistica IS '200.000 envios. dias_transito_real: columna generada (base + demora)';

-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cotizaciones_externas (
    fecha                 DATE          PRIMARY KEY,
    fecha_id              INTEGER       NOT NULL REFERENCES dim_fecha(fecha_id) UNIQUE,
    usd_ars_oficial       NUMERIC(12,2) CHECK (usd_ars_oficial > 0),
    usd_ars_blue          NUMERIC(12,2) CHECK (usd_ars_blue > 0),
    soja_cbot_usd_ton     NUMERIC(10,2) CHECK (soja_cbot_usd_ton > 0),
    maiz_cbot_usd_ton     NUMERIC(10,2) CHECK (maiz_cbot_usd_ton > 0),
    trigo_cbot_usd_ton    NUMERIC(10,2) CHECK (trigo_cbot_usd_ton > 0),
    urea_fob_usd_ton      NUMERIC(10,2) CHECK (urea_fob_usd_ton > 0)
);

COMMENT ON TABLE cotizaciones_externas IS 'Serie historica diaria: USD/ARS oficial+blue, CBOT granos, urea FOB. 2016-2026';

-- ── Indices de performance ────────────────────────────────────────

-- Fact_Ventas: patron de acceso principal (fecha, cliente, producto, sucursal)
CREATE INDEX IF NOT EXISTS idx_fv_fecha       ON fact_ventas(fecha_id);
CREATE INDEX IF NOT EXISTS idx_fv_cliente     ON fact_ventas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_fv_producto    ON fact_ventas(producto_id);
CREATE INDEX IF NOT EXISTS idx_fv_sucursal    ON fact_ventas(sucursal_id);
CREATE INDEX IF NOT EXISTS idx_fv_vendedor    ON fact_ventas(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_fv_estado      ON fact_ventas(estado);
-- Indice compuesto para queries de revenue temporal
CREATE INDEX IF NOT EXISTS idx_fv_fecha_suc   ON fact_ventas(fecha_id, sucursal_id);
CREATE INDEX IF NOT EXISTS idx_fv_cli_fecha   ON fact_ventas(cliente_id, fecha_id);

-- Fact_Compras
CREATE INDEX IF NOT EXISTS idx_fc_fecha       ON fact_compras(fecha_id);
CREATE INDEX IF NOT EXISTS idx_fc_proveedor   ON fact_compras(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_fc_producto    ON fact_compras(producto_id);
CREATE INDEX IF NOT EXISTS idx_fc_deposito    ON fact_compras(deposito_destino_id);

-- Fact_Inventario
CREATE INDEX IF NOT EXISTS idx_fi_fecha       ON fact_inventario(fecha_id);
CREATE INDEX IF NOT EXISTS idx_fi_deposito    ON fact_inventario(deposito_id);
CREATE INDEX IF NOT EXISTS idx_fi_bajo_min    ON fact_inventario(bajo_minimo) WHERE bajo_minimo = TRUE;

-- Fact_Logistica
CREATE INDEX IF NOT EXISTS idx_fl_fecha       ON fact_logistica(fecha_despacho_id);
CREATE INDEX IF NOT EXISTS idx_fl_cliente     ON fact_logistica(cliente_id);
CREATE INDEX IF NOT EXISTS idx_fl_region      ON fact_logistica(region_destino_id);
CREATE INDEX IF NOT EXISTS idx_fl_estado      ON fact_logistica(estado);

-- Dim_Cliente
CREATE INDEX IF NOT EXISTS idx_dc_segmento    ON dim_cliente(segmento);
CREATE INDEX IF NOT EXISTS idx_dc_tier        ON dim_cliente(tier_cliente);
CREATE INDEX IF NOT EXISTS idx_dc_ciclo       ON dim_cliente(ciclo_vida);
CREATE INDEX IF NOT EXISTS idx_dc_sucursal    ON dim_cliente(sucursal_id_asignada);
CREATE INDEX IF NOT EXISTS idx_dc_activo      ON dim_cliente(activo);

-- Dim_Producto
CREATE INDEX IF NOT EXISTS idx_dp_categoria   ON dim_producto(categoria);
CREATE INDEX IF NOT EXISTS idx_dp_rotacion    ON dim_producto(rotacion);
CREATE INDEX IF NOT EXISTS idx_dp_activo      ON dim_producto(activo);

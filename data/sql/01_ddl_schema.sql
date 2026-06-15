-- ============================================================
-- AgroNova Argentina S.A. — Star Schema DDL
-- Compatible: PostgreSQL 14+, Neon, Snowflake (minor tweaks)
-- ============================================================

CREATE SCHEMA IF NOT EXISTS agronova;
SET search_path TO agronova;

-- ── Dimensiones ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dim_fecha (
    fecha_id              INTEGER PRIMARY KEY,
    fecha                 DATE NOT NULL,
    año                   SMALLINT NOT NULL,
    semestre              SMALLINT NOT NULL,
    trimestre             SMALLINT NOT NULL,
    mes                   SMALLINT NOT NULL,
    mes_nombre            VARCHAR(20) NOT NULL,
    semana_iso            SMALLINT NOT NULL,
    dia_año               SMALLINT NOT NULL,
    dia_semana            SMALLINT NOT NULL,
    dia_semana_nombre     VARCHAR(15) NOT NULL,
    es_feriado            BOOLEAN NOT NULL DEFAULT FALSE,
    es_fin_de_semana      BOOLEAN NOT NULL DEFAULT FALSE,
    es_dia_habil          BOOLEAN NOT NULL DEFAULT TRUE,
    temporada             VARCHAR(20) NOT NULL,
    temporada_agricola    VARCHAR(50) NOT NULL,
    factor_estacional     NUMERIC(5,4) NOT NULL
);

CREATE TABLE IF NOT EXISTS dim_region (
    region_id                     SMALLINT PRIMARY KEY,
    nombre_region                 VARCHAR(60) NOT NULL,
    provincia_principal           VARCHAR(50) NOT NULL,
    ciudades                      TEXT,
    superficie_km2                INTEGER,
    hectareas_prod_estimadas      INTEGER,
    cultivo_principal             VARCHAR(60),
    peso_comercial_pct            NUMERIC(5,4)
);

CREATE TABLE IF NOT EXISTS dim_sucursal (
    sucursal_id           SMALLINT PRIMARY KEY,
    nombre                VARCHAR(60) NOT NULL,
    provincia             VARCHAR(50) NOT NULL,
    region_id             SMALLINT REFERENCES dim_region(region_id),
    lat                   NUMERIC(10,6),
    lon                   NUMERIC(10,6),
    fecha_apertura        DATE,
    superficie_m2         INTEGER,
    empleados_totales     SMALLINT,
    estado                VARCHAR(20) NOT NULL DEFAULT 'Activa'
);

CREATE TABLE IF NOT EXISTS dim_deposito (
    deposito_id           SMALLINT PRIMARY KEY,
    nombre                VARCHAR(60) NOT NULL,
    sucursal_id           SMALLINT REFERENCES dim_sucursal(sucursal_id),
    lat                   NUMERIC(10,6),
    lon                   NUMERIC(10,6),
    capacidad_ton         INTEGER,
    fecha_habilitacion    DATE,
    tipo                  VARCHAR(60),
    muelles_carga         SMALLINT,
    temperatura_controlada BOOLEAN DEFAULT FALSE,
    certificaciones       TEXT,
    estado                VARCHAR(20) DEFAULT 'Operativo'
);

CREATE TABLE IF NOT EXISTS dim_vendedor (
    vendedor_id           INTEGER PRIMARY KEY,
    nombre                VARCHAR(60) NOT NULL,
    apellido              VARCHAR(60) NOT NULL,
    email                 VARCHAR(120),
    telefono              VARCHAR(30),
    sucursal_id           SMALLINT REFERENCES dim_sucursal(sucursal_id),
    zona_asignada         VARCHAR(60),
    categoria             VARCHAR(20),
    año_ingreso           SMALLINT,
    activo                BOOLEAN DEFAULT TRUE,
    salario_base_ars_2016 INTEGER
);

CREATE TABLE IF NOT EXISTS dim_proveedor (
    proveedor_id          SMALLINT PRIMARY KEY,
    nombre_proveedor      VARCHAR(100) NOT NULL,
    tipo                  VARCHAR(20) NOT NULL,
    pais                  VARCHAR(50),
    provincia             VARCHAR(50),
    ciudad                VARCHAR(50),
    puerto_ingreso        VARCHAR(80),
    moneda_operacion      VARCHAR(5),
    categorias_supply     TEXT,
    plazo_entrega_dias    SMALLINT,
    condicion_pago        VARCHAR(40),
    calificacion          NUMERIC(3,1),
    activo                BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS dim_producto (
    producto_id               VARCHAR(6) PRIMARY KEY,
    nombre_producto           VARCHAR(120) NOT NULL,
    categoria                 VARCHAR(40) NOT NULL,
    subcategoria              VARCHAR(60) NOT NULL,
    unidad_medida             VARCHAR(30),
    precio_usd_base_2016      NUMERIC(12,2),
    margen_bruto_pct          NUMERIC(6,4),
    proveedor_id_principal    SMALLINT REFERENCES dim_proveedor(proveedor_id),
    rotacion                  VARCHAR(10),
    requiere_frio             BOOLEAN DEFAULT FALSE,
    estacionalidad_alta       TEXT,
    activo                    BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS dim_cliente (
    cliente_id                VARCHAR(7) PRIMARY KEY,
    razon_social              VARCHAR(150) NOT NULL,
    segmento                  VARCHAR(40) NOT NULL,
    ciclo_vida                VARCHAR(30),
    provincia                 VARCHAR(50),
    ciudad                    VARCHAR(60),
    sucursal_id_asignada      SMALLINT REFERENCES dim_sucursal(sucursal_id),
    año_alta                  SMALLINT,
    año_baja                  SMALLINT,
    activo                    BOOLEAN DEFAULT TRUE,
    riesgo_crediticio         VARCHAR(10),
    superficie_ha             INTEGER,
    email                     VARCHAR(120),
    telefono                  VARCHAR(30),
    cuit                      VARCHAR(15)
);

-- ── Facts ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fact_ventas (
    venta_id              BIGINT PRIMARY KEY,
    fecha_id              INTEGER REFERENCES dim_fecha(fecha_id),
    cliente_id            VARCHAR(7) REFERENCES dim_cliente(cliente_id),
    producto_id           VARCHAR(6) REFERENCES dim_producto(producto_id),
    sucursal_id           SMALLINT REFERENCES dim_sucursal(sucursal_id),
    vendedor_id           INTEGER REFERENCES dim_vendedor(vendedor_id),
    cantidad              INTEGER NOT NULL,
    precio_unitario_ars   NUMERIC(14,2),
    precio_unitario_usd   NUMERIC(12,2),
    descuento_pct         NUMERIC(6,4),
    total_ars             NUMERIC(16,2),
    total_usd             NUMERIC(14,2),
    margen_bruto_ars      NUMERIC(16,2),
    canal                 VARCHAR(30),
    estado                VARCHAR(20)
);

CREATE TABLE IF NOT EXISTS fact_compras (
    compra_id                 BIGINT PRIMARY KEY,
    fecha_id                  INTEGER REFERENCES dim_fecha(fecha_id),
    proveedor_id              SMALLINT REFERENCES dim_proveedor(proveedor_id),
    producto_id               VARCHAR(6) REFERENCES dim_producto(producto_id),
    deposito_destino_id       SMALLINT REFERENCES dim_deposito(deposito_id),
    cantidad                  INTEGER,
    precio_unitario_usd       NUMERIC(12,2),
    precio_unitario_ars       NUMERIC(14,2),
    descuento_proveedor_pct   NUMERIC(6,4),
    total_usd                 NUMERIC(14,2),
    total_ars                 NUMERIC(16,2),
    plazo_entrega_dias        SMALLINT,
    estado                    VARCHAR(20)
);

CREATE TABLE IF NOT EXISTS fact_inventario (
    inventario_id     BIGINT PRIMARY KEY,
    fecha_id          INTEGER REFERENCES dim_fecha(fecha_id),
    producto_id       VARCHAR(6) REFERENCES dim_producto(producto_id),
    deposito_id       SMALLINT REFERENCES dim_deposito(deposito_id),
    stock_actual      INTEGER,
    stock_minimo      INTEGER,
    stock_maximo      INTEGER,
    bajo_minimo       BOOLEAN,
    valor_stock_ars   NUMERIC(16,2),
    valor_stock_usd   NUMERIC(14,2),
    merma_pct         NUMERIC(6,4)
);

CREATE TABLE IF NOT EXISTS fact_logistica (
    logistica_id          BIGINT PRIMARY KEY,
    fecha_despacho_id     INTEGER REFERENCES dim_fecha(fecha_id),
    cliente_id            VARCHAR(7) REFERENCES dim_cliente(cliente_id),
    deposito_origen_id    SMALLINT REFERENCES dim_deposito(deposito_id),
    region_destino_id     SMALLINT REFERENCES dim_region(region_id),
    transportista         VARCHAR(60),
    tipo_envio            VARCHAR(20),
    peso_kg               INTEGER,
    dias_transito_base    SMALLINT,
    dias_demora           SMALLINT,
    dias_transito_real    SMALLINT,
    costo_flete_ars       NUMERIC(12,2),
    estado                VARCHAR(20)
);

CREATE TABLE IF NOT EXISTS cotizaciones_externas (
    fecha                 DATE PRIMARY KEY,
    fecha_id              INTEGER REFERENCES dim_fecha(fecha_id),
    usd_ars_oficial       NUMERIC(10,2),
    usd_ars_blue          NUMERIC(10,2),
    soja_cbot_usd_ton     NUMERIC(10,2),
    maiz_cbot_usd_ton     NUMERIC(10,2),
    trigo_cbot_usd_ton    NUMERIC(10,2),
    urea_fob_usd_ton      NUMERIC(10,2)
);

-- ── Índices de performance ─────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_ventas_fecha     ON fact_ventas(fecha_id);
CREATE INDEX IF NOT EXISTS idx_ventas_cliente   ON fact_ventas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_ventas_producto  ON fact_ventas(producto_id);
CREATE INDEX IF NOT EXISTS idx_ventas_sucursal  ON fact_ventas(sucursal_id);
CREATE INDEX IF NOT EXISTS idx_compras_fecha    ON fact_compras(fecha_id);
CREATE INDEX IF NOT EXISTS idx_compras_prov     ON fact_compras(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_inv_fecha        ON fact_inventario(fecha_id);
CREATE INDEX IF NOT EXISTS idx_inv_deposito     ON fact_inventario(deposito_id);
CREATE INDEX IF NOT EXISTS idx_log_fecha        ON fact_logistica(fecha_despacho_id);
CREATE INDEX IF NOT EXISTS idx_log_cliente      ON fact_logistica(cliente_id);

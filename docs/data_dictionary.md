# Diccionario de Datos — AgroNova Argentina S.A.

## Convenciones

- **PK**: Primary Key | **FK**: Foreign Key | **UK**: Unique Key
- **GEN**: columna GENERATED ALWAYS AS ... STORED (no insertar en ETL)
- Tipos mapeados a PostgreSQL nativo

---

## DIM_FECHA

Dimension tiempo. Granularidad: **dia**. Rango: 2016-01-01 a 2026-12-31.

| Columna | Tipo SQL | Tipo Python | Descripcion |
|---------|----------|------------|-------------|
| fecha_id | INT PK | int32 | YYYYMMDD (ej: 20241115) |
| fecha | DATE UK | datetime | Fecha calendario |
| año | SMALLINT | int16 | 2016-2026 |
| semestre | SMALLINT | int8 | 1 o 2 |
| trimestre | SMALLINT | int8 | 1-4 |
| mes | SMALLINT | int8 | 1-12 |
| mes_nombre | VARCHAR(20) | str | "Enero", "Febrero", ... |
| semana_iso | SMALLINT | int8 | 1-53 (ISO 8601) |
| dia_mes | SMALLINT | int8 | 1-31 |
| dia_semana | SMALLINT | int8 | 0=Lun, 6=Dom |
| dia_nombre | VARCHAR(20) | str | "Lunes", ... |
| es_fin_de_semana | BOOLEAN | bool | Sabado o Domingo |
| es_feriado | BOOLEAN | bool | Feriado nacional argentino |
| es_dia_habil | BOOLEAN | bool | NOT (feriado OR fin_semana) |
| temporada_agricola | VARCHAR(30) | str | "Siembra Fina", "Gruesa", "Cosecha", "Off" |
| factor_estacional | FLOAT | float32 | 0.70 (Jul) a 1.65 (Nov) |

---

## DIM_REGION

| Columna | Tipo SQL | Descripcion |
|---------|----------|-------------|
| region_id | SMALLINT PK | 1=PAM, 2=NOA, 3=NEA, 4=CUY, 5=PAT |
| nombre_region | VARCHAR(50) | "Pampeana", "Noroeste", etc. |
| provincia_principal | VARCHAR(50) | Provincia mas representativa |
| area_km2 | NUMERIC(10,2) | Area aproximada en km2 |
| potencial_agricola | VARCHAR(20) | "Alto", "Medio", "Bajo" |

---

## DIM_SUCURSAL

| Columna | Tipo SQL | Descripcion |
|---------|----------|-------------|
| sucursal_id | SMALLINT PK | 1-5 |
| nombre | VARCHAR(80) UK | Nombre de la sucursal |
| ciudad | VARCHAR(50) | Ciudad sede |
| provincia | VARCHAR(50) | Provincia |
| region_id | SMALLINT FK -> dim_region | Region de pertenencia |
| lat | FLOAT | Latitud WGS84 |
| lon | FLOAT | Longitud WGS84 |
| superficie_m2 | INT | Superficie de la sucursal |
| activa | BOOLEAN | TRUE para todas las 5 sucursales actuales |

---

## DIM_DEPOSITO

| Columna | Tipo SQL | Descripcion |
|---------|----------|-------------|
| deposito_id | SMALLINT PK | 1-3 |
| nombre | VARCHAR(80) | "Rosario Central", "Cordoba Inland", "Salta Norte" |
| sucursal_id | SMALLINT FK -> dim_sucursal | Sucursal a la que pertenece |
| capacidad_ton | INT | Capacidad maxima en toneladas |
| lat / lon | FLOAT | Coordenadas geograficas |
| activo | BOOLEAN | Estado operativo |

---

## DIM_VENDEDOR

| Columna | Tipo SQL | Descripcion |
|---------|----------|-------------|
| vendedor_id | SMALLINT PK | Auto-incremental |
| nombre | VARCHAR(50) | Nombre (generado con Faker es_AR) |
| apellido | VARCHAR(50) | Apellido |
| email | VARCHAR(100) UK | email corporativo unico |
| sucursal_id | SMALLINT FK -> dim_sucursal | Sucursal de base |
| categoria | VARCHAR(30) | "Junior", "Senior", "Key Account" |
| activo | BOOLEAN | Estado del vendedor |
| fecha_ingreso | DATE | Fecha de alta en la empresa |

---

## DIM_PROVEEDOR

| Columna | Tipo SQL | Descripcion |
|---------|----------|-------------|
| proveedor_id | SMALLINT PK | 1-15 |
| nombre_proveedor | VARCHAR(100) UK | Nombre comercial |
| tipo | VARCHAR(20) | "Nacional" o "Internacional" |
| pais | VARCHAR(50) | Argentina, USA, Brasil, Alemania, China |
| moneda_facturacion | CHAR(3) | "ARS" (nacionales) o "USD" (internacionales) |
| activo | BOOLEAN | TRUE para los 15 proveedores |

---

## DIM_PRODUCTO

| Columna | Tipo SQL | Descripcion |
|---------|----------|-------------|
| producto_id | CHAR(5) PK | Formato: P#### (ej: P0001) |
| nombre_producto | VARCHAR(120) UK | Nombre completo del SKU |
| categoria | VARCHAR(50) | Herbicidas / Fertilizantes / Fungicidas / Insecticidas / Semillas |
| subcategoria | VARCHAR(60) | Ej: "Inhibidores ALS", "Urea granulada" |
| proveedor_id | SMALLINT FK -> dim_proveedor | Proveedor principal |
| precio_usd_base_2016 | FLOAT | Precio de referencia en USD (año base 2016) |
| margen_bruto_pct | FLOAT | Margen sobre precio de venta (0.10 a 0.45) |
| rotacion | ENUM rotacion_producto | Alta / Media / Baja |
| requiere_frio | BOOLEAN | Productos biologicos o sensibles a temperatura |
| activo | BOOLEAN | Si el SKU sigue en catalogo |

---

## DIM_CLIENTE

| Columna | Tipo SQL | Descripcion |
|---------|----------|-------------|
| cliente_id | CHAR(6) PK | Formato: C##### (ej: C00001) |
| razon_social | VARCHAR(120) | Nombre legal (generado con Faker es_AR) |
| cuit | VARCHAR(13) UK | Formato XX-XXXXXXXX-X |
| segmento | VARCHAR(30) | "Grande Productor" / "Cooperativa" / "Distribuidor" / "PYME" |
| ciclo_vida | VARCHAR(20) | "Nuevo" / "Activo" / "Maduro" / "Churned" |
| provincia | VARCHAR(50) | Provincia de operacion |
| region_id | SMALLINT FK -> dim_region | Region geografica |
| año_alta | SMALLINT | Año de incorporacion (2016-2026) |
| año_baja | SMALLINT NULL | Año de churn (NULL = cliente activo) |
| activo | BOOLEAN | FALSE si año_baja IS NOT NULL |
| riesgo_crediticio | ENUM riesgo_tipo | Bajo / Medio / Alto / Critico |
| limite_credito_usd | FLOAT NULL | Linea de credito en USD |
| volumen_factor | FLOAT | **Factor Pareto**: multiplica cantidad base en ventas |
| tier_cliente | ENUM tier_cliente | A / B / C / D |
| superficie_ha | INT NULL | Superficie agricola operada (solo productores) |

**Nota sobre volumen_factor y tier_cliente:**
Estas dos columnas implementan la distribucion Pareto 80/20. El `volumen_factor` escala la cantidad base de cada venta segun el tier del cliente. No proviene de datos de ERP; es un parametro del modelo sintetico para reproducir concentracion de ventas real.

---

## COTIZACIONES_EXTERNAS

| Columna | Tipo SQL | Descripcion |
|---------|----------|-------------|
| fecha | DATE PK | Fecha de la cotizacion |
| fecha_id | INT FK -> dim_fecha | Join con dimension tiempo |
| usd_ars_oficial | FLOAT | TC BNA oficial (venta) |
| usd_ars_blue | FLOAT NULL | TC paralelo (referencial) |
| soja_cbot_usd_ton | FLOAT NULL | Soja CBOT en USD/ton |
| maiz_cbot_usd_ton | FLOAT NULL | Maiz CBOT en USD/ton |
| trigo_cbot_usd_ton | FLOAT NULL | Trigo CBOT en USD/ton |
| urea_fob_usd_ton | FLOAT NULL | Urea FOB NOLA en USD/ton |
| glifosato_usd_lt | FLOAT NULL | Glifosato spot en USD/litro |

---

## FACT_VENTAS

Tabla principal. Granularidad: **una fila por linea de pedido**.

| Columna | Tipo SQL | Descripcion |
|---------|----------|-------------|
| venta_id | BIGINT PK | 1 a 1,500,000 (secuencial) |
| fecha_id | INT FK -> dim_fecha | Fecha de la venta |
| cliente_id | CHAR(6) FK -> dim_cliente | Cliente comprador |
| producto_id | CHAR(5) FK -> dim_producto | SKU vendido |
| sucursal_id | SMALLINT FK -> dim_sucursal | Sucursal de origen |
| vendedor_id | SMALLINT FK -> dim_vendedor | Vendedor asignado |
| canal_venta | ENUM canal_venta | Directo / Distribuidor / E-commerce / Telefono |
| estado | ENUM estado_venta | Completada / Cancelada / Devuelta / Pendiente |
| cantidad | INT | Unidades (1-5000, sesgado por volumen_factor) |
| precio_unitario_ars | FLOAT | Precio ARS al TC del dia |
| precio_unitario_usd | FLOAT | Precio en USD (referencia) |
| descuento_pct | FLOAT | 0.00 a 0.20 (0-20%) |
| total_ars | FLOAT | cantidad * precio * (1 - descuento) |
| total_usd | FLOAT | total_ars / TC del dia |
| margen_bruto_ars | FLOAT | total_ars * margen_pct del producto |
| nro_factura | VARCHAR(20) NULL | Numero de comprobante |

---

## FACT_COMPRAS

Granularidad: **una fila por orden de compra**.

| Columna | Tipo SQL | Descripcion |
|---------|----------|-------------|
| compra_id | INT PK | Secuencial |
| fecha_id | INT FK -> dim_fecha | Fecha de la orden |
| proveedor_id | SMALLINT FK -> dim_proveedor | Proveedor |
| producto_id | CHAR(5) FK -> dim_producto | Producto adquirido |
| deposito_destino_id | SMALLINT FK -> dim_deposito | Deposito de recepcion |
| estado | ENUM estado_compra | Recibida / Pendiente / Cancelada / En_transito |
| cantidad | INT | Unidades compradas |
| precio_compra_ars | FLOAT | Precio unitario de compra en ARS |
| precio_compra_usd | FLOAT NULL | Precio en USD (internacionales) |
| total_ars | FLOAT | Total de la orden |
| total_usd | FLOAT NULL | Total en USD |
| nro_orden_compra | VARCHAR(20) NULL | OC interna |
| puerto_ingreso | VARCHAR(50) NULL | Puerto para importaciones (Bs.As., Rosario) |

---

## FACT_INVENTARIO

Granularidad: **snapshot diario por producto y deposito**.

| Columna | Tipo SQL | Descripcion |
|---------|----------|-------------|
| inventario_id | BIGINT PK | Secuencial |
| fecha_id | INT FK -> dim_fecha | Fecha del snapshot |
| producto_id | CHAR(5) FK -> dim_producto | Producto |
| deposito_id | SMALLINT FK -> dim_deposito | Deposito |
| stock_actual | INT | Unidades en stock ese dia |
| stock_minimo | INT | Nivel de reposicion |
| stock_maximo | INT | Capacidad maxima para el producto |
| valor_stock_ars | FLOAT | stock_actual * precio_costo a ese TC |
| merma_pct | FLOAT | % de merma diaria (0-10%) |
| **bajo_minimo** | BOOLEAN **GEN** | TRUE si stock_actual < stock_minimo |
| UK | (fecha_id, producto_id, deposito_id) | Un registro por combinacion |

---

## FACT_LOGISTICA

Granularidad: **un despacho / entrega**.

| Columna | Tipo SQL | Descripcion |
|---------|----------|-------------|
| logistica_id | BIGINT PK | Secuencial |
| fecha_despacho_id | INT FK -> dim_fecha | Fecha de salida del deposito |
| fecha_entrega_id | INT NULL FK -> dim_fecha | Fecha de entrega al cliente |
| cliente_id | CHAR(6) FK -> dim_cliente | Cliente destino |
| deposito_origen_id | SMALLINT FK -> dim_deposito | Deposito de salida |
| region_destino_id | SMALLINT FK -> dim_region | Region de entrega |
| transportista | VARCHAR(80) NULL | Empresa de transporte |
| estado | ENUM estado_logistica | Entregado / En_transito / Demorado / Cancelado |
| dias_transito_base | SMALLINT | Dias estimados (1-30) |
| **dias_transito_real** | SMALLINT **GEN** | Calculado desde fechas |
| costo_flete_ars | FLOAT | Costo del flete en ARS |
| peso_kg | FLOAT NULL | Peso del envio |
| volumen_m3 | FLOAT NULL | Volumen del envio |

from __future__ import annotations

from sqlalchemy import (
    BigInteger, Boolean, Date, ForeignKey, Integer,
    Numeric, SmallInteger, String, Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.core.database import Base, DB_SCHEMA

_TABLE_ARGS = {"schema": DB_SCHEMA}


class DimFecha(Base):
    __tablename__ = "dim_fecha"
    __table_args__ = _TABLE_ARGS

    fecha_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    fecha = mapped_column(Date, nullable=False)
    anio = mapped_column("año", SmallInteger, nullable=False)
    semestre = mapped_column(SmallInteger, nullable=False)
    trimestre = mapped_column(SmallInteger, nullable=False)
    mes = mapped_column(SmallInteger, nullable=False)
    mes_nombre = mapped_column(String(20), nullable=False)
    semana_iso = mapped_column(SmallInteger, nullable=False)
    dia_anio = mapped_column("dia_año", SmallInteger, nullable=False)
    dia_semana = mapped_column(SmallInteger, nullable=False)
    dia_semana_nombre = mapped_column(String(15), nullable=False)
    es_feriado = mapped_column(Boolean, nullable=False, default=False)
    es_fin_de_semana = mapped_column(Boolean, nullable=False, default=False)
    es_dia_habil = mapped_column(Boolean, nullable=False, default=True)
    temporada = mapped_column(String(20), nullable=False)
    temporada_agricola = mapped_column(String(60), nullable=False)
    factor_estacional = mapped_column(Numeric(5, 4), nullable=False)


class DimRegion(Base):
    __tablename__ = "dim_region"
    __table_args__ = _TABLE_ARGS

    region_id: Mapped[int] = mapped_column(SmallInteger, primary_key=True)
    nombre_region = mapped_column(String(60), nullable=False)
    provincia_principal = mapped_column(String(50), nullable=False)
    ciudades = mapped_column(Text)
    superficie_km2 = mapped_column(Integer)
    hectareas_prod_estimadas = mapped_column(Integer)
    cultivo_principal = mapped_column(String(60))
    peso_comercial_pct = mapped_column(Numeric(5, 4))


class DimSucursal(Base):
    __tablename__ = "dim_sucursal"
    __table_args__ = _TABLE_ARGS

    sucursal_id: Mapped[int] = mapped_column(SmallInteger, primary_key=True)
    nombre = mapped_column(String(60), nullable=False)
    provincia = mapped_column(String(50), nullable=False)
    region_id = mapped_column(SmallInteger, ForeignKey(f"{DB_SCHEMA}.dim_region.region_id"), nullable=False)
    lat = mapped_column(Numeric(10, 6))
    lon = mapped_column(Numeric(10, 6))
    fecha_apertura = mapped_column(Date)
    superficie_m2 = mapped_column(Integer)
    empleados_totales = mapped_column(SmallInteger)
    estado = mapped_column(String(20), nullable=False, default="Activa")


class DimDeposito(Base):
    __tablename__ = "dim_deposito"
    __table_args__ = _TABLE_ARGS

    deposito_id: Mapped[int] = mapped_column(SmallInteger, primary_key=True)
    nombre = mapped_column(String(60), nullable=False)
    sucursal_id = mapped_column(SmallInteger, ForeignKey(f"{DB_SCHEMA}.dim_sucursal.sucursal_id"), nullable=False)
    lat = mapped_column(Numeric(10, 6))
    lon = mapped_column(Numeric(10, 6))
    capacidad_ton = mapped_column(Integer)
    fecha_habilitacion = mapped_column(Date)
    tipo = mapped_column(String(60))
    muelles_carga = mapped_column(SmallInteger)
    temperatura_controlada = mapped_column(Boolean, default=False)
    certificaciones = mapped_column(Text)
    estado = mapped_column(String(20), default="Operativo")


class DimVendedor(Base):
    __tablename__ = "dim_vendedor"
    __table_args__ = _TABLE_ARGS

    vendedor_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nombre = mapped_column(String(60), nullable=False)
    apellido = mapped_column(String(60), nullable=False)
    email = mapped_column(String(120))
    telefono = mapped_column(String(30))
    sucursal_id = mapped_column(SmallInteger, ForeignKey(f"{DB_SCHEMA}.dim_sucursal.sucursal_id"), nullable=False)
    zona_asignada = mapped_column(String(60))
    categoria = mapped_column(String(20))
    anio_ingreso = mapped_column("año_ingreso", SmallInteger)
    activo = mapped_column(Boolean, default=True)
    salario_base_ars_2016 = mapped_column(Integer)


class DimProveedor(Base):
    __tablename__ = "dim_proveedor"
    __table_args__ = _TABLE_ARGS

    proveedor_id: Mapped[int] = mapped_column(SmallInteger, primary_key=True)
    nombre_proveedor = mapped_column(String(100), nullable=False)
    tipo = mapped_column(String(20), nullable=False)
    pais = mapped_column(String(50))
    provincia = mapped_column(String(50))
    ciudad = mapped_column(String(50))
    puerto_ingreso = mapped_column(String(80))
    moneda_operacion = mapped_column(String(5))
    categorias_supply = mapped_column(Text)
    plazo_entrega_dias = mapped_column(SmallInteger)
    condicion_pago = mapped_column(String(40))
    calificacion = mapped_column(Numeric(3, 1))
    activo = mapped_column(Boolean, default=True)


class DimProducto(Base):
    __tablename__ = "dim_producto"
    __table_args__ = _TABLE_ARGS

    producto_id: Mapped[str] = mapped_column(String(6), primary_key=True)
    nombre_producto = mapped_column(String(120), nullable=False)
    categoria = mapped_column(String(40), nullable=False)
    subcategoria = mapped_column(String(60), nullable=False)
    unidad_medida = mapped_column(String(30))
    precio_usd_base_2016 = mapped_column(Numeric(12, 2))
    margen_bruto_pct = mapped_column(Numeric(6, 4))
    proveedor_id_principal = mapped_column(SmallInteger, ForeignKey(f"{DB_SCHEMA}.dim_proveedor.proveedor_id"))
    rotacion = mapped_column(String(10))
    requiere_frio = mapped_column(Boolean, default=False)
    estacionalidad_alta = mapped_column(Text)
    activo = mapped_column(Boolean, default=True)


class DimCliente(Base):
    __tablename__ = "dim_cliente"
    __table_args__ = _TABLE_ARGS

    cliente_id: Mapped[str] = mapped_column(String(7), primary_key=True)
    razon_social = mapped_column(String(150), nullable=False)
    segmento = mapped_column(String(40), nullable=False)
    ciclo_vida = mapped_column(String(30))
    provincia = mapped_column(String(50))
    ciudad = mapped_column(String(60))
    sucursal_id_asignada = mapped_column(SmallInteger, ForeignKey(f"{DB_SCHEMA}.dim_sucursal.sucursal_id"))
    anio_alta = mapped_column("año_alta", SmallInteger)
    anio_baja = mapped_column("año_baja", SmallInteger)
    activo = mapped_column(Boolean, default=True)
    riesgo_crediticio = mapped_column(String(10))
    superficie_ha = mapped_column(Integer)
    email = mapped_column(String(120))
    telefono = mapped_column(String(30))
    cuit = mapped_column(String(15))
    volumen_factor = mapped_column(Numeric(8, 4), default=1.0)
    tier_cliente = mapped_column(String(1))

    ventas: Mapped[list["FactVentas"]] = relationship(back_populates="cliente")


class FactVentas(Base):
    __tablename__ = "fact_ventas"
    __table_args__ = _TABLE_ARGS

    venta_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    fecha_id = mapped_column(Integer, ForeignKey(f"{DB_SCHEMA}.dim_fecha.fecha_id"), nullable=False)
    cliente_id = mapped_column(String(7), ForeignKey(f"{DB_SCHEMA}.dim_cliente.cliente_id"), nullable=False)
    producto_id = mapped_column(String(6), ForeignKey(f"{DB_SCHEMA}.dim_producto.producto_id"), nullable=False)
    sucursal_id = mapped_column(SmallInteger, ForeignKey(f"{DB_SCHEMA}.dim_sucursal.sucursal_id"), nullable=False)
    vendedor_id = mapped_column(Integer, ForeignKey(f"{DB_SCHEMA}.dim_vendedor.vendedor_id"), nullable=False)
    cantidad = mapped_column(Integer, nullable=False)
    precio_unitario_ars = mapped_column(Numeric(16, 2), nullable=False)
    precio_unitario_usd = mapped_column(Numeric(12, 2), nullable=False)
    descuento_pct = mapped_column(Numeric(6, 4), nullable=False, default=0)
    total_ars = mapped_column(Numeric(18, 2), nullable=False)
    total_usd = mapped_column(Numeric(14, 2), nullable=False)
    margen_bruto_ars = mapped_column(Numeric(18, 2))
    canal = mapped_column(String(30))
    estado = mapped_column(String(20))

    cliente: Mapped["DimCliente"] = relationship(back_populates="ventas")


class FactCompras(Base):
    __tablename__ = "fact_compras"
    __table_args__ = _TABLE_ARGS

    compra_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    fecha_id = mapped_column(Integer, ForeignKey(f"{DB_SCHEMA}.dim_fecha.fecha_id"), nullable=False)
    proveedor_id = mapped_column(SmallInteger, ForeignKey(f"{DB_SCHEMA}.dim_proveedor.proveedor_id"), nullable=False)
    producto_id = mapped_column(String(6), ForeignKey(f"{DB_SCHEMA}.dim_producto.producto_id"), nullable=False)
    deposito_destino_id = mapped_column(SmallInteger, ForeignKey(f"{DB_SCHEMA}.dim_deposito.deposito_id"), nullable=False)
    cantidad = mapped_column(Integer, nullable=False)
    precio_unitario_usd = mapped_column(Numeric(12, 2), nullable=False)
    precio_unitario_ars = mapped_column(Numeric(16, 2), nullable=False)
    descuento_proveedor_pct = mapped_column(Numeric(6, 4), default=0)
    total_usd = mapped_column(Numeric(14, 2), nullable=False)
    total_ars = mapped_column(Numeric(18, 2), nullable=False)
    plazo_entrega_dias = mapped_column(SmallInteger)
    estado = mapped_column(String(20))


class FactInventario(Base):
    __tablename__ = "fact_inventario"
    __table_args__ = _TABLE_ARGS

    inventario_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    fecha_id = mapped_column(Integer, ForeignKey(f"{DB_SCHEMA}.dim_fecha.fecha_id"), nullable=False)
    producto_id = mapped_column(String(6), ForeignKey(f"{DB_SCHEMA}.dim_producto.producto_id"), nullable=False)
    deposito_id = mapped_column(SmallInteger, ForeignKey(f"{DB_SCHEMA}.dim_deposito.deposito_id"), nullable=False)
    stock_actual = mapped_column(Integer, nullable=False, default=0)
    stock_minimo = mapped_column(Integer)
    stock_maximo = mapped_column(Integer)
    bajo_minimo = mapped_column(Boolean)  # GENERATED ALWAYS in Postgres
    valor_stock_ars = mapped_column(Numeric(18, 2))
    valor_stock_usd = mapped_column(Numeric(14, 2))
    merma_pct = mapped_column(Numeric(6, 4), default=0)


class FactLogistica(Base):
    __tablename__ = "fact_logistica"
    __table_args__ = _TABLE_ARGS

    logistica_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    fecha_despacho_id = mapped_column(Integer, ForeignKey(f"{DB_SCHEMA}.dim_fecha.fecha_id"), nullable=False)
    cliente_id = mapped_column(String(7), ForeignKey(f"{DB_SCHEMA}.dim_cliente.cliente_id"), nullable=False)
    deposito_origen_id = mapped_column(SmallInteger, ForeignKey(f"{DB_SCHEMA}.dim_deposito.deposito_id"), nullable=False)
    region_destino_id = mapped_column(SmallInteger, ForeignKey(f"{DB_SCHEMA}.dim_region.region_id"), nullable=False)
    transportista = mapped_column(String(60))
    tipo_envio = mapped_column(String(20))
    peso_kg = mapped_column(Integer)
    dias_transito_base = mapped_column(SmallInteger)
    dias_demora = mapped_column(SmallInteger, default=0)
    dias_transito_real = mapped_column(SmallInteger)  # GENERATED ALWAYS in Postgres
    costo_flete_ars = mapped_column(Numeric(14, 2))
    estado = mapped_column(String(20))


class CotizacionesExternas(Base):
    __tablename__ = "cotizaciones_externas"
    __table_args__ = _TABLE_ARGS

    fecha: Mapped[object] = mapped_column(Date, primary_key=True)
    fecha_id = mapped_column(Integer, ForeignKey(f"{DB_SCHEMA}.dim_fecha.fecha_id"), nullable=False)
    usd_ars_oficial = mapped_column(Numeric(12, 2))
    usd_ars_blue = mapped_column(Numeric(12, 2))
    soja_cbot_usd_ton = mapped_column(Numeric(10, 2))
    maiz_cbot_usd_ton = mapped_column(Numeric(10, 2))
    trigo_cbot_usd_ton = mapped_column(Numeric(10, 2))
    urea_fob_usd_ton = mapped_column(Numeric(10, 2))

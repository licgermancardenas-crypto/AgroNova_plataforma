"""
SQLAlchemy ORM models mirroring the Data Warehouse star schema
(data/csv/Dim_Cliente.csv, Fact_Ventas.csv) for the future Neon migration.

Not used by any endpoint yet — backend/services/ reads the CSVs directly via
pandas. These models exist so the table shape is defined ahead of the actual
DB connection (see backend/core/db.py).
"""
from __future__ import annotations

from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey
from sqlalchemy.orm import relationship

from backend.core.db import Base


class Cliente(Base):
    __tablename__ = "dim_cliente"

    cliente_id = Column(Integer, primary_key=True)
    razon_social = Column(String, nullable=False)
    segmento = Column(String)
    provincia = Column(String)
    ciudad = Column(String)
    sucursal_id_asignada = Column(Integer, ForeignKey("dim_sucursal.sucursal_id"))
    activo = Column(Boolean, default=True)
    superficie_ha = Column(Float)

    ventas = relationship("Venta", back_populates="cliente")


class Sucursal(Base):
    __tablename__ = "dim_sucursal"

    sucursal_id = Column(Integer, primary_key=True)
    nombre = Column(String, nullable=False)
    lat = Column(Float)
    lon = Column(Float)


class Venta(Base):
    __tablename__ = "fact_ventas"

    venta_id = Column(Integer, primary_key=True)
    fecha_id = Column(Integer, nullable=False)
    cliente_id = Column(Integer, ForeignKey("dim_cliente.cliente_id"))
    producto_id = Column(Integer)
    sucursal_id = Column(Integer, ForeignKey("dim_sucursal.sucursal_id"))
    total_ars = Column(Float)
    margen_bruto_ars = Column(Float)
    estado = Column(String)

    cliente = relationship("Cliente", back_populates="ventas")

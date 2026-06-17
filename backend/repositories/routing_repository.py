from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

import gis.geo_utils as gu
from backend.models.orm import DimCliente, DimDeposito, DimSucursal


class RoutingRepository:
    def __init__(self, db: Session):
        self.db = db

    def sucursales(self) -> list[dict]:
        rows = self.db.execute(
            select(DimSucursal.sucursal_id, DimSucursal.nombre, DimSucursal.lat, DimSucursal.lon)
        ).fetchall()
        return [
            {"sucursal_id": r.sucursal_id, "nombre": r.nombre,
             "lat": float(r.lat), "lon": float(r.lon)}
            for r in rows
        ]

    def depositos(self) -> list[dict]:
        rows = self.db.execute(
            select(
                DimDeposito.deposito_id, DimDeposito.nombre,
                DimDeposito.lat, DimDeposito.lon, DimDeposito.sucursal_id,
            )
        ).fetchall()
        return [
            {"deposito_id": r.deposito_id, "nombre": r.nombre,
             "lat": float(r.lat), "lon": float(r.lon), "sucursal_id": r.sucursal_id}
            for r in rows
        ]

    def provincia_counts(self) -> dict[str, int]:
        """Canonical province name → client count (5 active provinces)."""
        rows = self.db.execute(
            select(DimCliente.provincia, func.count())
            .select_from(DimCliente)
            .where(DimCliente.provincia.isnot(None))
            .group_by(DimCliente.provincia)
        ).fetchall()
        return {gu.normalize_province(r[0]): int(r[1]) for r in rows}

    def sucursal_real_counts(self) -> dict[int, int]:
        """sucursal_id_asignada → real client count stored in dim_cliente."""
        rows = self.db.execute(
            select(DimCliente.sucursal_id_asignada, func.count())
            .select_from(DimCliente)
            .where(DimCliente.sucursal_id_asignada.isnot(None))
            .group_by(DimCliente.sucursal_id_asignada)
        ).fetchall()
        return {int(r[0]): int(r[1]) for r in rows}

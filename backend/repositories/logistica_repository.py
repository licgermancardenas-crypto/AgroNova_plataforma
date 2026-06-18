from __future__ import annotations

from sqlalchemy import select, func, and_
from sqlalchemy.orm import Session

from backend.models.orm import DimDeposito, DimFecha, DimRegion, FactLogistica
from backend.repositories.base import BaseRepository


class LogisticaRepository(BaseRepository[FactLogistica]):
    model = FactLogistica

    def __init__(self, db: Session):
        super().__init__(db)

    def otif_pct_anio(self, anio: int) -> float:
        total_stmt = (
            select(func.count(FactLogistica.logistica_id))
            .join(DimFecha, FactLogistica.fecha_despacho_id == DimFecha.fecha_id)
            .where(DimFecha.anio == anio)
        )
        on_time_stmt = (
            select(func.count(FactLogistica.logistica_id))
            .join(DimFecha, FactLogistica.fecha_despacho_id == DimFecha.fecha_id)
            .where(
                and_(
                    DimFecha.anio == anio,
                    FactLogistica.estado == "Entregado",
                    FactLogistica.dias_demora == 0,
                )
            )
        )
        total = self.db.execute(total_stmt).scalar_one() or 1
        on_time = self.db.execute(on_time_stmt).scalar_one() or 0
        return round(on_time / total * 100, 2)

    def risk_by_deposito(self) -> list[dict]:
        subq = (
            select(
                FactLogistica.deposito_origen_id,
                func.count(FactLogistica.logistica_id).label("n_envios"),
                func.sum(
                    func.cast(FactLogistica.estado == "Demorado", func.Integer)
                ).label("n_demorado"),
                func.sum(
                    func.cast(FactLogistica.estado == "Devuelto", func.Integer)
                ).label("n_devuelto"),
                func.sum(
                    func.cast(FactLogistica.estado == "Entregado", func.Integer)
                ).label("n_entregado"),
                func.sum(
                    func.cast(FactLogistica.estado == "En tránsito", func.Integer)
                ).label("n_transito"),
                func.avg(FactLogistica.dias_demora).label("dias_demora_prom"),
            )
            .group_by(FactLogistica.deposito_origen_id)
            .subquery()
        )
        stmt = (
            select(
                DimDeposito.deposito_id,
                DimDeposito.nombre,
                DimDeposito.sucursal_id,
                subq.c.n_envios,
                subq.c.n_demorado,
                subq.c.n_devuelto,
                subq.c.n_entregado,
                subq.c.n_transito,
                subq.c.dias_demora_prom,
            )
            .join(subq, DimDeposito.deposito_id == subq.c.deposito_origen_id)
        )
        rows = self.db.execute(stmt).all()
        result = []
        for r in rows:
            n = r.n_envios or 1
            pct_dem = round((r.n_demorado or 0) / n * 100, 2)
            pct_dev = round((r.n_devuelto or 0) / n * 100, 2)
            pct_ent = round((r.n_entregado or 0) / n * 100, 2)
            pct_tra = round((r.n_transito or 0) / n * 100, 2)
            score = round(pct_dem * 0.5 + pct_dev * 0.5, 2)
            result.append({
                "deposito_id": r.deposito_id,
                "nombre": r.nombre,
                "sucursal_id": r.sucursal_id,
                "n_envios": r.n_envios,
                "pct_demorado": pct_dem,
                "pct_devuelto": pct_dev,
                "pct_entregado": pct_ent,
                "pct_en_transito": pct_tra,
                "dias_demora_prom": round(float(r.dias_demora_prom or 0), 2),
                "incidencia_score": score,
                "risk_level": "CRÍTICO" if score > 15 else "RIESGO" if score > 8 else "NORMAL",
            })
        return result

    def risk_by_tipo_envio(self) -> list[dict]:
        stmt = (
            select(
                FactLogistica.tipo_envio,
                func.count(FactLogistica.logistica_id).label("n_envios"),
                func.avg(FactLogistica.dias_demora).label("dias_demora_prom"),
            )
            .group_by(FactLogistica.tipo_envio)
        )
        rows = self.db.execute(stmt).all()
        result = []
        for r in rows:
            n = r.n_envios or 1
            result.append({
                "tipo_envio": r.tipo_envio,
                "n_envios": r.n_envios,
                "pct_demorado": 0.0,
                "pct_devuelto": 0.0,
                "pct_entregado": 0.0,
                "pct_en_transito": 0.0,
                "dias_demora_prom": round(float(r.dias_demora_prom or 0), 2),
                "incidencia_score": 0.0,
                "risk_level": "NORMAL",
            })
        return result

    def global_metrics(self) -> tuple[float, float]:
        stmt = select(
            func.avg(FactLogistica.costo_flete_ars / func.nullif(FactLogistica.peso_kg, 0)).label("cost_per_kg"),
            func.avg(FactLogistica.peso_kg).label("avg_peso"),
        )
        row = self.db.execute(stmt).one()
        return (round(float(row.cost_per_kg or 0), 2), round(float(row.avg_peso or 0), 2))

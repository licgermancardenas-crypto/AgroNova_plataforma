from __future__ import annotations

from sqlalchemy import case, func, select

from backend.models.orm import DimDeposito, DimFecha, FactLogistica
from backend.repositories.base import BaseRepository


def _assign_risk_level(rows: list[dict]) -> list[dict]:
    """Rank rows by incidencia_score DESC; assign Alto/Medio/Bajo by position."""
    n = len(rows)
    if n == 0:
        return rows
    sorted_idx = sorted(range(n), key=lambda i: rows[i]["incidencia_score"], reverse=True)
    for rank, orig_idx in enumerate(sorted_idx):
        if n <= 2:
            label = "Alto" if rank == 0 else "Bajo"
        else:
            label = "Alto" if rank == 0 else ("Bajo" if rank == n - 1 else "Medio")
        rows[orig_idx]["risk_level"] = label
    return rows


class LogisticaRepository(BaseRepository[FactLogistica]):
    model = FactLogistica

    def otif_pct_global(self) -> float:
        """OTIF = entregado a tiempo (estado='Entregado' AND dias_demora=0) —
        same definition as gis/geo_utils.py::load_logistica()'s otif column."""
        otif_count = func.sum(
            case((FactLogistica.estado == "Entregado", 1), else_=0)
            * case((FactLogistica.dias_demora == 0, 1), else_=0)
        )
        total = func.count()
        stmt = select(otif_count, total).select_from(FactLogistica)
        otif, total_n = self.db.execute(stmt).one()
        return round(float(otif or 0) / total_n * 100, 2) if total_n else 0.0

    def otif_pct_anio(self, anio: int) -> float:
        """OTIF filtered to the given year (via dim_fecha.año join)."""
        otif_count = func.sum(
            case((FactLogistica.estado == "Entregado", 1), else_=0)
            * case((FactLogistica.dias_demora == 0, 1), else_=0)
        )
        total = func.count()
        stmt = (
            select(otif_count, total)
            .select_from(FactLogistica)
            .join(DimFecha, FactLogistica.fecha_despacho_id == DimFecha.fecha_id)
            .where(DimFecha.anio == anio)
        )
        otif, total_n = self.db.execute(stmt).one()
        return round(float(otif or 0) / total_n * 100, 2) if total_n else 0.0

    def risk_by_deposito(self) -> list[dict]:
        """Aggregated risk metrics per deposit — matches route_risk.json by_deposito."""
        n_envios = func.count().label("n_envios")
        pct_d = (func.sum(case((FactLogistica.estado == "Demorado", 1.0), else_=0)) / func.count() * 100).label("pct_demorado")
        pct_dev = (func.sum(case((FactLogistica.estado == "Devuelto", 1.0), else_=0)) / func.count() * 100).label("pct_devuelto")
        pct_ent = (func.sum(case((FactLogistica.estado == "Entregado", 1.0), else_=0)) / func.count() * 100).label("pct_entregado")
        pct_tr = (func.sum(case((FactLogistica.estado == "En tránsito", 1.0), else_=0)) / func.count() * 100).label("pct_en_transito")
        dias_d = func.avg(FactLogistica.dias_demora).label("dias_demora_prom")

        stmt = (
            select(
                DimDeposito.deposito_id, DimDeposito.nombre, DimDeposito.sucursal_id,
                n_envios, pct_d, pct_dev, pct_ent, pct_tr, dias_d,
            )
            .select_from(FactLogistica)
            .join(DimDeposito, FactLogistica.deposito_origen_id == DimDeposito.deposito_id)
            .group_by(DimDeposito.deposito_id, DimDeposito.nombre, DimDeposito.sucursal_id)
            .order_by(DimDeposito.deposito_id)
        )
        rows = self.db.execute(stmt).fetchall()
        result = []
        for r in rows:
            pd_val = round(float(r.pct_demorado or 0), 2)
            pdev_val = round(float(r.pct_devuelto or 0), 2)
            result.append({
                "deposito_id": int(r.deposito_id),
                "nombre": r.nombre,
                "sucursal_id": int(r.sucursal_id),
                "n_envios": int(r.n_envios),
                "pct_demorado": pd_val,
                "pct_devuelto": pdev_val,
                "pct_entregado": round(float(r.pct_entregado or 0), 2),
                "pct_en_transito": round(float(r.pct_en_transito or 0), 2),
                "dias_demora_prom": round(float(r.dias_demora_prom or 0), 2),
                "incidencia_score": round(pd_val + pdev_val * 2, 2),
            })
        return _assign_risk_level(result)

    def risk_by_tipo_envio(self) -> list[dict]:
        """Aggregated risk metrics per shipping type — matches route_risk.json by_tipo_envio."""
        n_envios = func.count().label("n_envios")
        pct_d = (func.sum(case((FactLogistica.estado == "Demorado", 1.0), else_=0)) / func.count() * 100).label("pct_demorado")
        pct_dev = (func.sum(case((FactLogistica.estado == "Devuelto", 1.0), else_=0)) / func.count() * 100).label("pct_devuelto")
        pct_ent = (func.sum(case((FactLogistica.estado == "Entregado", 1.0), else_=0)) / func.count() * 100).label("pct_entregado")
        pct_tr = (func.sum(case((FactLogistica.estado == "En tránsito", 1.0), else_=0)) / func.count() * 100).label("pct_en_transito")
        dias_d = func.avg(FactLogistica.dias_demora).label("dias_demora_prom")

        stmt = (
            select(
                FactLogistica.tipo_envio,
                n_envios, pct_d, pct_dev, pct_ent, pct_tr, dias_d,
            )
            .select_from(FactLogistica)
            .group_by(FactLogistica.tipo_envio)
            .order_by(FactLogistica.tipo_envio)
        )
        rows = self.db.execute(stmt).fetchall()
        result = []
        for r in rows:
            pd_val = round(float(r.pct_demorado or 0), 2)
            pdev_val = round(float(r.pct_devuelto or 0), 2)
            result.append({
                "tipo_envio": r.tipo_envio,
                "n_envios": int(r.n_envios),
                "pct_demorado": pd_val,
                "pct_devuelto": pdev_val,
                "pct_entregado": round(float(r.pct_entregado or 0), 2),
                "pct_en_transito": round(float(r.pct_en_transito or 0), 2),
                "dias_demora_prom": round(float(r.dias_demora_prom or 0), 2),
                "incidencia_score": round(pd_val + pdev_val * 2, 2),
            })
        return _assign_risk_level(result)

    def global_metrics(self) -> tuple[float, float]:
        """Returns (cost_per_kg_ars, avg_peso_kg) — global averages from fact_logistica."""
        stmt = (
            select(
                func.avg(FactLogistica.costo_flete_ars / FactLogistica.peso_kg),
                func.avg(FactLogistica.peso_kg),
            )
            .select_from(FactLogistica)
            .where(FactLogistica.peso_kg > 0)
        )
        cost_per_kg, avg_peso = self.db.execute(stmt).one()
        return round(float(cost_per_kg or 0), 2), round(float(avg_peso or 0), 1)

    def by_deposito(self, deposito_id: int) -> list[FactLogistica]:
        stmt = select(FactLogistica).where(FactLogistica.deposito_origen_id == deposito_id)
        return list(self.db.execute(stmt).scalars().all())

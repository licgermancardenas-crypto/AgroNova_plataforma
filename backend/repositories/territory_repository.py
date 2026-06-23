from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.core.database import DB_SCHEMA

_S = DB_SCHEMA


class TerritoryRepository:
    def __init__(self, db: Session):
        self.db = db

    # ── Branch aggregate metrics ───────────────────────────────────────────────

    def get_branches(self) -> list[dict]:
        """Per-sucursal KPIs using PostGIS ST_Distance (geography)."""
        sql = text(f"""
            SELECT
                ss.sucursal_id,
                ss.nombre,
                ss.provincia          AS branch_provincia,
                ss.latitud,
                ss.longitud,
                COUNT(sc.cliente_id)                                            AS n_clientes,
                COALESCE(SUM(sc.revenue_ars), 0)                                AS revenue_total,
                COALESCE(AVG(sc.otif_pct), 0)                                   AS otif_avg,
                COALESCE(AVG(
                    ST_Distance(sc.geom::geography, ss.geom::geography) / 1000.0
                ), 0)                                                            AS avg_distance_km,
                COALESCE(AVG(sc.margen_pct), 0)                                 AS margen_avg,
                COALESCE(AVG(sc.churn_score), 0)                                AS churn_avg,
                SUM(CASE WHEN sc.churn_level = 'Alto' THEN 1 ELSE 0 END)       AS n_alto_riesgo,
                SUM(CASE WHEN sc.tier = 'A' THEN 1 ELSE 0 END)                 AS n_tier_a
            FROM {_S}.spatial_sucursales ss
            LEFT JOIN {_S}.spatial_clientes sc
                ON  sc.sucursal_id_asignada = ss.sucursal_id
                AND sc.is_outlier = false
            GROUP BY ss.sucursal_id, ss.nombre, ss.provincia, ss.latitud, ss.longitud
            ORDER BY ss.sucursal_id
        """)
        rows = self.db.execute(sql).all()
        result = []
        for r in rows:
            result.append({
                "sucursal_id":    int(r.sucursal_id),
                "nombre":         r.nombre,
                "provincia":      r.branch_provincia,
                "lat":            float(r.latitud),
                "lng":            float(r.longitud),
                "n_clientes":     int(r.n_clientes),
                "revenue_total":  float(r.revenue_total or 0),
                "otif_avg":       round(float(r.otif_avg or 0), 2),
                "avg_distance_km":round(float(r.avg_distance_km or 0), 1),
                "margen_avg":     round(float(r.margen_avg or 0), 2),
                "churn_avg":      round(float(r.churn_avg or 0), 3),
                "n_alto_riesgo":  int(r.n_alto_riesgo or 0),
                "n_tier_a":       int(r.n_tier_a or 0),
            })
        return result

    # ── Client → nearest sucursal (KNN) ───────────────────────────────────────

    def get_reassignment_candidates(self, improvement_threshold_pct: float = 20.0) -> list[dict]:
        """
        For each non-outlier client, find the nearest sucursal via KNN.
        Return records where nearest ≠ assigned AND improvement ≥ threshold.
        Uses a lateral subquery so PostGIS does the geometry math.
        """
        sql = text(f"""
            WITH nearest AS (
                SELECT
                    sc.cliente_id,
                    sc.sucursal_id_asignada                                     AS current_id,
                    sc.revenue_ars,
                    sc.otif_pct,
                    sc.provincia,
                    sc.latitud,
                    sc.longitud,
                    ST_Distance(sc.geom::geography, curr.geom::geography) / 1000.0  AS current_dist_km,
                    nn.sucursal_id                                              AS nearest_id,
                    nn.nombre                                                   AS nearest_nombre,
                    ST_Distance(sc.geom::geography, nn.geom::geography)  / 1000.0   AS nearest_dist_km
                FROM {_S}.spatial_clientes sc
                JOIN {_S}.spatial_sucursales curr ON curr.sucursal_id = sc.sucursal_id_asignada
                JOIN LATERAL (
                    SELECT s2.sucursal_id, s2.nombre, s2.geom
                    FROM {_S}.spatial_sucursales s2
                    ORDER BY sc.geom <-> s2.geom
                    LIMIT 1
                ) nn ON true
                WHERE sc.is_outlier = false
            )
            SELECT
                n.cliente_id,
                c.razon_social,
                n.provincia,
                n.current_id,
                curr_s.nombre                                                   AS current_nombre,
                n.nearest_id,
                n.nearest_nombre,
                n.revenue_ars,
                n.otif_pct,
                n.latitud                                                       AS lat,
                n.longitud                                                      AS lon,
                n.current_dist_km,
                n.nearest_dist_km,
                n.current_dist_km - n.nearest_dist_km                          AS improvement_km,
                CASE WHEN n.current_dist_km > 0
                    THEN (n.current_dist_km - n.nearest_dist_km) / n.current_dist_km * 100
                    ELSE 0 END                                                  AS improvement_pct
            FROM nearest n
            JOIN {_S}.dim_cliente c   ON c.cliente_id = n.cliente_id
            JOIN {_S}.spatial_sucursales curr_s ON curr_s.sucursal_id = n.current_id
            WHERE n.nearest_id != n.current_id
              AND n.current_dist_km > 0
              AND (n.current_dist_km - n.nearest_dist_km) / n.current_dist_km * 100 >= :thr
            ORDER BY improvement_km DESC
        """)
        rows = self.db.execute(sql, {"thr": improvement_threshold_pct}).all()
        result = []
        for r in rows:
            result.append({
                "cliente_id":       r.cliente_id,
                "razon_social":     r.razon_social,
                "provincia":        r.provincia,
                "current_id":       int(r.current_id),
                "current_nombre":   r.current_nombre,
                "nearest_id":       int(r.nearest_id),
                "nearest_nombre":   r.nearest_nombre,
                "revenue_ars":      float(r.revenue_ars or 0),
                "otif_pct":         float(r.otif_pct or 0),
                "lat":              float(r.lat),
                "lon":              float(r.lon),
                "current_dist_km":  round(float(r.current_dist_km), 1),
                "nearest_dist_km":  round(float(r.nearest_dist_km), 1),
                "improvement_km":   round(float(r.improvement_km), 1),
                "improvement_pct":  round(float(r.improvement_pct), 1),
            })
        return result

    # ── Overall territory status ───────────────────────────────────────────────

    def get_status_summary(self, branches: list[dict], conflicts: list[dict]) -> dict:
        """Compute executive KPIs from already-fetched branch + conflict data."""
        total_clients  = sum(b["n_clientes"] for b in branches)
        total_revenue  = sum(b["revenue_total"] for b in branches)
        n_conflicts    = len(conflicts)
        savings_km     = sum(c["improvement_km"] for c in conflicts)
        avg_reduction  = (
            sum(c["improvement_pct"] for c in conflicts) / n_conflicts
            if n_conflicts else 0
        )
        revenue_at_risk = sum(c["revenue_ars"] for c in conflicts)

        # weighted-avg OTIF across all branches
        weighted_otif = (
            sum(b["otif_avg"] * b["n_clientes"] for b in branches) / total_clients
            if total_clients else 0
        )

        return {
            "total_clientes":        total_clients,
            "total_revenue_ars":     total_revenue,
            "n_conflictos":          n_conflicts,
            "pct_conflictos":        round(n_conflicts / total_clients * 100, 1) if total_clients else 0,
            "revenue_en_riesgo":     revenue_at_risk,
            "ahorro_potencial_km":   round(savings_km, 0),
            "reduccion_media_pct":   round(avg_reduction, 1),
            "otif_global":           round(weighted_otif, 2),
            "otif_ganancia_est":     round(avg_reduction * 0.05, 2),  # empirical: 1% dist ≈ 0.05% OTIF
            "n_branches":            len(branches),
        }

from __future__ import annotations

import json
import pathlib

from sqlalchemy.orm import Session

from backend.repositories.territory_repository import TerritoryRepository

# ── Thresholds for load classification ────────────────────────────────────────
# Composite score: 40% client-volume, 30% OTIF (inverted), 30% avg-distance
_SATURADA_SCORE  = 0.65
_ALTA_CARGA_SCORE = 0.40

# Expansion JSON from GIS outputs (pre-computed)
_EXPANSION_PATH = (
    pathlib.Path(__file__).parent.parent.parent
    / "web" / "public" / "data" / "gis_outputs" / "expansion_recommendations.json"
)
_OPPORTUNITY_PATH = (
    pathlib.Path(__file__).parent.parent.parent
    / "web" / "public" / "data" / "gis_outputs" / "opportunity_score.json"
)


def _load_json(path: pathlib.Path) -> list[dict]:
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return []


def _classify_load(
    n_clientes: int,
    max_clientes: int,
    otif_avg: float,
    avg_distance_km: float,
    max_distance_km: float,
) -> str:
    """Return NORMAL | ALTA_CARGA | SATURADA."""
    vol   = n_clientes  / max(max_clientes,  1)
    otif  = max(0.0, 1.0 - otif_avg / 100.0)  # high OTIF = low stress
    dist  = avg_distance_km / max(max_distance_km, 1)
    score = vol * 0.40 + otif * 0.30 + dist * 0.30
    if score >= _SATURADA_SCORE:
        return "SATURADA"
    if score >= _ALTA_CARGA_SCORE:
        return "ALTA_CARGA"
    return "NORMAL"


LOAD_COLOR = {
    "NORMAL":     "#22C55E",
    "ALTA_CARGA": "#F97316",
    "SATURADA":   "#E03E3E",
}


class TerritoryService:
    def __init__(self, db: Session):
        self._repo = TerritoryRepository(db)

    # ── Public API ─────────────────────────────────────────────────────────────

    def get_branches(self) -> list[dict]:
        branches = self._repo.get_branches()
        if not branches:
            return []

        max_clients = max(b["n_clientes"] for b in branches)
        max_dist    = max(b["avg_distance_km"] for b in branches)

        for b in branches:
            load = _classify_load(
                b["n_clientes"], max_clients,
                b["otif_avg"],
                b["avg_distance_km"], max_dist,
            )
            b["load_status"] = load
            b["load_color"]  = LOAD_COLOR[load]
            b["revenue_total_m"] = round(b["revenue_total"] / 1_000_000, 2)
            b["pct_clientes"]    = round(b["n_clientes"] / max(sum(x["n_clientes"] for x in branches), 1) * 100, 1)

        return branches

    def get_conflicts(self, threshold_pct: float = 20.0) -> list[dict]:
        return self._repo.get_reassignment_candidates(threshold_pct)

    def get_status(self) -> dict:
        branches  = self._repo.get_branches()
        conflicts = self._repo.get_reassignment_candidates(improvement_threshold_pct=20.0)
        summary   = self._repo.get_status_summary(branches, conflicts)

        # Add load classification summary
        if branches:
            max_clients = max(b["n_clientes"] for b in branches)
            max_dist    = max(b["avg_distance_km"] for b in branches)
            load_counts = {"NORMAL": 0, "ALTA_CARGA": 0, "SATURADA": 0}
            for b in branches:
                load = _classify_load(
                    b["n_clientes"], max_clients,
                    b["otif_avg"], b["avg_distance_km"], max_dist,
                )
                load_counts[load] += 1
            summary["load_distribution"] = load_counts

        return summary

    def get_optimization(self) -> dict:
        """High-level optimization recommendations."""
        conflicts = self.get_conflicts(threshold_pct=20.0)
        branches  = self.get_branches()

        # Group conflicts by destination (nearest) branch
        recomendaciones = {}
        for c in conflicts:
            nid = c["nearest_id"]
            if nid not in recomendaciones:
                recomendaciones[nid] = {
                    "sucursal_id":    nid,
                    "sucursal_nombre": c["nearest_nombre"],
                    "clientes":        [],
                    "revenue_ganado":  0.0,
                    "ahorro_km_total": 0.0,
                }
            recomendaciones[nid]["clientes"].append(c["cliente_id"])
            recomendaciones[nid]["revenue_ganado"]  += c["revenue_ars"]
            recomendaciones[nid]["ahorro_km_total"] += c["improvement_km"]

        for v in recomendaciones.values():
            v["n_clientes"]       = len(v["clientes"])
            v["ahorro_km_total"]  = round(v["ahorro_km_total"], 1)
            v["revenue_ganado"]   = round(v["revenue_ganado"], 0)
            del v["clientes"]   # keep payload small

        # Per-branch conflict summary
        branch_conflicts: dict[int, int] = {}
        for c in conflicts:
            branch_conflicts[c["current_id"]] = branch_conflicts.get(c["current_id"], 0) + 1

        for b in branches:
            b["n_conflictos"] = branch_conflicts.get(b["sucursal_id"], 0)

        total_revenue = sum(b["revenue_total"] for b in branches)
        total_revenue_en_riesgo = sum(c["revenue_ars"] for c in conflicts)

        return {
            "n_conflictos":          len(conflicts),
            "revenue_en_riesgo":     round(total_revenue_en_riesgo, 0),
            "pct_revenue_en_riesgo": round(total_revenue_en_riesgo / max(total_revenue, 1) * 100, 1),
            "recomendaciones":       list(recomendaciones.values()),
            "branches":              branches,
            "top_conflicts":         conflicts[:50],
        }

    def get_expansion(self) -> list[dict]:
        """Return expansion candidates ranked by expansion_score + opportunity_score."""
        exp   = _load_json(_EXPANSION_PATH)
        opp   = {f"{r.get('provincia','')}/{r.get('lat','')}/{r.get('lon','')}": r
                 for r in _load_json(_OPPORTUNITY_PATH)}

        result = []
        for rec in exp:
            key = f"{rec.get('provincia','')}/{rec.get('lat','')}/{rec.get('lon','')}"
            opp_rec = opp.get(key, {})
            result.append({
                "provincia":        rec.get("provincia"),
                "ciudad":           rec.get("ciudad_candidata"),
                "lat":              rec.get("lat"),
                "lon":              rec.get("lon"),
                "expansion_score":  rec.get("expansion_score", 0),
                "gap_score":        rec.get("gap_score", 0),
                "opportunity_score": rec.get("opportunity_score", opp_rec.get("opportunity_score", 0)),
                "dist_km":          rec.get("dist_sucursal_mas_cercana_km", 0),
                "agr_ha_m":         rec.get("agr_ha_m", 0),
                "cluster":          rec.get("cluster"),
                "justificacion":    rec.get("justificacion", ""),
                "n_activos":        opp_rec.get("n_activos", 0),
                "penetracion_idx":  opp_rec.get("penetracion_idx", 0),
                # ROI estimate: expansion_score × gap_score × 10M ARS base (heuristic)
                "roi_est_m_ars":    round(
                    rec.get("expansion_score", 0) * rec.get("gap_score", 0) * 10, 2
                ),
            })

        result.sort(key=lambda x: x["expansion_score"], reverse=True)
        return result[:20]

from __future__ import annotations

from sqlalchemy.orm import Session

from backend.repositories.network_repository import NetworkRepository

# ── Thresholds ─────────────────────────────────────────────────────────────────
# score = utilizacion*0.40 + (1-otif/100)*0.35 + dias_demora_norm*0.25

_CRÍTICO_SCORE   = 0.55
_ALTO_USO_SCORE  = 0.35

LOAD_COLOR = {
    "NORMAL":   "#22C55E",
    "ALTO_USO": "#F97316",
    "CRÍTICO":  "#E03E3E",
}


def _classify_depot(
    utilizacion_pct: float,
    otif_pct:        float,
    dias_demora_prom: float,
    max_demora:      float,
) -> str:
    util  = utilizacion_pct / 100.0
    otif  = max(0.0, 1.0 - otif_pct / 100.0)
    delay = dias_demora_prom / max(max_demora, 1.0)
    score = util * 0.40 + otif * 0.35 + delay * 0.25
    if score >= _CRÍTICO_SCORE:
        return "CRÍTICO"
    if score >= _ALTO_USO_SCORE:
        return "ALTO_USO"
    return "NORMAL"


class NetworkService:
    def __init__(self, db: Session):
        self._repo = NetworkRepository(db)

    def get_depots(self) -> list[dict]:
        depots = self._repo.get_depots()
        if not depots:
            return []
        max_delay = max((d["dias_demora_prom"] for d in depots), default=1.0) or 1.0
        for d in depots:
            status = _classify_depot(
                d["utilizacion_pct"], d["otif_pct"], d["dias_demora_prom"], max_delay
            )
            d["load_status"] = status
            d["load_color"]  = LOAD_COLOR[status]
            # capacidad_ton is physical depot capacity; utilizacion_pct from inventory items
            d["capacidad_libre_ton"] = round(
                d["capacidad_ton"] * max(0.0, 1.0 - d["utilizacion_pct"] / 100.0), 1
            )
        return depots

    def get_flows(self) -> list[dict]:
        return self._repo.get_flows()

    def get_capacity(self) -> list[dict]:
        """Depot capacity breakdown sorted by utilizacion_pct desc."""
        depots = self.get_depots()
        return sorted(depots, key=lambda d: -d["utilizacion_pct"])

    def get_bottlenecks(self) -> list[dict]:
        depots = self.get_depots()
        return [d for d in depots if d["load_status"] in ("CRÍTICO", "ALTO_USO")]

    def get_status(self) -> dict:
        depots = self.get_depots()
        flows  = self.get_flows()
        summary = self._repo.get_status_summary(depots, flows)
        return summary

    def get_simulation(self, closed_deposito_id: int) -> dict:
        """
        Scenario: depot X stops operating.
        - Flows that originate there get redistributed to other depots.
        - Estimate OTIF impact, capacity overflow, affected clients.
        """
        depots   = self.get_depots()
        flows    = self.get_flows()
        all_envios = sum(d["n_envios"] for d in depots)

        closed = next((d for d in depots if d["deposito_id"] == closed_deposito_id), None)
        if not closed:
            return {"error": f"Depósito {closed_deposito_id} no encontrado"}

        remaining = [d for d in depots if d["deposito_id"] != closed_deposito_id]
        affected_flows = [f for f in flows if f["deposito_id"] == closed_deposito_id]

        affected_envios = closed["n_envios"]
        affected_revenue = closed["costo_flete_total"]

        # Distribute to nearest remaining depots proportionally
        if remaining:
            cap_remaining = sum(d["capacidad_ton"] for d in remaining)
            overflow = max(0, affected_envios - sum(
                max(0, d["capacidad_ton"] - d["stock_actual"] / 1000)
                for d in remaining
            ))
            redistrib = []
            for d in remaining:
                share = (d["capacidad_ton"] / max(cap_remaining, 1)) * affected_envios
                new_util = min(100, d["utilizacion_pct"] + share * 100 / max(d["capacidad_ton"] * 10, 1))
                redistrib.append({
                    "deposito_id":   d["deposito_id"],
                    "nombre":        d["nombre"],
                    "n_recibidos":   round(share),
                    "nueva_util_pct": round(new_util, 1),
                    "nuevo_status":  _classify_depot(
                        new_util, d["otif_pct"] * 0.95,
                        d["dias_demora_prom"] + 0.5, 10
                    ),
                })
        else:
            overflow = affected_envios
            redistrib = []

        # OTIF degradation estimate: +1 día demora → -2pp OTIF
        otif_delta = -closed["dias_demora_prom"] * 2 - 3  # at least -3pp for disruption

        return {
            "deposito_cerrado_id":    closed_deposito_id,
            "deposito_cerrado_nombre":closed["nombre"],
            "n_envios_afectados":     affected_envios,
            "pct_red_afectado":       round(affected_envios / max(all_envios, 1) * 100, 1),
            "costo_flete_perdido":    affected_revenue,
            "n_rutas_afectadas":      len(affected_flows),
            "overflow_estimado":      round(overflow),
            "otif_delta_pp":          round(otif_delta, 1),
            "redistribucion":         redistrib,
            "top_flows_afectados":    affected_flows[:10],
        }

"""
AI Spatial Intelligence — GIS-18.
All analytics derived from existing GIS output files. No mocks, no ML artifacts.
Algorithms: linear trend regression, composite scoring, 2x2 opportunity matrix.
"""
from __future__ import annotations

import json
import math
from pathlib import Path

_REPO = Path(__file__).resolve().parents[2]
_GIS_DIR = _REPO / "data" / "gis_outputs"
_GEO_DIR = _REPO / "web" / "public" / "data" / "geo"

# Revenue-per-million-hectare estimate (derived from existing province data)
_REV_PER_HA_M = 180_000_000.0
# Capex base (ARS, millions) + distance scaling
_CAPEX_BASE_MARD = 50.0
_CAPEX_PER_KM = 0.15
# Working-capital multiple
_CAPEX_WC_MULT = 1.20


def _load(path: Path) -> list | dict:
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


# ─── Linear regression helpers ───────────────────────────────────────────────

def _ols_slope_intercept(xs: list[float], ys: list[float]) -> tuple[float, float]:
    n = len(xs)
    if n < 2:
        return 0.0, ys[0] if ys else 0.0
    x_mean = sum(xs) / n
    y_mean = sum(ys) / n
    denom = sum((x - x_mean) ** 2 for x in xs)
    if denom == 0:
        return 0.0, y_mean
    slope = sum((xs[i] - x_mean) * (ys[i] - y_mean) for i in range(n)) / denom
    intercept = y_mean - slope * x_mean
    return slope, intercept


def _cagr(v_start: float, v_end: float, years: int) -> float:
    if v_start <= 0 or v_end <= 0 or years <= 0:
        return 0.0
    return (v_end / v_start) ** (1.0 / years) - 1.0


def _trend_label(cagr: float) -> str:
    if cagr >= 0.04:
        return "CRECIENTE"
    if cagr <= -0.02:
        return "DECRECIENTE"
    return "ESTABLE"


def _confidence(n_years: int) -> str:
    if n_years >= 6:
        return "ALTA"
    if n_years >= 3:
        return "MEDIA"
    return "BAJA"


# ─── 1. Expansion recommendations ────────────────────────────────────────────

def expansion_recommendations() -> dict:
    candidates: list[dict] = _load(_GIS_DIR / "expansion_recommendations.json")
    opp_raw: list[dict]    = _load(_GIS_DIR / "opportunity_score.json")
    tc: dict               = _load(_GIS_DIR / "transport_costs.json")

    opp_by_prov = {o["provincia"]: o for o in opp_raw}
    avg_dist_suc = 150.0  # fallback km

    # Average cost per km from transport_costs
    cost_per_kg = tc.get("cost_per_kg_ars", 21.52) if isinstance(tc, dict) else 21.52

    items = []
    for rank, cand in enumerate(candidates, start=1):
        prov   = cand["provincia"]
        dist   = cand.get("dist_sucursal_mas_cercana_km", avg_dist_suc)
        agr_ha = cand.get("agr_ha_m", 1.0)
        exp_sc = cand.get("expansion_score", 50.0)
        opp_sc = cand.get("opportunity_score", 50.0)
        cluster = cand.get("cluster", "—")

        # Capex model: base + distance premium + working capital
        capex = (_CAPEX_BASE_MARD + dist * _CAPEX_PER_KM) * _CAPEX_WC_MULT
        capex = round(capex, 1)

        # Annual revenue estimate (conservative: 60 % of theoretical potential)
        annual_rev = round(agr_ha * _REV_PER_HA_M * 0.60 / 1_000_000, 2)  # in M ARS

        roi = round((annual_rev / capex) * 100, 1) if capex > 0 else 0.0
        payback = round(capex / annual_rev, 1) if annual_rev > 0 else 99.0

        # Priority
        if exp_sc >= 62:
            priority = "ALTA"
        elif exp_sc >= 57:
            priority = "MEDIA"
        else:
            priority = "BAJA"

        # AI rationale based on real data
        opp_extra = opp_by_prov.get(prov, {})
        pen_idx = opp_extra.get("penetracion_idx", 0)
        pen_note = "0 clientes activos — mercado virgen" if pen_idx < 1 else f"penetración actual {pen_idx:.0f}"
        rationale = (
            f"Prioridad {priority}: {agr_ha:.1f}M ha agrícolas, {pen_note}, "
            f"opportunity_score {opp_sc:.1f}/100, dist. {dist:.0f} km. "
            f"Capex est. ${capex:.0f}M ARS → payback {payback:.1f} años. "
            f"Cluster: {cluster}."
        )

        items.append({
            "rank": rank,
            "provincia": prov,
            "ciudad_candidata": cand.get("ciudad_candidata", prov),
            "macro_region": cand.get("macro_region", "—"),
            "lat": cand.get("lat", 0.0),
            "lon": cand.get("lon", 0.0),
            "expansion_score": round(exp_sc, 1),
            "opportunity_score": round(opp_sc, 1),
            "agr_ha_m": agr_ha,
            "dist_sucursal_km": round(dist, 1),
            "cluster": cluster,
            "capex_estimate_mard_ars": capex,
            "annual_revenue_estimate_mard_ars": annual_rev,
            "roi_estimate_pct": roi,
            "payback_years": payback,
            "priority": priority,
            "ai_rationale": rationale,
        })

    return {
        "model": "rule-based-v1",
        "total_candidates": len(items),
        "items": items,
    }


# ─── 2. Revenue forecast ─────────────────────────────────────────────────────

def revenue_forecast_province() -> dict:
    ts_raw: dict = _load(_GEO_DIR / "province_timeseries.json")
    kpis:  list  = _load(_GEO_DIR / "province_kpis.json")

    if not isinstance(ts_raw, dict):
        ts_raw = {}

    # Build per-province revenue series from timeseries
    prov_series: dict[str, list[tuple[int, float]]] = {}
    for year_str, records in ts_raw.items():
        try:
            yr = int(year_str)
        except ValueError:
            continue
        for rec in records:
            pname = rec.get("nombre") or rec.get("provincia")
            rev   = rec.get("revenue_ars", 0.0)
            if pname and rev > 0:
                prov_series.setdefault(pname, []).append((yr, float(rev)))

    # Current KPI lookup for meta
    kpi_by_prov = {k.get("nombre"): k for k in kpis}

    items = []
    for pname, series in sorted(prov_series.items()):
        series.sort(key=lambda t: t[0])
        xs = [float(t[0]) for t in series]
        ys = [t[1] for t in series]

        slope, intercept = _ols_slope_intercept(xs, ys)

        def proj(year: int) -> float:
            return max(0.0, intercept + slope * year)

        rev_2016 = ys[0]
        rev_2024 = ys[-1] if len(ys) >= 1 else proj(2024)
        rev_start = rev_2016
        rev_end   = rev_2024
        n_yrs     = series[-1][0] - series[0][0]

        cagr = _cagr(rev_start, rev_end, n_yrs) if n_yrs > 0 else 0.0

        meta = kpi_by_prov.get(pname, {})

        items.append({
            "provincia": pname,
            "macro_region": meta.get("macro_region", "—"),
            "lat": meta.get("lat", 0.0),
            "lon": meta.get("lon", 0.0),
            "revenue_2024_ars": round(rev_end, 0),
            "cagr_pct": round(cagr * 100, 2),
            "forecast_2025_ars": round(proj(2025), 0),
            "forecast_2026_ars": round(proj(2026), 0),
            "forecast_2027_ars": round(proj(2027), 0),
            "forecast_2028_ars": round(proj(2028), 0),
            "forecast_2029_ars": round(proj(2029), 0),
            "trend": _trend_label(cagr),
            "confidence": _confidence(len(series)),
        })

    # Sort by forecast_2027 descending
    items.sort(key=lambda x: x["forecast_2027_ars"], reverse=True)

    return {
        "model": "linear-trend-v1",
        "base_years": "2016-2024",
        "items": items,
    }


# ─── 3. Churn geographic risk ─────────────────────────────────────────────────

def churn_geographic_risk() -> dict:
    churn_raw:    list = _load(_GIS_DIR / "churn_by_province.json")
    route_risk:   dict = _load(_GIS_DIR / "route_risk.json")
    coverage_raw: list = _load(_GIS_DIR / "coverage_score.json")

    # Compute mean logistics risk from route_risk (depot level → aggregate)
    depots = route_risk.get("by_deposito", []) if isinstance(route_risk, dict) else []
    if depots:
        log_risk_mean = sum(d.get("pct_demorado", 0) / 100.0 for d in depots) / len(depots)
    else:
        log_risk_mean = 0.05  # fallback 5 %

    # Coverage by province lookup
    cov_by_prov = {c["provincia"]: c for c in coverage_raw}

    items = []
    for rec in churn_raw:
        pname       = rec["provincia"]
        churn_score = float(rec.get("churn_score", 0.0))
        n_activos   = int(rec.get("n_activos", 0))
        macro       = rec.get("macro_region", "—")
        lat         = float(rec.get("lat", 0.0))
        lon         = float(rec.get("lon", 0.0))

        # Coverage gap: 1 − coverage_score/100 (if no data → gap = 1.0)
        cov = cov_by_prov.get(pname)
        if cov:
            coverage_gap = 1.0 - min(cov.get("coverage_score", 0.0), 100.0) / 100.0
        else:
            coverage_gap = 1.0  # no coverage at all

        geo_risk = (
            0.4 * churn_score
            + 0.3 * log_risk_mean
            + 0.3 * coverage_gap
        )
        geo_risk = round(geo_risk, 4)

        if rec.get("churn_level") == "Sin Datos" and n_activos == 0:
            risk_label = "SIN DATOS"
            action = "Mercado virgen — evaluar plan de entrada"
        elif geo_risk > 0.45:
            risk_label = "ALTO"
            action = "Intervención urgente: retención + mejora logística + cobertura"
        elif geo_risk > 0.30:
            risk_label = "MEDIO"
            action = "Monitoreo activo: revisar OTIF, segmentación de clientes"
        else:
            risk_label = "BAJO"
            action = "Mantener cobertura actual, optimizar margen bruto"

        items.append({
            "provincia": pname,
            "macro_region": macro,
            "lat": lat,
            "lon": lon,
            "n_activos": n_activos,
            "churn_rate": round(float(rec.get("churn_rate", 0.0)), 4),
            "logistics_risk_score": round(log_risk_mean, 4),
            "coverage_gap_pct": round(coverage_gap * 100, 1),
            "geo_risk_score": geo_risk,
            "risk_label": risk_label,
            "recommended_action": action,
        })

    # Sort: ALTO first, then MEDIO, BAJO, SIN DATOS
    _ORDER = {"ALTO": 0, "MEDIO": 1, "BAJO": 2, "SIN DATOS": 3}
    items.sort(key=lambda x: (_ORDER.get(x["risk_label"], 9), -x["geo_risk_score"]))

    return {
        "model": "composite-geo-risk-v1",
        "weights": {"churn": 0.4, "logistics": 0.3, "coverage_gap": 0.3},
        "items": items,
    }


# ─── 4. Opportunity matrix ────────────────────────────────────────────────────

def opportunity_matrix() -> dict:
    opp_raw: list   = _load(_GIS_DIR / "opportunity_score.json")
    churn_raw: list = _load(_GIS_DIR / "churn_by_province.json")
    rev_raw: list   = _load(_GIS_DIR / "revenue_density.json")

    churn_by_prov = {c["provincia"]: c for c in churn_raw}
    rev_by_prov   = {r["provincia"]: r for r in rev_raw}

    # Normalize penetracion_idx to 0-100
    pen_values = [o.get("penetracion_idx", 0.0) for o in opp_raw]
    max_pen = max(pen_values, default=1.0) or 1.0

    OPP_THRESHOLD = 50.0
    PEN_THRESHOLD = 50.0  # in normalised scale

    quadrant_counts: dict[str, int] = {"INVEST": 0, "GROW": 0, "DEFEND": 0, "MONITOR": 0}
    items = []

    for rec in opp_raw:
        pname  = rec["provincia"]
        macro  = rec.get("macro_region", "—")
        lat    = float(rec.get("lat", 0.0))
        lon    = float(rec.get("lon", 0.0))
        opp_sc = float(rec.get("opportunity_score", 0.0))
        pen_raw = float(rec.get("penetracion_idx", 0.0))
        pen_norm = round((pen_raw / max_pen) * 100.0, 2)

        high_opp = opp_sc > OPP_THRESHOLD
        high_pen = pen_norm > PEN_THRESHOLD

        if high_opp and not high_pen:
            quadrant = "INVEST"
            label    = "Oportunidad abierta"
            action   = "Alta ha agrícola + baja penetración → abrir sucursal o zona comercial"
        elif high_opp and high_pen:
            quadrant = "GROW"
            label    = "Escalar agresivamente"
            action   = "Mercado activo con alto potencial residual → aumentar cartera y producto"
        elif not high_opp and high_pen:
            quadrant = "DEFEND"
            label    = "Mercado maduro"
            action   = "Penetración sólida en mercado acotado → defender share, mejorar margen"
        else:
            quadrant = "MONITOR"
            label    = "Observar y esperar"
            action   = "Baja oportunidad + baja penetración → no priorizar, monitorear"

        quadrant_counts[quadrant] += 1

        # Composite score: weighted average
        comp = round(0.6 * opp_sc + 0.4 * pen_norm, 2)

        # Enrich with churn and density context
        churn = churn_by_prov.get(pname, {})
        rev   = rev_by_prov.get(pname, {})
        churn_note = f"churn {churn.get('churn_rate', 0):.1%}" if churn else ""
        density_sc = rev.get("density_score", 0.0) if rev else 0.0

        items.append({
            "provincia": pname,
            "macro_region": macro,
            "lat": lat,
            "lon": lon,
            "opportunity_score": round(opp_sc, 1),
            "penetracion_idx_norm": pen_norm,
            "penetracion_idx_raw": pen_raw,
            "quadrant": quadrant,
            "quadrant_label": label,
            "recommended_action": action,
            "composite_score": comp,
        })

    # Sort by composite_score desc
    items.sort(key=lambda x: x["composite_score"], reverse=True)

    return {
        "model": "2x2-opportunity-matrix-v1",
        "thresholds": {"opportunity_score": OPP_THRESHOLD, "penetracion_norm": PEN_THRESHOLD},
        "quadrant_counts": quadrant_counts,
        "items": items,
    }

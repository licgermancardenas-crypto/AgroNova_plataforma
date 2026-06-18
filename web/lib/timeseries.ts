/**
 * Temporal KPI engine for AgroNova GIS-12.
 *
 * Uses PROVINCE_KPIS (2026 baseline) and applies compound growth/decay
 * curves to synthesize historically plausible data for 2016–2026.
 *
 * Growth model (per macro-region, nominal ARS, going back from 2026):
 *   PAM  28%/yr  — Pampa, mature base + inflation
 *   NOA  32%/yr  — faster organic expansion
 *   NEA  30%/yr
 *   CUY  25%/yr
 *   PAT  22%/yr  — smallest market, slowest growth
 *
 * OTIF improves +0.65 pct-pts/yr  (past years = lower OTIF)
 * Churn worsens  +0.015/yr         (past years = higher churn)
 * Margin improves+0.12 pct-pts/yr
 */

import type { ProvinceKPI, GisMetric } from "@/types";
import { PROVINCE_KPIS } from "@/lib/geo-data";

export const YEAR_MIN = 2016;
export const YEAR_MAX = 2026;
export const BASELINE_YEAR = 2026;

// ── Growth parameters ─────────────────────────────────────────────────────────

const REV_GROWTH: Record<string, number> = {
  PAM: 0.280,
  NOA: 0.320,
  NEA: 0.300,
  CUY: 0.250,
  PAT: 0.220,
};

const CLI_GROWTH: Record<string, number> = {
  PAM: 0.090,
  NOA: 0.115,
  NEA: 0.105,
  CUY: 0.082,
  PAT: 0.070,
};

const OTIF_DELTA_PER_YEAR  =  0.65;  // pct-pts per year
const CHURN_DELTA_PER_YEAR =  0.015; // per year (higher in the past)
const MARGIN_DELTA_PER_YEAR=  0.12;  // pct-pts per year

// ── Per-province variation seed ───────────────────────────────────────────────

function seed(kpi: ProvinceKPI): number {
  return Math.sin(kpi.lat * 0.31 + kpi.lon * 0.07);
}

// ── Single KPI projection ─────────────────────────────────────────────────────

export function getKpiForYear(kpi: ProvinceKPI, year: number): ProvinceKPI {
  const yearsBack = BASELINE_YEAR - year;
  if (yearsBack === 0) return kpi;

  const revRate = REV_GROWTH[kpi.macro_region] ?? 0.27;
  const cliRate = CLI_GROWTH[kpi.macro_region] ?? 0.09;
  const s       = seed(kpi);

  // Compound interest in reverse
  const revFactor = Math.pow(1 + revRate * (1 + s * 0.05), yearsBack);
  const cliFactor = Math.pow(1 + cliRate * (1 + s * 0.03), yearsBack);

  const revenue  = Math.max(1_000_000, Math.round(kpi.revenue_ars / revFactor));
  const nActivos = Math.max(1, Math.round(kpi.n_activos / cliFactor));
  const nCli     = Math.max(1, Math.round(kpi.n_clientes / Math.pow(1 + cliRate * 0.8 * (1 + s * 0.02), yearsBack)));
  const margen   = parseFloat(Math.max(12, kpi.margen_pct - MARGIN_DELTA_PER_YEAR * yearsBack + s * 0.3).toFixed(1));
  const otif     = parseFloat(Math.max(70, kpi.otif_pct   - OTIF_DELTA_PER_YEAR   * yearsBack + s * 0.2).toFixed(1));
  const churn    = parseFloat(Math.min(0.90, kpi.churn_score + CHURN_DELTA_PER_YEAR * yearsBack + Math.abs(s) * 0.01).toFixed(3));

  return {
    ...kpi,
    revenue_ars:  revenue,
    revenue_pct:  0, // recalculated below in getKpisByYear
    n_activos:    nActivos,
    n_clientes:   nCli,
    margen_pct:   margen,
    otif_pct:     otif,
    churn_score:  churn,
  };
}

// ── Full year snapshot ────────────────────────────────────────────────────────

export function getKpisByYear(year: number): ProvinceKPI[] {
  const raw   = PROVINCE_KPIS.map(kpi => getKpiForYear(kpi, year));
  const total = raw.reduce((s, k) => s + k.revenue_ars, 0);
  return raw.map(k => ({
    ...k,
    revenue_pct: parseFloat(((k.revenue_ars / total) * 100).toFixed(2)),
  }));
}

// ── National totals for a year ────────────────────────────────────────────────

export interface NationalTotals {
  revenue_ars:    number;
  n_clientes:     number;
  n_activos:      number;
  provincias:     number;
  provincias_pam: number;
}

export function getNationalTotalsForYear(year: number): NationalTotals {
  const kpis = getKpisByYear(year);
  return {
    revenue_ars:    kpis.reduce((s, p) => s + p.revenue_ars, 0),
    n_clientes:     kpis.reduce((s, p) => s + p.n_clientes, 0),
    n_activos:      kpis.reduce((s, p) => s + p.n_activos, 0),
    provincias:     kpis.length,
    provincias_pam: kpis.filter(p => p.macro_region === "PAM").length,
  };
}

// ── Low coverage for year ─────────────────────────────────────────────────────

export function getLowCoverageForYear(year: number): ProvinceKPI[] {
  return getKpisByYear(year)
    .filter(p => p.n_activos < 50 && p.agr_ha_m > 0.3)
    .sort((a, b) => b.agr_ha_m - a.agr_ha_m)
    .slice(0, 5);
}

// ── Growth helper for UI trend arrows ────────────────────────────────────────

export function yoyGrowth(
  kpi: ProvinceKPI,
  metric: GisMetric,
  year: number,
): { pct: number; absolute: number } | null {
  if (year <= YEAR_MIN) return null;
  const curr = getKpiForYear(kpi, year);
  const prev = getKpiForYear(kpi, year - 1);

  const getVal = (k: ProvinceKPI): number => {
    switch (metric) {
      case "revenue":   return k.revenue_ars;
      case "clientes":  return k.n_activos;
      case "margen":    return k.margen_pct;
      case "churn":     return k.churn_score;
      case "otif":      return k.otif_pct;
    }
  };

  const currVal = getVal(curr);
  const prevVal = getVal(prev);
  if (prevVal === 0) return null;
  return {
    pct:      parseFloat((((currVal - prevVal) / Math.abs(prevVal)) * 100).toFixed(1)),
    absolute: parseFloat((currVal - prevVal).toFixed(1)),
  };
}

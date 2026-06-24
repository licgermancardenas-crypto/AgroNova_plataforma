"use client";

import { memo, useMemo } from "react";
import { useCountUp } from "@/hooks/useCountUp";
import type { ProvinceKPI, GisMetric } from "@/types";
import type { NationalTotals } from "@/lib/timeseries";
import { getNationalTotalsForYear, getKpisByYear, YEAR_MIN, YEAR_MAX } from "@/lib/timeseries";
import { fmtARS, fmtNumber } from "@/lib/formatters";

// ── Tiny SVG sparkline ─────────────────────────────────────────────────────────

function Sparkline({ data, color, w = 56, h = 18 }: { data: number[]; color: string; w?: number; h?: number }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const xs = data.map((_, i) => (i / (data.length - 1)) * w);
  const ys = data.map(v => h - ((v - min) / range) * (h - 2) - 1);
  const d = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="flex-shrink-0">
      <defs>
        <linearGradient id={`sg-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={`${d} L${xs[xs.length - 1]},${h} L0,${h} Z`}
        fill={`url(#sg-${color.replace("#", "")})`}
      />
      <path d={d} stroke={color} strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r="2" fill={color} />
    </svg>
  );
}

// ── Individual KPI chip ────────────────────────────────────────────────────────

interface KpiChipProps {
  icon: string;
  label: string;
  value: string;
  delta: number;
  sparkData: number[];
  color: string;
  isActive: boolean;
  onClick?: () => void;
}

const KpiChip = memo(function KpiChip({ icon, label, value, delta, sparkData, color, isActive, onClick }: KpiChipProps) {
  const positive = delta >= 0;
  return (
    <button
      onClick={onClick}
      className="flex flex-col gap-0.5 px-2.5 py-1.5 rounded-xl border transition-all flex-shrink-0 text-left"
      style={{
        background:   isActive ? `${color}14` : "rgba(5,12,6,0.70)",
        borderColor:  isActive ? `${color}45` : "rgba(26,61,32,0.60)",
        boxShadow:    isActive ? `0 0 16px ${color}14` : "none",
        minWidth: 110,
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span style={{ fontSize: 10 }}>{icon}</span>
          <span className="font-mono uppercase tracking-widest" style={{ fontSize: 7.5, color: isActive ? color : "#3E5A3E" }}>
            {label}
          </span>
        </div>
        <span
          className="font-mono px-1 rounded"
          style={{
            fontSize: 7.5,
            background: positive ? "rgba(34,197,94,0.10)" : "rgba(239,68,68,0.10)",
            color:      positive ? "#4ADE80" : "#F87171",
          }}
        >
          {positive ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}%
        </span>
      </div>
      <div className="flex items-end justify-between gap-2">
        <span className="font-mono font-bold leading-none" style={{ fontSize: 13, color: isActive ? color : "#DCE8DC" }}>
          {value}
        </span>
        <Sparkline data={sparkData} color={isActive ? color : "#2D4A2D"} />
      </div>
    </button>
  );
});

// ── Year samples ───────────────────────────────────────────────────────────────

const SPARK_YEARS = [2021, 2022, 2023, 2024, 2025, YEAR_MAX];

// ── KPI Ribbon ────────────────────────────────────────────────────────────────

interface KpiRibbonProps {
  nationalTotals: NationalTotals;
  currentKpis: ProvinceKPI[];
  metric: GisMetric;
  onMetricChange: (m: GisMetric) => void;
}

const KpiRibbon = memo(function KpiRibbon({ nationalTotals, currentKpis, metric, onMetricChange }: KpiRibbonProps) {
  const sparkYearData = useMemo(() =>
    SPARK_YEARS.map(y => ({
      totals: getNationalTotalsForYear(y),
      kpis:   getKpisByYear(y),
    })),
  []);

  const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / (arr.length || 1);

  const revenueData  = sparkYearData.map(d => d.totals.revenue_ars / 1e9);
  const clienteData  = sparkYearData.map(d => d.totals.n_activos);
  const otifData     = sparkYearData.map(d => avg(d.kpis.map(k => k.otif_pct)));
  const margenData   = sparkYearData.map(d => avg(d.kpis.map(k => k.margen_pct)));
  const cobertData   = sparkYearData.map(d => (d.totals.n_activos / Math.max(d.totals.n_clientes, 1)) * 100);
  const churnData    = sparkYearData.map(d => avg(d.kpis.map(k => k.churn_score * 100)));
  const riesgoData   = sparkYearData.map(d => avg(d.kpis.map(k => k.gap_score * 100)));

  const pct = (arr: number[]) => {
    const last = arr[arr.length - 1];
    const prev = arr[arr.length - 2];
    return prev ? ((last - prev) / prev) * 100 : 0;
  };

  const revBillions = useCountUp(nationalTotals.revenue_ars / 1e9, 1200, 2);
  const cliCount    = useCountUp(nationalTotals.n_activos, 1200, 0);
  const otifVal     = useCountUp(avg(currentKpis.map(k => k.otif_pct)), 1000, 1);
  const margenVal   = useCountUp(avg(currentKpis.map(k => k.margen_pct)), 1000, 1);
  const cobVal      = useCountUp((nationalTotals.n_activos / Math.max(nationalTotals.n_clientes, 1)) * 100, 1000, 1);
  const churnVal    = useCountUp(avg(currentKpis.map(k => k.churn_score * 100)), 1000, 1);
  const riskVal     = useCountUp(avg(currentKpis.map(k => k.gap_score * 100)), 1000, 1);

  const chips = [
    {
      icon: "💰", label: "Revenue", color: "#22C55E",
      value: `ARS ${revBillions.toFixed(2)}B`,
      delta: pct(revenueData), sparkData: revenueData,
      metricId: "revenue" as GisMetric,
    },
    {
      icon: "👥", label: "Clientes", color: "#4ADE80",
      value: fmtNumber(Math.round(cliCount)),
      delta: pct(clienteData), sparkData: clienteData,
      metricId: "clientes" as GisMetric,
    },
    {
      icon: "📦", label: "OTIF", color: "#0EA5E9",
      value: `${otifVal.toFixed(1)}%`,
      delta: pct(otifData), sparkData: otifData,
      metricId: "otif" as GisMetric,
    },
    {
      icon: "📈", label: "Margen", color: "#A3E635",
      value: `${margenVal.toFixed(1)}%`,
      delta: pct(margenData), sparkData: margenData,
      metricId: "margen" as GisMetric,
    },
    {
      icon: "🗺️", label: "Cobertura", color: "#0DB87E",
      value: `${cobVal.toFixed(0)}%`,
      delta: pct(cobertData), sparkData: cobertData,
      metricId: null,
    },
    {
      icon: "⚠️", label: "Churn", color: "#F97316",
      value: `${churnVal.toFixed(1)}%`,
      delta: -pct(churnData),
      sparkData: churnData,
      metricId: "churn" as GisMetric,
    },
    {
      icon: "🎯", label: "Riesgo", color: "#E8A020",
      value: riskVal < 30 ? "BAJO" : riskVal < 60 ? "MEDIO" : "ALTO",
      delta: pct(riesgoData), sparkData: riesgoData,
      metricId: null,
    },
  ];

  return (
    <div
      className="flex items-center gap-1.5 px-2 overflow-x-auto scrollbar-none flex-shrink-0"
      style={{ height: 60 }}
    >
      {chips.map(chip => (
        <KpiChip
          key={chip.label}
          icon={chip.icon}
          label={chip.label}
          value={chip.value}
          delta={chip.delta}
          sparkData={chip.sparkData}
          color={chip.color}
          isActive={chip.metricId !== null && metric === chip.metricId}
          onClick={chip.metricId !== null ? () => onMetricChange(chip.metricId as GisMetric) : undefined}
        />
      ))}
    </div>
  );
});

export default KpiRibbon;

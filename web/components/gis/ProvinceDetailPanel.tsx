"use client";

import {
  AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { TrendingUp, TrendingDown, Minus, Award, Users, Target } from "lucide-react";
import type { ProvinceKPI, GisMetric } from "@/types";
import { getMetricValue } from "@/lib/geo-data";
import { yoyGrowth, YEAR_MIN } from "@/lib/timeseries";
import { monthlyRevenue } from "@/lib/mock-data";
import { fmtARS, fmtNumber } from "@/lib/formatters";

// ── Derived data helpers ──────────────────────────────────────────────────────

function getRevenueTrend(kpi: ProvinceKPI): { label: string; val: number }[] {
  const last12 = monthlyRevenue.slice(-12);
  return last12.map(m => ({
    label: m.label,
    val:   Math.round(m.revenue_ars * (kpi.revenue_pct / 100) * (0.94 + Math.sin(kpi.lat * 0.3) * 0.06)),
  }));
}

function getClientTrend(kpi: ProvinceKPI): { label: string; val: number }[] {
  const base = kpi.n_activos;
  return ["Q1'24","Q2'24","Q3'24","Q4'24","Q1'25","Q2'25","Q3'25","Q4'25"].map((label, i) => ({
    label,
    val: Math.round(base * (0.82 + i * 0.025 + Math.sin(i + kpi.lon * 0.1) * 0.015)),
  }));
}

function getChurnData(kpi: ProvinceKPI): { name: string; val: number; color: string }[] {
  const high   = kpi.churn_score;
  const medium = Math.min(0.4, (1 - high) * 0.4);
  const low    = 1 - high - medium;
  return [
    { name: "Alto",  val: Math.round(high * 100),   color: "#E03E3E" },
    { name: "Medio", val: Math.round(medium * 100),  color: "#E8A020" },
    { name: "Bajo",  val: Math.round(low * 100),     color: "#22C55E" },
  ];
}

function nationalRank(kpi: ProvinceKPI, metric: GisMetric, allKpis: ProvinceKPI[]): number {
  const sorted = [...allKpis].sort((a, b) => getMetricValue(b, metric) - getMetricValue(a, metric));
  return sorted.findIndex(p => p.nombre === kpi.nombre) + 1;
}

function peerLeader(kpi: ProvinceKPI, metric: GisMetric, allKpis: ProvinceKPI[]): ProvinceKPI | null {
  return allKpis
    .filter(p => p.macro_region === kpi.macro_region && p.nombre !== kpi.nombre)
    .sort((a, b) => getMetricValue(b, metric) - getMetricValue(a, metric))[0] ?? null;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MiniTooltip({ active, payload, formatter }: {
  active?: boolean; payload?: { value: number }[]; formatter: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded px-2 py-1 text-2xs font-mono" style={{ fontSize: 9 }}>
      {formatter(payload[0].value)}
    </div>
  );
}

function YoyBadge({ pct, invert = false }: { pct: number; invert?: boolean }) {
  // invert=true for metrics where "up" is bad (churn)
  const good = invert ? pct < 0 : pct > 0;
  const col  = Math.abs(pct) < 0.5 ? "#7A9C7A" : good ? "#22C55E" : "#E03E3E";
  const sign = pct > 0 ? "+" : "";
  return (
    <span
      className="font-mono ml-1 text-2xs font-semibold"
      style={{ color: col, fontSize: 8, letterSpacing: 0 }}
    >
      {sign}{pct.toFixed(1)}%
    </span>
  );
}

function KpiRow({ label, value, color, sub, yoyPct, yoyInvert }: {
  label: string; value: string; color: string; sub?: string;
  yoyPct?: number | null; yoyInvert?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-border last:border-0">
      <div className="flex items-center">
        <span className="text-2xs text-text-muted">{label}</span>
        {sub && <span className="text-2xs text-text-muted ml-1 opacity-60">({sub})</span>}
        {yoyPct != null && <YoyBadge pct={yoyPct} invert={yoyInvert} />}
      </div>
      <span className="font-mono text-2xs font-bold" style={{ color }}>{value}</span>
    </div>
  );
}

function TrendIcon({ val }: { val: number }) {
  if (val > 0.15) return <TrendingUp size={10} className="text-success-DEFAULT" />;
  if (val > 0.05) return <TrendingUp size={10} style={{ color: "#E8A020" }} />;
  if (val < 0)    return <TrendingDown size={10} className="text-danger-DEFAULT" />;
  return <Minus size={10} className="text-text-muted" />;
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  kpi: ProvinceKPI;
  metric: GisMetric;
  onClose: () => void;
  year: number;
  allKpis: ProvinceKPI[];
}

export default function ProvinceDetailPanel({ kpi, metric, onClose, year, allKpis }: Props) {
  const rank        = nationalRank(kpi, metric, allKpis);
  const total       = allKpis.length;
  const leader      = peerLeader(kpi, metric, allKpis);
  const revTrend    = getRevenueTrend(kpi);
  const cliTrend    = getClientTrend(kpi);
  const churnData   = getChurnData(kpi);
  const rankPct     = ((total - rank) / total) * 100;
  const rankColor   = rank <= 5 ? "#22C55E" : rank <= 12 ? "#E8A020" : "#E03E3E";

  const otifColor   = kpi.otif_pct >= 93 ? "#22C55E" : kpi.otif_pct >= 88 ? "#E8A020" : "#E03E3E";
  const churnColor  = kpi.churn_score < 0.2 ? "#22C55E" : kpi.churn_score < 0.35 ? "#E8A020" : "#E03E3E";
  const margenColor = kpi.margen_pct >= 20 ? "#22C55E" : kpi.margen_pct >= 17 ? "#E8A020" : "#E03E3E";

  // YoY trends (null if at first year)
  const yoyRev  = year > YEAR_MIN ? yoyGrowth(kpi, "revenue",  year) : null;
  const yoyCli  = year > YEAR_MIN ? yoyGrowth(kpi, "clientes", year) : null;
  const yoyMar  = year > YEAR_MIN ? yoyGrowth(kpi, "margen",   year) : null;
  const yoyOtif = year > YEAR_MIN ? yoyGrowth(kpi, "otif",     year) : null;
  const yoyChr  = year > YEAR_MIN ? yoyGrowth(kpi, "churn",    year) : null;

  const leaderGap = leader
    ? ((getMetricValue(kpi, metric) / getMetricValue(leader, metric)) - 1)
    : 0;

  return (
    <div
      key={`${kpi.nombre}-${year}`}
      className="glass rounded-xl flex flex-col gap-0 overflow-hidden temporal-fade"
      style={{
        border: "1px solid rgba(34,197,94,0.22)",
        boxShadow: "0 0 24px rgba(34,197,94,0.07), 0 4px 20px rgba(0,0,0,0.4)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 flex-shrink-0"
        style={{
          background: "rgba(34,197,94,0.06)",
          borderBottom: "1px solid rgba(34,197,94,0.15)",
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0"
            style={{ boxShadow: "0 0 6px rgba(34,197,94,0.8)" }} />
          <div className="min-w-0">
            <p className="text-xs text-text-primary font-bold truncate leading-tight">{kpi.nombre}</p>
            <p className="tactical-text" style={{ fontSize: 9 }}>{kpi.macro_region} · {kpi.agr_ha_m.toFixed(1)}M ha · <span className="text-primary">{year}</span></p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center gap-1 px-2 py-0.5 rounded"
            style={{ background: `${rankColor}18`, border: `1px solid ${rankColor}40` }}>
            <Award size={8} style={{ color: rankColor }} />
            <span className="font-mono text-2xs font-bold" style={{ color: rankColor }}>#{rank}</span>
          </div>
          <button onClick={onClose}
            className="w-4 h-4 flex items-center justify-center rounded text-text-muted hover:text-danger-DEFAULT transition-colors"
            style={{ fontSize: 12 }}>
            ×
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2 p-3 overflow-y-auto">

        {/* KPI grid */}
        <div>
          <KpiRow label="Revenue"     value={fmtARS(kpi.revenue_ars, true)}  color="#22C55E"
            yoyPct={yoyRev?.pct} />
          <KpiRow label="Part. Nac."  value={`${kpi.revenue_pct.toFixed(1)}%`} color="#A3E635"
            sub={`#${rank}/${total}`} />
          <KpiRow label="Clientes"    value={`${fmtNumber(kpi.n_activos)} / ${fmtNumber(kpi.n_clientes)}`} color="#DCE8DC"
            yoyPct={yoyCli?.pct} />
          <KpiRow label="Margen"      value={`${kpi.margen_pct.toFixed(1)}%`}   color={margenColor}
            yoyPct={yoyMar?.pct} />
          <KpiRow label="OTIF"        value={`${kpi.otif_pct.toFixed(1)}%`}     color={otifColor}
            yoyPct={yoyOtif?.pct} />
          <KpiRow label="Riesgo Churn"value={`${(kpi.churn_score * 100).toFixed(0)}%`} color={churnColor}
            yoyPct={yoyChr?.pct} yoyInvert />
          <KpiRow label="Gap Score"   value={kpi.gap_score.toFixed(2)}           color="#0EA5E9" />
        </div>

        {/* National ranking bar */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="tactical-text" style={{ fontSize: 9 }}>Posición Nacional</p>
            <span className="font-mono" style={{ color: rankColor, fontSize: 9 }}>
              Top {Math.round(100 - rankPct)}%
            </span>
          </div>
          <div className="h-1.5 bg-bg-elevated rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${rankPct}%`, background: rankColor }}
            />
          </div>
        </div>

        {/* Peer comparison */}
        {leader && (
          <div className="rounded p-2" style={{ background: "rgba(14,165,233,0.06)", border: "1px solid rgba(14,165,233,0.15)" }}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1 tactical-text" style={{ fontSize: 9 }}>
                <Users size={8} /><span>vs. Líder {kpi.macro_region}</span>
              </div>
              <TrendIcon val={leaderGap} />
            </div>
            <div className="flex items-center justify-between text-2xs">
              <span className="text-text-muted truncate max-w-[80px]">{leader.nombre}</span>
              <span className="font-mono" style={{ color: leaderGap >= 0 ? "#22C55E" : "#E03E3E" }}>
                {leaderGap >= 0 ? "+" : ""}{(leaderGap * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        )}

        {/* Revenue trend */}
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <TrendingUp size={8} className="text-primary" />
            <p className="tactical-text" style={{ fontSize: 9 }}>Revenue 12 meses</p>
          </div>
          <ResponsiveContainer width="100%" height={58}>
            <AreaChart data={revTrend} margin={{ top: 2, right: 2, left: -32, bottom: 0 }}>
              <defs>
                <linearGradient id={`revGrad-${kpi.nombre.replace(/\s/g,"")}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#22C55E" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" tick={{ fill: "#3E5A3E", fontSize: 7 }} interval={2} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: "#3E5A3E", fontSize: 7 }} tickFormatter={v => `${(v/1e9).toFixed(1)}B`} tickLine={false} axisLine={false} />
              <Tooltip content={<MiniTooltip formatter={v => `ARS ${(v/1e9).toFixed(2)}B`} />} />
              <Area
                type="monotone"
                dataKey="val"
                stroke="#22C55E"
                strokeWidth={1.5}
                fill={`url(#revGrad-${kpi.nombre.replace(/\s/g,"")})`}
                dot={false}
                activeDot={{ r: 3, fill: "#22C55E" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Client evolution */}
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Users size={8} className="text-primary" />
            <p className="tactical-text" style={{ fontSize: 9 }}>Evolución Clientes</p>
          </div>
          <ResponsiveContainer width="100%" height={52}>
            <AreaChart data={cliTrend} margin={{ top: 2, right: 2, left: -32, bottom: 0 }}>
              <defs>
                <linearGradient id={`cliGrad-${kpi.nombre.replace(/\s/g,"")}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#0EA5E9" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#0EA5E9" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" tick={{ fill: "#3E5A3E", fontSize: 7 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: "#3E5A3E", fontSize: 7 }} tickLine={false} axisLine={false} />
              <Tooltip content={<MiniTooltip formatter={v => `${v} clientes`} />} />
              <Area
                type="monotone"
                dataKey="val"
                stroke="#0EA5E9"
                strokeWidth={1.5}
                fill={`url(#cliGrad-${kpi.nombre.replace(/\s/g,"")})`}
                dot={false}
                activeDot={{ r: 3, fill: "#0EA5E9" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Churn distribution */}
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Target size={8} style={{ color: churnColor }} />
            <p className="tactical-text" style={{ fontSize: 9 }}>Distribución Churn</p>
          </div>
          <ResponsiveContainer width="100%" height={52}>
            <BarChart data={churnData} margin={{ top: 2, right: 2, left: -32, bottom: 0 }} barSize={18}>
              <XAxis dataKey="name" tick={{ fill: "#7A9C7A", fontSize: 8 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: "#3E5A3E", fontSize: 7 }} tickFormatter={v => `${v}%`} tickLine={false} axisLine={false} />
              <Tooltip content={<MiniTooltip formatter={v => `${v}%`} />} />
              <Bar dataKey="val" radius={[2, 2, 0, 0]}>
                {churnData.map((d, i) => <Cell key={i} fill={d.color} fillOpacity={0.8} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-3 mt-1 justify-center">
            {churnData.map(d => (
              <div key={d.name} className="flex items-center gap-1 text-2xs">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: d.color }} />
                <span className="text-text-muted">{d.name} {d.val}%</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import {
  BarChart2, Layers, MapPin, Zap, Globe, Users, TrendingUp, RefreshCw,
} from "lucide-react";
import {
  RadialBarChart, RadialBar, ResponsiveContainer,
  BarChart, Bar, Cell, XAxis, YAxis, Tooltip,
} from "recharts";
import type { ProvinceKPI } from "@/types";
import type { NationalTotals } from "@/lib/timeseries";
import { fmtARS, fmtNumber } from "@/lib/formatters";

// ── Static layer counts (from known GeoJSON sizes) ────────────────────────────

const LAYER_COUNTS = {
  provincias:   24,
  departamentos:529,
  municipios:   2313,
  hotspots:     4,
  candidatos:   5,
  territorios:  5,
  buffers:      15,
  serviceareas: 15,
  rutas:        6,
  puertos:      5,
} as const;

// ── Coverage metric ───────────────────────────────────────────────────────────

function computeCoverage(kpis: ProvinceKPI[]) {
  const total   = kpis.length;
  const covered = kpis.filter(p => p.n_activos >= 50).length;
  const pct     = Math.round((covered / total) * 100);
  return { covered, total, pct };
}

function macroData(kpis: ProvinceKPI[]) {
  const by: Record<string, { rev: number; cli: number }> = {};
  kpis.forEach(p => {
    if (!by[p.macro_region]) by[p.macro_region] = { rev: 0, cli: 0 };
    by[p.macro_region].rev += p.revenue_ars;
    by[p.macro_region].cli += p.n_activos;
  });
  return Object.entries(by)
    .map(([name, v]) => ({
      name,
      revenue: Math.round(v.rev / 1e9 * 10) / 10,
      clientes: v.cli,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

const MACRO_COLORS: Record<string, string> = {
  PAM: "#22C55E", NOA: "#A3E635", NEA: "#0EA5E9",
  CUY: "#E8A020", PAT: "#C084FC",
};

function StatCard({ label, value, sub, icon: Icon, color = "#22C55E" }: {
  label: string; value: string | number; sub?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: React.ComponentType<any>;
  color?: string;
}) {
  return (
    <div
      className="flex items-center gap-2 p-2 rounded-lg"
      style={{ background: `${color}0A`, border: `1px solid ${color}20` }}
    >
      <div className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg"
        style={{ background: `${color}18` }}>
        <Icon size={12} style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="font-mono text-xs font-bold" style={{ color }}>{value}</p>
        <p className="tactical-text truncate" style={{ fontSize: 9 }}>{label}</p>
        {sub && <p className="tactical-text opacity-60" style={{ fontSize: 8 }}>{sub}</p>}
      </div>
    </div>
  );
}

function CoverageGauge({ pct }: { pct: number }) {
  const color = pct >= 80 ? "#22C55E" : pct >= 60 ? "#E8A020" : "#E03E3E";
  const data  = [{ name: "Cobertura", value: pct, fill: color }];
  return (
    <div className="relative flex items-center justify-center" style={{ height: 80 }}>
      <ResponsiveContainer width="100%" height={80}>
        <RadialBarChart
          innerRadius="62%" outerRadius="90%"
          data={data} startAngle={200} endAngle={-20}
          barSize={10}
        >
          <RadialBar dataKey="value" cornerRadius={4} background={{ fill: "#1A3D20" }} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono font-bold text-base" style={{ color }}>{pct}%</span>
        <span className="tactical-text" style={{ fontSize: 8 }}>cobertura</span>
      </div>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

interface StatsProps {
  kpis: ProvinceKPI[];
  nationalTotals: NationalTotals;
}

export default function MapStatisticsPanel({ kpis, nationalTotals }: StatsProps) {
  const [ts, setTs] = useState("");
  const coverage = computeCoverage(kpis);
  const macro    = macroData(kpis);

  useEffect(() => {
    setTs(new Date().toLocaleTimeString("es-AR", { hour12: false }));
    const t = setInterval(() => setTs(new Date().toLocaleTimeString("es-AR", { hour12: false })), 30_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex flex-col gap-2 h-full overflow-y-auto pr-0.5">

      {/* Header */}
      <div className="glass rounded-xl p-3" style={{ boxShadow: "0 0 16px rgba(34,197,94,0.04)" }}>
        <div className="flex items-center justify-between mb-1.5">
          <p className="tactical-text flex items-center gap-1.5">
            <BarChart2 size={10} /><span>Estadísticas del Mapa</span>
          </p>
          <span className="font-mono tactical-text" style={{ fontSize: 9 }}>{ts}</span>
        </div>
        <div className="space-y-1.5 text-2xs">
          <div className="flex justify-between">
            <span className="text-text-muted">Revenue Total</span>
            <span className="font-mono text-primary">{fmtARS(nationalTotals.revenue_ars, true)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Clientes Activos</span>
            <span className="font-mono text-text-secondary">{fmtNumber(nationalTotals.n_activos)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Provincias indexadas</span>
            <span className="font-mono text-text-secondary">{nationalTotals.provincias}</span>
          </div>
        </div>
      </div>

      {/* Coverage gauge */}
      <div className="glass rounded-xl p-3">
        <p className="tactical-text mb-1.5 flex items-center gap-1.5">
          <Globe size={10} /><span>Cobertura Territorial</span>
        </p>
        <CoverageGauge pct={coverage.pct} />
        <p className="tactical-text text-center mt-1" style={{ fontSize: 9 }}>
          {coverage.covered} / {coverage.total} provincias ≥ 50 clientes
        </p>
      </div>

      {/* Layer inventory */}
      <div className="glass rounded-xl p-3">
        <p className="tactical-text mb-2 flex items-center gap-1.5">
          <Layers size={10} /><span>Inventario de Capas</span>
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          <StatCard label="Provincias"    value={LAYER_COUNTS.provincias}    icon={Globe}    color="#22C55E" />
          <StatCard label="Departamentos" value={LAYER_COUNTS.departamentos}  icon={MapPin}   color="#4ADE80" sub="529 total" />
          <StatCard label="Municipios"    value={fmtNumber(LAYER_COUNTS.municipios)} icon={MapPin} color="#0EA5E9" />
          <StatCard label="Hotspots"      value={LAYER_COUNTS.hotspots}       icon={Zap}      color="#E8A020" />
          <StatCard label="Candidatas"    value={LAYER_COUNTS.candidatos}     icon={TrendingUp}color="#E03E3E" sub="expansión" />
          <StatCard label="Territorios"   value={LAYER_COUNTS.territorios}    icon={Layers}   color="#C084FC" />
          <StatCard label="Buffers"       value={LAYER_COUNTS.buffers}        icon={Globe}    color="#A3E635" sub="3 radios × 5" />
          <StatCard label="Service Areas" value={LAYER_COUNTS.serviceareas}   icon={Users}    color="#22C55E" sub="5 suc × 3 breaks" />
          <StatCard label="Rutas Nac."    value={LAYER_COUNTS.rutas}          icon={Layers}   color="#E8A020" />
          <StatCard label="Puertos"       value={LAYER_COUNTS.puertos}        icon={MapPin}   color="#38BDF8" />
        </div>
      </div>

      {/* Revenue by macro-region bar chart */}
      <div className="glass rounded-xl p-3">
        <p className="tactical-text mb-2 flex items-center gap-1.5">
          <BarChart2 size={10} /><span>Revenue por Macro-región</span>
        </p>
        <ResponsiveContainer width="100%" height={100}>
          <BarChart data={macro} layout="vertical" margin={{ top: 0, right: 4, left: 4, bottom: 0 }} barSize={10}>
            <XAxis type="number" tick={{ fill: "#3E5A3E", fontSize: 8 }} tickFormatter={v => `${v}B`} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="name" tick={{ fill: "#7A9C7A", fontSize: 9 }} tickLine={false} axisLine={false} width={28} />
            <Tooltip
              formatter={(v: number) => [`ARS ${v}B`, "Revenue"]}
              contentStyle={{ background: "#071209", border: "1px solid #1A3D20", borderRadius: 6, fontSize: 10 }}
              labelStyle={{ color: "#DCE8DC" }}
            />
            <Bar dataKey="revenue" radius={[0, 3, 3, 0]}>
              {macro.map((m) => (
                <Cell key={m.name} fill={MACRO_COLORS[m.name] ?? "#22C55E"} fillOpacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Clients by macro-region */}
      <div className="glass rounded-xl p-3">
        <p className="tactical-text mb-1.5 flex items-center gap-1.5">
          <Users size={10} /><span>Clientes por región</span>
        </p>
        <div className="space-y-2">
          {macro.map(m => {
            const pct = Math.round((m.clientes / nationalTotals.n_activos) * 100);
            const col = MACRO_COLORS[m.name] ?? "#22C55E";
            return (
              <div key={m.name}>
                <div className="flex justify-between text-2xs mb-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: col }} />
                    <span className="text-text-secondary">{m.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-text-muted">{fmtNumber(m.clientes)}</span>
                    <span className="font-mono" style={{ color: col }}>{pct}%</span>
                  </div>
                </div>
                <div className="h-1 bg-bg-elevated rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: col, opacity: 0.8 }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Refresh note */}
      <div className="flex items-center gap-1.5 justify-center py-1">
        <RefreshCw size={8} className="text-text-muted" />
        <span className="tactical-text" style={{ fontSize: 8 }}>Datos estáticos · GIS-11 Sprint</span>
      </div>

    </div>
  );
}

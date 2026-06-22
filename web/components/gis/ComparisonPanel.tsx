"use client";

import { useState, useEffect, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { ArrowLeftRight, BarChart2, TrendingUp, Users, Truck, Leaf, Zap } from "lucide-react";
import type { ProvinceKPI } from "@/types";
import { PROVINCE_KPIS } from "@/lib/geo-data";
import { getKpiForYear, yoyGrowth, YEAR_MIN } from "@/lib/timeseries";
import { fmtARS, fmtNumber } from "@/lib/formatters";

// ── Types ────────────────────────────────────────────────────────────────────

interface ProvinceEnv {
  province: string;
  drought_risk: number;
  rainfall_score: number;
  climate_score: number;
  suitability_score: number;
}

interface OppScore {
  provincia: string;
  opportunity_score: number;
}

interface ExpTarget {
  provincia: string;
  expansion_score: number;
}

interface Props {
  allKpis:     ProvinceKPI[];
  year:        number;
  compareA:    ProvinceKPI | null;
  compareB:    ProvinceKPI | null;
  setCompareA: (kpi: ProvinceKPI | null) => void;
  setCompareB: (kpi: ProvinceKPI | null) => void;
}

// ── Province selector ─────────────────────────────────────────────────────────

function ProvinceSelector({
  value, onChange, label, accent, allKpis,
}: {
  value: ProvinceKPI | null;
  onChange: (kpi: ProvinceKPI) => void;
  label: string;
  accent: string;
  allKpis: ProvinceKPI[];
}) {
  const [search, setSearch] = useState("");
  const [open,   setOpen]   = useState(false);

  const filtered = allKpis.filter(p =>
    p.nombre.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="relative flex-1 min-w-0">
      <p className="font-mono mb-0.5" style={{ fontSize: 8, color: accent }}>
        {label}
      </p>
      <input
        value={open ? search : (value?.nombre ?? "")}
        onChange={e => { setSearch(e.target.value); setOpen(true); }}
        onFocus={() => { setSearch(""); setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 160)}
        placeholder="Buscar…"
        className="w-full px-2 py-1 rounded text-2xs font-mono"
        style={{
          background: `${accent}0D`,
          border: `1px solid ${accent}35`,
          color: accent,
          outline: "none",
          fontSize: 9,
        }}
      />
      {open && filtered.length > 0 && (
        <div
          className="absolute top-full left-0 right-0 z-50 rounded mt-0.5 overflow-y-auto"
          style={{
            background: "rgba(5,11,6,0.98)",
            border: "1px solid rgba(34,197,94,0.22)",
            maxHeight: 130,
          }}
        >
          {filtered.map(p => (
            <button
              key={p.nombre}
              onMouseDown={() => { onChange(p); setSearch(""); setOpen(false); }}
              className="w-full text-left px-2 py-1 transition-colors hover:bg-primary/10"
              style={{ fontSize: 9, color: p.nombre === value?.nombre ? accent : "#7A9C7A" }}
            >
              {p.nombre}
              <span style={{ fontSize: 8, color: "#3E5A3E", marginLeft: 4 }}>{p.macro_region}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Comparison bar row ────────────────────────────────────────────────────────

function CmpRow({
  label, valA, valB, fmtA, fmtB, higherIsBetter = true,
}: {
  label: string; valA: number; valB: number;
  fmtA: string; fmtB: string; higherIsBetter?: boolean;
}) {
  const max = Math.max(Math.abs(valA), Math.abs(valB));
  if (max === 0) return null;
  const pctA = (Math.abs(valA) / max) * 100;
  const pctB = (Math.abs(valB) / max) * 100;
  const winA = higherIsBetter ? valA >= valB : valA <= valB;
  const diff = valB !== 0 ? ((valA - valB) / Math.abs(valB)) * 100 : 0;
  const diffColor = Math.abs(diff) < 1 ? "#7A9C7A" : diff > 0 ? "#22C55E" : "#E03E3E";

  return (
    <div className="mb-2.5">
      <div className="flex justify-between items-center mb-0.5">
        <span className="tactical-text" style={{ fontSize: 8 }}>{label}</span>
        <span className="font-mono" style={{ fontSize: 8, color: diffColor }}>
          {diff > 0 ? "+" : ""}{diff.toFixed(0)}%
        </span>
      </div>
      {[
        { id: "A", pct: pctA, val: fmtA, win: winA,  barColor: "#22C55E", dimColor: "#152B16", textColor: "#22C55E", dimText: "#3E5A3E" },
        { id: "B", pct: pctB, val: fmtB, win: !winA, barColor: "#0EA5E9", dimColor: "#0A1F2E", textColor: "#0EA5E9", dimText: "#2A5A7A" },
      ].map(({ id, pct, val, win, barColor, dimColor, textColor, dimText }) => (
        <div key={id} className="flex items-center gap-1 mb-0.5">
          <span className="font-mono flex-shrink-0" style={{ fontSize: 8, color: id === "A" ? "#22C55E" : "#0EA5E9", width: 10 }}>{id}</span>
          <div className="flex-1 h-2.5 bg-bg-elevated rounded-sm overflow-hidden">
            <div className="h-full rounded-sm transition-all duration-500"
              style={{ width: `${pct}%`, background: win ? barColor : dimColor }} />
          </div>
          <span className="font-mono flex-shrink-0 text-right" style={{ fontSize: 8, color: win ? textColor : dimText, minWidth: 46 }}>
            {val}
          </span>
          {win && <span style={{ fontSize: 7, color: id === "A" ? "#22C55E" : "#0EA5E9" }}>★</span>}
        </div>
      ))}
    </div>
  );
}

// ── Mini chart ────────────────────────────────────────────────────────────────

function MiniChart({
  baseA, baseB, metric, label,
}: {
  baseA: ProvinceKPI; baseB: ProvinceKPI;
  metric: "revenue" | "clientes" | "otif";
  label: string;
}) {
  const data = useMemo(() => {
    const years = Array.from({ length: 11 }, (_, i) => YEAR_MIN + i);
    return years.map(y => {
      const a = getKpiForYear(baseA, y);
      const b = getKpiForYear(baseB, y);
      const getVal = (k: ProvinceKPI) =>
        metric === "revenue"   ? k.revenue_ars
        : metric === "clientes" ? k.n_activos
        : k.otif_pct;
      return { y, a: getVal(a), b: getVal(b) };
    });
  }, [baseA, baseB, metric]);

  const fmtVal = (v: number) =>
    metric === "revenue"   ? `${(v / 1e9).toFixed(1)}B`
    : metric === "clientes" ? fmtNumber(v)
    : `${v.toFixed(0)}%`;

  return (
    <div className="mb-2">
      <p className="tactical-text mb-0.5" style={{ fontSize: 8 }}>{label}</p>
      <ResponsiveContainer width="100%" height={46}>
        <LineChart data={data} margin={{ top: 2, right: 2, left: -34, bottom: 0 }}>
          <XAxis dataKey="y" tick={{ fill: "#3E5A3E", fontSize: 7 }} interval={4} tickLine={false} axisLine={false} />
          <YAxis tick={{ fill: "#3E5A3E", fontSize: 7 }} tickFormatter={fmtVal} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{ background: "rgba(5,11,6,0.95)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 4, fontSize: 8, padding: "4px 8px" }}
            labelStyle={{ color: "#7A9C7A" }}
            formatter={(v: number, name: string) => [fmtVal(v), name === "a" ? baseA.nombre.split(" ")[0] : baseB.nombre.split(" ")[0]]}
          />
          <Line type="monotone" dataKey="a" stroke="#22C55E" strokeWidth={1.5} dot={false} />
          <Line type="monotone" dataKey="b" stroke="#0EA5E9" strokeWidth={1.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-1.5 mt-2.5"
      style={{ borderBottom: "1px solid rgba(34,197,94,0.10)", paddingBottom: 4 }}>
      <span className="text-primary">{icon}</span>
      <p className="tactical-text font-semibold" style={{ fontSize: 9, color: "#4ADE80" }}>{label}</p>
    </div>
  );
}

// ── Quick compare presets ─────────────────────────────────────────────────────

const QUICK_PAIRS: { label: string; a: string; b: string }[] = [
  { label: "BsAs / Cba",  a: "Buenos Aires",  b: "Córdoba"           },
  { label: "SF / ER",     a: "Santa Fe",       b: "Entre Ríos"        },
  { label: "PAM / NOA",   a: "Buenos Aires",  b: "Salta"             },
  { label: "Cba / Mza",   a: "Córdoba",        b: "Mendoza"           },
];

// ── Legend pill ───────────────────────────────────────────────────────────────

function LegendPill({ label, color, name }: { label: string; color: string; name: string }) {
  return (
    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded"
      style={{ background: `${color}10`, border: `1px solid ${color}30` }}>
      <span className="font-mono font-bold" style={{ fontSize: 8, color }}>{label}</span>
      <span className="text-2xs text-text-muted truncate max-w-[60px]" style={{ fontSize: 8 }}>{name}</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ComparisonPanel({
  allKpis, year, compareA, compareB, setCompareA, setCompareB,
}: Props) {
  const [envData, setEnvData]       = useState<Record<string, ProvinceEnv>>({});
  const [oppData, setOppData]       = useState<Record<string, number>>({});
  const [expData, setExpData]       = useState<Record<string, number>>({});
  const [dataReady, setDataReady]   = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/data/gis_outputs/environment_scores.json").then(r => r.json()).catch(() => []),
      fetch("/data/gis_outputs/opportunity_score.json").then(r => r.json()).catch(() => []),
      fetch("/data/gis_outputs/expansion_targets.json").then(r => r.json()).catch(() => []),
    ]).then(([env, opp, exp]) => {
      const envMap: Record<string, ProvinceEnv> = {};
      (env as ProvinceEnv[]).forEach(e => { envMap[e.province] = e; });

      const oppMap: Record<string, number> = {};
      (opp as OppScore[]).forEach(o => { oppMap[o.provincia] = o.opportunity_score; });

      const expMap: Record<string, number> = {};
      (exp as ExpTarget[]).forEach(e => { expMap[e.provincia] = e.expansion_score; });

      setEnvData(envMap);
      setOppData(oppMap);
      setExpData(expMap);
      setDataReady(true);
    });
  }, []);

  const nationalRank = (kpi: ProvinceKPI) =>
    [...allKpis].sort((a, b) => b.revenue_ars - a.revenue_ars).findIndex(p => p.nombre === kpi.nombre) + 1;

  const baseA = useMemo(() => PROVINCE_KPIS.find(k => k.nombre === compareA?.nombre) ?? null, [compareA]);
  const baseB = useMemo(() => PROVINCE_KPIS.find(k => k.nombre === compareB?.nombre) ?? null, [compareB]);

  const handleQuickPair = (a: string, b: string) => {
    const kpiA = allKpis.find(k => k.nombre === a);
    const kpiB = allKpis.find(k => k.nombre === b);
    if (kpiA) setCompareA(kpiA);
    if (kpiB) setCompareB(kpiB);
  };

  const bothSelected = compareA !== null && compareB !== null;

  return (
    <div className="flex flex-col gap-2 h-full">

      {/* Province selectors */}
      <div className="glass rounded-xl p-2.5" style={{ border: "1px solid rgba(34,197,94,0.14)" }}>
        <div className="flex items-end gap-1.5 mb-2">
          <ProvinceSelector value={compareA} onChange={setCompareA} label="PROVINCIA A" accent="#22C55E" allKpis={allKpis} />
          <button
            onClick={() => { const tmp = compareA; setCompareA(compareB); setCompareB(tmp); }}
            className="flex-shrink-0 p-1 rounded transition-all hover:bg-primary/10 mb-0.5"
            style={{ border: "1px solid rgba(34,197,94,0.20)", color: "#3E5A3E" }}
            title="Intercambiar"
          >
            <ArrowLeftRight size={10} />
          </button>
          <ProvinceSelector value={compareB} onChange={setCompareB} label="PROVINCIA B" accent="#0EA5E9" allKpis={allKpis} />
        </div>

        {/* Quick compare */}
        <p className="tactical-text mb-1" style={{ fontSize: 8 }}>Comparaciones rápidas</p>
        <div className="grid grid-cols-2 gap-1">
          {QUICK_PAIRS.map(pair => (
            <button
              key={pair.label}
              onClick={() => handleQuickPair(pair.a, pair.b)}
              className="px-1.5 py-1 rounded text-2xs font-mono transition-all hover:bg-primary/10 text-left"
              style={{ fontSize: 8, background: "rgba(34,197,94,0.04)", border: "1px solid rgba(34,197,94,0.12)", color: "#7A9C7A" }}
            >
              {pair.label}
            </button>
          ))}
        </div>
      </div>

      {/* Empty state */}
      {!bothSelected && (
        <div className="glass rounded-xl p-4 flex flex-col items-center justify-center gap-2 text-center flex-1"
          style={{ border: "1px solid rgba(34,197,94,0.10)" }}>
          <BarChart2 size={20} style={{ color: "#1A3D20" }} />
          <p className="tactical-text" style={{ fontSize: 9, color: "#3E5A3E" }}>
            Seleccioná dos provincias para comparar KPIs, tendencias y scores.
          </p>
        </div>
      )}

      {/* Comparison content */}
      {bothSelected && compareA && compareB && (
        <div className="flex flex-col gap-0 overflow-y-auto flex-1 pr-0.5">

          {/* Legend */}
          <div className="flex gap-1 mb-1">
            <LegendPill label="A" color="#22C55E" name={compareA.nombre} />
            <LegendPill label="B" color="#0EA5E9" name={compareB.nombre} />
          </div>

          <div className="glass rounded-xl p-2.5" style={{ border: "1px solid rgba(34,197,94,0.12)" }}>

            {/* COMERCIAL */}
            <SectionHeader icon={<TrendingUp size={9} />} label="COMERCIAL" />
            <CmpRow label="Revenue ARS"  valA={compareA.revenue_ars}  valB={compareB.revenue_ars}  fmtA={fmtARS(compareA.revenue_ars, true)}  fmtB={fmtARS(compareB.revenue_ars, true)} />
            <CmpRow label="Clientes Act." valA={compareA.n_activos}    valB={compareB.n_activos}    fmtA={fmtNumber(compareA.n_activos)}        fmtB={fmtNumber(compareB.n_activos)} />
            <CmpRow label="Margen %"      valA={compareA.margen_pct}   valB={compareB.margen_pct}   fmtA={`${compareA.margen_pct.toFixed(1)}%`}  fmtB={`${compareB.margen_pct.toFixed(1)}%`} />
            <CmpRow label="Ticket Prom."
              valA={compareA.n_activos > 0 ? compareA.revenue_ars / compareA.n_activos : 0}
              valB={compareB.n_activos > 0 ? compareB.revenue_ars / compareB.n_activos : 0}
              fmtA={fmtARS(compareA.n_activos > 0 ? compareA.revenue_ars / compareA.n_activos : 0, true)}
              fmtB={fmtARS(compareB.n_activos > 0 ? compareB.revenue_ars / compareB.n_activos : 0, true)}
            />

            {/* LOGÍSTICA */}
            <SectionHeader icon={<Truck size={9} />} label="LOGÍSTICA" />
            <CmpRow label="OTIF %"
              valA={compareA.otif_pct} valB={compareB.otif_pct}
              fmtA={`${compareA.otif_pct.toFixed(1)}%`} fmtB={`${compareB.otif_pct.toFixed(1)}%`}
            />
            <CmpRow label="Riesgo Log."
              valA={(100 - compareA.otif_pct) * 0.6 + compareA.churn_score * 100 * 0.4}
              valB={(100 - compareB.otif_pct) * 0.6 + compareB.churn_score * 100 * 0.4}
              fmtA={`${((100 - compareA.otif_pct) * 0.6 + compareA.churn_score * 100 * 0.4).toFixed(0)}`}
              fmtB={`${((100 - compareB.otif_pct) * 0.6 + compareB.churn_score * 100 * 0.4).toFixed(0)}`}
              higherIsBetter={false}
            />
            <CmpRow label="Activos/Total"
              valA={compareA.n_clientes > 0 ? (compareA.n_activos / compareA.n_clientes) * 100 : 0}
              valB={compareB.n_clientes > 0 ? (compareB.n_activos / compareB.n_clientes) * 100 : 0}
              fmtA={`${(compareA.n_clientes > 0 ? (compareA.n_activos / compareA.n_clientes) * 100 : 0).toFixed(0)}%`}
              fmtB={`${(compareB.n_clientes > 0 ? (compareB.n_activos / compareB.n_clientes) * 100 : 0).toFixed(0)}%`}
            />

            {/* CLIENTES */}
            <SectionHeader icon={<Users size={9} />} label="CLIENTES" />
            <CmpRow label="Churn Risk"
              valA={compareA.churn_score * 100} valB={compareB.churn_score * 100}
              fmtA={`${(compareA.churn_score * 100).toFixed(0)}%`}
              fmtB={`${(compareB.churn_score * 100).toFixed(0)}%`}
              higherIsBetter={false}
            />
            {(() => {
              const growA = year > YEAR_MIN ? yoyGrowth(compareA, "clientes", year) : null;
              const growB = year > YEAR_MIN ? yoyGrowth(compareB, "clientes", year) : null;
              if (!growA || !growB) return null;
              return (
                <CmpRow label="Growth YoY"
                  valA={growA.pct} valB={growB.pct}
                  fmtA={`${growA.pct > 0 ? "+" : ""}${growA.pct.toFixed(1)}%`}
                  fmtB={`${growB.pct > 0 ? "+" : ""}${growB.pct.toFixed(1)}%`}
                />
              );
            })()}
            <CmpRow label="Gap Score"
              valA={compareA.gap_score} valB={compareB.gap_score}
              fmtA={compareA.gap_score.toFixed(2)} fmtB={compareB.gap_score.toFixed(2)}
              higherIsBetter={false}
            />

            {/* AMBIENTAL */}
            {dataReady && (
              <>
                <SectionHeader icon={<Leaf size={9} />} label="AMBIENTAL" />
                {(() => {
                  const eA = envData[compareA.nombre];
                  const eB = envData[compareB.nombre];
                  if (!eA || !eB) return (
                    <p className="tactical-text" style={{ fontSize: 8, color: "#3E5A3E" }}>Sin datos ambientales</p>
                  );
                  return (
                    <>
                      <CmpRow label="Sequía Risk"
                        valA={eA.drought_risk} valB={eB.drought_risk}
                        fmtA={String(eA.drought_risk)} fmtB={String(eB.drought_risk)}
                        higherIsBetter={false}
                      />
                      <CmpRow label="Flood Risk"
                        valA={eA.rainfall_score} valB={eB.rainfall_score}
                        fmtA={String(eA.rainfall_score)} fmtB={String(eB.rainfall_score)}
                        higherIsBetter={false}
                      />
                      <CmpRow label="Climate Score"
                        valA={eA.climate_score} valB={eB.climate_score}
                        fmtA={String(eA.climate_score)} fmtB={String(eB.climate_score)}
                      />
                    </>
                  );
                })()}
              </>
            )}

            {/* IA */}
            {dataReady && (
              <>
                <SectionHeader icon={<Zap size={9} />} label="INTELIGENCIA" />
                <CmpRow label="Opportunity"
                  valA={oppData[compareA.nombre] ?? 0} valB={oppData[compareB.nombre] ?? 0}
                  fmtA={oppData[compareA.nombre] != null ? String(oppData[compareA.nombre]) : "N/A"}
                  fmtB={oppData[compareB.nombre] != null ? String(oppData[compareB.nombre]) : "N/A"}
                />
                <CmpRow label="Expansion"
                  valA={expData[compareA.nombre] ?? 0} valB={expData[compareB.nombre] ?? 0}
                  fmtA={expData[compareA.nombre] != null ? String(expData[compareA.nombre]) : "N/A"}
                  fmtB={expData[compareB.nombre] != null ? String(expData[compareB.nombre]) : "N/A"}
                />
                <CmpRow label="Ranking Nac."
                  valA={allKpis.length - nationalRank(compareA) + 1}
                  valB={allKpis.length - nationalRank(compareB) + 1}
                  fmtA={`#${nationalRank(compareA)}`}
                  fmtB={`#${nationalRank(compareB)}`}
                />
              </>
            )}
          </div>

          {/* Mini charts */}
          {baseA && baseB && (
            <div className="glass rounded-xl p-2.5 mt-2" style={{ border: "1px solid rgba(34,197,94,0.10)" }}>
              <p className="tactical-text mb-2 flex items-center gap-1.5" style={{ fontSize: 9, color: "#4ADE80" }}>
                <TrendingUp size={9} />
                <span>Evolución 2016–2026</span>
              </p>
              <MiniChart baseA={baseA} baseB={baseB} metric="revenue"   label="Revenue ARS" />
              <MiniChart baseA={baseA} baseB={baseB} metric="clientes"  label="Clientes Activos" />
              <MiniChart baseA={baseA} baseB={baseB} metric="otif"      label="OTIF %" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

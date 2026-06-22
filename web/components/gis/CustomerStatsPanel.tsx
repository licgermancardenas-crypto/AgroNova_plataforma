"use client";

import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { CustomerGeo } from "@/types";
import { fmtARS, fmtNumber } from "@/lib/formatters";

interface Props {
  customers: CustomerGeo[];
}

const CHURN_COLOR: Record<string, string> = { Bajo: "#22C55E", Medio: "#F97316", Alto: "#E03E3E" };
const TIER_COLOR:  Record<string, string> = { A: "#F97316", B: "#22C55E", C: "#A3E635", D: "#7A9C7A" };

function KpiCard({ label, value, sub, color = "#DCE8DC" }: {
  label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div
      className="rounded p-2 flex flex-col gap-0.5"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      <div className="text-[8px] font-mono" style={{ color: "#4A6A4A" }}>{label}</div>
      <div className="text-sm font-bold font-mono leading-tight" style={{ color }}>{value}</div>
      {sub && <div className="text-[8px]" style={{ color: "#7A9C7A" }}>{sub}</div>}
    </div>
  );
}

export default function CustomerStatsPanel({ customers }: Props) {
  const stats = useMemo(() => {
    if (!customers.length) return null;

    const active      = customers.filter(c => !c.is_outlier);
    const totalRev    = active.reduce((s, c) => s + (c.revenue_ars ?? 0), 0);
    const avgRev      = totalRev / (active.length || 1);
    const avgTicket   = active.reduce((s, c) => s + (c.ticket_promedio_ars ?? 0), 0) / (active.length || 1);
    const altoRiesgo  = active.filter(c => c.churn_level === "Alto").length;
    const altoRiesgoPct = (altoRiesgo / active.length * 100).toFixed(1);

    const top10 = [...active]
      .sort((a, b) => (b.revenue_ars ?? 0) - (a.revenue_ars ?? 0))
      .slice(0, 10);

    const byProv = Object.entries(
      active.reduce((acc, c) => {
        const p = c.provincia ?? "Sin provincia";
        acc[p] = (acc[p] ?? 0) + (c.revenue_ars ?? 0);
        return acc;
      }, {} as Record<string, number>),
    )
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([prov, rev]) => ({ prov: prov.replace("Buenos Aires", "Bs.As."), rev }));

    const byTier = Object.entries(
      active.reduce((acc, c) => {
        const t = c.tier ?? "D";
        acc[t] = (acc[t] ?? 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    )
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([tier, n]) => ({ tier, n }));

    const byChurn = ["Bajo", "Medio", "Alto"].map(level => ({
      level,
      n: active.filter(c => c.churn_level === level).length,
    }));

    const avgOtif = active
      .filter(c => c.otif_pct != null)
      .reduce((s, c, _, arr) => s + (c.otif_pct ?? 0) / arr.length, 0);

    return { active, totalRev, avgRev, avgTicket, altoRiesgo, altoRiesgoPct, top10, byProv, byTier, byChurn, avgOtif };
  }, [customers]);

  if (!stats) return (
    <div className="text-[10px] text-center mt-8 font-mono" style={{ color: "#4A6A4A" }}>Cargando...</div>
  );

  return (
    <div className="flex flex-col gap-4 text-[#DCE8DC]" style={{ paddingBottom: 8 }}>
      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-2">
        <KpiCard label="CLIENTES ACTIVOS"  value={fmtNumber(stats.active.length)}        color="#F97316" />
        <KpiCard label="REVENUE TOTAL"     value={fmtARS(stats.totalRev, true)}          color="#22C55E" />
        <KpiCard label="REVENUE PROMEDIO"  value={fmtARS(stats.avgRev, true)}            color="#A3E635" />
        <KpiCard label="TICKET PROMEDIO"   value={fmtARS(stats.avgTicket, true)} />
        <KpiCard
          label="ALTO RIESGO CHURN"
          value={String(stats.altoRiesgo)}
          sub={`${stats.altoRiesgoPct}% del total`}
          color="#E03E3E"
        />
        <KpiCard label="OTIF PROMEDIO"     value={`${stats.avgOtif.toFixed(1)}%`}
          color={stats.avgOtif >= 93 ? "#22C55E" : stats.avgOtif >= 88 ? "#F97316" : "#E03E3E"} />
      </div>

      {/* Churn distribution */}
      <div>
        <div className="text-[9px] font-mono font-bold tracking-widest mb-2" style={{ color: "#4A6A4A" }}>
          DISTRIBUCIÓN CHURN
        </div>
        <div className="flex gap-2">
          {stats.byChurn.map(({ level, n }) => {
            const pct = (n / stats.active.length * 100).toFixed(0);
            return (
              <div key={level} className="flex-1 text-center">
                <div className="text-[11px] font-bold font-mono" style={{ color: CHURN_COLOR[level] }}>{n}</div>
                <div className="text-[8px]" style={{ color: "#7A9C7A" }}>{level}</div>
                <div className="text-[8px] font-mono" style={{ color: "#4A6A4A" }}>{pct}%</div>
                <div className="mt-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: CHURN_COLOR[level] }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Revenue by province */}
      <div>
        <div className="text-[9px] font-mono font-bold tracking-widest mb-2" style={{ color: "#4A6A4A" }}>
          TOP PROVINCIAS (revenue)
        </div>
        <ResponsiveContainer width="100%" height={90}>
          <BarChart data={stats.byProv} layout="vertical" margin={{ top: 0, right: 4, bottom: 0, left: 36 }}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="prov" tick={{ fontSize: 7, fill: "#7A9C7A" }} width={36} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: "#071209", border: "1px solid #1A3D20", borderRadius: 4, fontSize: 9 }}
              formatter={(v: number) => [fmtARS(v, true), "Revenue"]}
              labelStyle={{ color: "#7A9C7A" }}
            />
            <Bar dataKey="rev" fill="#F97316" fillOpacity={0.75} radius={[0, 2, 2, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tier distribution */}
      <div>
        <div className="text-[9px] font-mono font-bold tracking-widest mb-2" style={{ color: "#4A6A4A" }}>
          DISTRIBUCIÓN TIER
        </div>
        <div className="flex gap-2">
          {stats.byTier.map(({ tier, n }) => (
            <div key={tier} className="flex-1 text-center">
              <div className="text-sm font-bold font-mono" style={{ color: TIER_COLOR[tier] }}>{n}</div>
              <div className="text-[8px] font-mono" style={{ color: "#7A9C7A" }}>Tier {tier}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Top 10 clients */}
      <div>
        <div className="text-[9px] font-mono font-bold tracking-widest mb-2" style={{ color: "#4A6A4A" }}>
          TOP 10 CLIENTES
        </div>
        <div className="flex flex-col gap-1">
          {stats.top10.map((c, i) => (
            <div
              key={c.cliente_id}
              className="flex items-center justify-between gap-2 rounded px-2 py-1"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[8px] font-mono flex-shrink-0" style={{ color: "#4A6A4A" }}>#{i + 1}</span>
                <span className="text-[9px] truncate" title={c.razon_social}>{c.razon_social}</span>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className="text-[9px] font-mono" style={{ color: "#22C55E" }}>
                  {fmtARS(c.revenue_ars ?? 0, true)}
                </span>
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: CHURN_COLOR[c.churn_level ?? "Medio"] }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

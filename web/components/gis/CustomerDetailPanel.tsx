"use client";

import { useMemo } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { X } from "lucide-react";
import type { CustomerGeo } from "@/types";
import { fmtARS, fmtNumber } from "@/lib/formatters";

const CHURN_COLOR = { Bajo: "#22C55E", Medio: "#F97316", Alto: "#E03E3E" } as const;

function badge(label: string, color: string, bg: string) {
  return (
    <span
      className="px-1.5 py-0.5 rounded text-[8px] font-bold font-mono uppercase tracking-wide"
      style={{ background: bg, color, border: `1px solid ${color}44` }}
    >
      {label}
    </span>
  );
}

function Row({ label, value, color = "#DCE8DC" }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between items-baseline">
      <span className="text-[9px]" style={{ color: "#7A9C7A" }}>{label}</span>
      <span className="font-mono text-[10px] font-semibold" style={{ color }}>{value}</span>
    </div>
  );
}

interface Props {
  customer:  CustomerGeo;
  onClose:   () => void;
}

export default function CustomerDetailPanel({ customer: c, onClose }: Props) {
  const churnColor = CHURN_COLOR[(c.churn_level as keyof typeof CHURN_COLOR)] ?? "#F97316";
  const churnPct   = Math.round((c.churn_score ?? 0) * 100);

  // Generate synthetic 12-month revenue trend from the client's revenue
  const monthlyData = useMemo(() => {
    const base   = (c.revenue_ars ?? 0) / 12;
    const months = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
    return months.map((m, i) => ({
      mes:         m,
      revenue_ars: Math.round(base * (0.75 + Math.sin(i * 0.5) * 0.18 + Math.random() * 0.1)),
    }));
  }, [c.cliente_id, c.revenue_ars]);

  const quarterlyData = useMemo(() => {
    const base = c.n_compras ?? 0;
    return ["Q1 25","Q2 25","Q3 25","Q4 25","Q1 26","Q2 26","Q3 26","Q4 26"].map((q, i) => ({
      periodo:   q,
      n_compras: Math.round(base / 8 * (0.7 + i * 0.05 + Math.random() * 0.2)),
    }));
  }, [c.cliente_id, c.n_compras]);

  const isAltoValor   = (c.tier === "A" || (c.revenue_ars ?? 0) > 5e7);
  const isAltoRiesgo  = c.churn_level === "Alto";
  const isEstrategico = (c.tier === "A" || c.tier === "B") && !isAltoRiesgo;

  return (
    <div className="flex flex-col gap-3 h-full overflow-y-auto text-[#DCE8DC]" style={{ scrollbarWidth: "thin" }}>
      {/* Header */}
      <div
        className="flex-shrink-0 rounded-lg p-3"
        style={{ background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.18)" }}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-[11px] font-bold leading-tight" style={{ color: "#FDBA74" }}>
              {c.razon_social}
            </div>
            <div className="text-[9px] mt-0.5" style={{ color: "#7A9C7A" }}>
              {c.segmento} · {c.provincia} · {c.ciudad}
            </div>
            <div className="text-[8px] mt-0.5 font-mono" style={{ color: "#4A6A4A" }}>
              CUIT {c.cuit ?? "—"} · ID {c.cliente_id}
            </div>
          </div>
          <button onClick={onClose} className="hover:text-[#E03E3E] transition-colors flex-shrink-0">
            <X size={12} />
          </button>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-1 mt-2">
          <span className="text-[8px] font-mono px-1.5 py-0.5 rounded" style={{ background: "rgba(249,115,22,0.15)", color: "#F97316", border: "1px solid rgba(249,115,22,0.30)" }}>
            TIER {c.tier}
          </span>
          {isAltoValor   && badge("ALTO VALOR",   "#22C55E", "rgba(34,197,94,0.12)")}
          {isAltoRiesgo  && badge("RIESGO ALTO",  "#E03E3E", "rgba(224,62,62,0.12)")}
          {isEstrategico && badge("ESTRATÉGICO",  "#A3E635", "rgba(163,230,53,0.12)")}
          <span className="text-[8px] font-mono px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.05)", color: "#7A9C7A", border: "1px solid rgba(255,255,255,0.10)" }}>
            {c.ciclo_vida}
          </span>
        </div>
      </div>

      {/* KPIs grid */}
      <div className="flex-shrink-0 flex flex-col gap-1.5">
        <Row label="Revenue anual"      value={fmtARS(c.revenue_ars ?? 0, true)}    color="#22C55E" />
        <Row label="Margen bruto"       value={`${c.margen_pct?.toFixed(1) ?? "—"}%`}  color="#A3E635" />
        <Row label="Ticket promedio"    value={fmtARS(c.ticket_promedio_ars ?? 0, true)} />
        <Row label="Frecuencia"         value={`${c.n_compras ?? 0} compras`} />
        <Row label="OTIF"               value={`${c.otif_pct?.toFixed(1) ?? "—"}%`}
          color={(c.otif_pct ?? 0) >= 93 ? "#22C55E" : (c.otif_pct ?? 0) >= 88 ? "#F97316" : "#E03E3E"} />
        <Row label="Última compra"      value={c.ultima_compra ?? "—"} />
        <Row label="Riesgo crediticio"  value={c.riesgo_crediticio ?? "—"} />
        {c.superficie_ha && <Row label="Superficie" value={`${fmtNumber(c.superficie_ha)} ha`} />}
      </div>

      {/* Churn bar */}
      <div
        className="flex-shrink-0 rounded p-2"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div className="flex justify-between mb-1">
          <span className="text-[9px]" style={{ color: "#7A9C7A" }}>Churn score</span>
          <span className="text-[9px] font-bold" style={{ color: churnColor }}>{c.churn_level} · {churnPct}%</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${churnPct}%`, background: churnColor }} />
        </div>
      </div>

      {/* Revenue 12m chart */}
      <div className="flex-shrink-0">
        <div className="text-[9px] font-mono mb-1.5" style={{ color: "#7A9C7A" }}>REVENUE 12 MESES</div>
        <ResponsiveContainer width="100%" height={52}>
          <LineChart data={monthlyData} margin={{ top: 2, right: 2, bottom: 0, left: 0 }}>
            <XAxis dataKey="mes" tick={{ fontSize: 7, fill: "#4A6A4A" }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip
              contentStyle={{ background: "#071209", border: "1px solid #1A3D20", borderRadius: 4, fontSize: 9 }}
              formatter={(v: number) => [fmtARS(v, true), "Revenue"]}
              labelStyle={{ color: "#7A9C7A" }}
            />
            <Line type="monotone" dataKey="revenue_ars" stroke="#F97316" strokeWidth={1.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Quarterly orders chart */}
      <div className="flex-shrink-0">
        <div className="text-[9px] font-mono mb-1.5" style={{ color: "#7A9C7A" }}>COMPRAS TRIMESTRALES</div>
        <ResponsiveContainer width="100%" height={52}>
          <BarChart data={quarterlyData} margin={{ top: 2, right: 2, bottom: 0, left: 0 }}>
            <XAxis dataKey="periodo" tick={{ fontSize: 7, fill: "#4A6A4A" }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip
              contentStyle={{ background: "#071209", border: "1px solid #1A3D20", borderRadius: 4, fontSize: 9 }}
              formatter={(v: number) => [v, "Compras"]}
              labelStyle={{ color: "#7A9C7A" }}
            />
            <Bar dataKey="n_compras" fill="#F97316" fillOpacity={0.7} radius={[2,2,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* VER DETALLE button */}
      <button
        className="flex-shrink-0 w-full py-2 rounded font-mono text-xs font-bold tracking-wide transition-all"
        style={{
          background:  "rgba(249,115,22,0.15)",
          border:      "1px solid rgba(249,115,22,0.35)",
          color:       "#F97316",
        }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(249,115,22,0.25)")}
        onMouseLeave={e => (e.currentTarget.style.background = "rgba(249,115,22,0.15)")}
      >
        VER DETALLE COMPLETO
      </button>
    </div>
  );
}

"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard, CardHeader } from "@/components/ui/glass-card";
import { KPICard } from "@/components/ui/kpi-card";
import { HorizontalBar } from "@/components/charts/HorizontalBar";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";
import { clientes, productos, kpiSummary, regions } from "@/lib/mock-data";
import { fmtARS, fmtUSD, fmtPctAbs, tierColor } from "@/lib/formatters";
import { DollarSign, BarChart3, TrendingUp, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

function ScatterTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="glass rounded-lg p-3 text-xs min-w-[160px]">
      <p className="font-medium text-text-primary mb-1">{d.nombre}</p>
      <p className="text-text-secondary">Margen: <span className="text-text-primary font-mono">{d.margen_pct.toFixed(1)}%</span></p>
      <p className="text-text-secondary">Revenue: <span className="text-text-primary font-mono">{fmtARS(d.revenue_ars, true)}</span></p>
      <p className="text-text-secondary">ABC: <span className="font-semibold">{d.abc}</span></p>
    </div>
  );
}

export default function FinanzasPage() {
  const scatterData = productos.map(p => ({
    nombre:      p.nombre,
    x:           p.revenue_ars / 1e6,   // Revenue en M ARS
    y:           p.margen_pct,
    abc:         p.abc,
    revenue_ars: p.revenue_ars,
    margen_pct:  p.margen_pct,
    r:           Math.sqrt(p.revenue_ars / 1e8),  // tamaño burbuja
  }));

  const abcColors = { A: "#1E6FDB", B: "#06C8FF", C: "#3E5C7A" };
  const avgMargen = 19.8;
  const avgRevenue = productos.reduce((s, p) => s + p.revenue_ars, 0) / productos.length / 1e6;

  const sucursalBar = regions.map(r => ({
    name:  r.region,
    value: r.margen_pct,
    color: r.margen_pct >= 20 ? "#0DB87E" : r.margen_pct >= 18 ? "#1E6FDB" : "#E8A020",
  }));

  const ltvTop = clientes.slice(0, 8);

  return (
    <AppLayout title="Dashboard Financiero" subtitle="Márgenes · LTV · Rentabilidad · 2026">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <KPICard label="Margen Bruto" value={fmtPctAbs(kpiSummary.margen_bruto_pct)} subvalue="Target 18–22%" change={0.4} changeLabel="vs año ant." accent="green" icon={<BarChart3 size={18} />} />
        <KPICard label="EBITDA Estimado" value={fmtARS(kpiSummary.ebitda_estimado_ars, true)} subvalue={fmtPctAbs(kpiSummary.ebitda_pct)} change={kpiSummary.yoy_pct_ars} changeLabel="YoY" accent="blue" icon={<DollarSign size={18} />} />
        <KPICard label="LTV Promedio USD" value={fmtUSD(clientes.reduce((s,c) => s+c.ltv_usd, 0) / clientes.length, true)} subvalue="Histórico por cliente" accent="cyan" icon={<TrendingUp size={18} />} />
        <KPICard label="CAGR 5Y USD" value={fmtPctAbs(kpiSummary.cagr_5y_usd)} subvalue="Crecimiento real 2021-2026" accent="green" icon={<Layers size={18} />} />
      </div>

      {/* Quadrant scatter + Margen por región */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <GlassCard>
          <CardHeader
            title="Análisis Cuadrante — Productos"
            subtitle="Eje X: Revenue ARS · Eje Y: Margen% · Tamaño: Revenue rel."
          />
          <div className="flex gap-4 mb-3 text-2xs text-text-muted">
            {[
              { label: "Estrellas", desc: "Alto R + Alto M", color: "#0DB87E" },
              { label: "Volumen",   desc: "Alto R + Bajo M", color: "#E8A020" },
              { label: "Nicho",     desc: "Bajo R + Alto M", color: "#1E6FDB" },
              { label: "Revisar",   desc: "Bajo R + Bajo M", color: "#E03E3E" },
            ].map(q => (
              <div key={q.label} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: q.color }} />
                <span>{q.label}</span>
              </div>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <ScatterChart margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(26,37,64,0.4)" />
              <XAxis type="number" dataKey="x" name="Revenue" tickFormatter={v => `${v.toFixed(0)}M`} tick={{ fill: "#3E5C7A", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis type="number" dataKey="y" name="Margen" domain={[10, 32]} tickFormatter={v => `${v}%`} tick={{ fill: "#3E5C7A", fontSize: 10 }} axisLine={false} tickLine={false} width={36} />
              <Tooltip content={<ScatterTooltip />} />
              <ReferenceLine x={avgRevenue} stroke="#1A2540" strokeDasharray="4 2" />
              <ReferenceLine y={avgMargen}  stroke="#1A2540" strokeDasharray="4 2" />
              <Scatter data={scatterData} name="Productos">
                {scatterData.map((d, i) => (
                  <Cell key={i} fill={abcColors[d.abc as "A"|"B"|"C"]} fillOpacity={0.75} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </GlassCard>

        <GlassCard>
          <CardHeader title="Margen % por Región" subtitle="2026" />
          <HorizontalBar data={sucursalBar} formatter={v => `${v.toFixed(1)}%`} height={200} />
          <div className="mt-4 pt-4 border-t border-border-subtle">
            <p className="text-xs text-text-muted mb-3">Detalle Regional</p>
            {regions.map(r => (
              <div key={r.region} className="flex items-center justify-between py-1.5 border-b border-border-subtle last:border-0">
                <span className="text-xs text-text-secondary">{r.region}</span>
                <div className="flex items-center gap-4">
                  <span className="text-xs font-mono text-text-primary">{fmtPctAbs(r.margen_pct)}</span>
                  <span className="text-2xs text-text-muted w-20 text-right">{fmtARS(r.revenue_ars, true)}</span>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      {/* LTV Table */}
      <GlassCard>
        <CardHeader title="Top Clientes por LTV" subtitle="Lifetime Value histórico · USD y ARS" />
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-text-muted">
                {["#","Cliente","Tier","LTV USD","LTV ARS","Margen%","Delta vs Tier","Risk"].map(h => (
                  <th key={h} className="text-left py-2 px-3 font-medium first:pl-0">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ltvTop.map((c, i) => {
                const tierAvgLTV = c.tier === "A" ? 180000 : c.tier === "B" ? 60000 : 20000;
                const delta = ((c.ltv_usd - tierAvgLTV) / tierAvgLTV) * 100;
                return (
                  <tr key={c.cliente_id} className="tr-hover border-b border-border-subtle last:border-0">
                    <td className="py-2.5 px-3 first:pl-0 text-text-muted font-mono">{i+1}</td>
                    <td className="py-2.5 px-3 text-text-primary font-medium">{c.razon_social}</td>
                    <td className="py-2.5 px-3"><span className={cn("px-2 py-0.5 rounded text-2xs font-semibold", tierColor(c.tier))}>{c.tier}</span></td>
                    <td className="py-2.5 px-3 font-mono text-cyan-brand">{fmtUSD(c.ltv_usd, true)}</td>
                    <td className="py-2.5 px-3 font-mono text-text-primary">{fmtARS(c.ltv_ars, true)}</td>
                    <td className="py-2.5 px-3 font-mono text-text-secondary">{c.margen_pct.toFixed(1)}%</td>
                    <td className="py-2.5 px-3 font-mono">
                      <span className={cn("text-2xs font-medium", delta >= 0 ? "text-success-DEFAULT" : "text-danger-DEFAULT")}>
                        {delta >= 0 ? "+" : ""}{delta.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={cn("px-2 py-0.5 rounded text-2xs",
                        c.risk_level === "High"   ? "bg-danger-bg text-danger-DEFAULT" :
                        c.risk_level === "Medium" ? "bg-warning-bg text-warning-DEFAULT" :
                        "bg-success-bg text-success-DEFAULT")}>{c.risk_level}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </AppLayout>
  );
}

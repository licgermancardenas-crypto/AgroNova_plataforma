"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard, CardHeader } from "@/components/ui/glass-card";
import { KPICard } from "@/components/ui/kpi-card";
import { DonutChart } from "@/components/charts/DonutChart";
import { clientes, rfmSegments, churnDistribution, kpiSummary } from "@/lib/mock-data";
import { fmtNumber, fmtPctAbs, fmtARS } from "@/lib/formatters";
import { Users, AlertTriangle, TrendingDown, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { SimpleTable } from "@/components/ui/simple-table";
import { TOOLTIP_STYLE } from "@/lib/chart-theme";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

export default function ClientesPage() {
  const highRisk = clientes.filter(c => c.risk_level === "High");
  const recencyBins = [
    { name: "0–30d",   value: clientes.filter(c => c.recency_days <= 30).length,  color: "#0DB87E" },
    { name: "31–90d",  value: clientes.filter(c => c.recency_days > 30 && c.recency_days <= 90).length, color: "#22C55E" },
    { name: "91–180d", value: clientes.filter(c => c.recency_days > 90 && c.recency_days <= 180).length, color: "#A3E635" },
    { name: "181–365d",value: clientes.filter(c => c.recency_days > 180 && c.recency_days <= 365).length, color: "#E8A020" },
    { name: ">365d",   value: clientes.filter(c => c.recency_days > 365).length,  color: "#E03E3E" },
  ];

  return (
    <AppLayout title="Dashboard de Clientes" subtitle="RFM · Churn Risk · Segmentación · 2026">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <KPICard label="Clientes Activos"  value={fmtNumber(kpiSummary.clientes_activos)}  subvalue="Compra en últimos 12M" accent="blue"    icon={<Users size={18} />} />
        <KPICard label="Churn Rate"        value={fmtPctAbs(kpiSummary.churn_rate)}         subvalue="Target < 10%"           change={kpiSummary.churn_rate - 9.1} accent="danger"  icon={<TrendingDown size={18} />} />
        <KPICard label="High Risk"         value={fmtNumber(800)}                            subvalue="P(churn) > 60%"         accent="danger"  icon={<AlertTriangle size={18} />} />
        <KPICard label="Champions"         value={fmtNumber(600)}                            subvalue="15% de la cartera"       accent="green"   icon={<Activity size={18} />} />
      </div>

      {/* RFM Segments + Churn distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <GlassCard>
          <CardHeader title="Segmentación RFM" subtitle="KMeans k=5 · % de clientes y revenue" />
          <DonutChart
            data={rfmSegments.map(s => ({ name: s.segment, value: s.count, color: s.color }))}
            centerLabel="Clientes"
            centerValue="4,000"
            height={220}
          />
          <div className="mt-3 space-y-2">
            {rfmSegments.map(s => (
              <div key={s.segment} className="flex items-center gap-3 py-1.5 border-b border-border-subtle last:border-0">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                <span className="text-xs text-text-secondary flex-1">{s.segment}</span>
                <span className="text-xs font-mono text-text-primary">{s.count.toLocaleString()}</span>
                <span className="text-xs text-text-muted w-14 text-right">{s.pct}%</span>
                <div className="h-1 w-20 bg-border rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${s.revenue_pct}%`, background: s.color }} />
                </div>
                <span className="text-2xs text-text-muted w-12 text-right">{s.revenue_pct}% Rev</span>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard>
          <CardHeader title="Distribución Churn Risk" subtitle="Predicción ML · 4,000 clientes" />
          <DonutChart
            data={churnDistribution.map(c => ({ name: c.risk_level, value: c.count, color: c.color }))}
            centerLabel="Total"
            centerValue="4,000"
            height={220}
          />
          <div className="mt-4">
            <p className="text-xs text-text-muted mb-2">Recencia — Distribución</p>
            <ResponsiveContainer width="100%" height={100}>
              <BarChart data={recencyBins} margin={{ top: 0, right: 0, left: -24, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fill: "#3E5C7A", fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#3E5C7A", fontSize: 9 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                  {recencyBins.map((b, i) => <Cell key={i} fill={b.color} fillOpacity={0.85} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </div>

      {/* High Risk clients table */}
      <GlassCard>
        <CardHeader
          title="Clientes en Riesgo Crítico"
          subtitle="P(churn) > 60% — acción urgente requerida"
          action={<span className="text-2xs text-danger-DEFAULT font-medium">{highRisk.length} clientes</span>}
        />
        <SimpleTable headers={["Cliente","Tier","Región","Días Inactivo","P(Churn)","Segment RFM","Revenue","Acción"]}>
              {highRisk.map(c => (
                <tr key={c.cliente_id} className="tr-hover border-b border-border-subtle last:border-0">
                  <td className="py-2.5 px-3 first:pl-0 text-text-primary font-medium">{c.razon_social}</td>
                  <td className="py-2.5 px-3">
                    <span className={cn("px-2 py-0.5 rounded text-2xs font-semibold",
                      c.tier === "A" ? "bg-primary-dim text-primary-light border border-primary-DEFAULT/30" :
                      "bg-bg-elevated text-text-secondary border border-border")}>{c.tier}</span>
                  </td>
                  <td className="py-2.5 px-3 text-text-secondary">{c.region}</td>
                  <td className="py-2.5 px-3 font-mono text-danger-DEFAULT">{c.dias_inactivo}d</td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 bg-border rounded-full w-16 overflow-hidden">
                        <div className="h-full rounded-full bg-danger-DEFAULT" style={{ width: `${c.churn_probability * 100}%` }} />
                      </div>
                      <span className="font-mono text-danger-DEFAULT font-medium">{(c.churn_probability * 100).toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={cn("px-2 py-0.5 rounded text-2xs",
                      c.rfm_segment === "En_Riesgo" ? "bg-warning-bg text-warning-DEFAULT" :
                      "bg-danger-bg text-danger-DEFAULT")}>{c.rfm_segment}</span>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-text-primary">{fmtARS(c.revenue_ars, true)}</td>
                  <td className="py-2.5 px-3 text-text-secondary">
                    {c.tier === "A" ? "Llamada gerencial" : "Email + oferta"}
                  </td>
                </tr>
              ))}
        </SimpleTable>
      </GlassCard>
    </AppLayout>
  );
}

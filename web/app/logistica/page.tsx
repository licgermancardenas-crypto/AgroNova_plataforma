"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard, CardHeader } from "@/components/ui/glass-card";
import { KPICard } from "@/components/ui/kpi-card";
import { OTIFBarChart, OTIFRadar } from "@/components/charts/OTIFChart";
import { otifData, transportistas, monthlyRevenue, kpiSummary } from "@/lib/mock-data";
import { fmtARS, fmtPctAbs, fmtNumber } from "@/lib/formatters";
import { Truck, CheckCircle, Clock, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { SimpleTable } from "@/components/ui/simple-table";
import { TOOLTIP_STYLE, REF_DASH } from "@/lib/chart-theme";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";

export default function LogisticaPage() {
  const totalDespachos = otifData.reduce((s, d) => s + d.total_despachos, 0);
  const totalDemorados = otifData.reduce((s, d) => s + d.demorados, 0);
  const totalFlete     = otifData.reduce((s, d) => s + d.costo_flete_ars, 0);

  // Simulated OTIF trend (last 12 months)
  const otifTrend = monthlyRevenue.slice(-12).map((m, i) => ({
    label: m.label,
    otif:  88 + Math.sin(i * 0.5) * 3 + i * 0.3,
    target: 92,
  }));

  return (
    <AppLayout title="Dashboard Logístico" subtitle="OTIF · Tiempos · Costos · Transportistas">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <KPICard label="OTIF Global" value={fmtPctAbs(kpiSummary.otif_global)} subvalue="Target ≥ 92%" change={-0.8} changeLabel="vs mes ant." accent={kpiSummary.otif_global >= 92 ? "green" : "warning"} icon={<CheckCircle size={18} />} />
        <KPICard label="Total Despachos" value={fmtNumber(totalDespachos)} subvalue={`${fmtNumber(totalDemorados)} demorados`} accent="blue" icon={<Truck size={18} />} />
        <KPICard label="Días Tránsito Prom." value="4.2d" subvalue="vs 3.9d mes ant." change={-7.7} accent="warning" icon={<Clock size={18} />} />
        <KPICard label="Costo Flete Total" value={fmtARS(totalFlete, true)} subvalue={`${fmtPctAbs(totalFlete / kpiSummary.revenue_total_ars * 100)} del revenue`} accent="blue" icon={<DollarSign size={18} />} />
      </div>

      {/* OTIF charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <GlassCard className="lg:col-span-2">
          <CardHeader title="OTIF por Región" subtitle="Vs target · 2026" />
          <OTIFBarChart data={otifData} height={200} />
          <div className="mt-3 pt-3 border-t border-border-subtle grid grid-cols-5 gap-2">
            {otifData.map(d => (
              <div key={d.region} className="text-center">
                <p className="text-2xs text-text-muted">{d.region}</p>
                <p className={cn("text-sm font-bold font-mono mt-0.5", d.otif_pct >= d.target_pct ? "text-success-DEFAULT" : "text-danger-DEFAULT")}>
                  {fmtPctAbs(d.otif_pct)}
                </p>
                <p className="text-2xs text-text-muted">Target {d.target_pct}%</p>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard>
          <CardHeader title="Radar OTIF vs Target" subtitle="Por región" />
          <OTIFRadar data={otifData} height={240} />
        </GlassCard>
      </div>

      {/* OTIF Trend + Transportistas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <GlassCard>
          <CardHeader title="Evolución OTIF — 12 Meses" subtitle="% global vs target 92%" />
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={otifTrend} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(26,61,32,0.4)" />
              <XAxis dataKey="label" tick={{ fill: "#3E5A3E", fontSize: 10 }} axisLine={false} tickLine={false} interval={2} />
              <YAxis domain={[84, 98]} tickFormatter={v => `${v}%`} tick={{ fill: "#3E5A3E", fontSize: 10 }} axisLine={false} tickLine={false} width={36} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => `${v.toFixed(1)}%`} />
              <ReferenceLine y={92} stroke="#22C55E" strokeDasharray={REF_DASH} strokeWidth={1.5} />
              <Line type="monotone" dataKey="otif" name="OTIF%" stroke="#A3E635" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#A3E635" }} />
            </LineChart>
          </ResponsiveContainer>
        </GlassCard>

        <GlassCard>
          <CardHeader title="Detalle por Región" subtitle="Tiempos, demoras y costos" />
          <SimpleTable headers={["Región","OTIF","Días Tr.","Demora","Costo Flete"]}>
                {otifData.map(d => (
                  <tr key={d.region} className="tr-hover border-b border-border-subtle last:border-0">
                    <td className="py-2 px-2 first:pl-0 text-text-primary font-medium">{d.region}</td>
                    <td className={cn("py-2 px-2 font-mono font-semibold", d.otif_pct >= d.target_pct ? "text-success-DEFAULT" : "text-danger-DEFAULT")}>
                      {fmtPctAbs(d.otif_pct)}
                    </td>
                    <td className="py-2 px-2 font-mono text-text-secondary">{d.dias_transito_prom}d</td>
                    <td className={cn("py-2 px-2 font-mono", d.dias_demora_prom > 2 ? "text-warning-DEFAULT" : "text-success-DEFAULT")}>
                      +{d.dias_demora_prom}d
                    </td>
                    <td className="py-2 px-2 font-mono text-text-primary">{fmtARS(d.costo_flete_ars, true)}</td>
                  </tr>
                ))}
          </SimpleTable>
        </GlassCard>
      </div>

      {/* Transportistas ranking */}
      <GlassCard>
        <CardHeader title="Ranking Transportistas" subtitle="OTIF × Costo × Despachos" />
        <SimpleTable headers={["#","Transportista","Despachos","OTIF%","Costo/Kg ARS","Demora Prom.","Cuadrante"]}>
              {transportistas.map((t, i) => {
                const q = t.otif_pct >= 92 && t.costo_kg_ars <= 88 ? "Socio Clave" :
                          t.otif_pct >= 92 ? "Alto OTIF" :
                          t.costo_kg_ars <= 88 ? "Económico" : "Revisar";
                const qColor = q === "Socio Clave" ? "text-success-DEFAULT bg-success-bg border-success-dim" :
                               q === "Alto OTIF"   ? "text-primary-light bg-primary-dim border-primary-DEFAULT/30" :
                               q === "Económico"   ? "text-cyan-brand bg-cyan-glow border-cyan-brand/30" :
                               "text-danger-DEFAULT bg-danger-bg border-danger-dim";
                return (
                  <tr key={t.nombre} className="tr-hover border-b border-border-subtle last:border-0">
                    <td className="py-2.5 px-3 first:pl-0 font-mono text-text-muted">{i+1}</td>
                    <td className="py-2.5 px-3 text-text-primary font-medium">{t.nombre}</td>
                    <td className="py-2.5 px-3 font-mono text-text-secondary">{t.total_despachos.toLocaleString()}</td>
                    <td className={cn("py-2.5 px-3 font-mono font-semibold", t.otif_pct >= 92 ? "text-success-DEFAULT" : t.otif_pct >= 88 ? "text-warning-DEFAULT" : "text-danger-DEFAULT")}>
                      {fmtPctAbs(t.otif_pct)}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-text-secondary">${t.costo_kg_ars}</td>
                    <td className={cn("py-2.5 px-3 font-mono", t.dias_demora_prom > 2.5 ? "text-warning-DEFAULT" : "text-success-DEFAULT")}>
                      +{t.dias_demora_prom}d
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={cn("px-2 py-0.5 rounded text-2xs font-medium border", qColor)}>{q}</span>
                    </td>
                  </tr>
                );
              })}
        </SimpleTable>
      </GlassCard>
    </AppLayout>
  );
}

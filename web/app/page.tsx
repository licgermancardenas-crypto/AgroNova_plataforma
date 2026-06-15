"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard, CardHeader } from "@/components/ui/glass-card";
import { KPICard, AlertBadge } from "@/components/ui/kpi-card";
import { AreaRevenueChart } from "@/components/charts/AreaRevenueChart";
import { HorizontalBar } from "@/components/charts/HorizontalBar";
import {
  kpiSummary, monthlyRevenue, regions, alerts,
} from "@/lib/mock-data";
import { fmtARS, fmtUSD, fmtPctAbs, fmtNumber, fmtPct } from "@/lib/formatters";
import {
  DollarSign, TrendingUp, Users, AlertTriangle,
  BarChart3, Truck, Clock, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const alertIcon = { danger: "🔴", warning: "🟡", info: "🔵" } as const;

export default function HomePage() {
  const regionBarData = regions.map(r => ({
    name:  r.region,
    value: r.revenue_ars,
    color: r.otif_pct >= 92 ? "#22C55E" : r.otif_pct >= 88 ? "#A3E635" : "#E8A020",
  }));

  return (
    <AppLayout title="Dashboard Ejecutivo" subtitle="AgroNova Argentina S.A. · 2026">
      {/* ── KPI Row 1 ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <KPICard
          label="Revenue Total ARS"
          value={fmtARS(kpiSummary.revenue_total_ars, true)}
          subvalue={fmtUSD(kpiSummary.revenue_total_usd, true)}
          change={kpiSummary.yoy_pct_ars}
          changeLabel="YoY ARS"
          accent="blue"
          icon={<DollarSign size={18} />}
        />
        <KPICard
          label="Margen Bruto"
          value={fmtPctAbs(kpiSummary.margen_bruto_pct)}
          subvalue={`EBITDA est. ${fmtPctAbs(kpiSummary.ebitda_pct)}`}
          change={kpiSummary.yoy_pct_usd}
          changeLabel="YoY USD"
          accent="cyan"
          icon={<BarChart3 size={18} />}
        />
        <KPICard
          label="CAGR 5Y USD"
          value={fmtPctAbs(kpiSummary.cagr_5y_usd)}
          subvalue="Crecimiento real 2021-2026"
          accent="green"
          icon={<TrendingUp size={18} />}
        />
        <KPICard
          label="Clientes Activos"
          value={fmtNumber(kpiSummary.clientes_activos)}
          subvalue={`Ticket prom. ${fmtARS(kpiSummary.ticket_promedio_ars, true)}`}
          change={-1.1}
          changeLabel="vs mes ant."
          accent="blue"
          icon={<Users size={18} />}
        />
      </div>

      {/* ── KPI Row 2 ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        <KPICard
          label="Riesgo Churn"
          value={fmtPctAbs(kpiSummary.churn_rate)}
          subvalue="800 clientes High Risk"
          change={kpiSummary.churn_rate - 9.1}
          changeLabel="vs año ant."
          accent="danger"
          size="sm"
          icon={<AlertTriangle size={16} />}
        />
        <KPICard
          label="OTIF Global"
          value={fmtPctAbs(kpiSummary.otif_global)}
          subvalue="Target ≥ 92%"
          change={-0.8}
          changeLabel="vs mes ant."
          accent="warning"
          size="sm"
          icon={<Truck size={16} />}
        />
        <KPICard
          label="Descuento Promedio"
          value={fmtPctAbs(kpiSummary.descuento_promedio_pct)}
          subvalue="Target < 8%"
          accent="cyan"
          size="sm"
          icon={<Zap size={16} />}
        />
        <KPICard
          label="Ticket Prom. USD"
          value={fmtUSD(kpiSummary.ticket_promedio_usd)}
          subvalue={fmtARS(kpiSummary.ticket_promedio_ars)}
          accent="green"
          size="sm"
          icon={<Clock size={16} />}
        />
      </div>

      {/* ── Charts row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Revenue chart — 2/3 width */}
        <GlassCard className="lg:col-span-2">
          <CardHeader
            title="Revenue y Margen — Serie Temporal"
            subtitle="2023–2026 · ARS (izq.) y USD (der.)"
          />
          <AreaRevenueChart data={monthlyRevenue} />
        </GlassCard>

        {/* Revenue por región — 1/3 */}
        <GlassCard>
          <CardHeader title="Revenue por Región" subtitle="2026 · ARS" />
          <HorizontalBar
            data={regionBarData}
            formatter={v => fmtARS(v, true)}
            height={260}
          />
        </GlassCard>
      </div>

      {/* ── Alerts + Metrics ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Alerts — 2/3 */}
        <GlassCard className="lg:col-span-2">
          <CardHeader
            title="Alertas Críticas"
            subtitle={`${alerts.length} alertas activas`}
            action={
              <span className="text-2xs text-text-muted">Live</span>
            }
          />
          <div className="space-y-2">
            {alerts.map(a => (
              <div key={a.id} className={cn(
                "flex items-start gap-3 p-3 rounded-lg border transition-colors",
                a.type === "danger"  ? "bg-danger-bg border-danger-dim/40" :
                a.type === "warning" ? "bg-warning-bg border-warning-dim/40" :
                "bg-primary-dim border-primary-DEFAULT/20"
              )}>
                <span className="text-sm flex-shrink-0 mt-0.5">{alertIcon[a.type]}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-xs font-semibold text-text-primary">{a.title}</p>
                    <AlertBadge type={a.type === "info" ? "info" : a.type}>{a.module}</AlertBadge>
                  </div>
                  <p className="text-xs text-text-secondary leading-snug">{a.description}</p>
                </div>
                <span className="text-2xs text-text-muted flex-shrink-0">{a.time}</span>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Quick stats — 1/3 */}
        <GlassCard>
          <CardHeader title="Métricas Clave" subtitle="Resumen ejecutivo" />
          <div className="space-y-3">
            {[
              { label: "Revenue YoY ARS",      value: fmtPct(kpiSummary.yoy_pct_ars), ok: true },
              { label: "Revenue YoY USD",       value: fmtPct(kpiSummary.yoy_pct_usd), ok: true },
              { label: "CAGR 5Y USD",           value: fmtPct(kpiSummary.cagr_5y_usd), ok: true },
              { label: "Margen Bruto",          value: fmtPctAbs(kpiSummary.margen_bruto_pct), ok: true },
              { label: "EBITDA Estimado",       value: fmtPctAbs(kpiSummary.ebitda_pct), ok: true },
              { label: "Clientes Activos",      value: fmtNumber(kpiSummary.clientes_activos), ok: true },
              { label: "Churn Rate",            value: fmtPctAbs(kpiSummary.churn_rate), ok: false },
              { label: "OTIF Global",           value: fmtPctAbs(kpiSummary.otif_global), ok: kpiSummary.otif_global >= 92 },
              { label: "Descuento Promedio",    value: fmtPctAbs(kpiSummary.descuento_promedio_pct), ok: true },
              { label: "EBITDA Est. ARS",       value: fmtARS(kpiSummary.ebitda_estimado_ars, true), ok: true },
            ].map(({ label, value, ok }) => (
              <div key={label} className="flex items-center justify-between py-1.5 border-b border-border-subtle last:border-0">
                <span className="text-xs text-text-secondary">{label}</span>
                <span className={cn("text-xs font-mono font-semibold", ok ? "text-text-primary" : "text-danger-DEFAULT")}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </AppLayout>
  );
}

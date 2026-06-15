"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard, CardHeader } from "@/components/ui/glass-card";
import { KPICard } from "@/components/ui/kpi-card";
import { AreaRevenueChart } from "@/components/charts/AreaRevenueChart";
import { ParetoChart } from "@/components/charts/ParetoChart";
import { HorizontalBar } from "@/components/charts/HorizontalBar";
import { clientes, productos, regions, vendedores, monthlyRevenue, kpiSummary } from "@/lib/mock-data";
import { fmtARS, fmtPctAbs, tierColor } from "@/lib/formatters";
import { TrendingUp, Users, ShoppingCart, Percent } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ComercialPage() {
  const topClientes = clientes.slice(0, 10);
  const regionBar = regions.map(r => ({
    name:  r.region,
    value: r.revenue_ars,
    color: "#1E6FDB",
  }));
  const vendedorBar = vendedores.map(v => ({
    name:  v.nombre.split(" ")[0] + " " + v.nombre.split(" ")[1][0] + ".",
    value: v.revenue_ars,
    color: "#06C8FF",
  }));

  return (
    <AppLayout title="Dashboard Comercial" subtitle="Ventas · Clientes · Vendedores · 2026">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <KPICard label="Revenue Total" value={fmtARS(kpiSummary.revenue_total_ars, true)} change={kpiSummary.yoy_pct_ars} changeLabel="YoY" accent="blue" icon={<TrendingUp size={18} />} />
        <KPICard label="Clientes Activos" value="1,187" subvalue="de 4,000 totales" accent="cyan" icon={<Users size={18} />} />
        <KPICard label="Ticket Promedio" value={fmtARS(kpiSummary.ticket_promedio_ars)} change={4.2} changeLabel="YoY" accent="green" icon={<ShoppingCart size={18} />} />
        <KPICard label="Descuento Prom." value={fmtPctAbs(kpiSummary.descuento_promedio_pct)} subvalue="Target < 8%" change={-0.4} changeLabel="vs año ant." accent="warning" icon={<Percent size={18} />} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <GlassCard>
          <CardHeader title="Revenue por Región" subtitle="2026 · ARS" />
          <HorizontalBar data={regionBar} formatter={v => fmtARS(v, true)} height={200} />
        </GlassCard>
        <GlassCard>
          <CardHeader title="Top 8 Vendedores" subtitle="Revenue 2026 · ARS" />
          <HorizontalBar data={vendedorBar} formatter={v => fmtARS(v, true)} height={200} colorDefault="#06C8FF" />
        </GlassCard>
      </div>

      {/* Pareto + Evolución temporal */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <GlassCard>
          <CardHeader
            title="Análisis Pareto — Productos"
            subtitle="Barras = Revenue · Línea = % Acumulado · Referencia 80%"
          />
          <ParetoChart data={productos} />
        </GlassCard>
        <GlassCard>
          <CardHeader title="Evolución Temporal" subtitle="Revenue ARS · Margen · USD — 2023-2026" />
          <AreaRevenueChart data={monthlyRevenue.slice(-18)} height={260} />
        </GlassCard>
      </div>

      {/* Top clients table */}
      <GlassCard>
        <CardHeader title="Top 10 Clientes por Revenue" subtitle="2026 · Completadas" />
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-text-muted">
                {["#","Cliente","Tier","Región","Revenue ARS","Margen %","Frec.","Risk"].map(h => (
                  <th key={h} className="text-left py-2 px-3 font-medium first:pl-0 last:pr-0">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topClientes.map((c, i) => (
                <tr key={c.cliente_id} className="tr-hover border-b border-border-subtle last:border-0">
                  <td className="py-2.5 px-3 first:pl-0 text-text-muted font-mono">{i + 1}</td>
                  <td className="py-2.5 px-3 text-text-primary font-medium">{c.razon_social}</td>
                  <td className="py-2.5 px-3">
                    <span className={cn("px-2 py-0.5 rounded text-2xs font-semibold", tierColor(c.tier))}>{c.tier}</span>
                  </td>
                  <td className="py-2.5 px-3 text-text-secondary">{c.region}</td>
                  <td className="py-2.5 px-3 font-mono text-text-primary">{fmtARS(c.revenue_ars, true)}</td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 rounded-full bg-border flex-1 max-w-[60px]">
                        <div className="h-full rounded-full bg-primary-DEFAULT" style={{ width: `${c.margen_pct * 4}%` }} />
                      </div>
                      <span className="font-mono text-text-secondary">{c.margen_pct.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-text-secondary">{c.frequency}</td>
                  <td className="py-2.5 px-3">
                    <span className={cn(
                      "px-2 py-0.5 rounded text-2xs font-medium",
                      c.risk_level === "High"   ? "bg-danger-bg text-danger-DEFAULT border border-danger-dim/50" :
                      c.risk_level === "Medium" ? "bg-warning-bg text-warning-DEFAULT border border-warning-dim/50" :
                      "bg-success-bg text-success-DEFAULT border border-success-dim/50"
                    )}>{c.risk_level}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </AppLayout>
  );
}

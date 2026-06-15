"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard, CardHeader } from "@/components/ui/glass-card";
import { KPICard } from "@/components/ui/kpi-card";
import { stockAlerts, rotacionData } from "@/lib/mock-data";
import { fmtARS, fmtNumber, priorityColor } from "@/lib/formatters";
import { Boxes, AlertTriangle, TrendingDown, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

const priorityLabel = (p: string) =>
  p.replace("1_", "").replace("2_", "").replace("3_", "").replace("4_", "").replace("5_", "").replace("6_", "").replace(/_/g, " ");

const priorityBg = (p: string) => {
  if (p === "1_Sin_Stock")  return "border-l-2 border-l-danger-DEFAULT bg-danger-bg/30";
  if (p === "2_Critico_A")  return "border-l-2 border-l-danger-DEFAULT bg-danger-bg/20";
  if (p === "3_Critico_B")  return "border-l-2 border-l-warning-DEFAULT bg-warning-bg/20";
  if (p === "4_Bajo_Minimo")return "border-l-2 border-l-warning-DEFAULT bg-warning-bg/10";
  return "border-l-2 border-l-cyan-brand bg-cyan-glow/10";
};

export default function InventarioPage() {
  const sinStock     = stockAlerts.filter(s => s.prioridad === "1_Sin_Stock").length;
  const bajMin       = stockAlerts.filter(s => s.prioridad.includes("Critico") || s.prioridad === "4_Bajo_Minimo").length;
  const totalReponer = stockAlerts.reduce((s, a) => s + a.unidades_a_reponer, 0);

  // Rotation by category (aggregate)
  const cats = Array.from(new Set(rotacionData.map(r => r.categoria)));
  const rotByCat = cats.map(cat => ({
    name: cat,
    value: rotacionData.filter(r => r.categoria === cat).reduce((s, r) => s + r.rotacion, 0) / 3,
    color: rotacionData.filter(r => r.categoria === cat)[0]?.rotacion > 1.5 ? "#0DB87E" :
           rotacionData.filter(r => r.categoria === cat)[0]?.rotacion > 0.8 ? "#1E6FDB" : "#E8A020",
  }));

  return (
    <AppLayout title="Dashboard de Inventario" subtitle="Stock · Rotación · Alertas · Cobertura">
      {/* Semáforo KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <KPICard label="Sin Stock" value={fmtNumber(sinStock)} subvalue="Acción URGENTE" accent="danger" size="sm" icon={<AlertTriangle size={16} />} />
        <KPICard label="Bajo Mínimo / Crítico" value={fmtNumber(bajMin)} subvalue="Revisar órdenes" accent="warning" size="sm" icon={<TrendingDown size={16} />} />
        <KPICard label="Unidades a Reponer" value={fmtNumber(totalReponer)} subvalue="Total urgente" accent="warning" size="sm" icon={<Package size={16} />} />
        <KPICard label="SKUs Normales" value="2,450" subvalue="Cobertura ≥ 15 días" accent="green" size="sm" icon={<Boxes size={16} />} />
      </div>

      {/* Stock alerts table + Rotation chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Alerts — 2/3 */}
        <GlassCard className="lg:col-span-2">
          <CardHeader
            title="Alertas de Stock — Priorización"
            subtitle="Ordenado por prioridad + P(ruptura)"
            action={<span className="text-2xs text-danger-DEFAULT">{stockAlerts.length} alertas</span>}
          />
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {stockAlerts.map(s => (
              <div key={s.producto_id} className={cn("p-3 rounded-lg", priorityBg(s.prioridad))}>
                <div className="flex items-start justify-between mb-1.5">
                  <div>
                    <span className={cn("text-2xs font-semibold px-1.5 py-0.5 rounded bg-bg-surface mr-2", priorityColor(s.prioridad))}>
                      P{s.prioridad[0]}
                    </span>
                    <span className="text-xs font-semibold text-text-primary">{s.nombre}</span>
                  </div>
                  <span className={cn("text-xs font-mono font-bold", priorityColor(s.prioridad))}>
                    {(s.ruptura_probability * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-3 text-2xs text-text-muted">
                  <div><span className="text-text-secondary">Depósito:</span><br /><span className="text-text-primary">{s.deposito}</span></div>
                  <div><span className="text-text-secondary">Stock/Mín:</span><br /><span className="font-mono text-text-primary">{s.stock_actual}/{s.stock_minimo}</span></div>
                  <div><span className="text-text-secondary">Cobertura:</span><br /><span className={cn("font-mono font-bold", s.dias_cobertura < 7 ? "text-danger-DEFAULT" : "text-warning-DEFAULT")}>{s.dias_cobertura.toFixed(1)}d</span></div>
                  <div><span className="text-text-secondary">A Reponer:</span><br /><span className="font-mono text-text-primary">{s.unidades_a_reponer.toLocaleString()}</span></div>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Rotation chart — 1/3 */}
        <GlassCard>
          <CardHeader title="Rotación por Categoría" subtitle="Índice promedio mensual" />
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={rotByCat} layout="vertical" margin={{ top: 4, right: 40, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(26,37,64,0.4)" horizontal={false} />
              <XAxis type="number" tickFormatter={v => `${v.toFixed(1)}x`} tick={{ fill: "#3E5C7A", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={92} tick={{ fill: "#7A9EC4", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#0C1220", border: "1px solid #1A2540", borderRadius: 8, fontSize: 11, color: "#DCE8F5" }} formatter={(v: any) => `${v.toFixed(2)}x/mes`} />
              <Bar dataKey="value" radius={[0, 3, 3, 0]} maxBarSize={20}>
                {rotByCat.map((r, i) => <Cell key={i} fill={r.color} fillOpacity={0.85} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Depot occupancy */}
          <div className="mt-4 pt-4 border-t border-border-subtle">
            <p className="text-xs text-text-muted mb-3">Ocupación Depósitos</p>
            {[
              { name: "Rosario", pct: 78, color: "#0DB87E" },
              { name: "Córdoba", pct: 52, color: "#1E6FDB" },
              { name: "Salta",   pct: 91, color: "#E03E3E" },
            ].map(d => (
              <div key={d.name} className="mb-2.5">
                <div className="flex justify-between text-2xs mb-1">
                  <span className="text-text-secondary">{d.name}</span>
                  <span className="font-mono" style={{ color: d.color }}>{d.pct}%</span>
                </div>
                <div className="h-1.5 bg-border rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${d.pct}%`, background: d.color }} />
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      {/* Capital inmovilizado */}
      <GlassCard>
        <CardHeader title="Capital Inmovilizado por Depósito × Categoría" subtitle="Productos con rotación baja o sin movimiento · ARS" />
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-text-muted">
                {["Categoría","Depósito","Índice Rot.","Días Inventario","Valor Stock","Estado"].map(h => (
                  <th key={h} className="text-left py-2 px-3 font-medium first:pl-0">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rotacionData.filter(r => r.rotacion < 1.0).map((r, i) => (
                <tr key={i} className="tr-hover border-b border-border-subtle last:border-0">
                  <td className="py-2 px-3 first:pl-0 text-text-primary">{r.categoria}</td>
                  <td className="py-2 px-3 text-text-secondary">{r.deposito}</td>
                  <td className="py-2 px-3 font-mono text-warning-DEFAULT">{r.rotacion.toFixed(2)}x</td>
                  <td className="py-2 px-3 font-mono text-text-primary">{r.dias_inventario.toFixed(1)}d</td>
                  <td className="py-2 px-3 font-mono text-text-primary">{fmtARS(r.valor_stock_ars, true)}</td>
                  <td className="py-2 px-3">
                    <span className={cn("px-2 py-0.5 rounded text-2xs",
                      r.rotacion < 0.6 ? "bg-danger-bg text-danger-DEFAULT" : "bg-warning-bg text-warning-DEFAULT"
                    )}>{r.rotacion < 0.6 ? "Inmovilizado" : "Bajo"}</span>
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

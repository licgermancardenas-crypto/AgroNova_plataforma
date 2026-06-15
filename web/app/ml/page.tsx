"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard, CardHeader } from "@/components/ui/glass-card";
import { KPICard } from "@/components/ui/kpi-card";
import { DonutChart } from "@/components/charts/DonutChart";
import { ForecastChart } from "@/components/charts/ForecastChart";
import {
  rfmSegments, churnDistribution, stockAlerts,
  forecastData, recommendations,
} from "@/lib/mock-data";
import { fmtPctAbs, fmtARS, priorityColor } from "@/lib/formatters";
import { Brain, TrendingUp, Users, Package, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

export default function MLPage() {
  return (
    <AppLayout title="Machine Learning" subtitle="Churn · Forecast · Segmentación · Recomendador · Stock Risk">
      {/* Module summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        {[
          { label: "Churn Prediction",      value: "ROC-AUC 0.87", sub: "GradientBoosting",  accent: "danger"  as const, icon: <Brain size={16} /> },
          { label: "Demand Forecast",       value: "RMSE 14.8%",   sub: "GBR × Categoria",   accent: "blue"    as const, icon: <TrendingUp size={16} /> },
          { label: "Segmentación RFM",      value: "k=5 clusters", sub: "Silhouette 0.41",    accent: "green"   as const, icon: <Users size={16} /> },
          { label: "Recomendador",          value: "Recall@10 28%",sub: "SVD + Reglas",       accent: "cyan"    as const, icon: <Lightbulb size={16} /> },
          { label: "Stock Risk",            value: "Recall 89.2%", sub: "RandomForest",       accent: "warning" as const, icon: <Package size={16} /> },
        ].map(m => (
          <KPICard key={m.label} label={m.label} value={m.value} subvalue={m.sub} accent={m.accent} size="sm" icon={m.icon} />
        ))}
      </div>

      {/* Churn + RFM */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Churn Prediction */}
        <GlassCard>
          <CardHeader
            title="Churn Prediction"
            subtitle="GradientBoostingClassifier · 4,000 clientes"
            icon={<Brain size={14} />}
          />
          <div className="grid grid-cols-2 gap-4">
            <DonutChart
              data={churnDistribution.map(c => ({ name: c.risk_level, value: c.count, color: c.color }))}
              centerLabel="Total"
              centerValue="4,000"
              height={200}
            />
            <div className="space-y-3">
              {churnDistribution.map(c => (
                <div key={c.risk_level} className={cn(
                  "p-3 rounded-lg border",
                  c.risk_level === "High"   ? "bg-danger-bg border-danger-dim/50" :
                  c.risk_level === "Medium" ? "bg-warning-bg border-warning-dim/50" :
                  "bg-success-bg border-success-dim/50"
                )}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-semibold" style={{ color: c.color }}>{c.risk_level} Risk</p>
                    <p className="text-xs font-mono" style={{ color: c.color }}>{c.pct}%</p>
                  </div>
                  <p className="text-sm font-bold text-text-primary font-mono">{c.count.toLocaleString()}</p>
                  <p className="text-2xs text-text-muted">clientes</p>
                </div>
              ))}
            </div>
          </div>
          {/* Model metrics */}
          <div className="mt-3 pt-3 border-t border-border-subtle grid grid-cols-3 gap-3 text-center">
            {[
              { label: "ROC-AUC",   value: "0.87" },
              { label: "F1-Score",  value: "0.79" },
              { label: "Recall",    value: "0.81" },
            ].map(m => (
              <div key={m.label}>
                <p className="text-xs font-bold font-mono text-cyan-brand">{m.value}</p>
                <p className="text-2xs text-text-muted">{m.label}</p>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Segmentación */}
        <GlassCard>
          <CardHeader
            title="Segmentación de Clientes"
            subtitle="KMeans k=5 · Features RFM"
            icon={<Users size={14} />}
          />
          <div className="space-y-2 mb-3">
            {rfmSegments.map(s => (
              <div key={s.segment} className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                <span className="text-xs text-text-secondary flex-1">{s.segment.replace("_", " ")}</span>
                <div className="w-24 h-1.5 bg-border rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${s.pct}%`, background: s.color }} />
                </div>
                <span className="text-xs font-mono text-text-primary w-12 text-right">{s.count.toLocaleString()}</span>
                <span className="text-2xs text-text-muted w-8 text-right">{s.pct}%</span>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-border-subtle">
            <p className="text-2xs text-text-muted mb-2">Acciones Recomendadas</p>
            {rfmSegments.slice(0, 3).map(s => (
              <div key={s.segment} className="flex items-start gap-2 py-1.5 border-b border-border-subtle last:border-0">
                <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: s.color }} />
                <div>
                  <span className="text-xs font-medium text-text-primary">{s.segment.replace("_", " ")}:</span>
                  <span className="text-xs text-text-secondary ml-1">{s.accion}</span>
                </div>
              </div>
            ))}
          </div>
          {/* Metrics */}
          <div className="mt-3 pt-3 border-t border-border-subtle grid grid-cols-3 gap-3 text-center">
            {[
              { label: "Silhouette",    value: "0.41" },
              { label: "Davies-Bouldin","value": "0.98" },
              { label: "k óptimo",      value: "5" },
            ].map(m => (
              <div key={m.label}>
                <p className="text-xs font-bold font-mono text-cyan-brand">{m.value}</p>
                <p className="text-2xs text-text-muted">{m.label}</p>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      {/* Forecast */}
      <GlassCard className="mb-4">
        <CardHeader
          title="Demand Forecast — Revenue ARS"
          subtitle="Real 2026 + Proyección 2027 · Horizontes 30d / 90d / 180d"
          icon={<TrendingUp size={14} />}
        />
        <ForecastChart data={forecastData} height={280} />
        <div className="mt-3 pt-3 border-t border-border-subtle grid grid-cols-4 gap-4 text-center">
          {[
            { label: "RMSE Cat.",   value: "14.8%", sub: "del revenue mensual" },
            { label: "RMSE Suc.",   value: "18.2%", sub: "del revenue mensual" },
            { label: "RMSE SKU",    value: "31.4%", sub: "alta varianza" },
            { label: "Horizon Conf.", value: "90d", sub: "confiable Cat." },
          ].map(m => (
            <div key={m.label} className="p-3 rounded-lg bg-bg-elevated border border-border-subtle">
              <p className="text-sm font-bold font-mono text-cyan-brand">{m.value}</p>
              <p className="text-xs text-text-primary mt-0.5">{m.label}</p>
              <p className="text-2xs text-text-muted">{m.sub}</p>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Recomendador + Stock Risk */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recomendador */}
        <GlassCard>
          <CardHeader
            title="Product Recommendation"
            subtitle="Collaborative Filtering + Association Rules"
            icon={<Lightbulb size={14} />}
          />
          <div className="space-y-3">
            {recommendations.map(r => (
              <div key={r.cliente_id} className="p-3 rounded-lg bg-bg-elevated border border-border-subtle">
                <div className="flex items-center gap-2 mb-2">
                  <span className={cn("px-1.5 py-0.5 rounded text-2xs font-semibold",
                    r.tier === "A" ? "bg-primary-dim text-primary-light" :
                    r.tier === "B" ? "bg-cyan-glow text-cyan-brand" : "bg-bg-surface text-text-muted"
                  )}>Tier {r.tier}</span>
                  <span className="text-xs font-medium text-text-primary">{r.razon_social}</span>
                </div>
                <div className="space-y-1.5">
                  {r.recommendations.map((rec, i) => (
                    <div key={i} className="flex items-center gap-2 text-2xs">
                      <span className="w-4 h-4 rounded bg-border text-text-muted flex items-center justify-center text-2xs font-mono">{i+1}</span>
                      <span className="text-text-secondary flex-1 truncate">{rec.producto}</span>
                      <span className={cn("px-1.5 py-0.5 rounded",
                        rec.type === "CF" ? "bg-primary-dim text-primary-light" : "bg-cyan-glow text-cyan-brand"
                      )}>{rec.type}</span>
                      <span className="font-mono text-text-muted w-8 text-right">{(rec.score * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-border-subtle grid grid-cols-3 gap-3 text-center">
            {[
              { label: "Recall@10", value: "28%" },
              { label: "Reglas",    value: "450+" },
              { label: "Lift Top",  value: "5.8x" },
            ].map(m => (
              <div key={m.label}>
                <p className="text-xs font-bold font-mono text-cyan-brand">{m.value}</p>
                <p className="text-2xs text-text-muted">{m.label}</p>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Stock Risk */}
        <GlassCard>
          <CardHeader
            title="Inventory Risk Prediction"
            subtitle="RandomForest · Prioridad 1–5 · P(ruptura)"
            icon={<Package size={14} />}
          />
          <div className="space-y-2">
            {stockAlerts.map(s => (
              <div key={s.producto_id} className="flex items-center gap-3 py-2 border-b border-border-subtle last:border-0">
                <div className={cn("w-6 h-6 rounded flex items-center justify-center text-2xs font-bold flex-shrink-0",
                  s.prioridad[0] === "1" ? "bg-danger-bg text-danger-DEFAULT border border-danger-dim" :
                  s.prioridad[0] === "2" ? "bg-danger-bg text-danger-DEFAULT border border-danger-dim" :
                  s.prioridad[0] === "3" ? "bg-warning-bg text-warning-DEFAULT border border-warning-dim" :
                  s.prioridad[0] === "4" ? "bg-warning-bg text-warning-DEFAULT border border-warning-dim" :
                  "bg-cyan-glow text-cyan-brand border border-cyan-brand/30"
                )}>P{s.prioridad[0]}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-text-primary truncate">{s.nombre}</p>
                  <p className="text-2xs text-text-muted">{s.deposito} · {s.abc} · {s.dias_cobertura.toFixed(1)}d cobertura</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={cn("text-xs font-mono font-bold", priorityColor(s.prioridad))}>
                    {(s.ruptura_probability * 100).toFixed(0)}%
                  </p>
                  <p className="text-2xs text-text-muted">{s.unidades_a_reponer.toLocaleString()} u.</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-border-subtle grid grid-cols-3 gap-3 text-center">
            {[
              { label: "ROC-AUC",  value: "0.92" },
              { label: "Recall",   value: "89.2%" },
              { label: "F1-Score", value: "0.84" },
            ].map(m => (
              <div key={m.label}>
                <p className="text-xs font-bold font-mono text-cyan-brand">{m.value}</p>
                <p className="text-2xs text-text-muted">{m.label}</p>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </AppLayout>
  );
}

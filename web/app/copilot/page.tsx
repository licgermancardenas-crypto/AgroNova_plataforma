"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard } from "@/components/ui/glass-card";
import { Sparkles, Lock, Send, Cpu, MessageSquare, Database, BarChart3 } from "lucide-react";

const CAPABILITIES = [
  { icon: <Database size={18} />, title: "SQL Natural Language", desc: "Preguntá en español, obtenés SQL + resultados" },
  { icon: <BarChart3 size={18} />, title: "Insight Generator", desc: "Narrativa automática de anomalías y tendencias" },
  { icon: <MessageSquare size={18} />, title: "Sales Assistant", desc: "Consultas sobre clientes, productos y logística" },
  { icon: <Cpu size={18} />, title: "ML Explainability", desc: "Explicación de predicciones en lenguaje natural" },
];

export default function CopilotPage() {
  return (
    <AppLayout title="AI Copilot" subtitle="Asistente de Decision Intelligence · Próximamente">
      <div className="max-w-3xl mx-auto">
        {/* Coming soon badge */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary-dim border border-primary-DEFAULT/30 text-primary-light text-sm font-medium">
            <Lock size={14} />
            <span>En desarrollo — Integración con Claude API</span>
          </div>
        </div>

        {/* Chat interface (disabled) */}
        <GlassCard elevated className="mb-6">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border-subtle">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-DEFAULT to-cyan-brand flex items-center justify-center glow-blue">
              <Sparkles size={18} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary">AgroNova AI Copilot</p>
              <p className="text-xs text-text-muted">Powered by Claude · claude-opus-4-8</p>
            </div>
            <div className="ml-auto flex items-center gap-1.5 text-2xs text-text-muted">
              <span className="status-dot bg-warning-DEFAULT animate-pulse-slow" />
              <span>Offline</span>
            </div>
          </div>

          {/* Chat messages area */}
          <div className="h-64 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary-dim border border-primary-DEFAULT/25 flex items-center justify-center mb-4 glow-blue">
              <Sparkles size={28} className="text-primary-light" />
            </div>
            <p className="text-sm font-medium text-text-primary mb-2">
              El Copilot está en desarrollo
            </p>
            <p className="text-xs text-text-secondary max-w-sm leading-relaxed">
              Cuando esté activo, podrás hacer preguntas en español sobre ventas, clientes,
              inventario y predicciones ML, y el sistema responderá con datos reales de la plataforma.
            </p>
          </div>

          {/* Chat input (disabled) */}
          <div className="mt-4 pt-4 border-t border-border-subtle">
            <div className="flex gap-2">
              <div className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-lg bg-bg-elevated border border-border text-text-muted/40 text-xs cursor-not-allowed">
                <MessageSquare size={13} />
                <span>Preguntá algo sobre tus datos... (próximamente)</span>
              </div>
              <button disabled className="px-3 py-2.5 rounded-lg bg-border text-text-muted/40 cursor-not-allowed">
                <Send size={14} />
              </button>
            </div>
          </div>
        </GlassCard>

        {/* Capabilities */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
          {CAPABILITIES.map(c => (
            <GlassCard key={c.title} hover className="opacity-70">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary-dim flex items-center justify-center text-primary-light flex-shrink-0">
                  {c.icon}
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">{c.title}</p>
                  <p className="text-xs text-text-secondary mt-0.5">{c.desc}</p>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>

        {/* Example prompts */}
        <GlassCard>
          <p className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-3">Preguntas de ejemplo</p>
          <div className="space-y-2">
            {[
              "¿Cuánto vendimos en la región NOA en noviembre 2026?",
              "¿Cuáles son los 5 clientes con mayor riesgo de churn este mes?",
              "¿Qué productos deberían reponerse antes de la temporada alta?",
              "¿Cuál fue el CAGR real en USD de los últimos 3 años?",
              "Mostrá la evolución del OTIF global por trimestre",
              "¿Qué clientes Tier A no compraron en los últimos 90 días?",
            ].map(q => (
              <div key={q} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-bg-elevated border border-border-subtle opacity-60">
                <MessageSquare size={12} className="text-primary-light flex-shrink-0" />
                <span className="text-xs text-text-secondary italic">&ldquo;{q}&rdquo;</span>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Integration note */}
        <div className="mt-6 p-4 rounded-xl border border-primary-DEFAULT/20 bg-primary-dim text-center">
          <p className="text-xs text-primary-light font-medium mb-1">Stack de integración planificado</p>
          <p className="text-2xs text-text-secondary">
            Next.js API Routes → Claude claude-opus-4-8 (MCP Tools) → PostgreSQL Neon → dbt views
          </p>
        </div>
      </div>
    </AppLayout>
  );
}

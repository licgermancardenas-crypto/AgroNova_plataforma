"use client";

import { useEffect, useState } from "react";
import { Activity, Truck, AlertTriangle, TrendingUp } from "lucide-react";
import type { GISRoute, SucursalMarker } from "@/types";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LiveMetricsPanelProps {
  routes:     GISRoute[];
  sucursales: SucursalMarker[];
  playing:    boolean;
}

interface LiveMetrics {
  enviosActivos:  number;
  rutasCriticas:  number;
  otifPromedio:   number;
  riesgoScore:    number;
}

// ── OTIF helpers ──────────────────────────────────────────────────────────────

function otifStatus(otif: number): { label: string; color: string } {
  return otif >= 93
    ? { label: "NORMAL",   color: "#22C55E" }
    : otif >= 88
    ? { label: "RIESGO",   color: "#E8A020" }
    : { label: "CRÍTICO",  color: "#E03E3E" };
}

function computeMetrics(
  routes:     GISRoute[],
  sucursales: SucursalMarker[],
  jitter:     number,
): LiveMetrics {
  const active    = routes.filter(r => r.activo).length;
  const baseOtif  = sucursales.reduce((s, x) => s + x.otif_pct, 0) / (sucursales.length || 1);
  const otif      = Math.max(80, Math.min(99, baseOtif + jitter));
  const criticas  = sucursales.filter(s => s.otif_pct < 90).length;
  const riesgo    = Math.round(100 - otif + criticas * 2);

  return {
    enviosActivos: active * 3 + Math.round(jitter * 2),
    rutasCriticas: criticas,
    otifPromedio:  Math.round(otif * 10) / 10,
    riesgoScore:   Math.min(100, Math.max(0, riesgo)),
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LiveMetricsPanel({ routes, sucursales, playing }: LiveMetricsPanelProps) {
  const [metrics, setMetrics] = useState<LiveMetrics>(() =>
    computeMetrics(routes, sucursales, 0)
  );
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      const jitter = (Math.random() - 0.5) * 1.2;
      setMetrics(computeMetrics(routes, sucursales, jitter));
      setTick(t => t + 1);
    }, 3000);
    return () => clearInterval(id);
  }, [playing, routes, sucursales]);

  const { otifPromedio } = metrics;
  const otifSt = otifStatus(otifPromedio);

  return (
    <div
      className="glass rounded-xl p-3 flex flex-col gap-2 text-xs"
      style={{
        border:    "1px solid rgba(34,197,94,0.18)",
        minWidth:  180,
        background: "rgba(5,14,7,0.82)",
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-1.5 mb-0.5">
        <Activity size={11} className="text-primary" />
        <span className="font-mono font-bold text-primary tracking-widest text-2xs uppercase">
          Live Logistics
        </span>
        {playing && (
          <span
            className="ml-auto flex items-center gap-1 font-mono text-2xs"
            style={{ color: "#22C55E" }}
          >
            <span
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{ background: "#22C55E", animation: "pulse 1.2s infinite" }}
            />
            LIVE
          </span>
        )}
      </div>

      {/* Metric rows */}
      <MetricRow
        icon={<Truck size={10} />}
        label="Envíos activos"
        value={metrics.enviosActivos.toString()}
        color="#A3E635"
      />
      <MetricRow
        icon={<AlertTriangle size={10} />}
        label="Rutas críticas"
        value={metrics.rutasCriticas.toString()}
        color={metrics.rutasCriticas > 1 ? "#E03E3E" : "#E8A020"}
      />
      <MetricRow
        icon={<TrendingUp size={10} />}
        label="OTIF promedio"
        value={`${metrics.otifPromedio}%`}
        color={otifSt.color}
        badge={otifSt.label}
        badgeColor={otifSt.color}
      />

      {/* Risk bar */}
      <div className="mt-1">
        <div className="flex justify-between items-center mb-1">
          <span className="tactical-text text-2xs" style={{ color: "#4B6B4B" }}>Riesgo logístico</span>
          <span className="font-mono text-2xs font-bold" style={{ color: metrics.riesgoScore > 30 ? "#E8A020" : "#22C55E" }}>
            {metrics.riesgoScore}%
          </span>
        </div>
        <div className="rounded-full overflow-hidden h-1" style={{ background: "rgba(255,255,255,0.05)" }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width:      `${metrics.riesgoScore}%`,
              background: metrics.riesgoScore > 50 ? "#E03E3E" : metrics.riesgoScore > 25 ? "#E8A020" : "#22C55E",
            }}
          />
        </div>
      </div>

      {/* Route status table */}
      <div className="mt-1 flex flex-col gap-0.5">
        <span className="tactical-text text-2xs uppercase tracking-widest mb-0.5" style={{ color: "#4B6B4B" }}>Estado rutas</span>
        {routes.filter(r => r.activo).map(r => {
          // derive OTIF from closest sucursal by matching from-lat roughly
          const suc = sucursales.reduce((best, s) => {
            const db = Math.abs(s.lat - r.from[0]);
            const dp = Math.abs(best.lat - r.from[0]);
            return db < dp ? s : best;
          }, sucursales[0]);
          const st = otifStatus(suc?.otif_pct ?? 90);
          return (
            <div key={r.id} className="flex items-center gap-1.5">
              <span
                className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: st.color }}
              />
              <span className="tactical-text text-2xs flex-1 truncate" style={{ color: "#8CAB8C" }}>
                {r.label}
              </span>
              <span
                className="font-mono text-2xs font-bold flex-shrink-0"
                style={{ color: st.color }}
              >
                {st.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Tick indicator */}
      <div className="mt-0.5 tactical-text text-2xs" style={{ color: "#2D4D2D" }}>
        actualización #{tick + 1}
      </div>
    </div>
  );
}

// ── Sub-component ─────────────────────────────────────────────────────────────

function MetricRow({
  icon, label, value, color, badge, badgeColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  badge?: string;
  badgeColor?: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span style={{ color: "#4B6B4B" }}>{icon}</span>
      <span className="tactical-text text-2xs flex-1" style={{ color: "#8CAB8C" }}>{label}</span>
      <span className="font-mono text-xs font-bold" style={{ color }}>{value}</span>
      {badge && (
        <span
          className="font-mono text-2xs font-bold px-1 rounded"
          style={{ color: badgeColor, background: `${badgeColor}15`, border: `1px solid ${badgeColor}30` }}
        >
          {badge}
        </span>
      )}
    </div>
  );
}

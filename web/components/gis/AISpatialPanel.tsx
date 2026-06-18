"use client";

import { useState, useEffect } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExpansionItem {
  rank: number;
  provincia: string;
  ciudad_candidata: string;
  macro_region: string;
  expansion_score: number;
  capex_estimate_mard_ars: number;
  annual_revenue_estimate_mard_ars: number;
  roi_estimate_pct: number;
  payback_years: number;
  priority: "ALTA" | "MEDIA" | "BAJA";
  ai_rationale: string;
}

interface ForecastItem {
  provincia: string;
  macro_region: string;
  revenue_2024_ars: number;
  cagr_pct: number;
  forecast_2027_ars: number;
  forecast_2029_ars: number;
  trend: string;
  confidence: string;
}

interface ChurnRiskItem {
  provincia: string;
  macro_region: string;
  n_activos: number;
  churn_rate: number;
  geo_risk_score: number;
  risk_label: string;
  recommended_action: string;
}

interface OpportunityItem {
  provincia: string;
  macro_region: string;
  opportunity_score: number;
  penetracion_idx_norm: number;
  quadrant: "INVEST" | "GROW" | "DEFEND" | "MONITOR";
  quadrant_label: string;
  recommended_action: string;
  composite_score: number;
}

interface OpportunityBody {
  quadrant_counts: Record<string, number>;
  items: OpportunityItem[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const API = "http://localhost:8000";

const fmtMard = (v: number) =>
  v >= 1000 ? `$${(v / 1000).toFixed(1)}B` : `$${v.toFixed(0)}M`;

const PRIORITY_COLOR: Record<string, string> = {
  ALTA:  "#22C55E",
  MEDIA: "#E8A020",
  BAJA:  "#4B6B4B",
};

const RISK_COLOR: Record<string, string> = {
  ALTO:      "#E03E3E",
  MEDIO:     "#E8A020",
  BAJO:      "#22C55E",
  "SIN DATOS": "#4B6B4B",
};

const QUADRANT_COLOR: Record<string, string> = {
  INVEST:  "#22C55E",
  GROW:    "#A3E635",
  DEFEND:  "#0EA5E9",
  MONITOR: "#4B6B4B",
};

const TREND_COLOR: Record<string, string> = {
  CRECIENTE:  "#22C55E",
  ESTABLE:    "#E8A020",
  DECRECIENTE:"#E03E3E",
};

// ── Sub-section header ────────────────────────────────────────────────────────

function SectionHeader({ label, badge }: { label: string; badge?: string }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <p className="tactical-text flex items-center gap-1.5">{label}</p>
      {badge && (
        <span className="font-mono text-2xs px-1.5 py-0.5 rounded"
          style={{ background: "rgba(34,197,94,0.10)", border: "1px solid rgba(34,197,94,0.20)", color: "#4ADE80" }}>
          {badge}
        </span>
      )}
    </div>
  );
}

// ── Skeleton loader ───────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-2">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-8 rounded bg-bg-elevated animate-pulse" />
      ))}
    </div>
  );
}

// ── Expansion section ─────────────────────────────────────────────────────────

function ExpansionSection({ items }: { items: ExpansionItem[] }) {
  const [expanded, setExpanded] = useState<number | null>(null);

  if (!items.length) return <p className="text-2xs text-text-muted italic">Sin datos de expansión</p>;

  return (
    <div className="space-y-1.5">
      {items.map(item => (
        <div key={item.rank}>
          <button
            onClick={() => setExpanded(expanded === item.rank ? null : item.rank)}
            className="w-full text-left"
          >
            <div className="flex items-center justify-between text-2xs py-1 px-1.5 rounded hover:bg-bg-elevated transition-all">
              <div className="flex items-center gap-2">
                <span className="font-mono w-4 text-text-muted">{item.rank}</span>
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: PRIORITY_COLOR[item.priority] }}
                />
                <span className="text-text-secondary truncate max-w-[80px]">{item.provincia}</span>
                <span className="text-text-muted">{item.macro_region}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="font-mono" style={{ color: PRIORITY_COLOR[item.priority] }}>
                  {item.expansion_score.toFixed(0)}
                </span>
                <span className="font-mono text-text-muted text-2xs">{item.priority}</span>
              </div>
            </div>
          </button>

          {expanded === item.rank && (
            <div
              className="mt-1 mb-1.5 p-2 rounded text-2xs space-y-1"
              style={{ background: "rgba(34,197,94,0.04)", border: "1px solid rgba(34,197,94,0.12)" }}
            >
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                {[
                  ["Capex est.", fmtMard(item.capex_estimate_mard_ars)],
                  ["Rev. anual est.", fmtMard(item.annual_revenue_estimate_mard_ars)],
                  ["ROI est.", `${item.roi_estimate_pct.toFixed(1)}%`],
                  ["Payback", `${item.payback_years.toFixed(1)} años`],
                ].map(([l, v]) => (
                  <div key={l} className="flex justify-between">
                    <span className="text-text-muted">{l}</span>
                    <span className="font-mono text-text-secondary">{v}</span>
                  </div>
                ))}
              </div>
              <p className="text-text-muted mt-1 leading-relaxed"
                style={{ fontSize: 9 }}>{item.ai_rationale}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Forecast section ──────────────────────────────────────────────────────────

function ForecastSection({ items }: { items: ForecastItem[] }) {
  const top = items.slice(0, 8);
  const maxRev = Math.max(...top.map(i => i.forecast_2027_ars), 1);

  return (
    <div className="space-y-2">
      {top.map(item => {
        const bar = (item.forecast_2027_ars / maxRev) * 100;
        return (
          <div key={item.provincia}>
            <div className="flex justify-between text-2xs mb-0.5">
              <div className="flex items-center gap-1.5">
                <span className="text-text-secondary truncate max-w-[75px]">{item.provincia}</span>
                <span
                  className="font-mono text-2xs"
                  style={{ color: TREND_COLOR[item.trend] ?? "#4B6B4B", fontSize: 8 }}
                >
                  {item.trend === "CRECIENTE" ? "↑" : item.trend === "DECRECIENTE" ? "↓" : "→"}
                  {item.cagr_pct > 0 ? "+" : ""}{item.cagr_pct.toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className="font-mono text-primary">
                  {(item.forecast_2027_ars / 1_000_000_000).toFixed(1)}B
                </span>
                <span className="font-mono text-text-muted" style={{ fontSize: 8 }}>
                  →{(item.forecast_2029_ars / 1_000_000_000).toFixed(1)}B
                </span>
              </div>
            </div>
            <div className="h-1 bg-bg-elevated rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${bar}%`,
                  background: TREND_COLOR[item.trend] ?? "#22C55E",
                  opacity: 0.7,
                }}
              />
            </div>
          </div>
        );
      })}
      <p className="tactical-text mt-1" style={{ fontSize: 8 }}>
        Proyección linear 2025-2029 · base 2016-2024
      </p>
    </div>
  );
}

// ── Churn risk section ────────────────────────────────────────────────────────

function ChurnRiskSection({ items }: { items: ChurnRiskItem[] }) {
  const active = items.filter(i => i.risk_label !== "SIN DATOS").slice(0, 6);
  const noData = items.filter(i => i.risk_label === "SIN DATOS").length;

  return (
    <div className="space-y-1.5">
      {active.map(item => (
        <div key={item.provincia}>
          <div className="flex items-center justify-between text-2xs">
            <div className="flex items-center gap-1.5">
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: RISK_COLOR[item.risk_label] }}
              />
              <span className="text-text-secondary truncate max-w-[72px]">{item.provincia}</span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="font-mono text-text-muted">
                {(item.churn_rate * 100).toFixed(1)}% ch
              </span>
              <span
                className="font-mono"
                style={{ color: RISK_COLOR[item.risk_label] }}
              >
                {item.risk_label}
              </span>
            </div>
          </div>
          <div
            className="h-0.5 mt-0.5 rounded-full"
            style={{
              width: `${Math.min(item.geo_risk_score * 200, 100)}%`,
              background: RISK_COLOR[item.risk_label],
              opacity: 0.5,
            }}
          />
        </div>
      ))}
      {noData > 0 && (
        <p className="tactical-text" style={{ fontSize: 8 }}>
          +{noData} provincias sin presencia comercial
        </p>
      )}
    </div>
  );
}

// ── Opportunity matrix section ────────────────────────────────────────────────

function OpportunityMatrixSection({ body }: { body: OpportunityBody }) {
  const { quadrant_counts, items } = body;
  const top = items.slice(0, 10);

  return (
    <div className="space-y-2">
      {/* 2×2 summary grid */}
      <div className="grid grid-cols-2 gap-1">
        {(["INVEST", "GROW", "DEFEND", "MONITOR"] as const).map(q => (
          <div
            key={q}
            className="rounded px-2 py-1.5 text-center"
            style={{
              background: `${QUADRANT_COLOR[q]}12`,
              border: `1px solid ${QUADRANT_COLOR[q]}30`,
            }}
          >
            <p className="font-mono text-2xs font-bold" style={{ color: QUADRANT_COLOR[q] }}>
              {quadrant_counts[q] ?? 0}
            </p>
            <p className="tactical-text" style={{ fontSize: 8 }}>{q}</p>
          </div>
        ))}
      </div>

      {/* Province list */}
      <div className="space-y-1">
        {top.map(item => (
          <div key={item.provincia} className="flex items-center justify-between text-2xs">
            <div className="flex items-center gap-1.5">
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: QUADRANT_COLOR[item.quadrant] }}
              />
              <span className="text-text-secondary truncate max-w-[72px]">{item.provincia}</span>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="font-mono text-text-muted">
                opp {item.opportunity_score.toFixed(0)}
              </span>
              <span
                className="font-mono text-2xs px-1 rounded"
                style={{
                  background: `${QUADRANT_COLOR[item.quadrant]}18`,
                  color: QUADRANT_COLOR[item.quadrant],
                  fontSize: 8,
                }}
              >
                {item.quadrant}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

type Section = "expansion" | "forecast" | "churn" | "matrix";

export default function AISpatialPanel() {
  const [section, setSection] = useState<Section>("expansion");
  const [expansion,    setExpansion]    = useState<ExpansionItem[]>([]);
  const [forecast,     setForecast]     = useState<ForecastItem[]>([]);
  const [churnRisk,    setChurnRisk]    = useState<ChurnRiskItem[]>([]);
  const [opportunity,  setOpportunity]  = useState<OpportunityBody | null>(null);
  const [loading,      setLoading]      = useState<Record<Section, boolean>>({
    expansion: true, forecast: true, churn: true, matrix: true,
  });
  const [error,        setError]        = useState<Partial<Record<Section, string>>>({});

  const fetchSection = (sec: Section) => {
    const url: Record<Section, string> = {
      expansion: `${API}/api/ai/expansion`,
      forecast:  `${API}/api/ai/forecast`,
      churn:     `${API}/api/ai/churn-risk`,
      matrix:    `${API}/api/ai/opportunities`,
    };
    setLoading(prev => ({ ...prev, [sec]: true }));
    setError(prev => ({ ...prev, [sec]: undefined }));
    fetch(url[sec])
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(data => {
        if (sec === "expansion") setExpansion(data.items ?? []);
        if (sec === "forecast")  setForecast(data.items ?? []);
        if (sec === "churn")     setChurnRisk(data.items ?? []);
        if (sec === "matrix")    setOpportunity(data);
      })
      .catch((e: Error) => setError(prev => ({ ...prev, [sec]: e.message })))
      .finally(() => setLoading(prev => ({ ...prev, [sec]: false })));
  };

  useEffect(() => {
    (["expansion", "forecast", "churn", "matrix"] as Section[]).forEach(fetchSection);
  }, []);

  const tabs: { id: Section; label: string }[] = [
    { id: "expansion", label: "Expansión" },
    { id: "forecast",  label: "Forecast" },
    { id: "churn",     label: "Riesgo" },
    { id: "matrix",    label: "Matrix" },
  ];

  return (
    <div className="flex flex-col gap-2">

      {/* Sub-tabs */}
      <div
        className="rounded-xl p-1 flex gap-1 flex-shrink-0"
        style={{ background: "rgba(7,18,9,0.6)", backdropFilter: "blur(8px)", border: "1px solid rgba(34,197,94,0.10)" }}
      >
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setSection(t.id)}
            className={`flex-1 py-1 rounded text-2xs font-mono transition-all border ${
              section === t.id
                ? "bg-primary-dim text-primary border-primary/30"
                : "text-text-muted border-transparent hover:text-text-secondary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {section === "expansion" && (
        <div className="glass rounded-xl p-3">
          <SectionHeader
            label="Top Candidatas de Expansión"
            badge={`${expansion.length} candidatas`}
          />
          <p className="tactical-text mb-2" style={{ fontSize: 8 }}>
            Capex · ROI · Payback · click para detalle
          </p>
          {loading.expansion ? <Skeleton /> :
           error.expansion   ? <p className="text-2xs text-danger-DEFAULT">Backend no disponible</p> :
           <ExpansionSection items={expansion} />}
        </div>
      )}

      {section === "forecast" && (
        <div className="glass rounded-xl p-3">
          <SectionHeader
            label="Revenue Forecast 2027-2029"
            badge="Tendencia lineal"
          />
          {loading.forecast ? <Skeleton /> :
           error.forecast   ? <p className="text-2xs text-danger-DEFAULT">Backend no disponible</p> :
           <ForecastSection items={forecast} />}
        </div>
      )}

      {section === "churn" && (
        <div className="glass rounded-xl p-3">
          <SectionHeader
            label="Riesgo Geográfico Compuesto"
            badge="churn 40% · log 30% · cobertura 30%"
          />
          {loading.churn ? <Skeleton /> :
           error.churn   ? <p className="text-2xs text-danger-DEFAULT">Backend no disponible</p> :
           <ChurnRiskSection items={churnRisk} />}
        </div>
      )}

      {section === "matrix" && (
        <div className="glass rounded-xl p-3">
          <SectionHeader
            label="Opportunity Matrix 2×2"
            badge="opp × penetración"
          />
          <div className="grid grid-cols-2 gap-x-4 mb-2" style={{ fontSize: 8 }}>
            {[
              ["INVEST",  "Alta opp, baja pen → abrir"],
              ["GROW",    "Alta opp, alta pen → escalar"],
              ["DEFEND",  "Baja opp, alta pen → proteger"],
              ["MONITOR", "Baja opp, baja pen → observar"],
            ].map(([q, d]) => (
              <div key={q} className="flex items-start gap-1 text-text-muted">
                <span className="w-1.5 h-1.5 rounded-full mt-0.5 flex-shrink-0"
                  style={{ background: QUADRANT_COLOR[q] }} />
                <span>{q}: {d}</span>
              </div>
            ))}
          </div>
          {loading.matrix ? <Skeleton /> :
           error.matrix   ? <p className="text-2xs text-danger-DEFAULT">Backend no disponible</p> :
           opportunity    ? <OpportunityMatrixSection body={opportunity} /> :
           null}
        </div>
      )}

    </div>
  );
}

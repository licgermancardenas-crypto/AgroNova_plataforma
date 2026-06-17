"use client";

import { useEffect, useState } from "react";
import { Target, TrendingUp, Crosshair, Activity, AlertTriangle } from "lucide-react";
import { fmtARS } from "@/lib/formatters";
import {
  ANALYTICS_ENDPOINTS, COVERAGE_COLOR, OPPORTUNITY_COLOR, EXPANSION_COLOR, CHURN_COLOR,
} from "@/lib/spatial-analytics";
import type {
  CoverageScoreRecord, OpportunityScoreRecord, ExpansionTargetRecord,
  RevenueDensityRecord, ChurnByProvinceRecord,
} from "@/types";

interface AnalyticsState {
  coverage: CoverageScoreRecord[];
  opportunity: OpportunityScoreRecord[];
  expansion: ExpansionTargetRecord[];
  density: RevenueDensityRecord[];
  churn: ChurnByProvinceRecord[];
  loading: boolean;
  error: string | null;
}

function useSpatialAnalytics(): AnalyticsState {
  const [state, setState] = useState<AnalyticsState>({
    coverage: [], opportunity: [], expansion: [], density: [], churn: [],
    loading: true, error: null,
  });

  useEffect(() => {
    Promise.all([
      fetch(ANALYTICS_ENDPOINTS.coverage).then(r => r.json()),
      fetch(ANALYTICS_ENDPOINTS.opportunity).then(r => r.json()),
      fetch(ANALYTICS_ENDPOINTS.expansion).then(r => r.json()),
      fetch(ANALYTICS_ENDPOINTS.density).then(r => r.json()),
      fetch(ANALYTICS_ENDPOINTS.churn).then(r => r.json()),
    ])
      .then(([coverage, opportunity, expansion, density, churn]) => {
        setState({ coverage, opportunity, expansion, density, churn, loading: false, error: null });
      })
      .catch((e: Error) => setState(s => ({ ...s, loading: false, error: e.message })));
  }, []);

  return state;
}

function ScoreBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-2xs mb-0.5">
        <span className="text-text-secondary truncate max-w-[90px]">{label}</span>
        <span className="font-mono font-bold" style={{ color }}>{value.toFixed(1)}</span>
      </div>
      <div className="h-1 bg-bg-elevated rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

export default function SpatialAnalyticsPanel() {
  const { coverage, opportunity, expansion, density, churn, loading, error } = useSpatialAnalytics();

  if (loading) {
    return (
      <div className="glass rounded-xl p-3 flex items-center justify-center h-32">
        <span className="tactical-text text-text-muted">Cargando análisis espacial…</span>
      </div>
    );
  }
  if (error) {
    return (
      <div className="glass rounded-xl p-3 border border-danger-DEFAULT/30">
        <span className="tactical-text text-danger-DEFAULT">Error: {error}</span>
      </div>
    );
  }

  const topCoverage = [...coverage].sort((a, b) => b.coverage_score - a.coverage_score).slice(0, 5);
  const topOpportunity = [...opportunity].sort((a, b) => b.opportunity_score - a.opportunity_score).slice(0, 5);
  const topExpansion = [...expansion]
    .filter(e => e.expansion_priority === "Alta")
    .sort((a, b) => b.expansion_score - a.expansion_score)
    .slice(0, 5);
  const topDensity = [...density]
    .filter(d => d.provincia !== "Ciudad Autónoma de Buenos Aires")
    .sort((a, b) => b.revenue_density - a.revenue_density)
    .slice(0, 5);
  const churnActive = [...churn]
    .filter(c => c.n_total > 0)
    .sort((a, b) => b.churn_rate - a.churn_rate);

  return (
    <div className="flex flex-col gap-2.5">
      {/* Coverage Score */}
      <div className="glass rounded-xl p-3">
        <p className="tactical-text mb-2.5 flex items-center gap-1.5">
          <Crosshair size={10} /><span>Coverage Score</span>
        </p>
        <div className="space-y-2">
          {topCoverage.map(p => (
            <ScoreBar
              key={p.provincia}
              label={p.provincia}
              value={p.coverage_score}
              max={100}
              color={COVERAGE_COLOR[p.coverage_label]}
            />
          ))}
        </div>
      </div>

      {/* Opportunity Score */}
      <div className="glass rounded-xl p-3">
        <p className="tactical-text mb-2.5 flex items-center gap-1.5">
          <Target size={10} /><span>Opportunity Score</span>
        </p>
        <div className="space-y-2">
          {topOpportunity.map(p => (
            <ScoreBar
              key={p.provincia}
              label={p.provincia}
              value={p.opportunity_score}
              max={100}
              color={OPPORTUNITY_COLOR[p.opportunity_label]}
            />
          ))}
        </div>
      </div>

      {/* Expansion Targets */}
      <div className="glass rounded-xl p-3">
        <p className="tactical-text mb-2.5 flex items-center gap-1.5">
          <TrendingUp size={10} /><span>Expansion Targets</span>
        </p>
        <div className="space-y-2">
          {topExpansion.length === 0 && (
            <span className="text-2xs text-text-muted">Sin objetivos de alta prioridad</span>
          )}
          {topExpansion.map(p => (
            <div key={p.provincia}>
              <div className="flex justify-between text-2xs mb-0.5">
                <span className="text-text-secondary truncate max-w-[90px]">{p.provincia}</span>
                <span className="font-mono font-bold" style={{ color: EXPANSION_COLOR[p.expansion_priority] }}>
                  {p.expansion_priority}
                </span>
              </div>
              <p className="text-2xs text-text-muted truncate">{p.rationale}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Revenue Density */}
      <div className="glass rounded-xl p-3">
        <p className="tactical-text mb-2.5 flex items-center gap-1.5">
          <Activity size={10} /><span>Densidad Comercial</span>
        </p>
        <div className="space-y-2">
          {topDensity.map(p => (
            <div key={p.provincia} className="flex justify-between text-2xs">
              <span className="text-text-secondary truncate max-w-[90px]">{p.provincia}</span>
              <span className="font-mono text-primary">{fmtARS(p.revenue_density, true)}/km²</span>
            </div>
          ))}
        </div>
      </div>

      {/* Churn Geográfico */}
      <div className="glass rounded-xl p-3">
        <p className="tactical-text mb-2.5 flex items-center gap-1.5">
          <AlertTriangle size={10} /><span>Churn Geográfico</span>
        </p>
        <div className="space-y-2">
          {churnActive.map(p => (
            <div key={p.provincia} className="flex justify-between text-2xs">
              <span className="text-text-secondary truncate max-w-[90px]">{p.provincia}</span>
              <span className="font-mono font-bold" style={{ color: CHURN_COLOR[p.churn_level] }}>
                {(p.churn_rate * 100).toFixed(1)}% · {p.churn_level}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Network, Gauge, Layers3, Rocket } from "lucide-react";
import {
  NETWORK_ENDPOINTS, LOGISTICS_COLOR, CLUSTER_COLOR, COVERAGE_BUCKET_COLOR,
} from "@/lib/network-intelligence";
import type {
  CoverageDistribution, LogisticsScoreRecord, TerritorialCluster, ExpansionRecommendation,
} from "@/types";

interface NetworkState {
  coverage: CoverageDistribution | null;
  logistics: LogisticsScoreRecord[];
  clusters: TerritorialCluster[];
  expansion: ExpansionRecommendation[];
  loading: boolean;
  error: string | null;
}

function useNetworkIntelligence(): NetworkState {
  const [state, setState] = useState<NetworkState>({
    coverage: null, logistics: [], clusters: [], expansion: [], loading: true, error: null,
  });

  useEffect(() => {
    Promise.all([
      fetch(NETWORK_ENDPOINTS.coverageDistribution).then(r => r.json()),
      fetch(NETWORK_ENDPOINTS.logisticsScore).then(r => r.json()),
      fetch(NETWORK_ENDPOINTS.territorialClusters).then(r => r.json()),
      fetch(NETWORK_ENDPOINTS.expansionRecommendations).then(r => r.json()),
    ])
      .then(([coverage, logistics, clusters, expansion]) => {
        setState({ coverage, logistics, clusters, expansion, loading: false, error: null });
      })
      .catch((e: Error) => setState(s => ({ ...s, loading: false, error: e.message })));
  }, []);

  return state;
}

export default function NetworkIntelligencePanel() {
  const { coverage, logistics, clusters, expansion, loading, error } = useNetworkIntelligence();

  if (loading) {
    return (
      <div className="glass rounded-xl p-3 flex items-center justify-center h-32">
        <span className="tactical-text text-text-muted">Cargando network intelligence…</span>
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

  const rankedLogistics = [...logistics].sort(
    (a, b) => (b.logistics_score ?? -1) - (a.logistics_score ?? -1)
  );
  const rankedClusters = [...clusters].sort((a, b) => b.n_activos_total - a.n_activos_total);

  return (
    <div className="flex flex-col gap-2.5">
      {/* Logistics Efficiency */}
      <div className="glass rounded-xl p-3">
        <p className="tactical-text mb-2.5 flex items-center gap-1.5">
          <Gauge size={10} /><span>Eficiencia Logística</span>
        </p>
        <div className="space-y-2">
          {rankedLogistics.map(s => (
            <div key={s.sucursal_id}>
              <div className="flex justify-between text-2xs mb-0.5">
                <span className="text-text-secondary truncate max-w-[90px]">{s.nombre}</span>
                <span className="font-mono font-bold" style={{ color: LOGISTICS_COLOR[s.logistics_label] }}>
                  {s.logistics_score !== null ? s.logistics_score.toFixed(1) : s.logistics_label}
                </span>
              </div>
              {s.logistics_score !== null && (
                <div className="h-1 bg-bg-elevated rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${s.logistics_score}%`, background: LOGISTICS_COLOR[s.logistics_label] }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Coverage Radius Distribution */}
      <div className="glass rounded-xl p-3">
        <p className="tactical-text mb-2.5 flex items-center gap-1.5">
          <Network size={10} /><span>Distribución por Radios</span>
        </p>
        <div className="space-y-2">
          {coverage?.national.map(b => (
            <div key={b.bucket}>
              <div className="flex justify-between text-2xs mb-0.5">
                <span className="text-text-secondary">{b.bucket}</span>
                <span className="font-mono" style={{ color: COVERAGE_BUCKET_COLOR[b.bucket] }}>
                  {b.pct.toFixed(1)}%
                </span>
              </div>
              <div className="h-1 bg-bg-elevated rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${b.pct}%`, background: COVERAGE_BUCKET_COLOR[b.bucket] }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Territorial Clusters */}
      <div className="glass rounded-xl p-3">
        <p className="tactical-text mb-2.5 flex items-center gap-1.5">
          <Layers3 size={10} /><span>Clusters Territoriales</span>
        </p>
        <div className="space-y-2.5">
          {rankedClusters.map(c => (
            <div key={c.cluster_id}>
              <div className="flex justify-between text-2xs mb-0.5">
                <span className="font-mono font-bold" style={{ color: CLUSTER_COLOR[c.label] }}>
                  {c.label}
                </span>
                <span className="text-text-muted">{c.n_provincias} prov.</span>
              </div>
              <p className="text-2xs text-text-muted truncate">{c.provincias.join(", ")}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Expansion Recommendations */}
      <div className="glass rounded-xl p-3">
        <p className="tactical-text mb-2.5 flex items-center gap-1.5">
          <Rocket size={10} /><span>Recomendaciones de Expansión</span>
        </p>
        <div className="space-y-2.5">
          {expansion.map(e => (
            <div key={e.provincia}>
              <div className="flex justify-between text-2xs mb-0.5">
                <span className="text-text-primary font-semibold truncate max-w-[100px]">{e.ciudad_candidata}</span>
                <span className="font-mono text-primary">{e.expansion_score.toFixed(1)}</span>
              </div>
              <p className="text-2xs text-text-muted">{e.justificacion}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

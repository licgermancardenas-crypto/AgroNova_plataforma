"use client";

import { useEffect, useState } from "react";
import { Leaf, Droplets, AlertTriangle, TrendingUp } from "lucide-react";

interface ProvinceEnv {
  province: string;
  macro_region: string;
  lat: number;
  lon: number;
  rainfall_mm_yr: number;
  rainfall_score: number;
  rainfall_label: string;
  drought_risk: number;
  drought_label: string;
  suitability_score: number;
  climate_score: number;
  dominant_crops: string[];
}

interface ScoresResponse {
  total: number;
  source: string;
  items: ProvinceEnv[];
}

type EnvTab = "climate" | "drought" | "rainfall" | "suitability";

const API = "http://localhost:8000";

function ScoreBadge({ value, high = false }: { value: number; high?: boolean }) {
  const color =
    high
      ? value > 70 ? "#22C55E" : value > 45 ? "#E8A020" : "#E03E3E"
      : value > 70 ? "#E03E3E" : value > 45 ? "#E8A020" : "#22C55E";
  return (
    <span
      className="font-mono text-xs font-bold px-1.5 py-0.5 rounded"
      style={{ color, background: `${color}18`, border: `1px solid ${color}40` }}
    >
      {value}
    </span>
  );
}

function MiniBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5 flex-1">
      <div className="flex-1 h-1 bg-bg-elevated rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${value}%`, background: color }} />
      </div>
      <span className="font-mono text-2xs w-6 text-right" style={{ color }}>{value}</span>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-2">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-8 bg-bg-elevated rounded animate-pulse opacity-40" />
      ))}
    </div>
  );
}

export default function EnvironmentPanel() {
  const [tab,     setTab]     = useState<EnvTab>("climate");
  const [data,    setData]    = useState<ProvinceEnv[]>([]);
  const [source,  setSource]  = useState("");
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`${API}/api/environment/scores`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d: ScoresResponse) => { setData(d.items); setSource(d.source); setLoading(false); })
      .catch((e: Error) => { setError(e.message); setLoading(false); });
  }, []);

  const sorted = {
    climate:    [...data].sort((a, b) => b.climate_score - a.climate_score),
    drought:    [...data].sort((a, b) => b.drought_risk - a.drought_risk),
    rainfall:   [...data].sort((a, b) => b.rainfall_score - a.rainfall_score),
    suitability:[...data].sort((a, b) => b.suitability_score - a.suitability_score),
  };

  const TABS: { id: EnvTab; label: string; icon: React.ReactNode }[] = [
    { id: "climate",     label: "Clima",      icon: <TrendingUp size={9} /> },
    { id: "drought",     label: "Sequía",     icon: <AlertTriangle size={9} /> },
    { id: "rainfall",    label: "Lluvia",     icon: <Droplets size={9} /> },
    { id: "suitability", label: "Aptitud",    icon: <Leaf size={9} /> },
  ];

  return (
    <div className="flex flex-col gap-2 h-full">

      {/* Header */}
      <div className="glass rounded-xl p-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <Leaf size={10} className="text-primary" />
            <span className="tactical-text font-bold" style={{ color: "#22C55E" }}>ENV INTELLIGENCE</span>
          </div>
          <span className="tactical-text" style={{ color: "#4B6B4B" }}>GIS-19</span>
        </div>
        {source && <p className="tactical-text" style={{ fontSize: 8, color: "#4B6B4B" }}>Fuente: {source}</p>}
        <div className="flex items-center gap-1 mt-1.5 text-2xs">
          <span className="font-mono text-primary">{data.length}</span>
          <span className="text-text-muted">provincias indexadas</span>
        </div>
      </div>

      {/* Sub-tab bar */}
      <div
        className="rounded-xl p-1 flex gap-1 flex-shrink-0"
        style={{ background: "rgba(7,18,9,0.6)", border: "1px solid rgba(34,197,94,0.10)" }}
      >
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-1 rounded text-2xs font-mono flex items-center justify-center gap-1 transition-all border ${
              tab === t.id
                ? "bg-primary-dim text-primary border-primary/30"
                : "text-text-muted border-transparent hover:text-text-secondary"
            }`}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5">
        {loading ? (
          <div className="glass rounded-xl p-3"><Skeleton /></div>
        ) : error ? (
          <div className="glass rounded-xl p-3">
            <div className="flex items-center gap-1.5 text-danger-DEFAULT mb-2">
              <AlertTriangle size={10} />
              <span className="tactical-text">API no disponible</span>
            </div>
            <p className="tactical-text text-2xs text-text-muted">Backend offline — datos no cargados.</p>
          </div>
        ) : (
          <>
            {/* Climate tab */}
            {tab === "climate" && (
              <div className="glass rounded-xl p-3">
                <p className="tactical-text mb-2 flex items-center gap-1.5">
                  <TrendingUp size={9} /><span>Score Climático Compuesto</span>
                </p>
                <div className="space-y-2">
                  {sorted.climate.map((p, i) => (
                    <div key={p.province}>
                      <div className="flex items-center gap-1.5 text-2xs mb-0.5">
                        <span className="text-text-muted w-4 font-mono">{i + 1}</span>
                        <span className="text-text-secondary truncate flex-1">{p.province}</span>
                        <span className="tactical-text px-1 rounded" style={{
                          background: `${{ PAM: "#22C55E", NEA: "#4ADE80", NOA: "#E8A020", CUY: "#F97316", PAT: "#38BDF8" }[p.macro_region] ?? "#666"}18`,
                          color:      `${{ PAM: "#22C55E", NEA: "#4ADE80", NOA: "#E8A020", CUY: "#F97316", PAT: "#38BDF8" }[p.macro_region] ?? "#666"}`,
                          fontSize:   8,
                        }}>{p.macro_region}</span>
                        <ScoreBadge value={p.climate_score} high />
                      </div>
                      <MiniBar value={p.climate_score} color="#22C55E" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Drought tab */}
            {tab === "drought" && (
              <div className="glass rounded-xl p-3">
                <p className="tactical-text mb-2 flex items-center gap-1.5">
                  <AlertTriangle size={9} /><span>Riesgo de Sequía (mayor = crítico)</span>
                </p>
                <div className="space-y-2">
                  {sorted.drought.map((p, i) => (
                    <div key={p.province}>
                      <div className="flex items-center gap-1.5 text-2xs mb-0.5">
                        <span className="text-text-muted w-4 font-mono">{i + 1}</span>
                        <span className="text-text-secondary truncate flex-1">{p.province}</span>
                        <span className="tactical-text text-2xs text-text-muted truncate max-w-[55px]">{p.drought_label}</span>
                        <ScoreBadge value={p.drought_risk} />
                      </div>
                      <MiniBar value={p.drought_risk} color={p.drought_risk > 70 ? "#E03E3E" : p.drought_risk > 45 ? "#E8A020" : "#22C55E"} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Rainfall tab */}
            {tab === "rainfall" && (
              <div className="glass rounded-xl p-3">
                <p className="tactical-text mb-2 flex items-center gap-1.5">
                  <Droplets size={9} /><span>Score Pluvial</span>
                </p>
                <div className="space-y-2">
                  {sorted.rainfall.map((p, i) => (
                    <div key={p.province}>
                      <div className="flex items-center gap-1.5 text-2xs mb-0.5">
                        <span className="text-text-muted w-4 font-mono">{i + 1}</span>
                        <span className="text-text-secondary truncate flex-1">{p.province}</span>
                        <span className="tactical-text text-2xs" style={{ color: "#4B6B4B" }}>{p.rainfall_mm_yr}mm</span>
                        <ScoreBadge value={p.rainfall_score} high />
                      </div>
                      <MiniBar value={p.rainfall_score} color="#0EA5E9" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Suitability tab */}
            {tab === "suitability" && (
              <div className="glass rounded-xl p-3">
                <p className="tactical-text mb-2 flex items-center gap-1.5">
                  <Leaf size={9} /><span>Aptitud Agrícola</span>
                </p>
                <div className="space-y-2.5">
                  {sorted.suitability.slice(0, 12).map((p, i) => (
                    <div key={p.province}>
                      <div className="flex items-center gap-1.5 text-2xs mb-0.5">
                        <span className="text-text-muted w-4 font-mono">{i + 1}</span>
                        <span className="text-text-secondary truncate flex-1">{p.province}</span>
                        <ScoreBadge value={p.suitability_score} high />
                      </div>
                      <MiniBar value={p.suitability_score} color="#A3E635" />
                      <p className="tactical-text mt-0.5 ml-5" style={{ fontSize: 8, color: "#4B6B4B" }}>
                        {p.dominant_crops.slice(0, 3).join(" · ")}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

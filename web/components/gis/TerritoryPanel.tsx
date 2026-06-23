"use client";

import { useState, useMemo, useEffect, memo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
} from "recharts";
import type {
  TerritoryAnalysis, TerritoryBranch, TerritoryConflict,
  ExpansionCandidate, LoadStatus,
} from "@/types";
import { fmtARS } from "@/lib/formatters";

// ── helpers ────────────────────────────────────────────────────────────────────

const LOAD_COLOR: Record<LoadStatus, string> = {
  NORMAL:     "#22C55E",
  ALTA_CARGA: "#F97316",
  SATURADA:   "#E03E3E",
};

const LOAD_LABEL: Record<LoadStatus, string> = {
  NORMAL:     "Normal",
  ALTA_CARGA: "Alta Carga",
  SATURADA:   "Saturada",
};

function haversineKm(la1: number, lo1: number, la2: number, lo2: number): number {
  const R  = 6371;
  const dL = (la2 - la1) * Math.PI / 180;
  const dO = (lo2 - lo1) * Math.PI / 180;
  const a  = Math.sin(dL / 2) ** 2
    + Math.cos(la1 * Math.PI / 180) * Math.cos(la2 * Math.PI / 180) * Math.sin(dO / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmtM(n: number) { return (n / 1e6).toFixed(1) + "M"; }
function fmtPct(n: number) { return n.toFixed(1) + "%"; }
function fmtKm(n: number)  { return n.toFixed(0) + " km"; }

// ── KPI badge ─────────────────────────────────────────────────────────────────

function Kpi({ label, value, sub, color }: {
  label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 bg-white/5 rounded p-2.5">
      <span className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</span>
      <span className={`text-base font-bold font-mono ${color ?? "text-green-400"}`}>{value}</span>
      {sub && <span className="text-[10px] text-gray-500">{sub}</span>}
    </div>
  );
}

// ── sub-tabs ──────────────────────────────────────────────────────────────────

type SubTab = "territorios" | "conflictos" | "simulacion" | "expansion";

// ═══════════════════════════════════════════════════════════════════════════════
// TERRITORIOS sub-tab
// ═══════════════════════════════════════════════════════════════════════════════

function TerritoriosTab({ data }: { data: TerritoryAnalysis }) {
  const st = data.status;
  const branches = data.branches;

  const radarData = useMemo(() => branches.map(b => ({
    name: b.nombre.split(" ")[0],
    Clientes:    b.n_clientes,
    Revenue_M:   +(b.revenue_total / 1e6).toFixed(1),
    OTIF:        b.otif_avg,
    Dist_km:     b.avg_distance_km,
    Conflictos:  b.n_conflictos,
  })), [branches]);

  return (
    <div className="flex flex-col gap-3">
      {/* Executive KPIs */}
      <div className="grid grid-cols-2 gap-2">
        <Kpi label="Total Clientes"    value={st.total_clientes.toLocaleString()} />
        <Kpi label="Conflictos"        value={st.n_conflictos.toLocaleString()}
              sub={fmtPct(st.pct_conflictos) + " del total"} color="text-yellow-400" />
        <Kpi label="Revenue Total"     value={"ARS " + fmtM(st.total_revenue_ars)} />
        <Kpi label="OTIF Global"       value={fmtPct(st.otif_global)}
              color={st.otif_global >= 85 ? "text-green-400" : "text-orange-400"} />
        <Kpi label="Reducción Dist."   value={fmtPct(st.reduccion_media_pct)}
              sub="si se reasignan conflictos" color="text-blue-400" />
        <Kpi label="Ahorro Dist."      value={fmtKm(st.ahorro_potencial_km)}
              sub="total acumulado" color="text-blue-400" />
      </div>

      {/* Load distribution */}
      <div className="bg-white/5 rounded p-2.5">
        <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-2">Carga por Sucursal</div>
        <div className="flex gap-2 mb-2">
          {(["NORMAL", "ALTA_CARGA", "SATURADA"] as LoadStatus[]).map(s => (
            <div key={s} className="flex items-center gap-1 text-[10px]">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: LOAD_COLOR[s] }} />
              <span className="text-gray-400">{LOAD_LABEL[s]}: {st.load_distribution[s]}</span>
            </div>
          ))}
        </div>
        <div className="space-y-1.5">
          {branches.map(b => (
            <div key={b.sucursal_id} className="flex items-center gap-2 text-[11px]">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: b.load_color }} />
              <span className="text-gray-300 w-24 truncate">{b.nombre}</span>
              <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: fmtPct(b.pct_clientes), background: b.load_color }}
                />
              </div>
              <span className="text-gray-400 w-12 text-right">{b.n_clientes.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Branch revenue bar */}
      <div className="bg-white/5 rounded p-2.5">
        <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-2">Revenue por Sucursal (ARS M)</div>
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={radarData} margin={{ left: -10, right: 4, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fill: "#9CA3AF", fontSize: 9 }} />
            <YAxis tick={{ fill: "#9CA3AF", fontSize: 9 }} />
            <Tooltip
              contentStyle={{ background: "#111", border: "1px solid #333", fontSize: 11 }}
              formatter={(v: number) => [`ARS ${v.toFixed(1)}M`, "Revenue"]}
            />
            <Bar dataKey="Revenue_M" fill="#22C55E" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONFLICTOS sub-tab
// ═══════════════════════════════════════════════════════════════════════════════

function ConflictosTab({ conflicts, branches }: {
  conflicts: TerritoryConflict[];
  branches:  TerritoryBranch[];
}) {
  const [filterBranch, setFilterBranch] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<"improvement_km" | "revenue_ars">("improvement_km");

  const filtered = useMemo(() => {
    let list = filterBranch
      ? conflicts.filter(c => c.current_id === filterBranch)
      : conflicts;
    return [...list].sort((a, b) => b[sortBy] - a[sortBy]).slice(0, 100);
  }, [conflicts, filterBranch, sortBy]);

  const totalRev  = useMemo(() => filtered.reduce((s, c) => s + c.revenue_ars,   0), [filtered]);
  const totalSave = useMemo(() => filtered.reduce((s, c) => s + c.improvement_km, 0), [filtered]);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <Kpi label="Mal-Asignados" value={conflicts.length.toLocaleString()} color="text-yellow-400" />
        <Kpi label="Revenue Pool"  value={"ARS " + fmtM(conflicts.reduce((s,c) => s+c.revenue_ars, 0))} />
        <Kpi label="Ahorro Total"  value={fmtKm(conflicts.reduce((s,c) => s+c.improvement_km, 0))}
              color="text-blue-400" />
        <Kpi label="Mejora Media"  value={fmtPct(
          conflicts.length ? conflicts.reduce((s,c)=>s+c.improvement_pct,0)/conflicts.length : 0
        )} color="text-blue-400" />
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilterBranch(null)}
          className={`text-[10px] px-2 py-0.5 rounded border ${filterBranch === null ? "border-green-400 text-green-400" : "border-white/20 text-gray-400"}`}
        >Todos</button>
        {branches.map(b => (
          <button
            key={b.sucursal_id}
            onClick={() => setFilterBranch(prev => prev === b.sucursal_id ? null : b.sucursal_id)}
            className={`text-[10px] px-2 py-0.5 rounded border ${filterBranch === b.sucursal_id ? "border-orange-400 text-orange-400" : "border-white/20 text-gray-400"}`}
          >{b.nombre.split(" ")[0]}</button>
        ))}
      </div>

      <div className="flex gap-2">
        {(["improvement_km", "revenue_ars"] as const).map(s => (
          <button key={s} onClick={() => setSortBy(s)}
            className={`text-[10px] px-2 py-0.5 rounded border ${sortBy === s ? "border-blue-400 text-blue-400" : "border-white/20 text-gray-400"}`}
          >{s === "improvement_km" ? "Por Ahorro km" : "Por Revenue"}</button>
        ))}
      </div>

      {filterBranch && (
        <div className="grid grid-cols-2 gap-2">
          <Kpi label="Revenue Filtrado" value={"ARS " + fmtM(totalRev)} />
          <Kpi label="Ahorro Filtrado"  value={fmtKm(totalSave)} color="text-blue-400" />
        </div>
      )}

      {/* Conflict list */}
      <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-0.5">
        {filtered.map(c => (
          <div key={c.cliente_id}
            className="bg-white/5 rounded p-2 text-[10px] hover:bg-white/10 transition-colors">
            <div className="font-semibold text-gray-200 truncate">{c.razon_social}</div>
            <div className="text-gray-400 mt-0.5">
              {c.current_nombre} <span className="text-orange-400">→</span> {c.nearest_nombre}
            </div>
            <div className="flex gap-3 mt-1 text-gray-400">
              <span>Ahorro: <span className="text-blue-400 font-mono">{fmtKm(c.improvement_km)}</span></span>
              <span>({fmtPct(c.improvement_pct)})</span>
              <span className="ml-auto">ARS {fmtM(c.revenue_ars)}</span>
            </div>
          </div>
        ))}
        {filtered.length === 100 && (
          <div className="text-[10px] text-gray-500 text-center py-1">
            Mostrando top 100 — use filtros para reducir
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SIMULACIÓN sub-tab
// ═══════════════════════════════════════════════════════════════════════════════

interface SimulationProps {
  data:             TerritoryAnalysis;
  onSimClose?:      (id: number | null) => void;
  simClosedId?:     number | null;
}

function SimulacionTab({ data, onSimClose, simClosedId }: SimulationProps) {
  const [scenario, setScenario] = useState<"close" | "open">("close");
  const [newLat, setNewLat]   = useState("");
  const [newLng, setNewLng]   = useState("");

  const { branches, conflicts } = data;

  // Scenario A: close a branch
  const closeImpact = useMemo(() => {
    if (!simClosedId) return null;
    const affected  = conflicts.filter(c => c.current_id === simClosedId);
    const remaining = branches.filter(b => b.sucursal_id !== simClosedId);
    const branch    = branches.find(b => b.sucursal_id === simClosedId);
    if (!branch) return null;

    // For affected clients — find nearest among remaining branches
    let totalExtraKm  = 0;
    let reasignados   = 0;
    const destCounts: Record<number, number> = {};

    affected.forEach(c => {
      let bestBranch: TerritoryBranch | null = null;
      let bestD = Infinity;
      remaining.forEach(b => {
        const d = haversineKm(c.lat, c.lon, b.lat, b.lng);
        if (d < bestD) { bestD = d; bestBranch = b; }
      });
      if (bestBranch !== null) {
        const picked: TerritoryBranch = bestBranch;
        totalExtraKm += Math.max(0, bestD - c.current_dist_km);
        destCounts[picked.sucursal_id] = (destCounts[picked.sucursal_id] ?? 0) + 1;
        reasignados++;
      }
    });

    // Add all branch's own clients (non-conflict)
    const ownClients = branch.n_clientes;
    const totalRevLost = branch.revenue_total;

    return {
      branch_nombre: branch.nombre,
      n_clientes_afectados: ownClients,
      n_reasignados:  reasignados,
      revenue_perdido: totalRevLost,
      extra_km_total:  totalExtraKm,
      otif_impacto:   -branch.otif_avg * 0.1,  // heuristic
      destinos: Object.entries(destCounts).map(([id, n]) => ({
        nombre: branches.find(b => b.sucursal_id === +id)?.nombre ?? id,
        n,
      })).sort((a, b) => b.n - a.n),
    };
  }, [simClosedId, conflicts, branches]);

  // Scenario B: open new branch
  const openImpact = useMemo(() => {
    const lat = parseFloat(newLat);
    const lng = parseFloat(newLng);
    if (isNaN(lat) || isNaN(lng)) return null;

    // Clients that would find new branch closer than current
    let captured   = 0;
    let revCaptured = 0;
    let avgDistGain = 0;

    conflicts.forEach(c => {
      const distNew = haversineKm(c.lat, c.lon, lat, lng);
      if (distNew < c.current_dist_km * 0.8) {  // 20% improvement threshold
        captured++;
        revCaptured += c.revenue_ars;
        avgDistGain += c.current_dist_km - distNew;
      }
    });
    // Also check all branch clients
    branches.forEach(b => {
      const d = haversineKm(b.lat, b.lng, lat, lng);
      // clients proxied by this branch within 100km of new branch
      if (d < 100) {
        captured   += Math.round(b.n_clientes * 0.2);  // heuristic: 20% capture
        revCaptured += b.revenue_total * 0.2;
      }
    });

    const monthlyRev  = revCaptured / 12;
    const setupCost   = 50_000_000;  // ARS 50M setup heuristic
    const paybackMths = setupCost / Math.max(monthlyRev, 1);

    return {
      clientes_capturados: captured,
      revenue_estimado:    revCaptured,
      ahorro_distancia:    avgDistGain,
      payback_meses:       Math.round(paybackMths),
      roi_anual_pct:       Math.round((monthlyRev * 12 / setupCost - 1) * 100),
    };
  }, [newLat, newLng, conflicts, branches]);

  return (
    <div className="flex flex-col gap-3">
      {/* Scenario selector */}
      <div className="flex gap-2">
        {(["close", "open"] as const).map(s => (
          <button key={s} onClick={() => setScenario(s)}
            className={`flex-1 text-[11px] py-1.5 rounded border font-medium transition-colors ${
              scenario === s ? "border-green-400 text-green-400 bg-green-400/10"
                             : "border-white/20 text-gray-400 hover:border-white/40"
            }`}
          >{s === "close" ? "A: Cerrar Sucursal" : "B: Abrir Sucursal"}</button>
        ))}
      </div>

      {scenario === "close" && (
        <div className="flex flex-col gap-2">
          <div className="text-[10px] text-gray-400">Seleccionar sucursal a cerrar:</div>
          <div className="space-y-1.5">
            {branches.map(b => (
              <button key={b.sucursal_id}
                onClick={() => onSimClose?.(simClosedId === b.sucursal_id ? null : b.sucursal_id)}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded border text-[11px] transition-colors ${
                  simClosedId === b.sucursal_id
                    ? "border-red-500 text-red-400 bg-red-500/10"
                    : "border-white/20 text-gray-300 hover:border-white/40"
                }`}
              >
                <div className="w-2 h-2 rounded-full" style={{ background: b.load_color }} />
                <span>{b.nombre}</span>
                <span className="ml-auto text-gray-500">{b.n_clientes.toLocaleString()} cli</span>
              </button>
            ))}
          </div>

          {closeImpact && (
            <div className="flex flex-col gap-2 mt-1 border border-red-500/30 rounded p-2.5">
              <div className="text-[11px] font-semibold text-red-400">
                Impacto: cerrar {closeImpact.branch_nombre}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Kpi label="Clientes afectados" value={closeImpact.n_clientes_afectados.toLocaleString()} color="text-red-400" />
                <Kpi label="Revenue en riesgo"  value={"ARS " + fmtM(closeImpact.revenue_perdido)} color="text-red-400" />
                <Kpi label="Km extra/cliente"   value={fmtKm(closeImpact.n_reasignados ? closeImpact.extra_km_total / closeImpact.n_reasignados : 0)} color="text-orange-400" />
                <Kpi label="OTIF impacto est."  value={closeImpact.otif_impacto.toFixed(1) + "pp"} color="text-orange-400" />
              </div>
              {closeImpact.destinos.length > 0 && (
                <div>
                  <div className="text-[10px] text-gray-400 mb-1">Reasignación estimada:</div>
                  {closeImpact.destinos.map(d => (
                    <div key={d.nombre} className="flex justify-between text-[10px] text-gray-300">
                      <span>{d.nombre}</span>
                      <span className="text-purple-400">{d.n} clientes</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {scenario === "open" && (
        <div className="flex flex-col gap-2">
          <div className="text-[10px] text-gray-400">Coordenadas de nueva sucursal (WGS84):</div>
          <div className="flex gap-2">
            <input
              type="number" step="0.001" placeholder="Latitud"
              value={newLat} onChange={e => setNewLat(e.target.value)}
              className="flex-1 bg-white/5 border border-white/20 rounded px-2 py-1 text-[11px] text-gray-200 placeholder-gray-600 focus:outline-none focus:border-green-500"
            />
            <input
              type="number" step="0.001" placeholder="Longitud"
              value={newLng} onChange={e => setNewLng(e.target.value)}
              className="flex-1 bg-white/5 border border-white/20 rounded px-2 py-1 text-[11px] text-gray-200 placeholder-gray-600 focus:outline-none focus:border-green-500"
            />
          </div>
          <div className="text-[9px] text-gray-500">Ej: Lat -31.40, Lng -64.18 (Córdoba)</div>

          {openImpact && (
            <div className="flex flex-col gap-2 mt-1 border border-green-500/30 rounded p-2.5">
              <div className="text-[11px] font-semibold text-green-400">Proyección nueva sucursal</div>
              <div className="grid grid-cols-2 gap-2">
                <Kpi label="Clientes captados"  value={openImpact.clientes_capturados.toLocaleString()} />
                <Kpi label="Revenue estimado"   value={"ARS " + fmtM(openImpact.revenue_estimado)} />
                <Kpi label="ROI anual est."      value={openImpact.roi_anual_pct + "%"}
                      color={openImpact.roi_anual_pct > 0 ? "text-green-400" : "text-red-400"} />
                <Kpi label="Payback"             value={openImpact.payback_meses + " meses"}
                      color={openImpact.payback_meses < 18 ? "text-green-400" : "text-orange-400"} />
              </div>
              <div className="text-[9px] text-gray-500 mt-1">
                * Estimaciones basadas en clientes actuales con mejora &gt;20% en distancia.
                Setup cost asumido: ARS 50M.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPANSIÓN sub-tab
// ═══════════════════════════════════════════════════════════════════════════════

function ExpansionTab({ expansion }: { expansion: ExpansionCandidate[] }) {
  if (!expansion.length) {
    return (
      <div className="text-[11px] text-gray-500 text-center py-8">
        Sin datos de expansión disponibles.
        <br/>Verificar gis_outputs/expansion_recommendations.json
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="text-[10px] text-gray-400">
        Top {expansion.length} candidatos por expansion_score
      </div>

      {/* Score chart */}
      <div className="bg-white/5 rounded p-2.5">
        <ResponsiveContainer width="100%" height={120}>
          <BarChart
            data={expansion.slice(0, 8).map(e => ({
              name: e.ciudad ?? e.provincia,
              score: +(e.expansion_score * 100).toFixed(0),
              gap:   +(e.gap_score * 100).toFixed(0),
            }))}
            margin={{ left: -10, right: 4, bottom: 0 }}
          >
            <XAxis dataKey="name" tick={{ fill: "#9CA3AF", fontSize: 8 }} />
            <YAxis tick={{ fill: "#9CA3AF", fontSize: 9 }} />
            <Tooltip contentStyle={{ background: "#111", border: "1px solid #333", fontSize: 11 }} />
            <Bar dataKey="score" name="Expansión" fill="#22C55E" radius={[2, 2, 0, 0]} />
            <Bar dataKey="gap"   name="Gap"        fill="#3B82F6" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Candidate cards */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-0.5">
        {expansion.map((e, i) => (
          <div key={`${e.provincia}-${e.ciudad}-${i}`}
            className="bg-white/5 rounded p-2.5 text-[10px] hover:bg-white/10 transition-colors">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold text-gray-200">
                  <span className="text-green-500 mr-1">#{i + 1}</span>
                  {e.ciudad ?? e.provincia}
                </div>
                <div className="text-gray-400">{e.provincia} · {e.cluster}</div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-green-400 font-mono font-bold">
                  {(e.expansion_score * 100).toFixed(0)}
                </div>
                <div className="text-gray-500">score</div>
              </div>
            </div>
            <div className="flex gap-3 mt-1.5 text-gray-400">
              <span>Gap: <span className="text-blue-400">{(e.gap_score * 100).toFixed(0)}</span></span>
              <span>Opp: <span className="text-purple-400">{(e.opportunity_score * 100).toFixed(0)}</span></span>
              <span>Dist: <span className="text-gray-300">{e.dist_km.toFixed(0)} km</span></span>
              {e.roi_est_m_ars > 0 && (
                <span className="ml-auto">ROI: <span className="text-yellow-400">ARS {e.roi_est_m_ars.toFixed(1)}M</span></span>
              )}
            </div>
            {e.justificacion && (
              <div className="text-gray-500 mt-1 leading-relaxed line-clamp-2">
                {e.justificacion}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PANEL
// ═══════════════════════════════════════════════════════════════════════════════

interface TerritoryPanelProps {
  // layer visibility controls
  showConflicts:     boolean;
  showBranchRings:   boolean;
  showConflictLines: boolean;
  onToggleConflicts:      () => void;
  onToggleBranchRings:    () => void;
  onToggleConflictLines:  () => void;
  // simulation
  simClosedId:  number | null;
  onSimClose:   (id: number | null) => void;
}

function TerritoryPanel({
  showConflicts, showBranchRings, showConflictLines,
  onToggleConflicts, onToggleBranchRings, onToggleConflictLines,
  simClosedId, onSimClose,
}: TerritoryPanelProps) {
  const [subTab, setSubTab]       = useState<SubTab>("territorios");
  const [analysis, setAnalysis]   = useState<TerritoryAnalysis | null>(null);
  const [expansion, setExpansion] = useState<ExpansionCandidate[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);

    Promise.all([
      fetch("/data/gis_outputs/territory_analysis.json").then(r => r.json()),
      fetch("/data/gis_outputs/expansion_recommendations.json").then(r => r.json()).catch(() => []),
    ])
      .then(([ta, exp]) => {
        if (!alive) return;
        setAnalysis(ta as TerritoryAnalysis);
        // Map expansion fields to ExpansionCandidate
        const mapped = (exp as Record<string, unknown>[]).map((e) => ({
          provincia:         e.provincia as string,
          ciudad:            (e.ciudad_candidata ?? e.ciudad) as string,
          lat:               e.lat as number,
          lon:               e.lon as number,
          expansion_score:   (e.expansion_score as number) ?? 0,
          gap_score:         (e.gap_score as number) ?? 0,
          opportunity_score: (e.opportunity_score as number) ?? 0,
          dist_km:           (e.dist_sucursal_mas_cercana_km as number) ?? 0,
          agr_ha_m:          (e.agr_ha_m as number) ?? 0,
          cluster:           e.cluster as string,
          justificacion:     (e.justificacion as string) ?? "",
          n_activos:         (e.n_activos as number) ?? 0,
          penetracion_idx:   (e.penetracion_idx as number) ?? 0,
          roi_est_m_ars:     ((e.expansion_score as number ?? 0) * (e.gap_score as number ?? 0) * 10),
        })) as ExpansionCandidate[];
        mapped.sort((a, b) => b.expansion_score - a.expansion_score);
        setExpansion(mapped.slice(0, 20));
        setLoading(false);
      })
      .catch(err => {
        if (!alive) return;
        setError(String(err));
        setLoading(false);
      });

    return () => { alive = false; };
  }, []);

  const SUB_TABS: { id: SubTab; label: string }[] = [
    { id: "territorios", label: "Territ." },
    { id: "conflictos",  label: "Conflic." },
    { id: "simulacion",  label: "Simul." },
    { id: "expansion",   label: "Expans." },
  ];

  return (
    <div className="flex flex-col gap-3 text-sm h-full">
      {/* Layer toggles */}
      <div className="flex flex-wrap gap-1.5">
        {[
          { label: "Conflictos",   on: showConflicts,     fn: onToggleConflicts },
          { label: "Rings",        on: showBranchRings,   fn: onToggleBranchRings },
          { label: "Líneas",       on: showConflictLines, fn: onToggleConflictLines },
        ].map(t => (
          <button key={t.label} onClick={t.fn}
            className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
              t.on ? "border-green-400 text-green-400 bg-green-400/10"
                   : "border-white/20 text-gray-500 hover:border-white/40"
            }`}
          >{t.label}</button>
        ))}
        {simClosedId && (
          <button onClick={() => onSimClose(null)}
            className="text-[10px] px-2 py-0.5 rounded border border-red-400 text-red-400 bg-red-400/10">
            Reset Sim
          </button>
        )}
      </div>

      {/* Sub-tab nav */}
      <div className="flex gap-1">
        {SUB_TABS.map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)}
            className={`flex-1 text-[10px] py-1 rounded border transition-colors ${
              subTab === t.id
                ? "border-green-500 text-green-400 bg-green-500/10"
                : "border-white/15 text-gray-500 hover:text-gray-300"
            }`}
          >{t.label}</button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="text-[11px] text-gray-500 text-center py-8">
            Cargando territory_analysis.json…
          </div>
        )}
        {error && (
          <div className="text-[11px] text-red-400 text-center py-4">
            Error: {error}
          </div>
        )}
        {!loading && !error && analysis && (
          <>
            {subTab === "territorios" && <TerritoriosTab data={analysis} />}
            {subTab === "conflictos"  && <ConflictosTab conflicts={analysis.conflicts} branches={analysis.branches} />}
            {subTab === "simulacion"  && (
              <SimulacionTab data={analysis} onSimClose={onSimClose} simClosedId={simClosedId} />
            )}
            {subTab === "expansion"   && <ExpansionTab expansion={expansion} />}
          </>
        )}
      </div>
    </div>
  );
}

export default memo(TerritoryPanel);
export type { TerritoryPanelProps };

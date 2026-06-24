"use client";

import { useState, useMemo, useEffect, memo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  RadialBarChart, RadialBar, PieChart, Pie, Cell,
} from "recharts";
import type { NetworkAnalysis, NetworkDepot, NetworkFlow, DepotStatus } from "@/types";

// ── helpers ────────────────────────────────────────────────────────────────────

const DEPOT_COLOR: Record<DepotStatus, string> = {
  NORMAL:    "#22C55E",
  ALTO_USO:  "#F97316",
  "CRÍTICO": "#E03E3E",
};
const DEPOT_LABEL: Record<DepotStatus, string> = {
  NORMAL:    "Normal",
  ALTO_USO:  "Alto Uso",
  "CRÍTICO": "Crítico",
};

function fmtM(n: number)   { return (n / 1e6).toFixed(1) + "M"; }
function fmtPct(n: number) { return n.toFixed(1) + "%"; }
function fmtTon(n: number) { return n.toFixed(0) + " t"; }
function fmtK(n: number)   { return n >= 1000 ? (n / 1000).toFixed(1) + "K" : n.toFixed(0); }

function Kpi({ label, value, sub, color }: {
  label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 bg-white/5 rounded p-2.5">
      <span className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</span>
      <span className={`text-sm font-bold font-mono ${color ?? "text-green-400"}`}>{value}</span>
      {sub && <span className="text-[10px] text-gray-500">{sub}</span>}
    </div>
  );
}

type SubTab = "flow" | "capacity" | "bottlenecks" | "simulation";

// ═══════════════════════════════════════════════════════════════════════════════
// FLOW sub-tab
// ═══════════════════════════════════════════════════════════════════════════════

function FlowTab({ data }: { data: NetworkAnalysis }) {
  const st = data.status;

  const flowByDepot = useMemo(() => {
    const map: Record<number, { nombre: string; n: number; costo: number; otif: number }> = {};
    for (const f of data.flows) {
      if (!map[f.deposito_id]) {
        map[f.deposito_id] = { nombre: f.deposito_nombre, n: 0, costo: 0, otif: 0 };
      }
      map[f.deposito_id].n    += f.n_envios;
      map[f.deposito_id].costo += f.costo_flete;
    }
    // Weighted OTIF
    for (const f of data.flows) {
      const d = map[f.deposito_id];
      if (d) d.otif += (f.otif_pct * f.n_envios) / Math.max(d.n, 1);
    }
    return Object.values(map);
  }, [data.flows]);

  const topFlows = useMemo(
    () => [...data.flows].sort((a, b) => b.n_envios - a.n_envios).slice(0, 10),
    [data.flows]
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <Kpi label="Total Envíos"   value={fmtK(st.total_envios)} />
        <Kpi label="OTIF Global"    value={fmtPct(st.otif_global)}
              color={st.otif_global >= 90 ? "text-green-400" : st.otif_global >= 75 ? "text-orange-400" : "text-red-400"} />
        <Kpi label="Costo Flete"    value={"ARS " + fmtM(st.costo_flete_total)} />
        <Kpi label="Demora Prom."   value={st.dias_demora_prom.toFixed(1) + " d"}
              color={st.dias_demora_prom < 1 ? "text-green-400" : "text-orange-400"} />
      </div>

      {/* Envíos per depot */}
      <div className="bg-white/5 rounded p-2.5">
        <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-2">
          Envíos por Depósito
        </div>
        <ResponsiveContainer width="100%" height={100}>
          <BarChart data={flowByDepot.map(d => ({
            name: d.nombre.split(" ").slice(-1)[0],
            envios: d.n,
            otif: d.otif,
          }))} margin={{ left: -10, right: 4 }}>
            <XAxis dataKey="name" tick={{ fill: "#9CA3AF", fontSize: 9 }} />
            <YAxis tick={{ fill: "#9CA3AF", fontSize: 9 }} />
            <Tooltip contentStyle={{ background: "#111", border: "1px solid #333", fontSize: 11 }}
              formatter={(v: number) => [fmtK(v), "Envíos"]} />
            <Bar dataKey="envios" fill="#3B82F6" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Top flows */}
      <div className="bg-white/5 rounded p-2.5">
        <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-2">Top Rutas</div>
        <div className="space-y-1 max-h-[200px] overflow-y-auto">
          {topFlows.map((f, i) => (
            <div key={`${f.deposito_id}-${f.region_id}`}
              className="flex items-center gap-2 text-[10px] hover:bg-white/5 rounded px-1">
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: f.flow_color }} />
              <span className="text-gray-400 truncate flex-1">
                {f.deposito_nombre.split(" ").pop()} → {f.region_nombre}
              </span>
              <span className="text-gray-300 font-mono">{fmtK(f.n_envios)}</span>
              <span className={`w-10 text-right ${f.otif_pct >= 90 ? "text-green-400" : "text-orange-400"}`}>
                {f.otif_pct.toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CAPACITY sub-tab
// ═══════════════════════════════════════════════════════════════════════════════

function CapacityTab({ depots }: { depots: NetworkDepot[] }) {
  const sorted = useMemo(
    () => [...depots].sort((a, b) => b.utilizacion_pct - a.utilizacion_pct),
    [depots]
  );
  const totalCap  = useMemo(() => depots.reduce((s, d) => s + d.capacidad_ton, 0), [depots]);
  const totalFree = useMemo(() => depots.reduce((s, d) => s + d.capacidad_libre_ton, 0), [depots]);

  const pieData = useMemo(() => [
    { name: "Ocupado", value: Math.round(totalCap - totalFree), fill: "#F97316" },
    { name: "Libre",   value: Math.round(totalFree),            fill: "#22C55E" },
  ], [totalCap, totalFree]);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <Kpi label="Capacidad Total" value={fmtTon(totalCap)} />
        <Kpi label="Capacidad Libre" value={fmtTon(totalFree)}
              color={totalFree / totalCap < 0.15 ? "text-red-400" : "text-green-400"} />
      </div>

      {/* Capacity donut */}
      <div className="bg-white/5 rounded p-2.5 flex items-center gap-3">
        <PieChart width={80} height={80}>
          <Pie data={pieData} innerRadius={24} outerRadius={38} dataKey="value" paddingAngle={2}>
            {pieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
          </Pie>
        </PieChart>
        <div className="flex flex-col gap-1.5 text-[10px]">
          {pieData.map(d => (
            <div key={d.name} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: d.fill }} />
              <span className="text-gray-400">{d.name}: </span>
              <span className="font-mono text-gray-200">{fmtTon(d.value)}</span>
            </div>
          ))}
          <div className="text-gray-500 mt-0.5">
            Util: {((1 - totalFree / Math.max(totalCap, 1)) * 100).toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Per-depot utilization bars */}
      <div className="space-y-2">
        {sorted.map(d => (
          <div key={d.deposito_id} className="bg-white/5 rounded p-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: d.load_color }} />
                <span className="text-[11px] text-gray-200">{d.nombre}</span>
              </div>
              <span className="text-[10px] font-mono" style={{ color: d.load_color }}>
                {d.load_status}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${Math.min(d.utilizacion_pct, 100)}%`, background: d.load_color }}
                />
              </div>
              <span className="text-[10px] font-mono text-gray-300 w-10 text-right">
                {d.utilizacion_pct.toFixed(0)}%
              </span>
            </div>
            <div className="flex gap-3 mt-1 text-[10px] text-gray-500">
              <span>Cap: {fmtTon(d.capacidad_ton)}</span>
              <span>Libre: {fmtTon(d.capacidad_libre_ton)}</span>
              <span className="ml-auto">OTIF: {d.otif_pct.toFixed(0)}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// BOTTLENECKS sub-tab
// ═══════════════════════════════════════════════════════════════════════════════

function BottlenecksTab({ depots }: { depots: NetworkDepot[] }) {
  const bottlenecks = useMemo(
    () => depots.filter(d => d.load_status !== "NORMAL")
              .sort((a, b) => {
                const order: Record<DepotStatus, number> = { "CRÍTICO": 0, "ALTO_USO": 1, "NORMAL": 2 };
                return order[a.load_status] - order[b.load_status];
              }),
    [depots]
  );

  if (!bottlenecks.length) {
    return (
      <div className="text-center text-gray-500 text-[11px] py-8">
        Sin cuellos de botella detectados.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="text-[10px] text-gray-400">
        {bottlenecks.length} depósito{bottlenecks.length !== 1 ? "s" : ""} con carga elevada
      </div>

      {bottlenecks.map(d => (
        <div key={d.deposito_id}
          className="rounded p-2.5 border"
          style={{ borderColor: d.load_color + "50", background: d.load_color + "0D" }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-semibold text-gray-200">{d.nombre}</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
              style={{ background: d.load_color + "30", color: d.load_color }}>
              {DEPOT_LABEL[d.load_status]}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1.5 text-[10px]">
            <div className="bg-white/5 rounded p-1.5">
              <div className="text-gray-500">Utilización</div>
              <div className="font-mono" style={{ color: d.load_color }}>
                {d.utilizacion_pct.toFixed(0)}%
              </div>
            </div>
            <div className="bg-white/5 rounded p-1.5">
              <div className="text-gray-500">OTIF</div>
              <div className={`font-mono ${d.otif_pct >= 88 ? "text-green-400" : "text-red-400"}`}>
                {d.otif_pct.toFixed(1)}%
              </div>
            </div>
            <div className="bg-white/5 rounded p-1.5">
              <div className="text-gray-500">Demora prom.</div>
              <div className="font-mono text-orange-400">{d.dias_demora_prom.toFixed(1)} d</div>
            </div>
            <div className="bg-white/5 rounded p-1.5">
              <div className="text-gray-500">Envíos</div>
              <div className="font-mono text-blue-400">{fmtK(d.n_envios)}</div>
            </div>
          </div>

          <div className="mt-2 flex gap-3 text-[10px] text-gray-500">
            <span>Demorado: <span className="text-orange-400">{d.pct_demorado.toFixed(1)}%</span></span>
            <span>Devuelto: <span className="text-red-400">{d.pct_devuelto.toFixed(1)}%</span></span>
            <span>Libre: <span className="text-gray-300">{fmtTon(d.capacidad_libre_ton)}</span></span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SIMULATION sub-tab (FASE 6)
// ═══════════════════════════════════════════════════════════════════════════════

interface SimProps {
  data:         NetworkAnalysis;
  simClosedId:  number | null;
  onSimClose:   (id: number | null) => void;
}

function SimulationTab({ data, simClosedId, onSimClose }: SimProps) {
  const { depots, flows } = data;
  const totalEnvios = data.status.total_envios;

  const impact = useMemo(() => {
    if (!simClosedId) return null;
    const closed = depots.find(d => d.deposito_id === simClosedId);
    if (!closed) return null;

    const affectedFlows = flows.filter(f => f.deposito_id === simClosedId);
    const remaining = depots.filter(d => d.deposito_id !== simClosedId);

    const totalEnviosAffected = closed.n_envios;
    const pct = (totalEnviosAffected / Math.max(totalEnvios, 1)) * 100;

    // Redistribute proportionally by capacity
    const capTotal = remaining.reduce((s, d) => s + d.capacidad_ton, 0);
    const redistrib = remaining.map(d => {
      const extra   = Math.round(totalEnviosAffected * d.capacidad_ton / Math.max(capTotal, 1));
      const newUtil = Math.min(100, d.utilizacion_pct + extra * 100 / Math.max(d.capacidad_ton * 100, 1));
      return {
        nombre:     d.nombre,
        extra_envios: extra,
        nueva_util: newUtil,
        color:      newUtil > 85 ? "#E03E3E" : newUtil > 65 ? "#F97316" : "#22C55E",
      };
    });

    const otifDelta = -(closed.pct_demorado * 0.15 + 3);  // heuristic disruption
    const overload  = Math.max(0, totalEnviosAffected - remaining.reduce(
      (s, d) => s + Math.max(0, d.capacidad_libre_ton * 100), 0
    ));

    return {
      deposito_nombre:    closed.nombre,
      n_envios_afectados: totalEnviosAffected,
      pct_red_afectado:   pct,
      n_rutas_afectadas:  affectedFlows.length,
      costo_perdido:      closed.costo_flete_total,
      otif_delta:         otifDelta,
      overflow_estimado:  overload,
      redistrib,
    };
  }, [simClosedId, depots, flows, totalEnvios]);

  return (
    <div className="flex flex-col gap-3">
      <div className="text-[10px] text-gray-400">
        Seleccionar depósito a cerrar para simular impacto:
      </div>

      <div className="space-y-1.5">
        {depots.map(d => (
          <button key={d.deposito_id}
            onClick={() => onSimClose(simClosedId === d.deposito_id ? null : d.deposito_id)}
            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded border text-[11px] transition-colors ${
              simClosedId === d.deposito_id
                ? "border-red-500 text-red-400 bg-red-500/10"
                : "border-white/20 text-gray-300 hover:border-white/40"
            }`}
          >
            <div className="w-2 h-2 rounded-full" style={{ background: d.load_color }} />
            <span className="flex-1 text-left">{d.nombre}</span>
            <span className="text-gray-500">{fmtK(d.n_envios)} env.</span>
          </button>
        ))}
      </div>

      {impact && (
        <div className="flex flex-col gap-2 border border-red-500/30 rounded p-2.5">
          <div className="text-[11px] font-semibold text-red-400">
            Impacto: cerrar {impact.deposito_nombre}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Kpi label="Envíos afectados"  value={fmtK(impact.n_envios_afectados)}
                  sub={fmtPct(impact.pct_red_afectado) + " de la red"} color="text-red-400" />
            <Kpi label="Costo en riesgo"   value={"ARS " + fmtM(impact.costo_perdido)} color="text-red-400" />
            <Kpi label="Rutas afectadas"   value={String(impact.n_rutas_afectadas)} color="text-orange-400" />
            <Kpi label="OTIF delta est."   value={impact.otif_delta.toFixed(1) + " pp"} color="text-orange-400" />
          </div>

          {impact.redistrib.length > 0 && (
            <div>
              <div className="text-[10px] text-gray-400 mb-1">Reasignación estimada:</div>
              {impact.redistrib.map(r => (
                <div key={r.nombre}
                  className="flex justify-between items-center text-[10px] py-0.5 border-b border-white/5">
                  <span className="text-gray-300">{r.nombre}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-blue-400">+{fmtK(r.extra_envios)}</span>
                    <span className="font-mono" style={{ color: r.color }}>
                      {r.nueva_util.toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {impact.overflow_estimado > 0 && (
            <div className="text-[10px] text-red-400 mt-1">
              Overflow estimado: {fmtK(impact.overflow_estimado)} envíos sin capacidad
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PANEL (FASE 5+7+8)
// ═══════════════════════════════════════════════════════════════════════════════

interface NetworkPanelProps {
  showFlows:       boolean;
  showBottlenecks: boolean;
  onToggleFlows:        () => void;
  onToggleBottlenecks:  () => void;
  simClosedId:  number | null;
  onSimClose:   (id: number | null) => void;
}

function NetworkPanel({
  showFlows, showBottlenecks,
  onToggleFlows, onToggleBottlenecks,
  simClosedId, onSimClose,
}: NetworkPanelProps) {
  const [subTab, setSubTab]     = useState<SubTab>("flow");
  const [data,   setData]       = useState<NetworkAnalysis | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error,   setError]     = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch("/data/gis_outputs/network_analysis.json")
      .then(r => r.json())
      .then((d: NetworkAnalysis) => { if (alive) { setData(d); setLoading(false); } })
      .catch(e => { if (alive) { setError(String(e)); setLoading(false); } });
    return () => { alive = false; };
  }, []);

  const SUB_TABS: { id: SubTab; label: string }[] = [
    { id: "flow",        label: "Flujo" },
    { id: "capacity",    label: "Cap." },
    { id: "bottlenecks", label: "Cuello" },
    { id: "simulation",  label: "Sim." },
  ];

  return (
    <div className="flex flex-col gap-3 text-sm h-full">
      {/* Layer toggles */}
      <div className="flex gap-1.5 flex-wrap">
        {[
          { label: "Flujos",      on: showFlows,       fn: onToggleFlows },
          { label: "Bottlenecks", on: showBottlenecks, fn: onToggleBottlenecks },
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

      {/* Executive KPIs strip (FASE 7) */}
      {data && !loading && (
        <div className="grid grid-cols-3 gap-1.5">
          <Kpi label="OTIF" value={fmtPct(data.status.otif_global)}
                color={data.status.otif_global >= 90 ? "text-green-400" : "text-orange-400"} />
          <Kpi label="Util. Prom." value={fmtPct(data.status.utilizacion_promedio)}
                color={data.status.utilizacion_promedio > 80 ? "text-red-400" : "text-orange-400"} />
          <Kpi label="Críticos" value={String(data.status.n_depositos_criticos)}
                color={data.status.n_depositos_criticos > 0 ? "text-red-400" : "text-green-400"} />
        </div>
      )}

      {/* Sub-tab nav */}
      <div className="flex gap-1">
        {SUB_TABS.map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)}
            className={`flex-1 text-[10px] py-1 rounded border transition-colors ${
              subTab === t.id
                ? "border-blue-500 text-blue-400 bg-blue-500/10"
                : "border-white/15 text-gray-500 hover:text-gray-300"
            }`}
          >{t.label}</button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="text-[11px] text-gray-500 text-center py-8">
            Cargando network_analysis.json…
          </div>
        )}
        {error && (
          <div className="text-[11px] text-red-400 text-center py-4">Error: {error}</div>
        )}
        {!loading && !error && data && (
          <>
            {subTab === "flow"        && <FlowTab data={data} />}
            {subTab === "capacity"    && <CapacityTab depots={data.depots} />}
            {subTab === "bottlenecks" && <BottlenecksTab depots={data.depots} />}
            {subTab === "simulation"  && (
              <SimulationTab data={data} simClosedId={simClosedId} onSimClose={onSimClose} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default memo(NetworkPanel);
export type { NetworkPanelProps };

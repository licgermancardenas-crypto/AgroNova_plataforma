"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useCallback } from "react";
import {
  Layers, MapPin, Activity, Crosshair, Radio, TrendingUp,
  AlertTriangle, ChevronRight, RefreshCw, BarChart2, Zap,
  GitBranch, Shield, MapPinPlus,
} from "lucide-react";
import { sucursales, depositos, clienteMarkers, gisRoutes } from "@/lib/mock-data";
import { fmtARS, fmtNumber } from "@/lib/formatters";
import type { ProvinceKPI, GisMetric } from "@/types";
import {
  PROVINCE_KPIS, NATIONAL_TOTALS, getLowCoverageProvinces, getMetricValue,
} from "@/lib/geo-data";
import SpatialAnalyticsPanel   from "@/components/gis/SpatialAnalyticsPanel";
import NetworkIntelligencePanel from "@/components/gis/NetworkIntelligencePanel";
import RoutingPanel             from "@/components/gis/RoutingPanel";

const LeafletMap = dynamic(() => import("@/components/map/LeafletMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-text-muted tactical-text">
      <div className="w-6 h-6 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
      <span>Cargando mapa…</span>
    </div>
  ),
});

// ── Metric selector ───────────────────────────────────────────────────────────
const METRICS: { id: GisMetric; label: string; color: string }[] = [
  { id: "revenue",  label: "Revenue",  color: "#22C55E" },
  { id: "clientes", label: "Clientes", color: "#4ADE80" },
  { id: "margen",   label: "Margen",   color: "#A3E635" },
  { id: "churn",    label: "Churn",    color: "#E03E3E" },
  { id: "otif",     label: "OTIF",     color: "#0EA5E9" },
];

// ── Layer definitions ─────────────────────────────────────────────────────────
const LAYER_DEFS = [
  { key: "choropleth",   label: "Coroplético",      color: "#22C55E", icon: "▪" },
  { key: "voronoi",      label: "Territorios",      color: "#4ADE80", icon: "⬡" },
  { key: "hotspots",     label: "Hotspots",          color: "#22C55E", icon: "🔥" },
  { key: "heatmap",      label: "Densidad",          color: "#0DB87E", icon: "◉" },
  { key: "buffers",      label: "Cobertura",         color: "#A3E635", icon: "◎" },
  { key: "candidatos",   label: "Candidatos",        color: "#E8A020", icon: "📍" },
  { key: "routing_risk", label: "Rutas c/ Riesgo",  color: "#E03E3E", icon: "🚛" },
  { key: "sucursales",   label: "Sucursales",        color: "#22C55E", icon: "◉" },
  { key: "depositos",    label: "Depósitos",         color: "#E8A020", icon: "◉" },
  { key: "clientes",     label: "Clientes",          color: "#0DB87E", icon: "◉" },
  { key: "radios",       label: "Radios Cobertura",  color: "#A3E635", icon: "○" },
];

// ── Stat chip ────────────────────────────────────────────────────────────────
function TacStat({ label, value, unit = "", accent = false }: {
  label: string; value: string | number; unit?: string; accent?: boolean;
}) {
  return (
    <div className="flex flex-col items-center px-3 py-1 border-r border-border last:border-0">
      <span className="tactical-text mb-0.5">{label}</span>
      <span className={`font-mono text-sm font-semibold ${accent ? "text-primary" : "text-text-primary"}`}>
        {value}<span className="text-text-muted text-xs ml-0.5">{unit}</span>
      </span>
    </div>
  );
}

// ── Left panel ────────────────────────────────────────────────────────────────
function LeftPanel({
  metric, setMetric,
  layers, toggleLayer,
  selected,
}: {
  metric: GisMetric; setMetric: (m: GisMetric) => void;
  layers: Record<string, boolean>; toggleLayer: (k: string) => void;
  selected: ProvinceKPI | null;
}) {
  const top5 = [...PROVINCE_KPIS]
    .sort((a, b) => getMetricValue(b, metric) - getMetricValue(a, metric))
    .slice(0, 5);
  const topVal = getMetricValue(top5[0], metric);

  const fmtMetric = (kpi: ProvinceKPI) => {
    const v = getMetricValue(kpi, metric);
    if (metric === "revenue")  return fmtARS(v, true);
    if (metric === "clientes") return fmtNumber(v);
    if (metric === "margen")   return `${v.toFixed(1)}%`;
    if (metric === "otif")     return `${v.toFixed(1)}%`;
    return `${(v * 100).toFixed(0)}%`;
  };

  // Split layers into two groups for compactness
  const primaryLayers  = LAYER_DEFS.slice(0, 7);
  const markerLayers   = LAYER_DEFS.slice(7);

  return (
    <div className="flex flex-col gap-2.5 h-full overflow-y-auto pr-0.5">

      {/* Metric selector */}
      <div className="glass rounded-xl p-3">
        <p className="tactical-text mb-2.5 flex items-center gap-1.5">
          <BarChart2 size={10} /><span>Métrica</span>
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {METRICS.map(m => (
            <button
              key={m.id}
              onClick={() => setMetric(m.id)}
              className={`px-2 py-1.5 rounded text-2xs font-mono transition-all border ${
                metric === m.id
                  ? "text-text-primary border-opacity-60"
                  : "bg-bg-elevated border-border text-text-muted hover:border-border-accent"
              }`}
              style={metric === m.id ? { background: `${m.color}22`, borderColor: m.color, color: m.color } : {}}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Map layers */}
      <div className="glass rounded-xl p-3">
        <p className="tactical-text mb-2 flex items-center gap-1.5">
          <Layers size={10} /><span>Capas del Mapa</span>
        </p>
        <div className="space-y-1">
          {primaryLayers.map(l => (
            <button
              key={l.key}
              onClick={() => toggleLayer(l.key)}
              className={`w-full flex items-center justify-between px-2 py-1 rounded text-xs transition-all border ${
                layers[l.key]
                  ? "bg-primary-dim border-primary/30 text-text-primary"
                  : "bg-bg-elevated border-border text-text-muted hover:border-border-accent"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: layers[l.key] ? l.color : "#3E5A3E" }} />
                <span className="truncate max-w-[110px]">{l.label}</span>
              </div>
              <span className={`text-2xs font-mono ${layers[l.key] ? "text-primary" : "text-text-muted"}`}>
                {layers[l.key] ? "ON" : "—"}
              </span>
            </button>
          ))}
        </div>
        <div className="mt-1.5 pt-1.5 border-t border-border space-y-1">
          <p className="tactical-text text-2xs mb-1">Marcadores</p>
          {markerLayers.map(l => (
            <button
              key={l.key}
              onClick={() => toggleLayer(l.key)}
              className={`w-full flex items-center justify-between px-2 py-1 rounded text-xs transition-all border ${
                layers[l.key]
                  ? "bg-primary-dim border-primary/30 text-text-primary"
                  : "bg-bg-elevated border-border text-text-muted hover:border-border-accent"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: layers[l.key] ? l.color : "#3E5A3E" }} />
                <span>{l.label}</span>
              </div>
              <span className={`text-2xs font-mono ${layers[l.key] ? "text-primary" : "text-text-muted"}`}>
                {layers[l.key] ? "ON" : "—"}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Top 5 by metric */}
      <div className="glass rounded-xl p-3">
        <p className="tactical-text mb-2.5 flex items-center gap-1.5">
          <TrendingUp size={10} /><span>Top 5 Provincias</span>
        </p>
        <div className="space-y-2">
          {top5.map((p, i) => {
            const val = getMetricValue(p, metric);
            const pct = topVal > 0 ? (val / topVal) * 100 : 0;
            return (
              <div key={p.nombre}>
                <div className="flex justify-between text-2xs mb-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-text-muted w-3">{i + 1}</span>
                    <span className="text-text-secondary truncate max-w-[75px]">{p.nombre}</span>
                  </div>
                  <span className="font-mono text-primary">{fmtMetric(p)}</span>
                </div>
                <div className="h-1 bg-bg-elevated rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-primary/70" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected province detail */}
      {selected && (
        <div className="glass rounded-xl p-3 border border-primary/30">
          <p className="tactical-text mb-2 flex items-center gap-1.5">
            <Activity size={10} /><span>Provincia Seleccionada</span>
          </p>
          <p className="text-xs text-text-primary font-semibold mb-1 truncate">{selected.nombre}</p>
          <span className="tactical-text text-2xs mb-2 block">{selected.macro_region}</span>
          <div className="space-y-1.5 text-2xs">
            {[
              ["Revenue",  fmtARS(selected.revenue_ars, true), "text-primary"],
              ["Part. %",  `${selected.revenue_pct.toFixed(1)}%`, "text-cyan-brand"],
              ["Activos",  fmtNumber(selected.n_activos), "text-text-primary"],
              ["Margen",   `${selected.margen_pct.toFixed(1)}%`, "text-text-primary"],
              ["OTIF",     `${selected.otif_pct.toFixed(1)}%`, selected.otif_pct >= 90 ? "text-success-DEFAULT" : "text-warning-DEFAULT"],
              ["Churn",    `${(selected.churn_score * 100).toFixed(0)}%`, selected.churn_score > 0.35 ? "text-danger-DEFAULT" : "text-warning-DEFAULT"],
            ].map(([label, val, color]) => (
              <div key={label} className="flex justify-between">
                <span className="text-text-muted">{label}</span>
                <span className={`font-mono ${color}`}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sucursales list */}
      <div className="glass rounded-xl p-3">
        <p className="tactical-text mb-2 flex items-center gap-1.5">
          <Crosshair size={10} /><span>Sucursales</span>
        </p>
        <div className="space-y-1.5">
          {sucursales.map(s => (
            <div key={s.id} className="flex items-center justify-between text-2xs">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span className="text-text-secondary truncate max-w-[80px]">{s.nombre}</span>
              </div>
              <span className="font-mono text-primary">{s.clientes} cli.</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Right panel ───────────────────────────────────────────────────────────────
function RightPanel({ selected }: { selected: ProvinceKPI | null }) {
  const lowCoverage = getLowCoverageProvinces();
  const activeRoutes = gisRoutes.filter(r => r.activo).length;

  // Dynamic alerts derived from KPI data
  const highChurnProvs = PROVINCE_KPIS.filter(p => p.churn_score > 0.38).slice(0, 2);
  const lowOtifProvs   = PROVINCE_KPIS.filter(p => p.otif_pct < 87).slice(0, 2);
  const alerts = [
    ...highChurnProvs.map(p => ({ msg: `Churn ${(p.churn_score * 100).toFixed(0)}% en ${p.nombre}`, c: "#E03E3E" })),
    ...lowOtifProvs.map(p =>   ({ msg: `OTIF ${p.otif_pct.toFixed(1)}% bajo target en ${p.macro_region}`, c: "#E8A020" })),
    { msg: "Depósito Salta Norte 91% cap.", c: "#E8A020" },
    { msg: "5 sucursales candidatas sin cobertura", c: "#0EA5E9" },
  ].slice(0, 5);

  return (
    <div className="flex flex-col gap-2.5 h-full overflow-y-auto pr-0.5">
      {/* National KPIs */}
      <div className="glass rounded-xl p-3">
        <p className="tactical-text mb-2.5 flex items-center gap-1.5">
          <Activity size={10} /><span>Nacional</span>
        </p>
        <div className="space-y-2 text-2xs">
          <div className="flex justify-between">
            <span className="text-text-muted">Revenue Total</span>
            <span className="font-mono text-primary">{fmtARS(NATIONAL_TOTALS.revenue_ars, true)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Clientes Activos</span>
            <span className="font-mono text-text-primary">{fmtNumber(NATIONAL_TOTALS.n_activos)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Total Clientes</span>
            <span className="font-mono text-text-muted">{fmtNumber(NATIONAL_TOTALS.n_clientes)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Provincias</span>
            <span className="font-mono text-text-primary">{NATIONAL_TOTALS.provincias}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Rutas Activas</span>
            <span className="font-mono text-text-primary">{activeRoutes}/{gisRoutes.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">OTIF Nacional</span>
            <span className="font-mono text-success-DEFAULT">91.4%</span>
          </div>
        </div>
      </div>

      {/* Depósitos */}
      <div className="glass rounded-xl p-3">
        <p className="tactical-text mb-2.5 flex items-center gap-1.5">
          <Radio size={10} /><span>Depósitos</span>
        </p>
        <div className="space-y-2">
          {depositos.map(d => {
            const c = d.ocupacion_pct > 85 ? "#E03E3E" : d.ocupacion_pct > 70 ? "#E8A020" : "#22C55E";
            return (
              <div key={d.id}>
                <div className="flex justify-between text-2xs mb-0.5">
                  <span className="text-text-secondary truncate max-w-[82px]">{d.nombre.replace("Depósito ", "")}</span>
                  <span className="font-mono font-bold" style={{ color: c }}>{d.ocupacion_pct}%</span>
                </div>
                <div className="h-1 bg-bg-elevated rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${d.ocupacion_pct}%`, background: c }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Expansion candidates */}
      <div className="glass rounded-xl p-3">
        <p className="tactical-text mb-2 flex items-center gap-1.5">
          <MapPinPlus size={10} /><span>Candidatos Expansión</span>
        </p>
        <div className="space-y-1.5 text-2xs">
          {[
            { ciudad: "Resistencia (Chaco)",    score: 64.0, dist: 595 },
            { ciudad: "Sgo. del Estero",         score: 62.9, dist: 512 },
            { ciudad: "Corrientes",              score: 60.6, dist: 420 },
            { ciudad: "Salta",                   score: 60.1, dist: 927 },
            { ciudad: "San Luis",                score: 59.2, dist: 170 },
          ].map(c => (
            <div key={c.ciudad} className="flex justify-between">
              <span className="text-text-secondary truncate max-w-[90px]">{c.ciudad}</span>
              <span className="font-mono text-warning-DEFAULT">{c.score}/100</span>
            </div>
          ))}
        </div>
      </div>

      {/* Low coverage */}
      <div className="glass rounded-xl p-3">
        <p className="tactical-text mb-2.5 flex items-center gap-1.5">
          <ChevronRight size={10} /><span>Menor Cobertura</span>
        </p>
        <div className="space-y-2">
          {lowCoverage.map(p => (
            <div key={p.nombre}>
              <div className="flex justify-between text-2xs mb-0.5">
                <span className="text-text-secondary truncate max-w-[75px]">{p.nombre}</span>
                <span className="font-mono text-warning-DEFAULT">{p.n_activos} cli.</span>
              </div>
              <div className="flex justify-between text-2xs">
                <span className="text-text-muted">{p.agr_ha_m.toFixed(1)}M ha</span>
                <span className="font-mono text-text-muted">{p.macro_region}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* GIS alerts — data-derived */}
      <div className="glass rounded-xl p-3">
        <p className="tactical-text mb-2.5 flex items-center gap-1.5">
          <AlertTriangle size={10} /><span>Alertas GIS</span>
        </p>
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <div key={i} className="flex items-start gap-1.5 text-2xs">
              <span className="w-1.5 h-1.5 rounded-full mt-0.5 flex-shrink-0" style={{ background: a.c }} />
              <span className="text-text-muted">{a.msg}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Bottom panel ──────────────────────────────────────────────────────────────
function BottomPanel({
  metric, activeLayers, geoLoading, geoError,
}: {
  metric: GisMetric;
  activeLayers: number;
  geoLoading: boolean;
  geoError: string | null;
}) {
  const top5 = [...PROVINCE_KPIS]
    .sort((a, b) => getMetricValue(b, metric) - getMetricValue(a, metric))
    .slice(0, 5);
  const topVal = getMetricValue(top5[0], metric);

  const fmtShort = (kpi: ProvinceKPI) => {
    const v = getMetricValue(kpi, metric);
    if (metric === "revenue")  return fmtARS(v, true);
    if (metric === "clientes") return fmtNumber(v);
    if (metric === "otif")     return `${v.toFixed(1)}%`;
    if (metric === "margen")   return `${v.toFixed(1)}%`;
    return `${(v * 100).toFixed(0)}%`;
  };

  const regionKpis = (["PAM","NOA","NEA","CUY","PAT"] as const).map(r => ({
    region: r,
    revenue: PROVINCE_KPIS.filter(p => p.macro_region === r).reduce((s, p) => s + p.revenue_ars, 0),
    clientes: PROVINCE_KPIS.filter(p => p.macro_region === r).reduce((s, p) => s + p.n_activos, 0),
  }));

  return (
    <div className="glass rounded-xl mt-2 flex-shrink-0 overflow-hidden">
      {/* Top section: data panels */}
      <div className="flex divide-x divide-border" style={{ height: 76 }}>

        {/* Top 5 provincias */}
        <div className="flex-1 px-3 py-2 overflow-hidden">
          <p className="tactical-text mb-2 flex items-center gap-1">
            <TrendingUp size={9} />
            <span>Top Provincias · <span className="text-primary">{metric.toUpperCase()}</span></span>
          </p>
          <div className="flex gap-2.5 items-end h-[38px]">
            {top5.map((p, i) => {
              const val  = getMetricValue(p, metric);
              const pct  = topVal > 0 ? (val / topVal) * 100 : 0;
              const barH = Math.max(6, Math.round((pct / 100) * 28));
              return (
                <div key={p.nombre} className="flex flex-col items-center min-w-0 gap-0.5">
                  <span className="font-mono text-2xs text-primary leading-none" style={{ fontSize: 9 }}>{fmtShort(p)}</span>
                  <div className="w-7 bg-bg-elevated rounded-sm overflow-hidden flex items-end" style={{ height: 28 }}>
                    <div className="w-full rounded-sm bg-primary/60" style={{ height: barH }} />
                  </div>
                  <span className="text-text-muted truncate max-w-[30px]" style={{ fontSize: 8 }}>
                    {p.nombre.split(" ")[0]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Region breakdown */}
        <div className="px-3 py-2 overflow-hidden" style={{ minWidth: 220 }}>
          <p className="tactical-text mb-2 flex items-center gap-1">
            <GitBranch size={9} /><span>Regiones</span>
          </p>
          <div className="space-y-1">
            {regionKpis.map(r => {
              const pct = r.revenue / NATIONAL_TOTALS.revenue_ars * 100;
              return (
                <div key={r.region} className="flex items-center gap-2 text-2xs">
                  <span className="text-text-muted w-7">{r.region}</span>
                  <div className="flex-1 h-1 bg-bg-elevated rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-primary/60" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="font-mono text-primary w-10 text-right">{pct.toFixed(1)}%</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* National KPI chips */}
        <div className="px-3 py-2 flex items-center gap-0 divide-x divide-border">
          <TacStat label="Revenue Nac."  value={fmtARS(NATIONAL_TOTALS.revenue_ars, true)} accent />
          <TacStat label="Cli. Activos"  value={fmtNumber(NATIONAL_TOTALS.n_activos)} />
          <TacStat label="Sucursales"    value={sucursales.length} />
          <TacStat label="OTIF Global"   value="91.4%" accent />
          <TacStat label="Capas Activas" value={activeLayers} />
        </div>

        {/* Route risk summary */}
        <div className="px-3 py-2 overflow-hidden" style={{ minWidth: 160 }}>
          <p className="tactical-text mb-2 flex items-center gap-1">
            <Shield size={9} /><span>Riesgo Logístico</span>
          </p>
          <div className="space-y-1.5 text-2xs">
            {[
              { label: "CL Río Cuarto", risk: "Alto",  score: 6.05, c: "#E03E3E" },
              { label: "CL Rosario",    risk: "Medio", score: 5.97, c: "#E8A020" },
              { label: "CL Pergamino",  risk: "Bajo",  score: 5.94, c: "#22C55E" },
            ].map(d => (
              <div key={d.label} className="flex justify-between">
                <span className="text-text-muted truncate max-w-[80px]">{d.label}</span>
                <span className="font-mono font-bold" style={{ color: d.c }}>{d.risk}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Alerts */}
        <div className="px-3 py-2 overflow-hidden" style={{ minWidth: 200 }}>
          <p className="tactical-text mb-2 flex items-center gap-1">
            <AlertTriangle size={9} /><span>Alertas GIS Activas</span>
          </p>
          <div className="space-y-1">
            {[
              { msg: "5 zonas fuera de cobertura 150km", c: "#E03E3E" },
              { msg: "Depósito Salta 91% capacidad",     c: "#E8A020" },
              { msg: "OTIF NEA 86.7% bajo target 88%",  c: "#E8A020" },
              { msg: "Churn >40% en NOA periférico",     c: "#E03E3E" },
            ].map((a, i) => (
              <div key={i} className="flex items-center gap-1.5 text-2xs">
                <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: a.c }} />
                <span className="text-text-muted truncate">{a.msg}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="border-t border-border px-4 py-1 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${geoLoading ? "bg-warning-DEFAULT animate-pulse" : geoError ? "bg-danger-DEFAULT" : "bg-primary blink"}`} />
            <span className="tactical-text">{geoLoading ? "CARGANDO GIS…" : geoError ? "ERROR GeoJSON" : "LIVE · CartoDB Dark Matter"}</span>
          </div>
          <span className="tactical-text border-l border-border pl-4">IGN Argentina Provincias · EPSG:4326</span>
          <span className="tactical-text border-l border-border pl-4">Neon PostgreSQL · {(1_901_064).toLocaleString("es-AR")} rows</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="tactical-text">
            Métrica: <span className="text-primary font-mono">{metric.toUpperCase()}</span>
          </span>
          <span className="tactical-text border-l border-border pl-3">AgroNova GIS v3.0 · Sprint GIS-07</span>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function GISPage() {
  const [metric,   setMetric]   = useState<GisMetric>("revenue");
  const [selected, setSelected] = useState<ProvinceKPI | null>(null);
  const [rightTab, setRightTab] = useState<"ops" | "analytics" | "network" | "routing">("ops");
  const [geoData,  setGeoData]  = useState<GeoJSON.FeatureCollection | null>(null);
  const [geoLoading, setGeoLoading] = useState(true);
  const [geoError,   setGeoError]   = useState<string | null>(null);
  const [clock,    setClock]    = useState("");
  const [layers,   setLayers]   = useState({
    choropleth:   true,
    voronoi:      false,
    hotspots:     false,
    heatmap:      false,
    buffers:      false,
    candidatos:   false,
    routing_risk: false,
    sucursales:   true,
    depositos:    true,
    clientes:     true,
    radios:       false,
  });

  // Clock
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString("es-AR", { hour12: false }));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  // Load simplified province GeoJSON
  const loadGeo = useCallback(() => {
    setGeoLoading(true);
    setGeoError(null);
    fetch("/data/geo/provincias_simple.geojson")
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((data: GeoJSON.FeatureCollection) => { setGeoData(data); setGeoLoading(false); })
      .catch((e: Error) => { setGeoError(e.message); setGeoLoading(false); });
  }, []);

  useEffect(() => { loadGeo(); }, [loadGeo]);

  const toggleLayer = useCallback((key: string) => {
    setLayers(prev => ({ ...prev, [key]: !prev[key as keyof typeof prev] }));
  }, []);

  const activeLayers = Object.values(layers).filter(Boolean).length;

  return (
    <div className="flex flex-col h-[calc(100vh-76px)] animate-fade-in gap-0 -m-5 p-5 pt-3">

      {/* Tactical header */}
      <div className="glass rounded-xl mb-2 px-2 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center">
          <TacStat label="Rev. Nac."    value={fmtARS(NATIONAL_TOTALS.revenue_ars, true)} accent />
          <TacStat label="Cli. Activos" value={fmtNumber(NATIONAL_TOTALS.n_activos)} />
          <TacStat label="Provincias"   value={NATIONAL_TOTALS.provincias} />
          <TacStat label="Sucursales"   value={sucursales.length} />
          <TacStat label="Depósitos"    value={depositos.length} />
          <TacStat label="OTIF Global"  value="91.4%" accent />
        </div>
        <div className="flex items-center gap-3 pr-2">
          {geoLoading && (
            <div className="flex items-center gap-1.5">
              <RefreshCw size={10} className="text-primary animate-spin" />
              <span className="tactical-text">Cargando GIS…</span>
            </div>
          )}
          {geoError && (
            <button onClick={loadGeo} className="flex items-center gap-1.5 text-danger-DEFAULT hover:text-danger-dim">
              <AlertTriangle size={10} />
              <span className="tactical-text">Reintentar</span>
            </button>
          )}
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${geoLoading ? "bg-warning-DEFAULT animate-pulse" : geoError ? "bg-danger-DEFAULT" : "bg-primary blink"}`} />
            <span className="tactical-text">{geoLoading ? "LOADING" : geoError ? "ERROR" : "LIVE"}</span>
          </div>
          <span className="font-mono text-xs text-text-muted">{clock}</span>
          <span className="tactical-text">ARG-TZ</span>
        </div>
      </div>

      {/* 3-col layout */}
      <div className="flex gap-2 flex-1 min-h-0">

        {/* Left panel */}
        <div className="w-[220px] flex-shrink-0">
          <LeftPanel
            metric={metric} setMetric={setMetric}
            layers={layers} toggleLayer={toggleLayer}
            selected={selected}
          />
        </div>

        {/* Center: map */}
        <div className="flex-1 relative rounded-xl overflow-hidden border border-border glass-elevated min-h-0">
          {/* HUD scan line */}
          <div className="scan-line pointer-events-none z-10" />

          {/* Corner brackets */}
          {["top-2 left-2 border-t border-l","top-2 right-2 border-t border-r",
            "bottom-2 left-2 border-b border-l","bottom-2 right-2 border-b border-r"
          ].map((cls, i) => (
            <div key={i} className={`absolute w-4 h-4 ${cls} border-primary/40 z-10 pointer-events-none`} />
          ))}

          {/* Map title */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[500] pointer-events-none">
            <div className="glass px-3 py-1 rounded-full flex items-center gap-2">
              <MapPin size={10} className="text-primary" />
              <span className="tactical-text">ARGENTINA · GIS VISUAL INTELLIGENCE v3.0</span>
            </div>
          </div>

          {/* Coordinate overlay */}
          <div className="absolute bottom-10 left-3 z-[500] pointer-events-none flex flex-col gap-1">
            <div className="glass px-2 py-1 rounded">
              <span className="tactical-text">34°00′S · 64°00′O · EPSG:4326</span>
            </div>
            {!geoLoading && !geoError && (
              <div className="glass px-2 py-1 rounded">
                <span className="tactical-text text-success-DEFAULT">GeoJSON OK · {geoData?.features?.length ?? 0} provincias</span>
              </div>
            )}
            {geoError && (
              <div className="glass px-2 py-1 rounded border border-danger-DEFAULT/30">
                <span className="tactical-text text-danger-DEFAULT">GeoJSON Error: {geoError}</span>
              </div>
            )}
          </div>

          {/* Active layers HUD */}
          <div className="absolute bottom-10 right-12 z-[500] pointer-events-none flex flex-col gap-1 items-end">
            {Object.entries(layers).filter(([, v]) => v).map(([k]) => {
              const def = LAYER_DEFS.find(l => l.key === k);
              return (
                <div key={k} className="glass px-1.5 py-0.5 rounded flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full" style={{ background: def?.color ?? "#22C55E" }} />
                  <span className="tactical-text text-2xs">{def?.label ?? k}</span>
                </div>
              );
            })}
          </div>

          <LeafletMap
            sucursales={sucursales}
            depositos={depositos}
            clientes={clienteMarkers}
            routes={gisRoutes}
            showChoropleth={layers.choropleth}
            showHeatmap={layers.heatmap}
            showSucursales={layers.sucursales}
            showDepositos={layers.depositos}
            showClientes={layers.clientes}
            showRadios={layers.radios}
            showVoronoi={layers.voronoi}
            showBuffers={layers.buffers}
            showCandidatos={layers.candidatos}
            showHotspots={layers.hotspots}
            showRoutingRisk={layers.routing_risk}
            metric={metric}
            geoData={geoData}
            geoLoading={geoLoading}
            onProvinceClick={setSelected}
          />
        </div>

        {/* Right panel */}
        <div className="w-[190px] flex-shrink-0 flex flex-col gap-2 h-full min-h-0">
          <div className="glass rounded-xl p-1 flex gap-1 flex-shrink-0">
            {([
              { id: "ops",      label: "Ops" },
              { id: "analytics",label: "Análisis" },
              { id: "network",  label: "Network" },
              { id: "routing",  label: "Routing" },
            ] as const).map(t => (
              <button
                key={t.id}
                onClick={() => setRightTab(t.id)}
                className={`flex-1 py-1 rounded text-2xs font-mono transition-all ${
                  rightTab === t.id
                    ? "bg-primary-dim text-primary border border-primary/30"
                    : "text-text-muted hover:text-text-secondary"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto pr-0.5">
            {rightTab === "ops"       ? <RightPanel selected={selected} />
              : rightTab === "analytics" ? <SpatialAnalyticsPanel />
              : rightTab === "network"   ? <NetworkIntelligencePanel />
              : <RoutingPanel />}
          </div>
        </div>
      </div>

      {/* Bottom panel — expanded */}
      <BottomPanel
        metric={metric}
        activeLayers={activeLayers}
        geoLoading={geoLoading}
        geoError={geoError}
      />
    </div>
  );
}

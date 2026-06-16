"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useCallback } from "react";
import {
  Layers, MapPin, Activity, Crosshair, Radio, TrendingUp,
  AlertTriangle, ChevronRight, RefreshCw, BarChart2,
} from "lucide-react";
import { sucursales, depositos, clienteMarkers, gisRoutes } from "@/lib/mock-data";
import { fmtARS, fmtNumber } from "@/lib/formatters";
import type { ProvinceKPI, GisMetric } from "@/types";
import {
  PROVINCE_KPIS, NATIONAL_TOTALS, getLowCoverageProvinces, getMetricValue,
} from "@/lib/geo-data";
import SpatialAnalyticsPanel from "@/components/gis/SpatialAnalyticsPanel";
import NetworkIntelligencePanel from "@/components/gis/NetworkIntelligencePanel";

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
    return `${(v * 100).toFixed(0)}%`;
  };

  const LAYER_DEFS = [
    { key: "choropleth", label: "Coroplético",    color: "#22C55E" },
    { key: "heatmap",    label: "Heatmap",         color: "#4ADE80" },
    { key: "sucursales", label: "Sucursales",      color: "#22C55E" },
    { key: "depositos",  label: "Depósitos",       color: "#E8A020" },
    { key: "clientes",   label: "Clientes",        color: "#0DB87E" },
    { key: "radios",     label: "Radios Cobertura",color: "#A3E635" },
  ];

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

      {/* Layer toggles */}
      <div className="glass rounded-xl p-3">
        <p className="tactical-text mb-2.5 flex items-center gap-1.5">
          <Layers size={10} /><span>Capas</span>
        </p>
        <div className="space-y-1.5">
          {LAYER_DEFS.map(l => (
            <button
              key={l.key}
              onClick={() => toggleLayer(l.key)}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-all border ${
                layers[l.key]
                  ? "bg-primary-dim border-primary/30 text-text-primary"
                  : "bg-bg-elevated border-border text-text-muted hover:border-border-accent"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: layers[l.key] ? l.color : "#3E5A3E" }} />
                <span>{l.label}</span>
              </div>
              <span className={`text-2xs font-mono ${layers[l.key] ? "text-primary" : "text-text-muted"}`}>
                {layers[l.key] ? "ON" : "OFF"}
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
          <p className="text-xs text-text-primary font-semibold mb-2 truncate">{selected.nombre}</p>
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

      {/* Low coverage provinces */}
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

      {/* GIS alerts */}
      <div className="glass rounded-xl p-3">
        <p className="tactical-text mb-2.5 flex items-center gap-1.5">
          <AlertTriangle size={10} /><span>Alertas GIS</span>
        </p>
        <div className="space-y-2">
          {[
            { msg: "Depósito Rosario 87% cap.",   c: "#E8A020" },
            { msg: "OTIF NEA por debajo target",  c: "#E03E3E" },
            { msg: "Chaco: alto gap territorial", c: "#E8A020" },
            { msg: "Churn > 40% en NOA periférico", c: "#E03E3E" },
          ].map((a, i) => (
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

// ── Page ──────────────────────────────────────────────────────────────────────
export default function GISPage() {
  const [metric,   setMetric]   = useState<GisMetric>("revenue");
  const [selected, setSelected] = useState<ProvinceKPI | null>(null);
  const [rightTab, setRightTab] = useState<"ops" | "analytics" | "network">("ops");
  const [geoData,  setGeoData]  = useState<GeoJSON.FeatureCollection | null>(null);
  const [geoLoading, setGeoLoading] = useState(true);
  const [geoError,   setGeoError]   = useState<string | null>(null);
  const [clock,    setClock]    = useState("");
  const [layers,   setLayers]   = useState({
    choropleth: true,
    heatmap:    false,
    sucursales: true,
    depositos:  true,
    clientes:   true,
    radios:     false,
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

  const totalRevenue = NATIONAL_TOTALS.revenue_ars;
  const activeClients = NATIONAL_TOTALS.n_activos;
  const pamShare = PROVINCE_KPIS
    .filter(p => p.macro_region === "PAM")
    .reduce((s, p) => s + p.revenue_pct, 0);

  return (
    <div className="flex flex-col h-[calc(100vh-76px)] animate-fade-in gap-0 -m-5 p-5 pt-3">

      {/* Tactical header */}
      <div className="glass rounded-xl mb-2 px-2 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center">
          <TacStat label="Revenue Nac."  value={fmtARS(totalRevenue, true)}  accent />
          <TacStat label="Cli. Activos"  value={fmtNumber(activeClients)} />
          <TacStat label="Provincias"    value={NATIONAL_TOTALS.provincias} />
          <TacStat label="PAM Share"     value={`${pamShare.toFixed(0)}%`} accent />
          <TacStat label="Sucursales"    value={sucursales.length} />
          <TacStat label="Depósitos"     value={depositos.length} />
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
        <div className="w-[210px] flex-shrink-0">
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
              <span className="tactical-text">ARGENTINA · ANÁLISIS GEOESPACIAL v2.0</span>
            </div>
          </div>

          {/* Coordinate + GIS status overlay */}
          <div className="absolute bottom-10 left-3 z-[500] pointer-events-none flex flex-col gap-1">
            <div className="glass px-2 py-1 rounded">
              <span className="tactical-text">34°00′S · 64°00′O · EPSG:4326</span>
            </div>
            {!geoLoading && !geoError && (
              <div className="glass px-2 py-1 rounded">
                <span className="tactical-text text-success-DEFAULT">COROPLÉTICO OK · {geoData?.features?.length ?? 0} provincias</span>
              </div>
            )}
            {geoError && (
              <div className="glass px-2 py-1 rounded border border-danger-DEFAULT/30">
                <span className="tactical-text text-danger-DEFAULT">GeoJSON Error: {geoError}</span>
              </div>
            )}
          </div>

          {/* Active layers badges */}
          <div className="absolute bottom-10 right-12 z-[500] pointer-events-none flex flex-col gap-1 items-end">
            {Object.entries(layers).filter(([, v]) => v).map(([k]) => (
              <div key={k} className="glass px-1.5 py-0.5 rounded flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-primary" />
                <span className="tactical-text text-2xs">{k}</span>
              </div>
            ))}
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
              { id: "ops", label: "Operaciones" },
              { id: "analytics", label: "Análisis" },
              { id: "network", label: "Network" },
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
            {rightTab === "ops" ? <RightPanel selected={selected} />
              : rightTab === "analytics" ? <SpatialAnalyticsPanel />
              : <NetworkIntelligencePanel />}
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="glass rounded-xl mt-2 px-4 py-1.5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            <span className="tactical-text">CartoDB Dark Matter · OpenStreetMap</span>
          </div>
          <span className="tactical-text border-l border-border pl-4">IGN Argentina Provincias</span>
          <span className="tactical-text border-l border-border pl-4">Datos: 2026-06-16</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="tactical-text">
            Métrica: <span className="text-primary font-mono">{metric.toUpperCase()}</span>
          </span>
          <span className="tactical-text border-l border-border pl-3">AgroNova GIS v2.0</span>
        </div>
      </div>
    </div>
  );
}

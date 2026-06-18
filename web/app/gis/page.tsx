"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Layers, MapPin, Activity, Crosshair, Radio, TrendingUp,
  AlertTriangle, ChevronRight, RefreshCw, BarChart2, Globe, Anchor, Zap, Box,
  Mountain, Play, Pause, Gauge,
} from "lucide-react";
import { sucursales, depositos, clienteMarkers, gisRoutes } from "@/lib/mock-data";
import { fmtARS, fmtNumber } from "@/lib/formatters";
import type { ProvinceKPI, GisMetric, BasemapId, MapEngine } from "@/types";
import { getMetricValue } from "@/lib/geo-data";
import { isMapboxConfigured } from "@/lib/mapbox-config";
import {
  getKpisByYear, getNationalTotalsForYear, getLowCoverageForYear,
  YEAR_MIN, YEAR_MAX,
} from "@/lib/timeseries";
import type { NationalTotals } from "@/lib/timeseries";
import SpatialAnalyticsPanel   from "@/components/gis/SpatialAnalyticsPanel";
import NetworkIntelligencePanel from "@/components/gis/NetworkIntelligencePanel";
import RoutingPanel             from "@/components/gis/RoutingPanel";
import MapLegendAdvanced        from "@/components/gis/MapLegendAdvanced";
import ArcGISPanel              from "@/components/gis/ArcGISPanel";
import ProvinceDetailPanel      from "@/components/gis/ProvinceDetailPanel";
import MapStatisticsPanel       from "@/components/gis/MapStatisticsPanel";
import TimeSlider               from "@/components/gis/TimeSlider";

const LeafletMap = dynamic(() => import("@/components/map/LeafletMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-text-muted tactical-text">
      <div className="w-6 h-6 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
      <span>Cargando mapa…</span>
    </div>
  ),
});

const MapboxTerrainView = dynamic(
  () => import("@/components/gis/MapboxTerrainView"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-text-muted tactical-text">
        <div className="w-6 h-6 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
        <span>Cargando Mapbox Terrain…</span>
      </div>
    ),
  },
);

const LiveMetricsPanel = dynamic(
  () => import("@/components/gis/LiveMetricsPanel"),
  { ssr: false },
);

// ── Metrics ───────────────────────────────────────────────────────────────────

const METRICS: { id: GisMetric; label: string; color: string }[] = [
  { id: "revenue",  label: "Revenue",  color: "#22C55E" },
  { id: "clientes", label: "Clientes", color: "#4ADE80" },
  { id: "margen",   label: "Margen",   color: "#A3E635" },
  { id: "churn",    label: "Churn",    color: "#E03E3E" },
];

// ── Basemaps ──────────────────────────────────────────────────────────────────

const BASEMAP_OPTS: { id: BasemapId; label: string; dot: string }[] = [
  { id: "dark",          label: "Dark Matter",     dot: "#22C55E" },
  { id: "voyager",       label: "Carto Voyager",   dot: "#4ADE80" },
  { id: "esri_gray",     label: "Esri Gray",       dot: "#A3E635" },
  { id: "osm_hot",       label: "OSM Humanitario", dot: "#0EA5E9" },
  { id: "esri_imagery",  label: "Esri Satélite",   dot: "#E8A020" },
];

// ── Layer definitions ─────────────────────────────────────────────────────────

const ANALYSIS_LAYERS = [
  { key: "choropleth",    label: "Coroplético",      color: "#22C55E" },
  { key: "heatmap",       label: "Heatmap",           color: "#4ADE80" },
  { key: "radios",        label: "Radios Cobertura",  color: "#A3E635" },
];

const TERRITORY_LAYERS = [
  { key: "departamentos", label: "Departamentos",     color: "#4ADE80" },
  { key: "municipios",    label: "Municipios",         color: "#0EA5E9" },
  { key: "vial",          label: "Red Vial",           color: "#E8A020" },
  { key: "puertos",       label: "Puertos / Nodos",    color: "#A3E635" },
];

const MARKER_LAYERS = [
  { key: "sucursales",    label: "Sucursales",         color: "#22C55E" },
  { key: "depositos",     label: "Depósitos",          color: "#0EA5E9" },
  { key: "clientes",      label: "Clientes",           color: "#F97316" },
];

const GIS_OUTPUT_LAYERS = [
  { key: "hotspots",      label: "Hotspots",           color: "#E8A020" },
  { key: "territorios",   label: "Territorios",        color: "#C084FC" },
  { key: "buffers",       label: "Buffers Cobertura",  color: "#A3E635" },
  { key: "candidatos",    label: "Candidatas",         color: "#E8A020" },
  { key: "serviceareas",  label: "Service Areas",      color: "#22C55E" },
];

// ── Stat chip ─────────────────────────────────────────────────────────────────

function TacStat({ label, value, accent = false }: {
  label: string; value: string | number; accent?: boolean;
}) {
  return (
    <div className="flex flex-col items-center px-3 py-1.5 border-r border-border last:border-0">
      <span className="tactical-text mb-0.5">{label}</span>
      <span className={`font-mono text-sm font-semibold ${accent ? "text-primary" : "text-text-primary"}`}>
        {value}
      </span>
    </div>
  );
}

// ── Layer toggle button ───────────────────────────────────────────────────────

function LayerBtn({
  layerKey, label, color, active, onToggle,
}: {
  layerKey: string; label: string; color: string; active: boolean; onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-all border ${
        active
          ? "border-opacity-40 text-text-primary"
          : "bg-bg-elevated border-border text-text-muted hover:border-border-accent"
      }`}
      style={active ? { background: `${color}14`, borderColor: `${color}50` } : {}}
    >
      <div className="flex items-center gap-2">
        <span
          className="w-2 h-2 rounded-full flex-shrink-0 transition-all"
          style={{ background: active ? color : "#3E5A3E", boxShadow: active ? `0 0 5px ${color}80` : "none" }}
        />
        <span>{label}</span>
      </div>
      <span
        className="text-2xs font-mono"
        style={{ color: active ? color : "#4B6B4B" }}
      >
        {active ? "ON" : "—"}
      </span>
    </button>
  );
}

// ── Left panel ────────────────────────────────────────────────────────────────

function LeftPanel({
  metric, setMetric,
  basemap, setBasemap,
  layers, toggleLayer,
  selected, currentKpis,
  mode3D, setMode3D,
  show3DArcs, setShow3DArcs,
  showBeams, setShowBeams,
  metric3D, setMetric3D,
  mapEngine, setMapEngine,
  showTerrain, setShowTerrain,
  showSatellite, setShowSatellite,
  showFlows, setShowFlows,
  showVehicles, setShowVehicles,
  showPulse, setShowPulse,
}: {
  metric: GisMetric; setMetric: (m: GisMetric) => void;
  basemap: BasemapId; setBasemap: (b: BasemapId) => void;
  layers: Record<string, boolean>; toggleLayer: (k: string) => void;
  selected: ProvinceKPI | null;
  currentKpis: ProvinceKPI[];
  mode3D: boolean; setMode3D: (v: boolean) => void;
  show3DArcs: boolean; setShow3DArcs: (v: boolean) => void;
  showBeams: boolean; setShowBeams: (v: boolean) => void;
  metric3D: GisMetric; setMetric3D: (m: GisMetric) => void;
  mapEngine: MapEngine; setMapEngine: (e: MapEngine) => void;
  showTerrain: boolean; setShowTerrain: (v: boolean) => void;
  showSatellite: boolean; setShowSatellite: (v: boolean) => void;
  showFlows: boolean; setShowFlows: (v: boolean) => void;
  showVehicles: boolean; setShowVehicles: (v: boolean) => void;
  showPulse: boolean; setShowPulse: (v: boolean) => void;
}) {
  const top5 = [...currentKpis]
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

  return (
    <div className="flex flex-col gap-2 h-full overflow-y-auto pr-0.5">

      {/* Map Engine selector */}
      <div className="glass rounded-xl p-3">
        <p className="tactical-text mb-2 flex items-center gap-1.5">
          <Globe size={10} /><span>Motor de Mapa</span>
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {(["leaflet", "mapbox"] as MapEngine[]).map(eng => {
            const isActive  = mapEngine === eng;
            const available = eng === "leaflet" || isMapboxConfigured();
            return (
              <button
                key={eng}
                onClick={() => available && setMapEngine(eng)}
                disabled={!available}
                className="px-2 py-1.5 rounded text-2xs font-mono transition-all border flex flex-col items-center gap-0.5"
                style={isActive
                  ? { background: "rgba(34,197,94,0.15)", borderColor: "rgba(34,197,94,0.50)", color: "#22C55E" }
                  : available
                  ? { background: "rgba(7,18,9,0.5)", borderColor: "rgba(34,197,94,0.15)", color: "#4B6B4B" }
                  : { background: "rgba(7,18,9,0.3)", borderColor: "rgba(34,197,94,0.08)", color: "#2A4A2A", cursor: "not-allowed" }
                }
              >
                <span>{eng === "leaflet" ? "◆ LEAFLET" : "◈ MAPBOX"}</span>
                {!available && eng === "mapbox" && (
                  <span style={{ fontSize: 7, color: "#E8A020" }}>TOKEN FALTANTE</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mapbox Terrain controls — only when mapbox engine active */}
      {mapEngine === "mapbox" && (
        <div className="glass rounded-xl p-3" style={{ border: "1px solid rgba(163,230,53,0.15)" }}>
          <p className="tactical-text mb-2 flex items-center gap-1.5">
            <Mountain size={10} /><span>Mapbox Terrain</span>
          </p>
          <div className="space-y-1.5">
            <LayerBtn layerKey="terrain"   label="Terrain 3D"  color="#A3E635"
              active={showTerrain}   onToggle={() => setShowTerrain(!showTerrain)} />
            <LayerBtn layerKey="satellite" label="Satellite"   color="#0EA5E9"
              active={showSatellite} onToggle={() => setShowSatellite(!showSatellite)} />
          </div>
        </div>
      )}

      {/* Metric selector */}
      <div className="glass rounded-xl p-3" style={{ boxShadow: "0 0 16px rgba(34,197,94,0.04)" }}>
        <p className="tactical-text mb-2.5 flex items-center gap-1.5">
          <BarChart2 size={10} /><span>Métrica KPI</span>
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {METRICS.map(m => (
            <button
              key={m.id}
              onClick={() => setMetric(m.id)}
              className={`px-2 py-1.5 rounded text-2xs font-mono transition-all border ${
                metric === m.id ? "" : "bg-bg-elevated border-border text-text-muted hover:border-border-accent"
              }`}
              style={metric === m.id ? { background: `${m.color}18`, borderColor: `${m.color}60`, color: m.color } : {}}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Analysis layers */}
      <div className="glass rounded-xl p-3">
        <p className="tactical-text mb-2 flex items-center gap-1.5">
          <Layers size={10} /><span>Análisis</span>
        </p>
        <div className="space-y-1.5">
          {ANALYSIS_LAYERS.map(l => (
            <LayerBtn key={l.key} layerKey={l.key} label={l.label} color={l.color}
              active={!!layers[l.key]} onToggle={() => toggleLayer(l.key)} />
          ))}
        </div>
      </div>

      {/* Territory layers */}
      <div className="glass rounded-xl p-3">
        <p className="tactical-text mb-2 flex items-center gap-1.5">
          <Globe size={10} /><span>Territorio Real</span>
        </p>
        <div className="space-y-1.5">
          {TERRITORY_LAYERS.map(l => (
            <LayerBtn key={l.key} layerKey={l.key} label={l.label} color={l.color}
              active={!!layers[l.key]} onToggle={() => toggleLayer(l.key)} />
          ))}
        </div>
      </div>

      {/* Marker layers */}
      <div className="glass rounded-xl p-3">
        <p className="tactical-text mb-2 flex items-center gap-1.5">
          <MapPin size={10} /><span>Marcadores</span>
        </p>
        <div className="space-y-1.5">
          {MARKER_LAYERS.map(l => (
            <LayerBtn key={l.key} layerKey={l.key} label={l.label} color={l.color}
              active={!!layers[l.key]} onToggle={() => toggleLayer(l.key)} />
          ))}
        </div>
      </div>

      {/* GIS Output layers */}
      <div className="glass rounded-xl p-3">
        <p className="tactical-text mb-2 flex items-center gap-1.5">
          <Zap size={10} /><span>GIS Outputs</span>
        </p>
        <div className="space-y-1.5">
          {GIS_OUTPUT_LAYERS.map(l => (
            <LayerBtn key={l.key} layerKey={l.key} label={l.label} color={l.color}
              active={!!layers[l.key]} onToggle={() => toggleLayer(l.key)} />
          ))}
        </div>
      </div>

      {/* WebGL / 3D Intelligence (GIS-13) */}
      <div className="glass rounded-xl p-3">
        <p className="tactical-text mb-2 flex items-center gap-1.5">
          <Box size={10} /><span>WebGL 3D</span>
        </p>
        <div className="space-y-1.5">
          <LayerBtn layerKey="mode3d"  label="Modo 3D"    color="#A3E635" active={mode3D}     onToggle={() => setMode3D(!mode3D)} />
          <LayerBtn layerKey="arcos3d" label="Flow Arcos" color="#22C55E" active={show3DArcs}  onToggle={() => setShow3DArcs(!show3DArcs)} />
          <LayerBtn layerKey="beams"   label="Exp. Beams" color="#E8A020" active={showBeams}   onToggle={() => setShowBeams(!showBeams)} />
          {mode3D && (
            <div className="pt-1.5 border-t border-border">
              <p className="tactical-text mb-1.5" style={{ fontSize: 8 }}>Métrica 3D</p>
              <div className="grid grid-cols-2 gap-1">
                {METRICS.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setMetric3D(m.id)}
                    className="px-1.5 py-1 rounded text-2xs font-mono transition-all border"
                    style={metric3D === m.id
                      ? { background: `${m.color}18`, borderColor: `${m.color}60`, color: m.color }
                      : { background: "rgba(7,18,9,0.5)", borderColor: "rgba(34,197,94,0.15)", color: "#4B6B4B" }
                    }
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* GIS-16 Animation layers — Leaflet only */}
      {mapEngine === "leaflet" && (
        <div className="glass rounded-xl p-3" style={{ border: "1px solid rgba(34,197,94,0.15)" }}>
          <p className="tactical-text mb-2 flex items-center gap-1.5">
            <Activity size={10} /><span>Animaciones</span>
          </p>
          <div className="space-y-1.5">
            <LayerBtn layerKey="flows"    label="Flow Particles" color="#22C55E"
              active={showFlows}    onToggle={() => setShowFlows(!showFlows)} />
            <LayerBtn layerKey="vehicles" label="Vehículos"      color="#A3E635"
              active={showVehicles} onToggle={() => setShowVehicles(!showVehicles)} />
            <LayerBtn layerKey="pulse"    label="Pulsos Hotspot" color="#E8A020"
              active={showPulse}    onToggle={() => setShowPulse(!showPulse)} />
          </div>
        </div>
      )}

      {/* Basemap selector — Leaflet only */}
      {mapEngine === "leaflet" && <div className="glass rounded-xl p-3">
        <p className="tactical-text mb-2 flex items-center gap-1.5">
          <Globe size={10} /><span>Basemap</span>
        </p>
        <div className="space-y-1">
          {BASEMAP_OPTS.map(b => (
            <button
              key={b.id}
              onClick={() => setBasemap(b.id)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-2xs transition-all border ${
                basemap === b.id
                  ? "text-text-primary"
                  : "bg-bg-elevated border-border text-text-muted hover:border-border-accent"
              }`}
              style={basemap === b.id ? { background: `${b.dot}14`, borderColor: `${b.dot}50` } : {}}
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: basemap === b.id ? b.dot : "#3E5A3E" }} />
              <span>{b.label}</span>
              {basemap === b.id && <span className="ml-auto font-mono" style={{ color: b.dot }}>✓</span>}
            </button>
          ))}
        </div>
      </div>}

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

      {/* Selected province */}
      {selected && (
        <div className="glass rounded-xl p-3" style={{ border: "1px solid rgba(34,197,94,0.25)", boxShadow: "0 0 14px rgba(34,197,94,0.06)" }}>
          <p className="tactical-text mb-2 flex items-center gap-1.5">
            <Activity size={10} /><span>Provincia</span>
          </p>
          <p className="text-xs text-text-primary font-semibold mb-1 truncate">{selected.nombre}</p>
          <span className="tactical-text text-2xs mb-2 block">{selected.macro_region}</span>
          <div className="space-y-1.5 text-2xs">
            {[
              ["Revenue",  fmtARS(selected.revenue_ars, true), "#22C55E"],
              ["Part. %",  `${selected.revenue_pct.toFixed(1)}%`, "#0EA5E9"],
              ["Activos",  fmtNumber(selected.n_activos), "#DCE8DC"],
              ["Margen",   `${selected.margen_pct.toFixed(1)}%`, "#DCE8DC"],
              ["OTIF",     `${selected.otif_pct.toFixed(1)}%`, selected.otif_pct >= 90 ? "#22C55E" : "#E8A020"],
              ["Churn",    `${(selected.churn_score * 100).toFixed(0)}%`, selected.churn_score > 0.35 ? "#E03E3E" : "#E8A020"],
            ].map(([label, val, color]) => (
              <div key={label} className="flex justify-between">
                <span className="text-text-muted">{label}</span>
                <span className="font-mono" style={{ color }}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sucursales quick list */}
      <div className="glass rounded-xl p-3">
        <p className="tactical-text mb-2 flex items-center gap-1.5">
          <Crosshair size={10} /><span>Sucursales</span>
        </p>
        <div className="space-y-1.5">
          {sucursales.map(s => (
            <div key={s.id} className="flex items-center justify-between text-2xs">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" style={{ boxShadow: "0 0 4px rgba(34,197,94,0.6)" }} />
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

function RightPanel({
  selected, layers, nationalTotals, lowCoverage,
}: {
  selected: ProvinceKPI | null;
  layers: Record<string, boolean>;
  nationalTotals: NationalTotals;
  lowCoverage: ProvinceKPI[];
}) {
  const activeRoutes = gisRoutes.filter(r => r.activo).length;
  const activeLayers = Object.values(layers).filter(Boolean).length;

  return (
    <div className="flex flex-col gap-2 h-full overflow-y-auto pr-0.5">

      {/* National KPIs */}
      <div className="glass rounded-xl p-3" style={{ boxShadow: "0 0 16px rgba(34,197,94,0.04)" }}>
        <p className="tactical-text mb-2.5 flex items-center gap-1.5">
          <Activity size={10} /><span>Nacional</span>
        </p>
        <div className="space-y-2 text-2xs">
          {[
            ["Revenue Total",   fmtARS(nationalTotals.revenue_ars, true), "#22C55E"],
            ["Cli. Activos",    fmtNumber(nationalTotals.n_activos), "#DCE8DC"],
            ["Total Clientes",  fmtNumber(nationalTotals.n_clientes), "#7A9C7A"],
            ["Provincias",      String(nationalTotals.provincias), "#DCE8DC"],
            ["Rutas Activas",   `${activeRoutes}/${gisRoutes.length}`, "#A3E635"],
            ["Capas Activas",   String(activeLayers), "#0EA5E9"],
          ].map(([l, v, c]) => (
            <div key={l} className="flex justify-between">
              <span className="text-text-muted">{l}</span>
              <span className="font-mono" style={{ color: c }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Depósitos */}
      <div className="glass rounded-xl p-3">
        <p className="tactical-text mb-2 flex items-center gap-1.5">
          <Radio size={10} /><span>Depósitos</span>
        </p>
        <div className="space-y-2">
          {depositos.map(d => {
            const c = d.ocupacion_pct > 85 ? "#E03E3E" : d.ocupacion_pct > 70 ? "#E8A020" : "#22C55E";
            return (
              <div key={d.id}>
                <div className="flex justify-between text-2xs mb-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded flex-shrink-0" style={{ background: "#0EA5E9", boxShadow: "0 0 4px rgba(14,165,233,0.5)" }} />
                    <span className="text-text-secondary truncate max-w-[78px]">{d.nombre.replace("Depósito ", "")}</span>
                  </div>
                  <span className="font-mono font-bold" style={{ color: c }}>{d.ocupacion_pct}%</span>
                </div>
                <div className="h-1 bg-bg-elevated rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${d.ocupacion_pct}%`, background: c }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Puertos summary */}
      <div className="glass rounded-xl p-3">
        <p className="tactical-text mb-2 flex items-center gap-1.5">
          <Anchor size={10} /><span>Nodos Logísticos</span>
        </p>
        <div className="space-y-1.5">
          {[
            { n: "Rosario / Up-River",   cap: "80M ton", c: "#A3E635" },
            { n: "San Lorenzo",          cap: "60M ton", c: "#A3E635" },
            { n: "Bahía Blanca",         cap: "25M ton", c: "#0EA5E9" },
            { n: "Quequén",              cap: "12M ton", c: "#38BDF8" },
            { n: "Buenos Aires",         cap: "15M ton", c: "#0EA5E9" },
          ].map(p => (
            <div key={p.n} className="flex justify-between text-2xs">
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 flex-shrink-0"
                  style={{ background: `${p.c}44`, border: `1px solid ${p.c}`, transform: "rotate(45deg)" }} />
                <span className="text-text-secondary truncate max-w-[95px]">{p.n}</span>
              </div>
              <span className="font-mono" style={{ color: p.c }}>{p.cap}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Low coverage */}
      <div className="glass rounded-xl p-3">
        <p className="tactical-text mb-2 flex items-center gap-1.5">
          <ChevronRight size={10} /><span>Baja Cobertura</span>
        </p>
        <div className="space-y-1.5">
          {lowCoverage.map(p => (
            <div key={p.nombre}>
              <div className="flex justify-between text-2xs mb-0.5">
                <span className="text-text-secondary truncate max-w-[75px]">{p.nombre}</span>
                <span className="font-mono text-warning-DEFAULT">{p.n_activos} cli.</span>
              </div>
              <div className="flex justify-between text-2xs">
                <span className="text-text-muted">{p.agr_ha_m.toFixed(1)}M ha · {p.macro_region}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* GIS alerts */}
      <div className="glass rounded-xl p-3">
        <p className="tactical-text mb-2 flex items-center gap-1.5">
          <AlertTriangle size={10} /><span>Alertas GIS</span>
        </p>
        <div className="space-y-2">
          {[
            { msg: "Depósito Rosario 87% capacidad",  c: "#E8A020" },
            { msg: "OTIF NEA por debajo de target",   c: "#E03E3E" },
            { msg: "Chaco: alto gap territorial",     c: "#E8A020" },
            { msg: "Churn >40% en NOA periférico",    c: "#E03E3E" },
            { msg: "Municipios: zoom ≥8 para detalle",c: "#0EA5E9" },
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
  const [metric,        setMetric]        = useState<GisMetric>("revenue");
  const [selected,      setSelected]      = useState<ProvinceKPI | null>(null);
  const [rightTab,      setRightTab]      = useState<"ops" | "analytics" | "network" | "routing" | "arcgis" | "stats" | "live">("ops");
  const [geoData,       setGeoData]       = useState<GeoJSON.FeatureCollection | null>(null);
  const [geoLoading,    setGeoLoading]    = useState(true);
  const [geoError,      setGeoError]      = useState<string | null>(null);
  const [clock,         setClock]         = useState("");
  const [basemap,       setBasemap]       = useState<BasemapId>("dark");
  const [selectedYear,  setSelectedYear]  = useState<number>(YEAR_MAX);
  const [playing,       setPlaying]       = useState(false);
  const [mode3D,        setMode3D]        = useState(false);
  const [show3DArcs,    setShow3DArcs]    = useState(false);
  const [showBeams,     setShowBeams]     = useState(false);
  const [metric3D,      setMetric3D]      = useState<GisMetric>("revenue");
  // GIS-15 Mapbox engine
  const [mapEngine,     setMapEngine]     = useState<MapEngine>("leaflet");
  const [showTerrain,   setShowTerrain]   = useState(true);
  const [showSatellite, setShowSatellite] = useState(true);
  // GIS-16 animation
  const [showFlows,     setShowFlows]     = useState(false);
  const [showVehicles,  setShowVehicles]  = useState(false);
  const [showPulse,     setShowPulse]     = useState(true);
  const [animPlaying,   setAnimPlaying]   = useState(true);
  const [animSpeed,     setAnimSpeed]     = useState<1 | 2>(1);
  const selectedNameRef = useRef<string | null>(null);
  const [layers,   setLayers]   = useState({
    choropleth:    true,
    heatmap:       false,
    radios:        false,
    departamentos: false,
    municipios:    false,
    vial:          false,
    puertos:       false,
    sucursales:    true,
    depositos:     true,
    clientes:      true,
    coords:        true,
    // GIS Outputs
    hotspots:      false,
    territorios:   false,
    buffers:       false,
    candidatos:    false,
    serviceareas:  false,
  });

  // Clock
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString("es-AR", { hour12: false }));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  // ── Temporal KPI data ─────────────────────────────────────────────
  const currentKpis     = useMemo(() => getKpisByYear(selectedYear),            [selectedYear]);
  const nationalTotals  = useMemo(() => getNationalTotalsForYear(selectedYear), [selectedYear]);
  const lowCoverage     = useMemo(() => getLowCoverageForYear(selectedYear),    [selectedYear]);

  // When year changes, keep selected province in sync (year-aware KPI values)
  useEffect(() => {
    if (!selectedNameRef.current) return;
    const updated = currentKpis.find(k => k.nombre === selectedNameRef.current);
    if (updated) setSelected(updated);
  }, [currentKpis]);

  useEffect(() => {
    selectedNameRef.current = selected?.nombre ?? null;
  }, [selected]);

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

  const totalRevenue  = nationalTotals.revenue_ars;
  const activeClients = nationalTotals.n_activos;
  const pamShare = currentKpis
    .filter(p => p.macro_region === "PAM")
    .reduce((s, p) => s + p.revenue_pct, 0);
  const activeLayers = Object.values(layers).filter(Boolean).length;
  const currentBasemap = BASEMAP_OPTS.find(b => b.id === basemap)?.label ?? basemap;

  return (
    <div className="flex flex-col h-[calc(100vh-76px)] animate-fade-in gap-0 -m-5 p-5 pt-3">

      {/* ── Tactical header ────────────────────────────────────────── */}
      <div
        className="glass rounded-xl mb-2 px-2 flex items-center gap-2 flex-shrink-0"
        style={{ boxShadow: "0 0 24px rgba(34,197,94,0.05), inset 0 0 0 1px rgba(34,197,94,0.08)" }}
      >
        <div className="flex items-center flex-shrink-0">
          <TacStat label="Revenue Nac."  value={fmtARS(totalRevenue, true)}  accent />
          <TacStat label="Cli. Activos"  value={fmtNumber(activeClients)} />
          <TacStat label="Provincias"    value={nationalTotals.provincias} />
          <TacStat label="PAM Share"     value={`${pamShare.toFixed(0)}%`}  accent />
          <TacStat label="Capas ON"      value={activeLayers} />
        </div>
        <TimeSlider
          year={selectedYear}
          setYear={setSelectedYear}
          playing={playing}
          setPlaying={setPlaying}
        />
        <div className="flex items-center gap-3 pr-2 flex-shrink-0">
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
            <span className={`w-1.5 h-1.5 rounded-full ${geoLoading ? "bg-warning-DEFAULT animate-pulse" : geoError ? "bg-danger-DEFAULT" : "bg-primary"}`}
              style={!geoLoading && !geoError ? { boxShadow: "0 0 5px rgba(34,197,94,0.8)" } : {}} />
            <span className="tactical-text">{geoLoading ? "LOADING" : geoError ? "ERROR" : "LIVE"}</span>
          </div>
          <span className="font-mono text-xs text-text-muted">{clock}</span>
          <span className="tactical-text">ARG-TZ</span>
        </div>
      </div>

      {/* ── 3-col layout ────────────────────────────────────────────── */}
      <div className="flex gap-2 flex-1 min-h-0">

        {/* Left panel */}
        <div className="w-[215px] flex-shrink-0 flex flex-col gap-2 h-full min-h-0">
          {/* Province detail panel — replaces list when province selected */}
          {selected ? (
            <div className="flex-1 min-h-0 overflow-y-auto">
              <ProvinceDetailPanel
                kpi={selected}
                metric={metric}
                onClose={() => { setSelected(null); selectedNameRef.current = null; }}
                year={selectedYear}
                allKpis={currentKpis}
              />
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto pr-0.5">
              <LeftPanel
                metric={metric} setMetric={setMetric}
                basemap={basemap} setBasemap={setBasemap}
                layers={layers} toggleLayer={toggleLayer}
                selected={selected}
                currentKpis={currentKpis}
                mode3D={mode3D} setMode3D={setMode3D}
                show3DArcs={show3DArcs} setShow3DArcs={setShow3DArcs}
                showBeams={showBeams} setShowBeams={setShowBeams}
                metric3D={metric3D} setMetric3D={setMetric3D}
                mapEngine={mapEngine} setMapEngine={setMapEngine}
                showTerrain={showTerrain} setShowTerrain={setShowTerrain}
                showSatellite={showSatellite} setShowSatellite={setShowSatellite}
                showFlows={showFlows} setShowFlows={setShowFlows}
                showVehicles={showVehicles} setShowVehicles={setShowVehicles}
                showPulse={showPulse} setShowPulse={setShowPulse}
              />
            </div>
          )}
        </div>

        {/* Center: map */}
        <div
          className="flex-1 relative rounded-xl overflow-hidden min-h-0"
          style={{ border: "1px solid rgba(34,197,94,0.12)", boxShadow: "0 0 32px rgba(34,197,94,0.04), inset 0 0 0 1px rgba(34,197,94,0.05)" }}
        >
          {/* HUD scan line */}
          <div className="scan-line pointer-events-none z-10" />

          {/* Corner brackets */}
          {[
            "top-2 left-2 border-t border-l",
            "top-2 right-2 border-t border-r",
            "bottom-2 left-2 border-b border-l",
            "bottom-2 right-2 border-b border-r",
          ].map((cls, i) => (
            <div key={i} className={`absolute w-4 h-4 ${cls} border-primary/30 z-10 pointer-events-none`} />
          ))}

          {/* Map title HUD */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[500] pointer-events-none">
            <div
              className="px-4 py-1 rounded-full flex items-center gap-2"
              style={{
                background: "rgba(7,18,9,0.75)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(34,197,94,0.18)",
                boxShadow: "0 0 16px rgba(34,197,94,0.08)",
              }}
            >
              <MapPin size={10} className="text-primary" />
              <span className="tactical-text tracking-wider">ARGENTINA · GIS HYBRID INTELLIGENCE v6.0</span>
              <span className="tactical-text opacity-50">·</span>
              <span className="font-mono font-bold" style={{ color: "#A3E635", fontSize: 11 }}>{selectedYear}</span>
              {selectedYear < YEAR_MAX && <span className="tactical-text" style={{ color: "#E8A020" }}>HISTÓRICO</span>}
              {mapEngine === "mapbox"
                ? <span className="tactical-text font-bold" style={{ color: "#A3E635" }}>MAPBOX</span>
                : mode3D && <span className="tactical-text" style={{ color: "#A3E635" }}>3D</span>
              }
              {mapEngine === "mapbox" && showTerrain   && <span className="tactical-text" style={{ color: "#22C55E" }}>TERRAIN</span>}
              {mapEngine === "mapbox" && showSatellite && <span className="tactical-text" style={{ color: "#0EA5E9" }}>SAT</span>}
              {mapEngine === "mapbox" && !isMapboxConfigured() && (
                <span className="tactical-text" style={{ color: "#E8A020" }}>NO-TOKEN</span>
              )}
              {(showFlows || showVehicles) && <span className="tactical-text" style={{ color: "#22C55E" }}>FLOWS</span>}
              <span className="tactical-text" style={{ color: "#4ADE80" }}>Sprint GIS-16</span>
            </div>
          </div>

          {/* Engine selector — floating pill top-left */}
          <div className="absolute top-3 left-3 z-[500] flex gap-1">
            {(["leaflet", "mapbox"] as MapEngine[]).map(eng => {
              const isActive  = mapEngine === eng;
              const available = eng === "leaflet" || isMapboxConfigured();
              return (
                <button
                  key={eng}
                  onClick={() => available && setMapEngine(eng)}
                  disabled={!available}
                  className="px-2 py-1 rounded font-mono transition-all"
                  style={{
                    fontSize:        10,
                    background:      isActive ? "rgba(34,197,94,0.18)" : "rgba(7,18,9,0.75)",
                    border:          `1px solid ${isActive ? "rgba(34,197,94,0.45)" : "rgba(34,197,94,0.15)"}`,
                    color:           isActive ? "#22C55E" : available ? "#4B6B4B" : "#2A4A2A",
                    backdropFilter:  "blur(8px)",
                    cursor:          available ? "pointer" : "not-allowed",
                    boxShadow:       isActive ? "0 0 10px rgba(34,197,94,0.12)" : "none",
                  }}
                >
                  {eng === "leaflet" ? "◆ LEAFLET" : "◈ MAPBOX"}
                </button>
              );
            })}
          </div>

          {/* GIS-16 Live Metrics panel — bottom-left floating */}
          {(showFlows || showVehicles) && mapEngine === "leaflet" && (
            <div className="absolute bottom-28 left-3 z-[500]">
              <LiveMetricsPanel
                routes={gisRoutes}
                sucursales={sucursales}
                playing={animPlaying}
              />
            </div>
          )}

          {/* GIS-16 Animation controls — bottom-center floating */}
          {(showFlows || showVehicles) && mapEngine === "leaflet" && (
            <div
              className="absolute bottom-10 left-1/2 -translate-x-1/2 z-[500] flex items-center gap-1"
              style={{
                background:    "rgba(7,18,9,0.82)",
                backdropFilter:"blur(12px)",
                border:        "1px solid rgba(34,197,94,0.22)",
                borderRadius:  10,
                padding:       "4px 10px",
              }}
            >
              <Gauge size={10} style={{ color: "#22C55E" }} />
              <span className="font-mono text-2xs mr-1" style={{ color: "#4B6B4B" }}>ANIM</span>
              <button
                onClick={() => setAnimPlaying(!animPlaying)}
                className="flex items-center gap-1 px-2 py-1 rounded font-mono text-2xs transition-all"
                style={{
                  background: animPlaying ? "rgba(34,197,94,0.15)" : "rgba(7,18,9,0.5)",
                  border:     `1px solid ${animPlaying ? "rgba(34,197,94,0.4)" : "rgba(34,197,94,0.12)"}`,
                  color:      animPlaying ? "#22C55E" : "#4B6B4B",
                }}
              >
                {animPlaying ? <Pause size={9} /> : <Play size={9} />}
                {animPlaying ? "PAUSE" : "PLAY"}
              </button>
              {([1, 2] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setAnimSpeed(s)}
                  className="px-2 py-1 rounded font-mono text-2xs transition-all"
                  style={{
                    background: animSpeed === s ? "rgba(163,230,53,0.12)" : "rgba(7,18,9,0.5)",
                    border:     `1px solid ${animSpeed === s ? "rgba(163,230,53,0.35)" : "rgba(34,197,94,0.10)"}`,
                    color:      animSpeed === s ? "#A3E635" : "#4B6B4B",
                  }}
                >
                  x{s}
                </button>
              ))}
            </div>
          )}

          {/* GIS status overlay (bottom-left) */}
          <div className="absolute bottom-10 left-3 z-[500] pointer-events-none flex flex-col gap-1">
            <div
              className="px-2 py-1 rounded"
              style={{ background: "rgba(7,18,9,0.75)", backdropFilter: "blur(8px)", border: "1px solid rgba(34,197,94,0.12)" }}
            >
              {mapEngine === "leaflet"
                ? <span className="tactical-text">EPSG:4326 · WGS84 · {currentBasemap}</span>
                : <span className="tactical-text">MAPBOX GL · Satellite-Streets · WGS84</span>
              }
            </div>
            {!geoLoading && !geoError && (
              <div
                className="px-2 py-1 rounded"
                style={{ background: "rgba(7,18,9,0.75)", backdropFilter: "blur(8px)", border: "1px solid rgba(34,197,94,0.10)" }}
              >
                <span className="tactical-text text-success-DEFAULT">
                  {geoData?.features?.length ?? 0} provincias · {activeLayers} capas activas
                </span>
              </div>
            )}
            {geoError && (
              <div
                className="px-2 py-1 rounded"
                style={{ background: "rgba(7,18,9,0.75)", border: "1px solid rgba(224,62,62,0.3)" }}
              >
                <span className="tactical-text text-danger-DEFAULT">GeoJSON Error: {geoError}</span>
              </div>
            )}
          </div>

          {/* Active layer badges (bottom-right, above legend) — Leaflet only */}
          {mapEngine === "leaflet" && (
            <div className="absolute bottom-24 right-3 z-[500] pointer-events-none flex flex-col gap-0.5 items-end">
              {Object.entries(layers).filter(([k, v]) => v && k !== "coords").map(([k]) => {
                const allDefs = [...ANALYSIS_LAYERS, ...TERRITORY_LAYERS, ...MARKER_LAYERS, ...GIS_OUTPUT_LAYERS];
                const def = allDefs.find(d => d.key === k);
                return (
                  <div
                    key={k}
                    className="px-1.5 py-0.5 rounded flex items-center gap-1"
                    style={{ background: "rgba(7,18,9,0.75)", border: `1px solid ${def?.color ?? "#22C55E"}30` }}
                  >
                    <span className="w-1 h-1 rounded-full" style={{ background: def?.color ?? "#22C55E" }} />
                    <span className="tactical-text text-2xs">{def?.label ?? k}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Mapbox terrain badges (bottom-right) — Mapbox engine only */}
          {mapEngine === "mapbox" && (
            <div className="absolute bottom-10 right-3 z-[500] pointer-events-none flex flex-col gap-0.5 items-end">
              {[
                { label: "Terrain 3D", active: showTerrain,   color: "#A3E635" },
                { label: "Satellite",  active: showSatellite, color: "#0EA5E9" },
                { label: "Hillshade",  active: showTerrain,   color: "#22C55E" },
                { label: "Sky Layer",  active: true,          color: "#22C55E" },
                { label: "3D Build.",  active: true,          color: "#4ADE80" },
              ].map(b => (
                <div
                  key={b.label}
                  className="px-1.5 py-0.5 rounded flex items-center gap-1"
                  style={{ background: "rgba(7,18,9,0.75)", border: `1px solid ${b.active ? b.color : "#1A3D20"}30` }}
                >
                  <span className="w-1 h-1 rounded-full" style={{ background: b.active ? b.color : "#1A3D20" }} />
                  <span className="tactical-text text-2xs" style={{ color: b.active ? b.color : "#4B6B4B" }}>{b.label}</span>
                </div>
              ))}
            </div>
          )}

          {/* Advanced legend — Leaflet only */}
          {mapEngine === "leaflet" && <MapLegendAdvanced metric={metric} layers={layers} />}

          {/* Map — Leaflet or Mapbox */}
          {mapEngine === "leaflet" ? (
            <LeafletMap
              sucursales={sucursales}
              depositos={depositos}
              clientes={clienteMarkers}
              routes={gisRoutes}
              basemap={basemap}
              showChoropleth={layers.choropleth}
              showHeatmap={layers.heatmap}
              showDepartamentos={layers.departamentos}
              showMunicipios={layers.municipios}
              showVial={layers.vial}
              showPuertos={layers.puertos}
              showSucursales={layers.sucursales}
              showDepositos={layers.depositos}
              showClientes={layers.clientes}
              showRadios={layers.radios}
              showCoords={layers.coords}
              showHotspots={layers.hotspots}
              showTerritorios={layers.territorios}
              showBuffers={layers.buffers}
              showCandidatos={layers.candidatos}
              showServiceAreas={layers.serviceareas}
              metric={metric}
              allKpis={currentKpis}
              selectedProvince={selected?.nombre ?? null}
              geoData={geoData}
              geoLoading={geoLoading}
              onProvinceClick={setSelected}
              show3D={mode3D}
              show3DArcs={show3DArcs}
              showBeams={showBeams}
              metric3D={metric3D}
              showFlows={showFlows}
              showVehicles={showVehicles}
              showPulse={showPulse}
              animPlaying={animPlaying}
              animSpeed={animSpeed}
            />
          ) : (
            <MapboxTerrainView
              geoData={geoData}
              allKpis={currentKpis}
              metric={metric}
              selectedProvince={selected?.nombre ?? null}
              onProvinceClick={setSelected}
              selectedYear={selectedYear}
              showTerrain={showTerrain}
              showSatellite={showSatellite}
            />
          )}
        </div>

        {/* Right panel */}
        <div className="w-[195px] flex-shrink-0 flex flex-col gap-2 h-full min-h-0">
          <div
            className="rounded-xl p-1 flex gap-1 flex-shrink-0"
            style={{ background: "rgba(7,18,9,0.6)", backdropFilter: "blur(8px)", border: "1px solid rgba(34,197,94,0.10)" }}
          >
            {([
              { id: "ops",      label: "Ops" },
              { id: "analytics",label: "GIS" },
              { id: "network",  label: "Net" },
              { id: "routing",  label: "Log" },
              { id: "arcgis",   label: "ArcGIS" },
              { id: "stats",    label: "Stats" },
              { id: "live",     label: "Live" },
            ] as const).map(t => (
              <button
                key={t.id}
                onClick={() => setRightTab(t.id)}
                className={`flex-1 py-1 rounded text-2xs font-mono transition-all border ${
                  rightTab === t.id
                    ? "bg-primary-dim text-primary border-primary/30"
                    : "text-text-muted border-transparent hover:text-text-secondary"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto pr-0.5">
            {rightTab === "ops"       ? <RightPanel selected={selected} layers={layers} nationalTotals={nationalTotals} lowCoverage={lowCoverage} />
              : rightTab === "analytics" ? <SpatialAnalyticsPanel />
              : rightTab === "network"   ? <NetworkIntelligencePanel />
              : rightTab === "arcgis"    ? <ArcGISPanel />
              : rightTab === "stats"     ? <MapStatisticsPanel kpis={currentKpis} nationalTotals={nationalTotals} />
              : rightTab === "live"      ? <LiveMetricsPanel routes={gisRoutes} sucursales={sucursales} playing={animPlaying} />
              : <RoutingPanel />}
          </div>
        </div>
      </div>

      {/* ── Status bar ──────────────────────────────────────────────── */}
      <div
        className="rounded-xl mt-2 px-4 py-1.5 flex items-center justify-between flex-shrink-0"
        style={{
          background: "rgba(7,18,9,0.65)",
          backdropFilter: "blur(10px)",
          border: "1px solid rgba(34,197,94,0.10)",
          boxShadow: "0 0 16px rgba(34,197,94,0.03)",
        }}
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" style={{ boxShadow: "0 0 4px rgba(34,197,94,0.7)" }} />
            <span className="tactical-text">{currentBasemap}</span>
          </div>
          <span className="tactical-text border-l border-border pl-4">IGN Argentina · INDEC 2022</span>
          <span className="tactical-text border-l border-border pl-4">529 deptos · 2.313 munic.</span>
          <span className="tactical-text border-l border-border pl-4">5 puertos · 6 rutas · 4 hotspots · 5 territorios</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="tactical-text">
            KPI: <span className="text-primary font-mono">{metric.toUpperCase()}</span>
          </span>
          <span className="tactical-text border-l border-border pl-3">
            Capas: <span className="text-primary font-mono">{activeLayers}</span>
          </span>
          <span className="tactical-text border-l border-border pl-3">
            Año: <span className="font-mono" style={{ color: "#A3E635" }}>{selectedYear}</span>
            {selectedYear < YEAR_MAX && (
              <span className="ml-1" style={{ color: "#E8A020", fontSize: 8 }}>HISTÓRICO</span>
            )}
          </span>
          <span className="tactical-text border-l border-border pl-3">
            Engine: <span className="font-mono" style={{ color: mapEngine === "mapbox" ? "#A3E635" : "#4ADE80" }}>
              {mapEngine === "mapbox" ? "MAPBOX TERRAIN" : "LEAFLET"}
            </span>
          </span>
          <span className="tactical-text border-l border-border pl-3" style={{ color: "#4ADE80" }}>
            AgroNova GIS v6.0 · Sprint GIS-16
          </span>
        </div>
      </div>
    </div>
  );
}

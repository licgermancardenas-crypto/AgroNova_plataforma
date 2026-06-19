"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Layers, MapPin, Activity, Crosshair, Radio, TrendingUp,
  AlertTriangle, ChevronLeft, ChevronRight, RefreshCw, BarChart2, Globe, Anchor, Zap, Box,
  Mountain, Play, Pause, Gauge, Command, Bookmark,
} from "lucide-react";
import type { SearchResult } from "@/components/gis/GlobalSearchBar";
import type { PaletteCommand } from "@/components/gis/CommandPalette";
import type { BookmarkEntry } from "@/components/gis/BookmarkPanel";
import { sucursales, depositos, clienteMarkers, gisRoutes } from "@/lib/mock-data";
import { fmtARS, fmtNumber } from "@/lib/formatters";
import type { ProvinceKPI, GisMetric, BasemapId, MapEngine, CameraTarget } from "@/types";
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

const SpatialDiagnosticsPanel = dynamic(
  () => import("@/components/gis/SpatialDiagnosticsPanel"),
  { ssr: false },
);

const AISpatialPanel = dynamic(
  () => import("@/components/gis/AISpatialPanel"),
  { ssr: false },
);

const EnvironmentPanel = dynamic(
  () => import("@/components/gis/EnvironmentPanel"),
  { ssr: false },
);

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

const GlobalSearchBar = dynamic(
  () => import("@/components/gis/GlobalSearchBar"),
  { ssr: false, loading: () => <div className="flex-1 max-w-[280px] h-6 rounded opacity-20" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.10)" }} /> },
);

const CommandPaletteModal = dynamic(
  () => import("@/components/gis/CommandPalette"),
  { ssr: false },
);

const MiniMap = dynamic(
  () => import("@/components/gis/MiniMap"),
  { ssr: false },
);

const BookmarkPanel = dynamic(
  () => import("@/components/gis/BookmarkPanel"),
  { ssr: false },
);

// ── Camera presets ────────────────────────────────────────────────────────────

const CAMERA_PRESETS: { id: string; label: string; camera: CameraTarget }[] = [
  { id: "argentina", label: "ARG",  camera: { center: [-64,     -38   ] as [number,number], zoom: 3.8, pitch: 45, bearing: -8,  duration: 3000 } },
  { id: "pam",       label: "PAM",  camera: { center: [-62,     -34   ] as [number,number], zoom: 5.5, pitch: 35, bearing:  0,  duration: 2500 } },
  { id: "noa",       label: "NOA",  camera: { center: [-65,     -25   ] as [number,number], zoom: 5.5, pitch: 40, bearing: 10,  duration: 2500 } },
  { id: "nea",       label: "NEA",  camera: { center: [-58,     -27   ] as [number,number], zoom: 5.5, pitch: 35, bearing: -5,  duration: 2500 } },
  { id: "cuyo",      label: "CUYO", camera: { center: [-68,     -32   ] as [number,number], zoom: 5.5, pitch: 50, bearing: 15,  duration: 2500 } },
  { id: "pat",       label: "PAT",  camera: { center: [-68,     -47   ] as [number,number], zoom: 4.5, pitch: 40, bearing: -10, duration: 3000 } },
  { id: "rosario",   label: "ROS",  camera: { center: [-60.65,  -32.95] as [number,number], zoom: 10,  pitch: 60, bearing: 20,  duration: 4000 } },
  { id: "bsas",      label: "BUE",  camera: { center: [-58.38,  -34.6 ] as [number,number], zoom: 10,  pitch: 60, bearing: -15, duration: 4000 } },
  { id: "reset",     label: "↩RST", camera: { center: [-64,     -38   ] as [number,number], zoom: 4,   pitch: 0,  bearing:  0,  duration: 2000 } },
];

// ── Tour stops ────────────────────────────────────────────────────────────────

const TOUR_STOPS: CameraTarget[] = [
  { center: [-58.38, -34.6 ] as [number,number], zoom: 9,   pitch: 60, bearing: -15, duration: 4000 },
  { center: [-64.18, -31.42] as [number,number], zoom: 9,   pitch: 55, bearing:  10, duration: 3500 },
  { center: [-60.65, -32.95] as [number,number], zoom: 9,   pitch: 55, bearing:  20, duration: 3500 },
  { center: [-65,    -25   ] as [number,number], zoom: 5.5, pitch: 45, bearing:  10, duration: 3000 },
  { center: [-68,    -47   ] as [number,number], zoom: 5,   pitch: 40, bearing: -10, duration: 3500 },
  { center: [-64,    -38   ] as [number,number], zoom: 3.8, pitch: 45, bearing:  -8, duration: 3000 },
];
const TOUR_LABELS = ["Buenos Aires", "Córdoba", "Rosario", "NOA", "Patagonia", "Argentina"];

// ── Right tabs (reused by command palette) ────────────────────────────────────

const RIGHT_TABS_LIST = [
  { id: "ops",       label: "Ops"            },
  { id: "analytics", label: "GIS Analytics"  },
  { id: "network",   label: "Network Intel"  },
  { id: "routing",   label: "Logística"      },
  { id: "arcgis",    label: "ArcGIS Live"    },
  { id: "stats",     label: "Estadísticas"   },
  { id: "live",      label: "Live Metrics"   },
  { id: "spatial",   label: "Spatial Diag."  },
  { id: "ai",        label: "AI Spatial"     },
  { id: "env",       label: "Environment"    },
] as const;

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
  { id: "osm_topo",      label: "OpenTopoMap",     dot: "#A3E635" },
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
  pitch, setPitch,
  autoRotate, setAutoRotate,
  onCameraPreset,
  currentCamera,
  onBookmarkLoad,
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
  pitch: number; setPitch: (v: number) => void;
  autoRotate: boolean; setAutoRotate: (v: boolean) => void;
  onCameraPreset: (target: CameraTarget) => void;
  currentCamera: CameraTarget;
  onBookmarkLoad: (entry: BookmarkEntry) => void;
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

      {/* ── Back to main menu ─────────────────────────────────────────── */}
      <Link
        href="/"
        className="flex items-center justify-center gap-2 w-full py-2 rounded-xl font-mono font-bold transition-all border"
        style={{
          background:    "rgba(34,197,94,0.08)",
          borderColor:   "rgba(34,197,94,0.40)",
          color:         "#86EFAC",
          fontSize:      13,
          letterSpacing: "0.08em",
          boxShadow:     "0 0 12px rgba(34,197,94,0.10)",
        }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLElement;
          el.style.background = "rgba(34,197,94,0.18)";
          el.style.borderColor = "rgba(34,197,94,0.65)";
          el.style.color = "#ffffff";
          el.style.boxShadow = "0 0 18px rgba(34,197,94,0.30)";
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLElement;
          el.style.background = "rgba(34,197,94,0.08)";
          el.style.borderColor = "rgba(34,197,94,0.40)";
          el.style.color = "#86EFAC";
          el.style.boxShadow = "0 0 12px rgba(34,197,94,0.10)";
        }}
      >
        <ChevronLeft size={14} />
        <span>VOLVER AL MENÚ</span>
      </Link>

      {/* Map Engine selector */}
      <div className="glass rounded-xl p-3">
        <p className="tactical-text mb-2 flex items-center gap-1.5">
          <Globe size={10} /><span>Motor de Mapa</span>
        </p>
        <div className="grid grid-cols-3 gap-1">
          {([
            { id: "leaflet" as MapEngine, icon: "◆", label: "LEAFLET" },
            { id: "mapbox"  as MapEngine, icon: "◈", label: "MAPBOX"  },
            { id: "earth"   as MapEngine, icon: "◉", label: "EARTH"   },
          ]).map(eng => {
            const isActive  = mapEngine === eng.id;
            const available = eng.id === "leaflet" || isMapboxConfigured();
            const accentColor = eng.id === "earth" ? "#38BDF8" : "#22C55E";
            return (
              <button
                key={eng.id}
                onClick={() => available && setMapEngine(eng.id)}
                disabled={!available}
                className="px-1.5 py-1.5 rounded text-2xs font-mono transition-all border flex flex-col items-center gap-0.5"
                style={isActive
                  ? { background: `${accentColor}18`, borderColor: `${accentColor}55`, color: accentColor, boxShadow: `0 0 8px ${accentColor}20` }
                  : available
                  ? { background: "rgba(7,18,9,0.5)", borderColor: "rgba(34,197,94,0.15)", color: "#4B6B4B" }
                  : { background: "rgba(7,18,9,0.3)", borderColor: "rgba(34,197,94,0.08)", color: "#2A4A2A", cursor: "not-allowed" }
                }
              >
                <span>{eng.icon}</span>
                <span style={{ fontSize: 7 }}>{eng.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Mapbox / Earth controls */}
      {(mapEngine === "mapbox" || mapEngine === "earth") && (
        <div className="glass rounded-xl p-3" style={{ border: `1px solid ${mapEngine === "earth" ? "rgba(56,189,248,0.18)" : "rgba(163,230,53,0.15)"}` }}>
          <p className="tactical-text mb-2 flex items-center gap-1.5">
            <Mountain size={10} />
            <span>{mapEngine === "earth" ? "Earth Mode" : "Mapbox Terrain"}</span>
          </p>
          <div className="space-y-1.5">
            <LayerBtn layerKey="terrain"   label="Terrain 3D"  color="#A3E635"
              active={showTerrain}   onToggle={() => setShowTerrain(!showTerrain)} />
            <LayerBtn layerKey="satellite" label="Satellite"   color="#0EA5E9"
              active={showSatellite} onToggle={() => setShowSatellite(!showSatellite)} />
          </div>
        </div>
      )}

      {/* GIS-23: Camera cinematics — mapbox + earth */}
      {(mapEngine === "mapbox" || mapEngine === "earth") && (
        <div className="glass rounded-xl p-3" style={{ border: `1px solid ${mapEngine === "earth" ? "rgba(56,189,248,0.15)" : "rgba(34,197,94,0.12)"}` }}>
          <p className="tactical-text mb-2 flex items-center gap-1.5">
            <Globe size={10} className={mapEngine === "earth" ? "text-sky-400" : "text-primary"} />
            <span>Cámara Cinemática</span>
          </p>

          {/* Pitch slider */}
          <div className="mb-2">
            <div className="flex justify-between items-center mb-1">
              <span className="tactical-text">Pitch</span>
              <span className="font-mono text-2xs" style={{ color: "#22C55E" }}>{pitch}°</span>
            </div>
            <input
              type="range" min={0} max={80} step={5} value={pitch}
              onChange={e => setPitch(Number(e.target.value))}
              className="w-full h-1 rounded accent-primary cursor-pointer"
            />
            <div className="flex justify-between tactical-text mt-0.5" style={{ fontSize: 7, color: "#3E5A3E" }}>
              <span>0°</span><span>Top Down → Oblicuo</span><span>80°</span>
            </div>
          </div>

          {/* Auto-rotate */}
          <LayerBtn
            layerKey="autoRotate" label="Auto-Rotación" color="#38BDF8"
            active={autoRotate} onToggle={() => setAutoRotate(!autoRotate)}
          />

          {/* Camera presets */}
          <div className="pt-2 mt-1.5 border-t border-border">
            <p className="tactical-text mb-1.5" style={{ fontSize: 8, color: "#4B6B4B" }}>Presets Cámara</p>
            <div className="grid grid-cols-3 gap-1">
              {CAMERA_PRESETS.map(p => (
                <button
                  key={p.id}
                  onClick={() => onCameraPreset(p.camera)}
                  className="px-1 py-1 rounded font-mono text-2xs transition-all border hover:border-opacity-60"
                  style={{
                    fontSize:    8,
                    background:  "rgba(7,18,9,0.6)",
                    borderColor: p.id === "reset" ? "rgba(232,160,32,0.30)" : "rgba(34,197,94,0.20)",
                    color:       p.id === "reset" ? "#E8A020" : "#7A9C7A",
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
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

      {/* GIS-24 Bookmarks */}
      {(mapEngine === "mapbox" || mapEngine === "earth") && (
        <div className="glass rounded-xl p-3" style={{ border: "1px solid rgba(34,197,94,0.12)" }}>
          <BookmarkPanel
            currentCamera={currentCamera}
            currentEngine={mapEngine}
            onLoad={onBookmarkLoad}
          />
        </div>
      )}

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
  const [rightTab,      setRightTab]      = useState<"ops" | "analytics" | "network" | "routing" | "arcgis" | "stats" | "live" | "spatial" | "ai" | "env">("ops");
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
  // GIS-23 cinematic
  const [pitch,         setPitch]         = useState(40);
  const [autoRotate,    setAutoRotate]    = useState(false);
  const [targetCamera,  setTargetCamera]  = useState<CameraTarget | null>(null);
  const [currentCamera, setCurrentCamera] = useState<CameraTarget>({ center: [-64, -38], zoom: 4, pitch: 40, bearing: -8, duration: 0 });
  // GIS-24 command center
  const [showPalette,   setShowPalette]   = useState(false);
  const [tourPlaying,   setTourPlaying]   = useState(false);
  const [tourStep,      setTourStep]      = useState(0);
  const [showMiniMap,   setShowMiniMap]   = useState(false);
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

  // GIS-23: camera preset handler (also syncs pitch + currentCamera)
  const handleCameraPreset = useCallback((target: CameraTarget) => {
    setPitch(target.pitch);
    setTargetCamera({ ...target });
    setCurrentCamera({ ...target });
  }, []);

  // GIS-23: FlyTo on province select (Mapbox + Earth engines only)
  useEffect(() => {
    if (!selected || (mapEngine !== "mapbox" && mapEngine !== "earth")) return;
    const cam: CameraTarget = {
      center:   [selected.lon, selected.lat] as [number, number],
      zoom:     mapEngine === "earth" ? 7 : 6.5,
      pitch,
      bearing:  0,
      duration: 2800,
    };
    setTargetCamera(cam);
    setCurrentCamera(cam);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.nombre, mapEngine]);

  // GIS-24: Ctrl+K command palette
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key === "k") { e.preventDefault(); setShowPalette(p => !p); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // GIS-24: Tour mode — step through stops with flyTo
  useEffect(() => {
    if (!tourPlaying) return;
    if (mapEngine === "leaflet") setMapEngine("mapbox");
    const stop = TOUR_STOPS[tourStep];
    setTargetCamera({ ...stop });
    setCurrentCamera({ ...stop });
    setPitch(stop.pitch);
    const t = setTimeout(() => {
      if (tourStep < TOUR_STOPS.length - 1) { setTourStep(s => s + 1); }
      else { setTourPlaying(false); setTourStep(0); }
    }, stop.duration + 2800);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourPlaying, tourStep]);

  // GIS-24: Global Search select handler
  const handleSearchSelect = useCallback((result: SearchResult) => {
    if (result.type === "provincia" && result.kpi) {
      setSelected(result.kpi);
      selectedNameRef.current = result.kpi.nombre;
    }
    if (mapEngine !== "leaflet") {
      const zoom = result.type === "municipio" ? 10 : result.type === "provincia" ? 6.5 : 9;
      const cam: CameraTarget = { center: [result.lon, result.lat] as [number,number], zoom, pitch, bearing: 0, duration: 2500 };
      setTargetCamera(cam);
      setCurrentCamera(cam);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapEngine, pitch]);

  // GIS-24: Bookmark load handler
  const handleBookmarkLoad = useCallback((entry: BookmarkEntry) => {
    setMapEngine(entry.engine);
    handleCameraPreset(entry.camera);
  }, [handleCameraPreset]);

  // GIS-24: Command palette commands
  const paletteCommands: PaletteCommand[] = useMemo(() => [
    ...METRICS.map(m => ({ id: `metric_${m.id}`, group: "Métrica", label: `Métrica: ${m.label}`, action: () => setMetric(m.id) })),
    { id: "engine_leaflet", group: "Motor", label: "Motor: ◆ Leaflet OSM",    description: "2D", action: () => setMapEngine("leaflet") },
    { id: "engine_mapbox",  group: "Motor", label: "Motor: ◈ Mapbox Terrain", description: "3D", action: () => setMapEngine("mapbox")  },
    { id: "engine_earth",   group: "Motor", label: "Motor: ◉ Earth Mode",     description: "Night", action: () => setMapEngine("earth") },
    ...[...ANALYSIS_LAYERS, ...TERRITORY_LAYERS, ...MARKER_LAYERS, ...GIS_OUTPUT_LAYERS].map(l => ({
      id: `layer_${l.key}`, group: "Capa", label: `Capa: ${l.label} ${layers[l.key as keyof typeof layers] ? "● ON" : "○ OFF"}`,
      action: () => toggleLayer(l.key),
    })),
    ...currentKpis.map(p => ({
      id: `prov_${p.nombre}`, group: "Provincia", label: `→ ${p.nombre}`, description: p.macro_region,
      action: () => {
        setSelected(p); selectedNameRef.current = p.nombre;
        if (mapEngine !== "leaflet") { const cam: CameraTarget = { center: [p.lon, p.lat] as [number,number], zoom: 6.5, pitch, bearing: 0, duration: 2500 }; setTargetCamera(cam); setCurrentCamera(cam); }
      },
    })),
    ...RIGHT_TABS_LIST.map(t => ({ id: `tab_${t.id}`, group: "Panel", label: `Panel: ${t.label}`, action: () => setRightTab(t.id) })),
    ...CAMERA_PRESETS.map(p => ({ id: `cam_${p.id}`, group: "Cámara", label: `Cámara: ${p.id.replace("_"," ").toUpperCase()}`, action: () => handleCameraPreset(p.camera) })),
    { id: "tour_start", group: "Tour", label: "▶ Iniciar Tour Cinematográfico", description: "6 paradas",   action: () => { setTourPlaying(true); setTourStep(0); } },
    { id: "tour_stop",  group: "Tour", label: "⏹ Detener Tour",                 description: "terminar",    action: () => { setTourPlaying(false); setTourStep(0); } },
    { id: "minimap_toggle", group: "Vista", label: `${showMiniMap ? "Ocultar" : "Mostrar"} Minimapa`, action: () => setShowMiniMap(v => !v) },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [metric, mapEngine, layers, currentKpis, pitch, showMiniMap]);

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
    <div className="fixed inset-0 flex flex-col overflow-hidden animate-fade-in">

      {/* ── Tactical header ────────────────────────────────────────── */}
      <div
        className="glass rounded-xl mx-2 mt-1.5 px-2 flex items-center gap-2 flex-shrink-0"
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

        {/* GIS-24: Global Search */}
        <GlobalSearchBar
          provinces={currentKpis}
          sucursales={sucursales}
          depositos={depositos}
          onSelect={handleSearchSelect}
        />

        {/* GIS-24: ⌘K command palette button */}
        <button
          onClick={() => setShowPalette(true)}
          className="flex items-center gap-1 px-2 py-1 rounded font-mono transition-all border flex-shrink-0"
          style={{ fontSize: 10, background: "rgba(7,18,9,0.6)", borderColor: "rgba(34,197,94,0.20)", color: "#4B6B4B" }}
          title="Command Palette (Ctrl+K)"
        >
          <Command size={9} />
          <span>⌘K</span>
        </button>

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
      <div className="flex gap-2 flex-1 min-h-0 px-2 pt-1.5 pb-1.5">

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
                pitch={pitch} setPitch={setPitch}
                autoRotate={autoRotate} setAutoRotate={setAutoRotate}
                onCameraPreset={handleCameraPreset}
                currentCamera={currentCamera}
                onBookmarkLoad={handleBookmarkLoad}
              />
            </div>
          )}
        </div>

        {/* Center: map */}
        <div
          className="flex-1 flex flex-col relative rounded-xl overflow-hidden min-h-0"
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
                background:     mapEngine === "earth" ? "rgba(5,8,20,0.82)" : "rgba(7,18,9,0.75)",
                backdropFilter: "blur(14px)",
                border:         `1px solid ${mapEngine === "earth" ? "rgba(56,189,248,0.22)" : "rgba(34,197,94,0.18)"}`,
                boxShadow:      mapEngine === "earth"
                  ? "0 0 20px rgba(56,189,248,0.12), 0 0 40px rgba(56,189,248,0.04)"
                  : "0 0 16px rgba(34,197,94,0.08)",
              }}
            >
              <MapPin size={10} className={mapEngine === "earth" ? "text-sky-400" : "text-primary"} />
              <span className="tactical-text tracking-wider">ARGENTINA · GIS HYBRID INTELLIGENCE v9.0</span>
              <span className="tactical-text opacity-50">·</span>
              <span className="font-mono font-bold" style={{ color: "#A3E635", fontSize: 11 }}>{selectedYear}</span>
              {selectedYear < YEAR_MAX && <span className="tactical-text" style={{ color: "#E8A020" }}>HISTÓRICO</span>}
              {mapEngine === "earth" && (
                <span className="font-mono font-bold" style={{ color: "#38BDF8", fontSize: 10, textShadow: "0 0 8px rgba(56,189,248,0.6)" }}>◉ EARTH</span>
              )}
              {mapEngine === "mapbox" && (
                <span className="tactical-text font-bold" style={{ color: "#A3E635" }}>◈ MAPBOX</span>
              )}
              {mapEngine === "leaflet" && mode3D && <span className="tactical-text" style={{ color: "#A3E635" }}>3D</span>}
              {(mapEngine === "mapbox" || mapEngine === "earth") && showTerrain   && <span className="tactical-text" style={{ color: "#22C55E" }}>TERRAIN</span>}
              {(mapEngine === "mapbox" || mapEngine === "earth") && showSatellite && <span className="tactical-text" style={{ color: "#0EA5E9" }}>SAT</span>}
              {(mapEngine === "mapbox" || mapEngine === "earth") && autoRotate    && <span className="tactical-text" style={{ color: "#38BDF8" }}>↻ SPIN</span>}
              {(mapEngine === "mapbox" || mapEngine === "earth") && !isMapboxConfigured() && (
                <span className="tactical-text" style={{ color: "#E8A020" }}>NO-TOKEN</span>
              )}
              {(showFlows || showVehicles) && <span className="tactical-text" style={{ color: "#22C55E" }}>FLOWS</span>}
              <span className="tactical-text" style={{ color: "#4ADE80" }}>GIS-23</span>
            </div>
          </div>

          {/* Engine selector + Tour + MiniMap toggle — floating top-left */}
          <div className="absolute top-3 left-3 z-[500] flex gap-1 flex-wrap">
            {([
              { id: "leaflet" as MapEngine, label: "◆ LEAFLET", accent: "#22C55E" },
              { id: "mapbox"  as MapEngine, label: "◈ MAPBOX",  accent: "#22C55E" },
              { id: "earth"   as MapEngine, label: "◉ EARTH",   accent: "#38BDF8" },
            ]).map(eng => {
              const isActive  = mapEngine === eng.id;
              const available = eng.id === "leaflet" || isMapboxConfigured();
              return (
                <button
                  key={eng.id}
                  onClick={() => available && setMapEngine(eng.id)}
                  disabled={!available}
                  className="px-2 py-1 rounded font-mono transition-all"
                  style={{
                    fontSize:        10,
                    background:      isActive ? `${eng.accent}20` : "rgba(7,18,9,0.75)",
                    border:          `1px solid ${isActive ? `${eng.accent}55` : "rgba(34,197,94,0.15)"}`,
                    color:           isActive ? eng.accent : available ? "#4B6B4B" : "#2A4A2A",
                    backdropFilter:  "blur(8px)",
                    cursor:          available ? "pointer" : "not-allowed",
                    boxShadow:       isActive ? `0 0 10px ${eng.accent}20` : "none",
                  }}
                >
                  {eng.label}
                </button>
              );
            })}

            {/* GIS-24: Tour button */}
            {mapEngine !== "leaflet" && (
              <button
                onClick={() => { if (tourPlaying) { setTourPlaying(false); setTourStep(0); } else { setTourPlaying(true); setTourStep(0); } }}
                className="px-2 py-1 rounded font-mono transition-all"
                style={{
                  fontSize:       10,
                  background:     tourPlaying ? "rgba(249,115,22,0.20)" : "rgba(7,18,9,0.75)",
                  border:         `1px solid ${tourPlaying ? "rgba(249,115,22,0.50)" : "rgba(34,197,94,0.15)"}`,
                  color:          tourPlaying ? "#F97316" : "#4B6B4B",
                  backdropFilter: "blur(8px)",
                  minWidth:       70,
                }}
              >
                {tourPlaying ? `⏸ ${TOUR_LABELS[tourStep]}` : "▶ TOUR"}
              </button>
            )}

            {/* GIS-24: MiniMap toggle */}
            <button
              onClick={() => setShowMiniMap(v => !v)}
              className="px-2 py-1 rounded font-mono transition-all"
              style={{
                fontSize:       10,
                background:     showMiniMap ? "rgba(34,197,94,0.15)" : "rgba(7,18,9,0.75)",
                border:         `1px solid ${showMiniMap ? "rgba(34,197,94,0.45)" : "rgba(34,197,94,0.15)"}`,
                color:          showMiniMap ? "#22C55E" : "#4B6B4B",
                backdropFilter: "blur(8px)",
              }}
              title="Minimapa"
            >
              <Bookmark size={9} />
            </button>
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
              style={{ background: "rgba(7,18,9,0.75)", backdropFilter: "blur(8px)", border: `1px solid ${mapEngine === "earth" ? "rgba(56,189,248,0.15)" : "rgba(34,197,94,0.12)"}` }}
            >
              {mapEngine === "leaflet"
                ? <span className="tactical-text">EPSG:4326 · WGS84 · {currentBasemap}</span>
                : mapEngine === "earth"
                ? <span className="tactical-text" style={{ color: "#38BDF8" }}>◉ EARTH · Mapbox GL · Night Mode · WGS84</span>
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

          {/* Mapbox / Earth terrain badges (bottom-right) */}
          {(mapEngine === "mapbox" || mapEngine === "earth") && (
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

          {/* GIS-24: MiniMap */}
          {showMiniMap && (
            <div className="absolute top-14 right-3 z-[490] pointer-events-auto">
              <MiniMap
                allKpis={currentKpis}
                metric={metric}
                selectedProvince={selected?.nombre ?? null}
                onProvinceClick={setSelected}
              />
            </div>
          )}

          {/* Advanced legend — Leaflet only */}
          {mapEngine === "leaflet" && <MapLegendAdvanced metric={metric} layers={layers} />}

          {/* Map — flex-1 wrapper ensures it fills all remaining vertical space */}
          <div className="flex-1 min-h-0 relative">
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
                engineMode={mapEngine as "mapbox" | "earth"}
                pitch={pitch}
                autoRotate={autoRotate}
                targetCamera={targetCamera}
              />
            )}
          </div>
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
              { id: "spatial",  label: "Spatial" },
              { id: "ai",       label: "AI" },
              { id: "env",      label: "Env" },
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
              : rightTab === "spatial"   ? <SpatialDiagnosticsPanel />
              : rightTab === "ai"        ? <AISpatialPanel />
              : rightTab === "env"       ? <EnvironmentPanel />
              : <RoutingPanel />}
          </div>
        </div>
      </div>

      {/* GIS-24: Command Palette overlay */}
      {showPalette && (
        <CommandPaletteModal
          commands={paletteCommands}
          onClose={() => setShowPalette(false)}
        />
      )}

      {/* ── Command Center Footer ────────────────────────────────────── */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-3 gap-1 overflow-hidden"
        style={{
          height: 28,
          background: "rgba(4,10,5,0.95)",
          backdropFilter: "blur(12px)",
          borderTop: "1px solid rgba(34,197,94,0.12)",
          boxShadow: "0 -4px 16px rgba(0,0,0,0.4)",
        }}
      >
        <div className="flex items-center overflow-hidden min-w-0">
          {([
            { v: currentBasemap.toUpperCase(), c: "#22C55E" },
            { v: "EPSG:4326 · WGS84",         c: "#3E5A3E" },
            { v: "IGN ARGENTINA",              c: "#3E5A3E" },
            { v: "529 DEPTOS",                 c: "#3E5A3E" },
            { v: "2.313 MUNIC.",               c: "#3E5A3E" },
            { v: "5 PUERTOS",                  c: "#3E5A3E" },
          ] as const).map(({ v, c }, i) => (
            <div key={i} className="flex items-center flex-shrink-0">
              {i > 0 && <span className="inline-block w-px h-3 bg-border mx-2 flex-shrink-0" />}
              <span className="tactical-text" style={{ color: c }}>{v}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center flex-shrink-0">
          {([
            { v: `KPI · ${metric.toUpperCase()}`,                               c: "#22C55E" },
            { v: `CAPAS · ${activeLayers}`,                                     c: "#3E5A3E" },
            { v: selectedYear < YEAR_MAX ? `${selectedYear} ★ HIST` : String(selectedYear), c: selectedYear < YEAR_MAX ? "#E8A020" : "#3E5A3E" },
            { v: mapEngine === "earth" ? "◉ EARTH MODE" : mapEngine === "mapbox" ? "MAPBOX TERRAIN" : "LEAFLET OSM", c: mapEngine === "earth" ? "#38BDF8" : "#3E5A3E" },
            { v: "GIS v9.1 · GIS-20.1",                                          c: "#4ADE80" },
          ] as const).map(({ v, c }, i) => (
            <div key={i} className="flex items-center flex-shrink-0">
              {i > 0 && <span className="inline-block w-px h-3 bg-border mx-2 flex-shrink-0" />}
              <span className="tactical-text" style={{ color: c }}>{v}</span>
            </div>
          ))}
          <span className="inline-block w-px h-3 bg-border mx-2 flex-shrink-0" />
          <div className="flex items-center gap-1 flex-shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" style={{ boxShadow: "0 0 5px rgba(34,197,94,0.9)" }} />
            <span className="tactical-text" style={{ color: "#22C55E" }}>LIVE</span>
          </div>
        </div>
      </div>
    </div>
  );
}

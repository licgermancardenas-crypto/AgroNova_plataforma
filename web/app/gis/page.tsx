"use client";

import dynamic from "next/dynamic";
import { useState, useEffect } from "react";
import { Layers, Route, MapPin, Activity, AlertTriangle, Crosshair, Radio, Zap, TrendingUp } from "lucide-react";
import { sucursales, depositos, clienteMarkers, provinceHeat, gisRoutes } from "@/lib/mock-data";
import { fmtARS, fmtNumber } from "@/lib/formatters";
import type { ProvinceHeat } from "@/types";

const LeafletMap = dynamic(() => import("@/components/map/LeafletMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center text-text-muted tactical-text">
      Cargando mapa…
    </div>
  ),
});

// ── Tactical stat chip ────────────────────────────────────────────────────────
function TacStat({ label, value, unit = "", accent = false }: {
  label: string; value: string | number; unit?: string; accent?: boolean;
}) {
  return (
    <div className="flex flex-col items-center px-4 py-1 border-r border-border last:border-0">
      <span className="tactical-text mb-0.5">{label}</span>
      <span className={`font-mono text-sm font-semibold ${accent ? "text-primary" : "text-text-primary"}`}>
        {value}<span className="text-text-muted text-xs ml-0.5">{unit}</span>
      </span>
    </div>
  );
}

// ── Left panel ────────────────────────────────────────────────────────────────
function LeftPanel({
  showHeat, setShowHeat, showRoutes, setShowRoutes,
  showClientes, setShowClientes, showRadios, setShowRadios, selected,
}: {
  showHeat: boolean; setShowHeat: (v: boolean) => void;
  showRoutes: boolean; setShowRoutes: (v: boolean) => void;
  showClientes: boolean; setShowClientes: (v: boolean) => void;
  showRadios: boolean; setShowRadios: (v: boolean) => void;
  selected: ProvinceHeat | null;
}) {
  const layers = [
    { label: "Calor Provincias", active: showHeat,     toggle: () => setShowHeat(!showHeat),           color: "#22C55E" },
    { label: "Rutas Logísticas", active: showRoutes,   toggle: () => setShowRoutes(!showRoutes),       color: "#A3E635" },
    { label: "Clientes",         active: showClientes, toggle: () => setShowClientes(!showClientes),   color: "#0DB87E" },
    { label: "Radios Cobertura", active: showRadios,   toggle: () => setShowRadios(!showRadios),       color: "#E8A020" },
  ];

  return (
    <div className="flex flex-col gap-3 h-full overflow-y-auto">
      {/* Layer toggles */}
      <div className="glass rounded-xl p-3">
        <p className="tactical-text mb-3 flex items-center gap-1.5">
          <Layers size={10} /><span>Capas</span>
        </p>
        <div className="space-y-2">
          {layers.map(l => (
            <button key={l.label} onClick={l.toggle}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-all
                ${l.active
                  ? "bg-primary-dim border border-primary/30 text-text-primary"
                  : "bg-bg-elevated border border-border text-text-muted hover:border-border-accent"}`}>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: l.active ? l.color : "#3E5A3E" }} />
                <span>{l.label}</span>
              </div>
              <span className={`text-2xs font-mono ${l.active ? "text-primary" : "text-text-muted"}`}>
                {l.active ? "ON" : "OFF"}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Sucursales */}
      <div className="glass rounded-xl p-3">
        <p className="tactical-text mb-2.5 flex items-center gap-1.5">
          <Crosshair size={10} /><span>Sucursales</span>
        </p>
        <div className="space-y-2">
          {sucursales.map(s => (
            <div key={s.id} className="flex items-center justify-between text-2xs">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <span className="text-text-secondary truncate max-w-[90px]">{s.nombre}</span>
              </div>
              <span className="font-mono text-primary">{s.clientes}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Selected province */}
      {selected && (
        <div className="glass rounded-xl p-3 border border-primary/30">
          <p className="tactical-text mb-2 flex items-center gap-1.5">
            <Activity size={10} /><span>Selección</span>
          </p>
          <p className="text-xs text-text-primary font-semibold mb-2">{selected.nombre}</p>
          <div className="space-y-1.5 text-2xs">
            <div className="flex justify-between">
              <span className="text-text-muted">Revenue</span>
              <span className="font-mono text-primary">{fmtARS(selected.revenue_ars, true)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Partic.</span>
              <span className="font-mono text-cyan-brand">{selected.revenue_pct}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Clientes</span>
              <span className="font-mono text-text-primary">{selected.clientes}</span>
            </div>
          </div>
        </div>
      )}

      {/* Route legend */}
      <div className="glass rounded-xl p-3">
        <p className="tactical-text mb-2.5 flex items-center gap-1.5">
          <Route size={10} /><span>Rutas</span>
        </p>
        <div className="space-y-2">
          {gisRoutes.map(r => (
            <div key={r.id} className="flex items-center gap-2 text-2xs">
              <div className="w-8 h-0.5 flex-shrink-0"
                style={{ background: r.activo ? r.color : "#3E5A3E", opacity: r.activo ? 1 : 0.4 }} />
              <span className={`truncate ${r.activo ? "text-text-secondary" : "text-text-muted"}`}>
                {r.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Right panel ───────────────────────────────────────────────────────────────
function RightPanel() {
  const top5 = provinceHeat.slice(0, 5);
  return (
    <div className="flex flex-col gap-3 h-full overflow-y-auto">
      {/* Province table */}
      <div className="glass rounded-xl p-3">
        <p className="tactical-text mb-2.5 flex items-center gap-1.5">
          <TrendingUp size={10} /><span>Top Provincias</span>
        </p>
        <div className="space-y-2">
          {top5.map((p, i) => (
            <div key={p.nombre}>
              <div className="flex justify-between text-2xs mb-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-text-muted w-3">{i + 1}</span>
                  <span className="text-text-secondary truncate max-w-[72px]">{p.nombre}</span>
                </div>
                <span className="font-mono text-primary">{p.revenue_pct}%</span>
              </div>
              <div className="h-1 bg-bg-elevated rounded-full overflow-hidden">
                <div className="h-full rounded-full"
                  style={{ width: `${(p.revenue_pct / top5[0].revenue_pct) * 100}%`, background: "#22C55E", opacity: 0.7 }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Depot occupancy */}
      <div className="glass rounded-xl p-3">
        <p className="tactical-text mb-2.5 flex items-center gap-1.5">
          <Radio size={10} /><span>Depósitos</span>
        </p>
        <div className="space-y-2.5">
          {depositos.map(d => {
            const c = d.ocupacion_pct > 85 ? "#E03E3E" : d.ocupacion_pct > 70 ? "#E8A020" : "#22C55E";
            return (
              <div key={d.id}>
                <div className="flex justify-between text-2xs mb-1">
                  <span className="text-text-secondary truncate max-w-[90px]">
                    {d.nombre.replace("Depósito ", "")}
                  </span>
                  <span className="font-mono font-bold" style={{ color: c }}>{d.ocupacion_pct}%</span>
                </div>
                <div className="h-1.5 bg-bg-elevated rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${d.ocupacion_pct}%`, background: c }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active routes */}
      <div className="glass rounded-xl p-3">
        <p className="tactical-text mb-2.5 flex items-center gap-1.5">
          <Zap size={10} /><span>Rutas Activas</span>
        </p>
        <div className="space-y-2">
          {gisRoutes.filter(r => r.activo).map(r => (
            <div key={r.id} className="flex justify-between text-2xs">
              <span className="text-text-secondary truncate max-w-[90px]">{r.label}</span>
              <span className="font-mono text-primary">{r.toneladas_mes?.toLocaleString()}t</span>
            </div>
          ))}
          {gisRoutes.some(r => !r.activo) && (
            <p className="text-2xs text-text-muted">+{gisRoutes.filter(r => !r.activo).length} inactiva(s)</p>
          )}
        </div>
      </div>

      {/* GIS alerts */}
      <div className="glass rounded-xl p-3">
        <p className="tactical-text mb-2.5 flex items-center gap-1.5">
          <AlertTriangle size={10} /><span>Alertas GIS</span>
        </p>
        <div className="space-y-2">
          {[
            { msg: "Depósito Salta 91% cap.", c: "#E03E3E" },
            { msg: "OTIF NEA bajo target",    c: "#E8A020" },
            { msg: "Ruta Mendoza inactiva",   c: "#E8A020" },
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
  const [showHeat,     setShowHeat]     = useState(true);
  const [showRoutes,   setShowRoutes]   = useState(true);
  const [showClientes, setShowClientes] = useState(true);
  const [showRadios,   setShowRadios]   = useState(false);
  const [selected,     setSelected]     = useState<ProvinceHeat | null>(null);
  const [clock,        setClock]        = useState("");

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString("es-AR", { hour12: false }));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  const totalRevenue  = provinceHeat.reduce((s, p) => s + p.revenue_ars, 0);
  const totalClientes = provinceHeat.reduce((s, p) => s + p.clientes, 0);
  const activeRoutes  = gisRoutes.filter(r => r.activo).length;

  return (
    <div className="flex flex-col h-[calc(100vh-76px)] animate-fade-in gap-0 -m-5 p-5 pt-3">

      {/* Tactical header */}
      <div className="glass rounded-xl mb-2 px-2 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center">
          <TacStat label="Provincias"    value={provinceHeat.length} />
          <TacStat label="Revenue"       value={fmtARS(totalRevenue, true)} accent />
          <TacStat label="Clientes Mapa" value={fmtNumber(totalClientes)} />
          <TacStat label="Rutas Activas" value={activeRoutes} unit={`/${gisRoutes.length}`} accent />
          <TacStat label="Sucursales"    value={sucursales.length} />
          <TacStat label="Depósitos"     value={depositos.length} />
        </div>
        <div className="flex items-center gap-3 pr-2">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary blink" />
            <span className="tactical-text">LIVE</span>
          </div>
          <span className="font-mono text-xs text-text-muted">{clock}</span>
          <span className="tactical-text">ARG-TZ</span>
        </div>
      </div>

      {/* 3-col layout */}
      <div className="flex gap-2 flex-1 min-h-0">

        {/* Left panel — 200px */}
        <div className="w-[200px] flex-shrink-0">
          <LeftPanel
            showHeat={showHeat}         setShowHeat={setShowHeat}
            showRoutes={showRoutes}     setShowRoutes={setShowRoutes}
            showClientes={showClientes} setShowClientes={setShowClientes}
            showRadios={showRadios}     setShowRadios={setShowRadios}
            selected={selected}
          />
        </div>

        {/* Center: map */}
        <div className="flex-1 relative rounded-xl overflow-hidden border border-border glass-elevated min-h-0">
          {/* HUD scan line */}
          <div className="scan-line pointer-events-none z-10" />

          {/* Corner brackets */}
          {["top-2 left-2 border-t border-l", "top-2 right-2 border-t border-r",
            "bottom-2 left-2 border-b border-l", "bottom-2 right-2 border-b border-r",
          ].map((cls, i) => (
            <div key={i} className={`absolute w-4 h-4 ${cls} border-primary/40 z-10 pointer-events-none`} />
          ))}

          {/* Map label */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
            <div className="glass px-3 py-1 rounded-full flex items-center gap-2">
              <MapPin size={10} className="text-primary" />
              <span className="tactical-text">ARGENTINA · ANÁLISIS GEOESPACIAL</span>
            </div>
          </div>

          {/* Coordinate overlay */}
          <div className="absolute bottom-10 left-3 z-10 pointer-events-none">
            <div className="glass px-2 py-1 rounded">
              <span className="tactical-text">34°00′S · 64°00′O · EPSG:4326</span>
            </div>
          </div>

          {/* Status indicator */}
          <div className="absolute bottom-10 right-12 z-10 pointer-events-none">
            <div className="glass px-2 py-1 rounded flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-success-DEFAULT" />
              <span className="tactical-text">TILES OK</span>
            </div>
          </div>

          <LeafletMap
            sucursales={sucursales}
            depositos={depositos}
            clientes={clienteMarkers}
            provinceHeat={showHeat ? provinceHeat : []}
            routes={showRoutes ? gisRoutes : []}
            showRadios={showRadios}
            showClientes={showClientes}
            showHeat={showHeat}
            showRoutes={showRoutes}
          />
        </div>

        {/* Right panel — 180px */}
        <div className="w-[180px] flex-shrink-0">
          <RightPanel />
        </div>
      </div>

      {/* Status bar */}
      <div className="glass rounded-xl mt-2 px-4 py-1.5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            <span className="tactical-text">CartoDB Dark Matter</span>
          </div>
          <span className="tactical-text border-l border-border pl-4">Zoom Nacional z5</span>
          <span className="tactical-text border-l border-border pl-4">Datos: 2026-06-15</span>
        </div>
        <div className="flex items-center gap-2">
          {showHeat    && <span className="text-2xs px-1.5 py-0.5 rounded bg-primary-dim text-primary border border-primary/20">Calor</span>}
          {showRoutes  && <span className="text-2xs px-1.5 py-0.5 rounded bg-cyan-glow text-cyan-brand border border-cyan-brand/20">Rutas</span>}
          {showClientes && <span className="text-2xs px-1.5 py-0.5 rounded bg-success-bg text-success-DEFAULT border border-success-DEFAULT/20">Clientes</span>}
          {showRadios  && <span className="text-2xs px-1.5 py-0.5 rounded bg-warning-bg text-warning-DEFAULT border border-warning-DEFAULT/20">Radios</span>}
          <span className="tactical-text border-l border-border pl-3">AgroNova GIS v1.0</span>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Zap, MapPin, Globe, CheckCircle, Clock, Lock } from "lucide-react";
import type { ArcGISStatus } from "@/app/api/arcgis/status/route";

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusDot({ ok, pending = false }: { ok: boolean; pending?: boolean }) {
  if (pending) {
    return (
      <span className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ background: "#4B6B4B", border: "1px solid #3E5A3E" }} />
    );
  }
  return (
    <span
      className="w-2 h-2 rounded-full flex-shrink-0"
      style={{
        background:  ok ? "#22C55E" : "#E8A020",
        boxShadow:   ok ? "0 0 5px rgba(34,197,94,0.7)" : "0 0 5px rgba(232,160,32,0.5)",
      }}
    />
  );
}

function CapabilityRow({
  label, active, future = false,
}: {
  label: string; active: boolean; future?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-2xs py-1 border-b border-border last:border-0">
      <div className="flex items-center gap-1.5">
        {future
          ? <Lock size={8} className="text-text-muted flex-shrink-0" />
          : <StatusDot ok={active} />}
        <span className={future ? "text-text-muted" : active ? "text-text-secondary" : "text-text-muted"}>
          {label}
        </span>
      </div>
      <span
        className="font-mono"
        style={{
          color: future ? "#3E5A3E" : active ? "#22C55E" : "#E8A020",
          fontSize: 9,
        }}
      >
        {future ? "FUTURO" : active ? "OK" : "PENDIENTE"}
      </span>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function ArcGISPanel() {
  const [status,  setStatus]  = useState<ArcGISStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    fetch("/api/arcgis/status")
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d: ArcGISStatus) => { setStatus(d); setLoading(false); })
      .catch((e: Error) => { setError(e.message); setLoading(false); });
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="flex flex-col gap-2 h-full overflow-y-auto pr-0.5">

      {/* Header card */}
      <div
        className="glass rounded-xl p-3"
        style={{ boxShadow: "0 0 16px rgba(34,197,94,0.04)" }}
      >
        <div className="flex items-center justify-between mb-2">
          <p className="tactical-text flex items-center gap-1.5">
            <Globe size={10} /><span>ArcGIS REST API</span>
          </p>
          <button onClick={load} className="text-text-muted hover:text-primary transition-colors">
            <RefreshCw size={9} className={loading ? "animate-spin text-primary" : ""} />
          </button>
        </div>

        {loading && (
          <div className="flex items-center gap-2 py-2">
            <div className="w-3 h-3 border border-primary/40 border-t-primary rounded-full animate-spin" />
            <span className="tactical-text">Verificando estado…</span>
          </div>
        )}

        {error && !loading && (
          <div className="text-2xs text-danger-DEFAULT font-mono">{error}</div>
        )}

        {status && !loading && (
          <>
            {/* Mode badge */}
            <div
              className="flex items-center gap-2 px-2 py-1.5 rounded mb-2"
              style={{
                background:   status.configured ? "rgba(34,197,94,0.08)" : "rgba(232,160,32,0.08)",
                border:       `1px solid ${status.configured ? "rgba(34,197,94,0.25)" : "rgba(232,160,32,0.25)"}`,
              }}
            >
              <StatusDot ok={status.configured} />
              <span className="text-2xs font-mono font-bold" style={{ color: status.configured ? "#22C55E" : "#E8A020" }}>
                {status.configured ? "ARCGIS LIVE" : "MODO LOCAL"}
              </span>
            </div>

            {/* Message */}
            <p className="tactical-text leading-relaxed" style={{ fontSize: 9 }}>
              {status.message}
            </p>
          </>
        )}
      </div>

      {/* Geocoding */}
      {status && (
        <div className="glass rounded-xl p-3">
          <p className="tactical-text mb-2.5 flex items-center gap-1.5">
            <MapPin size={10} /><span>Geocoding</span>
          </p>
          <div className="space-y-2 text-2xs">
            <div className="flex justify-between">
              <span className="text-text-muted">Estado</span>
              <span className="font-mono text-success-DEFAULT">Activo</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Fuente</span>
              <span className="font-mono" style={{ color: status.configured ? "#22C55E" : "#E8A020" }}>
                {status.configured ? "ArcGIS World" : "Local (INDEC)"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Cobertura</span>
              <span className="font-mono text-text-secondary">Argentina</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Test</span>
              <span className="font-mono text-text-secondary text-2xs">"Rosario, Santa Fe"</span>
            </div>
          </div>

          {/* Test result card */}
          <div
            className="mt-2.5 rounded p-2"
            style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)" }}
          >
            <p style={{ fontSize: 9, color: "#4ADE80", fontFamily: "monospace" }}>
              Rosario, Santa Fe
            </p>
            <p style={{ fontSize: 9, color: "#7A9C7A", fontFamily: "monospace" }}>
              lat: -32.9468 · lon: -60.6393
            </p>
            <p style={{ fontSize: 9, color: "#7A9C7A", fontFamily: "monospace" }}>
              score: 85 · source: {status.configured ? "arcgis" : "local"}
            </p>
          </div>
        </div>
      )}

      {/* Service Areas */}
      {status && (
        <div className="glass rounded-xl p-3">
          <p className="tactical-text mb-2.5 flex items-center gap-1.5">
            <Zap size={10} /><span>Service Areas</span>
          </p>
          <div className="space-y-2 text-2xs">
            <div className="flex justify-between">
              <span className="text-text-muted">Polígonos</span>
              <span className="font-mono text-primary">{status.service_areas}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Instalaciones</span>
              <span className="font-mono text-text-secondary">5 sucursales</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Breaks</span>
              <span className="font-mono text-text-secondary">30 / 60 / 120 min</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Archivo</span>
              <span className="font-mono text-text-muted" style={{ fontSize: 9 }}>service_areas_all.geojson</span>
            </div>
          </div>

          {/* Break color legend */}
          <div className="mt-2.5 space-y-1">
            {[
              { min: 30,  color: "#22C55E", label: "30 min drive" },
              { min: 60,  color: "#E8A020", label: "60 min drive" },
              { min: 120, color: "#E03E3E", label: "120 min drive" },
            ].map(b => (
              <div key={b.min} className="flex items-center gap-2 text-2xs">
                <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                  style={{ background: `${b.color}30`, border: `1px solid ${b.color}` }} />
                <span className="text-text-muted">{b.label}</span>
                <span className="ml-auto font-mono" style={{ color: b.color, fontSize: 9 }}>{b.min} min</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Capabilities */}
      {status && (
        <div className="glass rounded-xl p-3">
          <p className="tactical-text mb-2 flex items-center gap-1.5">
            <CheckCircle size={10} /><span>Capacidades GIS-09</span>
          </p>
          <div>
            <CapabilityRow label="Geocoding"       active={status.capabilities.geocoding} />
            <CapabilityRow label="Routing"         active={status.capabilities.routing} />
            <CapabilityRow label="Service Areas"   active={status.capabilities.service_areas} />
            <CapabilityRow label="Isochrones"      active={status.capabilities.isochrones} />
            <CapabilityRow label="Feature Layers"  active={status.capabilities.feature_layers} future />
            <CapabilityRow label="Scene View 3D"   active={status.capabilities.scene_view}    future />
            <CapabilityRow label="Offline Maps"    active={status.capabilities.offline_maps}  future />
          </div>
        </div>
      )}

      {/* Roadmap */}
      <div className="glass rounded-xl p-3">
        <p className="tactical-text mb-2 flex items-center gap-1.5">
          <Clock size={10} /><span>Roadmap ArcGIS</span>
        </p>
        <div className="space-y-2">
          {[
            { sprint: "GIS-09", label: "Backend + API status",    done: true  },
            { sprint: "GIS-10", label: "Dibujar isochrones mapa", done: false },
            { sprint: "GIS-11", label: "ArcGIS JS SDK (WebMap)",  done: false },
            { sprint: "GIS-12", label: "Feature Layers vivos",    done: false },
            { sprint: "GIS-13", label: "Scene View 3D",           done: false },
            { sprint: "GIS-14", label: "Offline / mobile maps",   done: false },
          ].map(item => (
            <div key={item.sprint} className="flex items-center gap-2 text-2xs">
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{
                  background:  item.done ? "#22C55E" : "#1A3D20",
                  boxShadow:   item.done ? "0 0 4px rgba(34,197,94,0.6)" : "none",
                  border:      item.done ? "none" : "1px solid #3E5A3E",
                }}
              />
              <span className="font-mono" style={{ color: "#4ADE80", fontSize: 9 }}>{item.sprint}</span>
              <span className={item.done ? "text-text-secondary" : "text-text-muted"}>{item.label}</span>
              {item.done && <span className="ml-auto font-mono" style={{ color: "#22C55E", fontSize: 9 }}>✓</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Configuration hint */}
      {status && !status.configured && (
        <div
          className="glass rounded-xl p-3"
          style={{ border: "1px solid rgba(232,160,32,0.2)" }}
        >
          <p className="tactical-text mb-2" style={{ color: "#E8A020" }}>Activar API Live</p>
          <div className="space-y-1" style={{ fontSize: 9, fontFamily: "monospace", color: "#7A9C7A" }}>
            <p>Agregar en .env.local:</p>
            <div
              className="rounded p-1.5 mt-1"
              style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(34,197,94,0.12)" }}
            >
              <p style={{ color: "#A3E635" }}>ARCGIS_API_KEY=your_key</p>
              <p style={{ color: "#4ADE80" }}>ARCGIS_BASE_URL=https://...</p>
            </div>
            <p className="mt-1" style={{ color: "#4B6B4B" }}>
              Obtener key: developers.arcgis.com
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

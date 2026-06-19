"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  RefreshCw, Zap, MapPin, Globe, CheckCircle,
  Clock, Lock, Search, Navigation,
} from "lucide-react";
import type { ArcGISStatus } from "@/app/api/arcgis/status/route";
import type { GeocodeResult } from "@/app/api/arcgis/geocode/route";

// ── Sub-components ────────────────────────────────────────────────────────────

function PulseDot({ ok, pulse = false }: { ok: boolean; pulse?: boolean }) {
  return (
    <span className="relative inline-flex w-2 h-2 flex-shrink-0">
      {pulse && ok && (
        <span
          className="absolute inline-flex w-full h-full rounded-full animate-ping"
          style={{ background: "rgba(34,197,94,0.45)" }}
        />
      )}
      <span
        className="relative inline-flex w-2 h-2 rounded-full"
        style={{
          background: ok ? "#22C55E" : "#E8A020",
          boxShadow:  ok ? "0 0 5px rgba(34,197,94,0.7)" : "0 0 4px rgba(232,160,32,0.5)",
        }}
      />
    </span>
  );
}

function ServiceBadge({ live }: { live: boolean }) {
  return (
    <span
      className="px-1.5 py-0.5 rounded font-mono flex-shrink-0"
      style={{
        fontSize:    9,
        background:  live ? "rgba(34,197,94,0.12)"  : "rgba(232,160,32,0.10)",
        border:      `1px solid ${live ? "rgba(34,197,94,0.30)" : "rgba(232,160,32,0.25)"}`,
        color:       live ? "#22C55E" : "#E8A020",
      }}
    >
      {live ? "LIVE" : "LOCAL"}
    </span>
  );
}

function CapRow({
  label, active, source, future = false,
}: {
  label: string; active: boolean; source?: string; future?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-2xs py-1.5 border-b border-border last:border-0">
      <div className="flex items-center gap-1.5">
        {future
          ? <Lock size={8} className="text-text-muted flex-shrink-0" />
          : <PulseDot ok={active} />}
        <span className={future ? "text-text-muted" : active ? "text-text-secondary" : "text-text-muted"}>
          {label}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        {source && !future && (
          <span className="font-mono" style={{ fontSize: 8, color: "#4B6B4B" }}>
            {source}
          </span>
        )}
        <span
          className="font-mono"
          style={{ color: future ? "#3E5A3E" : active ? "#22C55E" : "#E8A020", fontSize: 9 }}
        >
          {future ? "FUTURO" : active ? "OK" : "—"}
        </span>
      </div>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function ArcGISPanel() {
  const [status,   setStatus]   = useState<ArcGISStatus | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  // Geocoding tester state
  const [geoQuery,   setGeoQuery]  = useState("");
  const [geoResult,  setGeoResult] = useState<GeocodeResult | null>(null);
  const [geoLoading, setGeoLoading]= useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/api/arcgis/status")
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d: ArcGISStatus) => { setStatus(d); setLoading(false); })
      .catch((e: Error) => { setError(e.message); setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  const testGeocode = useCallback(() => {
    const q = geoQuery.trim() || "Rosario, Santa Fe";
    setGeoLoading(true);
    fetch(`/api/arcgis/geocode?q=${encodeURIComponent(q)}`)
      .then(r => r.json())
      .then((d: GeocodeResult) => { setGeoResult(d); setGeoLoading(false); })
      .catch(() => setGeoLoading(false));
  }, [geoQuery]);

  const handleGeoKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") testGeocode();
  };

  return (
    <div className="flex flex-col gap-2 h-full overflow-y-auto pr-0.5">

      {/* ── ONLINE / OFFLINE header ── */}
      <div
        className="glass rounded-xl p-3"
        style={{ boxShadow: "0 0 16px rgba(34,197,94,0.04)" }}
      >
        <div className="flex items-center justify-between mb-2">
          <p className="tactical-text flex items-center gap-1.5">
            <Globe size={10} /><span>ArcGIS Live Services</span>
          </p>
          <button onClick={load} className="text-text-muted hover:text-primary transition-colors">
            <RefreshCw size={9} className={loading ? "animate-spin text-primary" : ""} />
          </button>
        </div>

        {loading && (
          <div className="flex items-center gap-2 py-2">
            <div className="w-3 h-3 border border-primary/40 border-t-primary rounded-full animate-spin" />
            <span className="tactical-text">Verificando…</span>
          </div>
        )}

        {error && !loading && (
          <div className="text-2xs text-danger-DEFAULT font-mono">{error}</div>
        )}

        {status && !loading && (
          <>
            {/* ONLINE / OFFLINE large badge */}
            <div
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg mb-2"
              style={{
                background: status.configured ? "rgba(34,197,94,0.07)" : "rgba(232,160,32,0.07)",
                border:     `1px solid ${status.configured ? "rgba(34,197,94,0.22)" : "rgba(232,160,32,0.22)"}`,
              }}
            >
              <PulseDot ok={status.configured} pulse={status.configured} />
              <div className="flex-1 min-w-0">
                <p className="font-mono font-bold" style={{
                  fontSize: 11,
                  color:    status.configured ? "#22C55E" : "#E8A020",
                }}>
                  {status.configured ? "ARCGIS LIVE" : "MODO LOCAL"}
                </p>
                <p className="tactical-text mt-0.5" style={{ fontSize: 8 }}>
                  {status.active_services} servicios activos
                  {status.api_key_masked && ` · key ${status.api_key_masked}`}
                </p>
              </div>
              <div
                className="px-2 py-0.5 rounded font-mono text-2xs font-bold flex-shrink-0"
                style={{
                  background: status.configured ? "rgba(34,197,94,0.15)" : "rgba(232,160,32,0.12)",
                  color:      status.configured ? "#22C55E" : "#E8A020",
                  fontSize:   9,
                }}
              >
                {status.configured ? "●ONLINE" : "●OFFLINE"}
              </div>
            </div>

            {/* Status message */}
            <p className="tactical-text leading-relaxed" style={{ fontSize: 9 }}>
              {status.message}
            </p>
          </>
        )}
      </div>

      {/* ── Geocoding service ── */}
      {status && !loading && (
        <div className="glass rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="tactical-text flex items-center gap-1.5">
              <MapPin size={10} /><span>Geocoding</span>
            </p>
            <ServiceBadge live={status.configured} />
          </div>

          <div className="space-y-1.5 text-2xs mb-3">
            <div className="flex justify-between">
              <span className="text-text-muted">Motor</span>
              <span className="font-mono" style={{ color: status.configured ? "#22C55E" : "#E8A020" }}>
                {status.geocoding_source === "arcgis_live" ? "ArcGIS World Geocoder" : "INDEC / tabla local"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Cobertura</span>
              <span className="font-mono text-text-secondary">Argentina</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Reverse</span>
              <span className="font-mono text-success-DEFAULT">OK</span>
            </div>
          </div>

          {/* Live geocoding tester */}
          <div
            className="rounded-lg p-2"
            style={{ background: "rgba(7,18,9,0.5)", border: "1px solid rgba(34,197,94,0.10)" }}
          >
            <p className="tactical-text mb-1.5" style={{ fontSize: 8 }}>Probar geocoding</p>
            <div className="flex gap-1.5">
              <input
                ref={inputRef}
                type="text"
                value={geoQuery}
                onChange={e => setGeoQuery(e.target.value)}
                onKeyDown={handleGeoKey}
                placeholder="Rosario, Santa Fe…"
                className="flex-1 rounded px-2 py-1 text-2xs font-mono outline-none"
                style={{
                  background:   "rgba(7,18,9,0.7)",
                  border:       "1px solid rgba(34,197,94,0.20)",
                  color:        "#DCE8DC",
                  fontSize:     10,
                }}
              />
              <button
                onClick={testGeocode}
                className="px-2 rounded flex items-center justify-center transition-all"
                style={{
                  background: "rgba(34,197,94,0.12)",
                  border:     "1px solid rgba(34,197,94,0.30)",
                  color:      "#22C55E",
                }}
                aria-label="Geocodificar"
              >
                {geoLoading
                  ? <RefreshCw size={9} className="animate-spin" />
                  : <Search size={9} />
                }
              </button>
            </div>

            {geoResult && (
              <div
                className="mt-2 rounded p-2 space-y-0.5"
                style={{ background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.12)" }}
              >
                <p style={{ fontSize: 9, color: "#4ADE80", fontFamily: "monospace" }}>
                  {geoResult.address}
                </p>
                <div className="flex gap-3">
                  <p style={{ fontSize: 9, color: "#7A9C7A", fontFamily: "monospace" }}>
                    {geoResult.lat.toFixed(4)}, {geoResult.lon.toFixed(4)}
                  </p>
                  <p style={{ fontSize: 9, color: "#7A9C7A", fontFamily: "monospace" }}>
                    score: {geoResult.score}
                  </p>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <ServiceBadge live={geoResult.source === "arcgis"} />
                  <span style={{ fontSize: 8, color: "#4B6B4B" }}>{geoResult.source}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Routing service ── */}
      {status && !loading && (
        <div className="glass rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="tactical-text flex items-center gap-1.5">
              <Navigation size={10} /><span>Routing</span>
            </p>
            <ServiceBadge live={status.configured} />
          </div>
          <div className="space-y-1.5 text-2xs">
            <div className="flex justify-between">
              <span className="text-text-muted">Motor</span>
              <span className="font-mono" style={{ color: status.configured ? "#22C55E" : "#E8A020" }}>
                {status.routing_source === "arcgis_live" ? "ArcGIS World Route" : "Haversine local"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Velocidad media</span>
              <span className="font-mono text-text-secondary">80 km/h (local)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Multi-stop</span>
              <span className="font-mono text-success-DEFAULT">OK</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Service areas ── */}
      {status && !loading && (
        <div className="glass rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="tactical-text flex items-center gap-1.5">
              <Zap size={10} /><span>Service Areas</span>
            </p>
            <ServiceBadge live={status.configured} />
          </div>
          <div className="space-y-1.5 text-2xs mb-3">
            <div className="flex justify-between">
              <span className="text-text-muted">Polígonos</span>
              <span className="font-mono text-primary">{status.service_areas}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Instalaciones</span>
              <span className="font-mono text-text-secondary">
                {status.service_areas_sucursales || 5} sucursales
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Breaks</span>
              <span className="font-mono text-text-secondary">30 / 60 / 120 min</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Motor</span>
              <span className="font-mono" style={{ color: status.configured ? "#22C55E" : "#E8A020" }}>
                {status.service_areas_source}
              </span>
            </div>
            {status.last_updated && (
              <div className="flex justify-between">
                <span className="text-text-muted">Actualizado</span>
                <span className="font-mono text-text-muted" style={{ fontSize: 8 }}>
                  {new Date(status.last_updated).toLocaleDateString("es-AR")}
                </span>
              </div>
            )}
          </div>

          {/* Drive-time legend */}
          <div className="space-y-1">
            {[
              { min: 30,  color: "#22C55E", label: "30 min" },
              { min: 60,  color: "#E8A020", label: "60 min" },
              { min: 120, color: "#E03E3E", label: "120 min" },
            ].map(b => (
              <div key={b.min} className="flex items-center gap-2 text-2xs">
                <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                  style={{ background: `${b.color}25`, border: `1px solid ${b.color}` }} />
                <span className="text-text-muted">Drive {b.label}</span>
                <span className="ml-auto font-mono" style={{ color: b.color, fontSize: 9 }}>
                  {b.min} min
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Capabilities matrix ── */}
      {status && !loading && (
        <div className="glass rounded-xl p-3">
          <p className="tactical-text mb-2 flex items-center gap-1.5">
            <CheckCircle size={10} /><span>Capacidades GIS-14</span>
          </p>
          <div>
            <CapRow label="Geocoding (forward)"  active={status.capabilities.geocoding}     source={status.geocoding_source} />
            <CapRow label="Geocoding (reverse)"  active={status.capabilities.geocoding}     source={status.geocoding_source} />
            <CapRow label="Routing multi-stop"   active={status.capabilities.routing}       source={status.routing_source} />
            <CapRow label="Service Areas"         active={status.capabilities.service_areas} source={status.service_areas_source} />
            <CapRow label="Isocronas dinámicas"   active={status.capabilities.isochrones}    source={status.service_areas_source} />
            <CapRow label="Feature Layers vivos"  active={status.capabilities.feature_layers} future />
            <CapRow label="Scene View 3D"          active={status.capabilities.scene_view}    future />
            <CapRow label="Mapas offline"          active={status.capabilities.offline_maps}  future />
          </div>
        </div>
      )}

      {/* ── Roadmap GIS ── */}
      <div className="glass rounded-xl p-3">
        <p className="tactical-text mb-2 flex items-center gap-1.5">
          <Clock size={10} /><span>Roadmap GIS</span>
        </p>
        <div className="space-y-2">
          {[
            { sprint: "GIS-09",  label: "Backend + API status",           done: true  },
            { sprint: "GIS-10",  label: "Service Areas en mapa",          done: true  },
            { sprint: "GIS-11",  label: "Visualización avanzada",         done: true  },
            { sprint: "GIS-12",  label: "Temporal intelligence",          done: true  },
            { sprint: "GIS-13",  label: "WebGL + Deck.gl 3D",             done: true  },
            { sprint: "GIS-14",  label: "ArcGIS Live Services",           done: true, active: true },
            { sprint: "GIS-15",  label: "Feature Layers + ArcGIS SDK",    done: false },
            { sprint: "GIS-16",  label: "Offline / mobile maps",          done: false },
          ].map(item => (
            <div key={item.sprint} className="flex items-center gap-2 text-2xs">
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{
                  background: item.done ? "#22C55E" : "#1A3D20",
                  boxShadow:  item.done ? "0 0 4px rgba(34,197,94,0.6)" : "none",
                  border:     item.done ? "none" : "1px solid #3E5A3E",
                }}
              />
              <span
                className="font-mono flex-shrink-0"
                style={{
                  color:     "active" in item && item.active ? "#A3E635" : "#4ADE80",
                  fontSize:  9,
                  fontWeight:"active" in item && item.active ? 700 : 400,
                }}
              >
                {item.sprint}
              </span>
              <span className={item.done ? "text-text-secondary" : "text-text-muted"}>
                {item.label}
              </span>
              {item.done && <span className="ml-auto font-mono" style={{ color: "#22C55E", fontSize: 9 }}>✓</span>}
            </div>
          ))}
        </div>
      </div>

      {/* ── Config hint (only in local mode) ── */}
      {status && !loading && !status.configured && (
        <div
          className="glass rounded-xl p-3"
          style={{ border: "1px solid rgba(232,160,32,0.2)" }}
        >
          <p className="tactical-text mb-2" style={{ color: "#E8A020" }}>
            Activar ArcGIS Live
          </p>
          <div className="space-y-1" style={{ fontSize: 9, fontFamily: "monospace", color: "#7A9C7A" }}>
            <p>Agregar en .env.local o .env:</p>
            <div
              className="rounded p-1.5 mt-1"
              style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(34,197,94,0.12)" }}
            >
              <p style={{ color: "#A3E635" }}>ARCGIS_API_KEY=your_key_here</p>
            </div>
            <p className="mt-1" style={{ color: "#4B6B4B" }}>
              Obtener key gratuita: developers.arcgis.com
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

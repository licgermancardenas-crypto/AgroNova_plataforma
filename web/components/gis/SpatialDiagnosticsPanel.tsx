"use client";

import { useState, useEffect } from "react";

interface SpatialStatus {
  available: boolean;
  version: string | null;
  tables_ready: Record<string, boolean>;
  mode: string;
}

interface CoverageItem {
  sucursal_id: number;
  nombre: string;
  provincia: string;
  lat: number;
  lon: number;
  clientes_cubiertos: number;
  radius_km: number;
}

interface HotspotItem {
  provincia: string;
  score: number;
  clientes_en_zona: number;
  revenue_ars: number;
}

interface OverlapItem {
  provincia_a: string;
  provincia_b: string;
  overlap_type: string;
  sucursales_en_overlap: number;
}

const API = "http://localhost:8000";

export default function SpatialDiagnosticsPanel() {
  const [status,    setStatus]    = useState<SpatialStatus | null>(null);
  const [coverage,  setCoverage]  = useState<CoverageItem[]>([]);
  const [hotspots,  setHotspots]  = useState<HotspotItem[]>([]);
  const [overlaps,  setOverlaps]  = useState<OverlapItem[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [queryLat,  setQueryLat]  = useState(-34.61);
  const [queryLon,  setQueryLon]  = useState(-58.37);
  const [nearest,   setNearest]   = useState<{ nearest_branch: object | null; nearest_depots: object[] } | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      fetch(`${API}/api/spatial/status`).then(r => r.json()),
      fetch(`${API}/api/spatial/coverage`).then(r => r.json()),
      fetch(`${API}/api/spatial/hotspots`).then(r => r.json()),
      fetch(`${API}/api/spatial/overlaps`).then(r => r.json()),
    ]).then(([s, c, h, o]) => {
      if (s.status === "fulfilled") setStatus(s.value);
      if (c.status === "fulfilled") setCoverage(c.value?.items ?? []);
      if (h.status === "fulfilled") setHotspots(h.value?.items ?? []);
      if (o.status === "fulfilled") setOverlaps(o.value?.items ?? []);
    }).finally(() => setLoading(false));
  }, []);

  const handleNearest = () => {
    fetch(`${API}/api/spatial/nearest?lat=${queryLat}&lon=${queryLon}`)
      .then(r => r.json())
      .then(setNearest)
      .catch(() => setNearest(null));
  };

  const isPostGIS = status?.available && status?.mode === "postgis";

  return (
    <div className="flex flex-col gap-2">

      {/* POSTGIS STATUS */}
      <div
        className="glass rounded-xl p-3"
        style={{ border: `1px solid ${isPostGIS ? "rgba(34,197,94,0.30)" : "rgba(232,160,32,0.25)"}` }}
      >
        <div className="flex items-center justify-between mb-2">
          <p className="tactical-text flex items-center gap-1.5">
            <span>POSTGIS STATUS</span>
          </p>
          <span
            className="font-mono text-2xs px-1.5 py-0.5 rounded"
            style={{
              background: isPostGIS ? "rgba(34,197,94,0.12)" : "rgba(232,160,32,0.12)",
              border:     `1px solid ${isPostGIS ? "rgba(34,197,94,0.30)" : "rgba(232,160,32,0.30)"}`,
              color:      isPostGIS ? "#22C55E" : "#E8A020",
            }}
          >
            {loading ? "..." : isPostGIS ? "✓ ACTIVO" : "⚑ FALLBACK"}
          </span>
        </div>

        {status && (
          <div className="space-y-1 text-2xs">
            <div className="flex justify-between">
              <span className="text-text-muted">Modo</span>
              <span className="font-mono" style={{ color: isPostGIS ? "#22C55E" : "#E8A020" }}>
                {status.mode.toUpperCase()}
              </span>
            </div>
            {status.version && (
              <div className="flex justify-between">
                <span className="text-text-muted">Versión</span>
                <span className="font-mono text-text-secondary">{status.version.split(" ")[0]}</span>
              </div>
            )}
            {Object.entries(status.tables_ready).map(([tbl, ready]) => (
              <div key={tbl} className="flex justify-between">
                <span className="text-text-muted truncate max-w-[100px]">{tbl.replace("spatial_", "")}</span>
                <span className="font-mono" style={{ color: ready ? "#22C55E" : "#E03E3E" }}>
                  {ready ? "✓ OK" : "✗ VACÍO"}
                </span>
              </div>
            ))}
          </div>
        )}

        {!status && !loading && (
          <p className="text-2xs text-text-muted">Backend no disponible en {API}</p>
        )}
      </div>

      {/* Coverage */}
      <div className="glass rounded-xl p-3">
        <p className="tactical-text mb-2">Cobertura por Sucursal</p>
        {coverage.length > 0 ? (
          <div className="space-y-1.5">
            {coverage.slice(0, 5).map(c => (
              <div key={c.sucursal_id}>
                <div className="flex justify-between text-2xs mb-0.5">
                  <span className="text-text-secondary truncate max-w-[85px]">{c.nombre}</span>
                  <span className="font-mono text-primary">{c.clientes_cubiertos} cli.</span>
                </div>
                <div className="text-2xs text-text-muted">{c.provincia} · {c.radius_km} km</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-2xs text-text-muted italic">Sin datos de cobertura PostGIS</p>
        )}
      </div>

      {/* Nearest branch/depot query */}
      <div className="glass rounded-xl p-3">
        <p className="tactical-text mb-2">Sucursal / Depósito Más Cercano</p>
        <div className="flex gap-1 mb-1.5">
          <input
            type="number"
            step="0.01"
            value={queryLat}
            onChange={e => setQueryLat(Number(e.target.value))}
            className="flex-1 bg-bg-elevated border border-border rounded px-1.5 py-1 font-mono text-2xs text-text-primary"
            placeholder="Lat"
          />
          <input
            type="number"
            step="0.01"
            value={queryLon}
            onChange={e => setQueryLon(Number(e.target.value))}
            className="flex-1 bg-bg-elevated border border-border rounded px-1.5 py-1 font-mono text-2xs text-text-primary"
            placeholder="Lon"
          />
        </div>
        <button
          onClick={handleNearest}
          className="w-full py-1 rounded text-2xs font-mono transition-all"
          style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)", color: "#22C55E" }}
        >
          CONSULTAR
        </button>
        {nearest && (
          <div className="mt-2 space-y-1 text-2xs">
            {nearest.nearest_branch ? (
              <div className="flex justify-between">
                <span className="text-text-muted">Sucursal</span>
                <span className="font-mono text-primary">
                  {(nearest.nearest_branch as { nombre: string; distance_km: number }).nombre}{" "}
                  ({((nearest.nearest_branch as { distance_km: number }).distance_km).toFixed(0)} km)
                </span>
              </div>
            ) : (
              <p className="text-text-muted italic">Sin PostGIS activo — modo fallback</p>
            )}
            {nearest.nearest_depots.length > 0 && nearest.nearest_depots.map((d: object, i: number) => (
              <div key={i} className="flex justify-between">
                <span className="text-text-muted">Depósito {i + 1}</span>
                <span className="font-mono text-text-secondary">
                  {(d as { nombre: string }).nombre} ({((d as { distance_km: number }).distance_km).toFixed(0)} km)
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Hotspot intersections */}
      <div className="glass rounded-xl p-3">
        <p className="tactical-text mb-2">Hotspots Intersectados</p>
        {hotspots.length > 0 ? (
          <div className="space-y-1.5">
            {hotspots.slice(0, 5).map((h, i) => (
              <div key={i} className="flex justify-between text-2xs">
                <span className="text-text-secondary truncate max-w-[85px]">{h.provincia}</span>
                <span className="font-mono" style={{ color: h.score > 7 ? "#E8A020" : "#22C55E" }}>
                  score: {h.score.toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-2xs text-text-muted italic">Sin datos de hotspots PostGIS</p>
        )}
      </div>

      {/* Territorial overlaps */}
      <div className="glass rounded-xl p-3">
        <p className="tactical-text mb-2">Solapamientos Territoriales</p>
        {overlaps.length > 0 ? (
          <div className="space-y-1.5">
            {overlaps.slice(0, 4).map((o, i) => (
              <div key={i} className="text-2xs">
                <div className="flex justify-between mb-0.5">
                  <span className="text-text-muted truncate max-w-[110px]">{o.provincia_a} ↔ {o.provincia_b}</span>
                  <span className="font-mono text-warning-DEFAULT">{o.sucursales_en_overlap} suc.</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-2xs text-text-muted italic">Sin solapamientos detectados</p>
        )}
      </div>

    </div>
  );
}

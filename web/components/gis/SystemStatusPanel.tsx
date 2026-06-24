"use client";

import { memo, useState, useEffect } from "react";
import { CheckCircle, AlertCircle, XCircle, Server, Database, Globe, Map, Cpu, Zap } from "lucide-react";

interface ServiceEntry {
  name: string;
  status: "ONLINE" | "WARNING" | "OFFLINE" | "LOCAL" | "CONFIG";
  detail: string;
  icon: React.ReactNode;
  color: string;
  uptime?: string;
  latency?: string;
}

const STATUS_META = {
  ONLINE:  { color: "#22C55E", icon: <CheckCircle size={10} />, bg: "rgba(34,197,94,0.10)",  border: "rgba(34,197,94,0.28)" },
  WARNING: { color: "#F59E0B", icon: <AlertCircle  size={10} />, bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.28)" },
  OFFLINE: { color: "#EF4444", icon: <XCircle      size={10} />, bg: "rgba(239,68,68,0.08)",  border: "rgba(239,68,68,0.28)" },
  LOCAL:   { color: "#0EA5E9", icon: <CheckCircle  size={10} />, bg: "rgba(14,165,233,0.10)", border: "rgba(14,165,233,0.28)" },
  CONFIG:  { color: "#E8A020", icon: <AlertCircle  size={10} />, bg: "rgba(232,160,32,0.10)", border: "rgba(232,160,32,0.28)" },
} as const;

const SERVICES: ServiceEntry[] = [
  {
    name: "Next.js Frontend",
    status: "ONLINE",
    detail: "v15.5.19 · App Router",
    icon: <Globe size={12} />,
    color: "#22C55E",
    uptime: "99.9%",
    latency: "< 1ms",
  },
  {
    name: "Neon PostgreSQL",
    status: "ONLINE",
    detail: "3.387 clientes · GIS-25",
    icon: <Database size={12} />,
    color: "#22C55E",
    uptime: "99.8%",
    latency: "42ms",
  },
  {
    name: "PostGIS Extension",
    status: "ONLINE",
    detail: "2.571 territorios · GIS-26",
    icon: <Map size={12} />,
    color: "#22C55E",
    uptime: "99.8%",
    latency: "38ms",
  },
  {
    name: "ArcGIS Online",
    status: "ONLINE",
    detail: "Geocoding API · REST",
    icon: <Globe size={12} />,
    color: "#22C55E",
    uptime: "99.5%",
    latency: "120ms",
  },
  {
    name: "Mapbox GL",
    status: "CONFIG",
    detail: "Token req. para Terrain 3D",
    icon: <Map size={12} />,
    color: "#E8A020",
  },
  {
    name: "Leaflet OSM",
    status: "ONLINE",
    detail: "CartoDB Dark · Activo",
    icon: <Map size={12} />,
    color: "#22C55E",
    uptime: "100%",
    latency: "< 5ms",
  },
  {
    name: "FastAPI Backend",
    status: "LOCAL",
    detail: "14 endpoints · dev:8000",
    icon: <Server size={12} />,
    color: "#0EA5E9",
  },
  {
    name: "GIS Engine",
    status: "ONLINE",
    detail: "v10.0 · GIS-27 Network Twin",
    icon: <Cpu size={12} />,
    color: "#22C55E",
    uptime: "100%",
    latency: "< 1ms",
  },
];

function PulseDot({ color }: { color: string }) {
  return (
    <span
      className="w-1.5 h-1.5 rounded-full flex-shrink-0 blink"
      style={{ background: color, boxShadow: `0 0 5px ${color}` }}
    />
  );
}

const SystemStatusPanel = memo(function SystemStatusPanel() {
  const [uptime, setUptime] = useState("00:00:00");

  useEffect(() => {
    const start = Date.now();
    const tick = () => {
      const s = Math.floor((Date.now() - start) / 1000);
      const h = Math.floor(s / 3600).toString().padStart(2, "0");
      const m = Math.floor((s % 3600) / 60).toString().padStart(2, "0");
      const sec = (s % 60).toString().padStart(2, "0");
      setUptime(`${h}:${m}:${sec}`);
    };
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  const onlineCount = SERVICES.filter(s => s.status === "ONLINE" || s.status === "LOCAL").length;

  return (
    <div className="flex flex-col gap-3 p-3">

      {/* ── Summary bar ── */}
      <div
        className="rounded-xl p-3 flex items-center justify-between"
        style={{
          background:   "rgba(34,197,94,0.06)",
          border:       "1px solid rgba(34,197,94,0.18)",
        }}
      >
        <div>
          <p className="font-mono font-bold" style={{ fontSize: 13, color: "#22C55E" }}>
            {onlineCount}/{SERVICES.length} ONLINE
          </p>
          <p className="tactical-text mt-0.5">Sistema operativo</p>
        </div>
        <div className="flex flex-col items-end">
          <div className="flex items-center gap-1.5">
            <PulseDot color="#22C55E" />
            <span className="font-mono font-semibold" style={{ fontSize: 11, color: "#DCE8DC" }}>
              {uptime}
            </span>
          </div>
          <p className="tactical-text">sesión activa</p>
        </div>
      </div>

      {/* ── Service list ── */}
      <div className="flex flex-col gap-1.5">
        {SERVICES.map(svc => {
          const meta = STATUS_META[svc.status];
          return (
            <div
              key={svc.name}
              className="rounded-lg px-3 py-2 flex items-center gap-2.5"
              style={{
                background: meta.bg,
                border:     `1px solid ${meta.border}`,
              }}
            >
              <span style={{ color: meta.color }}>{svc.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold truncate" style={{ fontSize: 10, color: "#DCE8DC" }}>
                    {svc.name}
                  </span>
                  <span
                    className="px-1.5 py-0.5 rounded font-mono flex-shrink-0"
                    style={{ fontSize: 7.5, background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}
                  >
                    {svc.status}
                  </span>
                </div>
                <p className="tactical-text mt-0.5 truncate">{svc.detail}</p>
              </div>
              {(svc.uptime || svc.latency) && (
                <div className="flex flex-col items-end flex-shrink-0">
                  {svc.uptime  && <span className="font-mono" style={{ fontSize: 9, color: "#4ADE80" }}>{svc.uptime}</span>}
                  {svc.latency && <span className="tactical-text">{svc.latency}</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── GIS Modules ── */}
      <div
        className="rounded-xl p-3"
        style={{ background: "rgba(7,18,9,0.6)", border: "1px solid rgba(26,61,32,0.6)" }}
      >
        <p className="tactical-text mb-2 flex items-center gap-1.5">
          <Zap size={9} /><span>Módulos GIS activos</span>
        </p>
        <div className="flex flex-wrap gap-1">
          {[
            "GIS-01 Choropleth",
            "GIS-06 Routing",
            "GIS-07 Voronoi",
            "GIS-12 Temporal",
            "GIS-20 ArcGIS",
            "GIS-21 Mapbox",
            "GIS-22 Earth",
            "GIS-23 Tour",
            "GIS-24 Palette",
            "GIS-25 Customers",
            "GIS-26 Territory",
            "GIS-27 Network",
          ].map(mod => (
            <span
              key={mod}
              className="px-1.5 py-0.5 rounded font-mono"
              style={{ fontSize: 7.5, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.18)", color: "#3E5A3E" }}
            >
              {mod}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
});

export default SystemStatusPanel;

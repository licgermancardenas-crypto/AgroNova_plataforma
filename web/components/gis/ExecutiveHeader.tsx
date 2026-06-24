"use client";

import { memo } from "react";
import { Command, RefreshCw, AlertTriangle } from "lucide-react";

interface StatusBadge {
  label: string;
  ok: boolean;
  dim?: boolean;
}

interface ExecutiveHeaderProps {
  clock: string;
  geoLoading: boolean;
  geoError: string | null;
  onReload: () => void;
  onOpenPalette: () => void;
  children?: React.ReactNode;
}

const BADGES: StatusBadge[] = [
  { label: "NEON",    ok: true  },
  { label: "POSTGIS", ok: true  },
  { label: "ARCGIS",  ok: true  },
  { label: "LEAFLET", ok: true  },
];

const TODAY = new Intl.DateTimeFormat("es-AR", {
  weekday: "short", day: "2-digit", month: "short", year: "numeric",
}).format(new Date());

const ExecutiveHeader = memo(function ExecutiveHeader({
  clock, geoLoading, geoError, onReload, onOpenPalette, children,
}: ExecutiveHeaderProps) {
  return (
    <div
      className="flex items-center gap-3 px-3 flex-shrink-0 rounded-xl"
      style={{
        height: 48,
        background:     "rgba(5, 12, 6, 0.92)",
        backdropFilter: "blur(20px) saturate(160%)",
        border:         "1px solid rgba(26, 61, 32, 0.85)",
        boxShadow:      "0 2px 20px rgba(0,0,0,0.55), 0 0 40px rgba(34,197,94,0.04), inset 0 1px 0 rgba(255,255,255,0.03)",
      }}
    >
      {/* ── Brand ── */}
      <div className="flex items-center gap-2.5 flex-shrink-0">
        <div className="relative flex-shrink-0">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center font-mono font-black text-xs"
            style={{
              background: "linear-gradient(135deg, rgba(34,197,94,0.22) 0%, rgba(34,197,94,0.08) 100%)",
              border:     "1px solid rgba(34,197,94,0.45)",
              color:      "#22C55E",
              boxShadow:  "0 0 14px rgba(34,197,94,0.20)",
            }}
          >
            AN
          </div>
          <span
            className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full blink"
            style={{ background: "#22C55E", boxShadow: "0 0 5px rgba(34,197,94,0.9)" }}
          />
        </div>
        <div className="flex flex-col">
          <span
            className="font-mono font-black leading-none tracking-[0.12em]"
            style={{ fontSize: 11, color: "#22C55E" }}
          >
            AGRONOVA
          </span>
          <span
            className="font-mono leading-none tracking-[0.08em]"
            style={{ fontSize: 7.5, color: "#3E5A3E", letterSpacing: "0.14em" }}
          >
            INTELLIGENCE PLATFORM
          </span>
        </div>
      </div>

      {/* ── Separator ── */}
      <div className="w-px h-7 flex-shrink-0" style={{ background: "rgba(34,197,94,0.12)" }} />

      {/* ── Center slot (TimeSlider + GlobalSearch) ── */}
      <div className="flex flex-1 min-w-0 items-center gap-2">
        {children}
      </div>

      {/* ── Status badges ── */}
      <div className="hidden md:flex items-center gap-1 flex-shrink-0">
        {BADGES.map(b => (
          <div
            key={b.label}
            className="flex items-center gap-1 px-2 py-0.5 rounded-md"
            style={{
              background:   "rgba(34,197,94,0.06)",
              border:       "1px solid rgba(34,197,94,0.18)",
            }}
          >
            <span
              className="w-1 h-1 rounded-full blink"
              style={{ background: "#22C55E", boxShadow: "0 0 4px rgba(34,197,94,0.8)" }}
            />
            <span className="font-mono" style={{ fontSize: 7.5, color: "#3E5A3E", letterSpacing: "0.10em" }}>
              {b.label}
            </span>
          </div>
        ))}
      </div>

      {/* ── Separator ── */}
      <div className="w-px h-7 flex-shrink-0" style={{ background: "rgba(34,197,94,0.12)" }} />

      {/* ── Geo status ── */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {geoLoading && (
          <div className="flex items-center gap-1">
            <RefreshCw size={9} className="text-primary animate-spin" />
            <span className="tactical-text" style={{ fontSize: 8 }}>GIS…</span>
          </div>
        )}
        {geoError && (
          <button onClick={onReload} className="flex items-center gap-1 text-yellow-500 hover:text-yellow-300">
            <AlertTriangle size={9} />
            <span className="tactical-text" style={{ fontSize: 8 }}>RETRY</span>
          </button>
        )}
        <div className="flex items-center gap-1">
          <span
            className={`w-1.5 h-1.5 rounded-full ${geoLoading ? "bg-yellow-500 animate-pulse" : geoError ? "bg-red-500" : "bg-primary blink"}`}
            style={!geoLoading && !geoError ? { boxShadow: "0 0 5px rgba(34,197,94,0.8)" } : {}}
          />
          <span className="tactical-text" style={{ color: geoLoading ? "#F59E0B" : geoError ? "#EF4444" : "#22C55E" }}>
            {geoLoading ? "SYNC" : geoError ? "ERROR" : "LIVE"}
          </span>
        </div>
      </div>

      {/* ── Clock ── */}
      <div className="flex-shrink-0 hidden sm:flex flex-col items-end">
        <span className="font-mono font-semibold" style={{ fontSize: 11, color: "#DCE8DC", letterSpacing: "0.05em" }}>
          {clock}
        </span>
        <span className="tactical-text" style={{ fontSize: 7.5, letterSpacing: "0.08em" }}>
          {TODAY}
        </span>
      </div>

      {/* ── ⌘K ── */}
      <button
        onClick={onOpenPalette}
        className="flex items-center gap-1 px-2 py-1 rounded-lg font-mono transition-all border flex-shrink-0"
        style={{
          fontSize: 9,
          background:   "rgba(7,18,9,0.7)",
          borderColor:  "rgba(34,197,94,0.22)",
          color:        "#4B6B4B",
        }}
        title="Command Palette (Ctrl+K)"
      >
        <Command size={9} />
        <span>⌘K</span>
      </button>
    </div>
  );
});

export default ExecutiveHeader;

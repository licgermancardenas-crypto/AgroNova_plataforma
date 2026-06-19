"use client";

import type { ProvinceKPI, GisMetric } from "@/types";
import { getMetricValue } from "@/lib/geo-data";

// ── Argentina simplified outline (lon, lat) ───────────────────────────────────

const ARG_OUTLINE: [number, number][] = [
  [-65.5, -21.8], [-62.0, -21.8], [-58.2, -20.0], [-57.0, -20.5],
  [-55.0, -21.5], [-53.8, -23.0], [-53.6, -26.5], [-55.7, -27.5],
  [-57.5, -27.0], [-58.6, -27.5], [-57.8, -29.2], [-58.3, -31.8],
  [-58.5, -33.5], [-57.2, -36.5], [-57.0, -38.0], [-61.0, -39.5],
  [-62.5, -39.5], [-65.0, -40.5], [-65.3, -42.7], [-65.4, -44.5],
  [-65.5, -47.0], [-65.5, -49.0], [-66.5, -51.5], [-68.5, -52.5],
  [-68.9, -54.1], [-65.5, -55.1], [-63.8, -54.5], [-64.0, -52.0],
  [-66.5, -50.0], [-70.5, -47.5], [-71.5, -42.5], [-71.0, -38.0],
  [-70.8, -35.0], [-70.5, -30.5], [-69.5, -25.0], [-68.5, -22.0],
  [-65.5, -21.8],
];

// ── Coordinate transform ──────────────────────────────────────────────────────

const LON_MIN = -73.5, LON_MAX = -52.8;
const LAT_MIN = -55.3, LAT_MAX = -21.5;
const W = 130, H = 182;

function toXY(lon: number, lat: number): [number, number] {
  const x = ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * W;
  const y = (1 - (lat - LAT_MIN) / (LAT_MAX - LAT_MIN)) * H;
  return [x, y];
}

function toPoints(pts: [number, number][]): string {
  return pts.map(([lon, lat]) => toXY(lon, lat).join(",")).join(" ");
}

// ── Metric color (simple gradient) ───────────────────────────────────────────

function metricColor(kpi: ProvinceKPI, metric: GisMetric, all: ProvinceKPI[]): string {
  const vals = all.map(k => getMetricValue(k, metric));
  const min  = Math.min(...vals);
  const max  = Math.max(...vals);
  const v    = getMetricValue(kpi, metric);
  const t    = max > min ? (v - min) / (max - min) : 0.5;
  if (metric === "churn") {
    const r = Math.round(40  + t * (224 - 40));
    const g = Math.round(180 + t * (62  - 180));
    const b = Math.round(40  + t * (40  - 40));
    return `rgb(${r},${g},${b})`;
  }
  const r = Math.round(74  - t * (74  - 34));
  const g = Math.round(222 - t * (222 - 197));
  const b = Math.round(128 - t * (128 - 94));
  return `rgb(${r},${g},${b})`;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  allKpis:          ProvinceKPI[];
  metric:           GisMetric;
  selectedProvince: string | null;
  onProvinceClick:  (kpi: ProvinceKPI) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MiniMap({ allKpis, metric, selectedProvince, onProvinceClick }: Props) {
  const outlinePoints = toPoints(ARG_OUTLINE);

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        width:          W + 20,
        height:         H + 20,
        background:     "rgba(4,10,5,0.90)",
        border:         "1px solid rgba(34,197,94,0.18)",
        backdropFilter: "blur(12px)",
        boxShadow:      "0 8px 24px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(34,197,94,0.05)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-0.5" style={{ borderBottom: "1px solid rgba(34,197,94,0.10)" }}>
        <span className="tactical-text" style={{ color: "#3E5A3E", fontSize: 7 }}>MINIMAP</span>
        <span className="tactical-text" style={{ color: "#2A4A2A", fontSize: 7 }}>{allKpis.length} PROV</span>
      </div>

      {/* SVG */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        style={{ display: "block", margin: "4px auto 0" }}
      >
        {/* Argentina outline */}
        <polygon
          points={outlinePoints}
          fill="rgba(34,197,94,0.04)"
          stroke="rgba(34,197,94,0.25)"
          strokeWidth={0.8}
          strokeLinejoin="round"
        />

        {/* Province dots */}
        {allKpis.map(kpi => {
          const [x, y] = toXY(kpi.lon, kpi.lat);
          const color  = metricColor(kpi, metric, allKpis);
          const isSel  = kpi.nombre === selectedProvince;
          return (
            <g key={kpi.nombre} style={{ cursor: "pointer" }} onClick={() => onProvinceClick(kpi)}>
              {isSel && (
                <circle cx={x} cy={y} r={5} fill="none" stroke="#22C55E" strokeWidth={1} opacity={0.6} />
              )}
              <circle
                cx={x} cy={y} r={isSel ? 3 : 2.2}
                fill={color}
                opacity={isSel ? 1 : 0.75}
                style={{ filter: isSel ? "drop-shadow(0 0 3px #22C55E)" : undefined }}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

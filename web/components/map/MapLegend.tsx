"use client";

import type { GisMetric, ProvinceKPI } from "@/types";
import { getMetricValue, getMetricLabel, interpolateColor } from "@/lib/geo-data";
import { fmtARS, fmtNumber } from "@/lib/formatters";

function fmtVal(v: number, metric: GisMetric): string {
  if (metric === "revenue")  return fmtARS(v, true);
  if (metric === "clientes") return fmtNumber(v);
  if (metric === "margen")   return `${v.toFixed(1)}%`;
  return `${(v * 100).toFixed(0)}%`;
}

interface Props {
  metric: GisMetric;
  kpis: ProvinceKPI[];
}

export default function MapLegend({ metric, kpis }: Props) {
  const values = kpis.map(k => getMetricValue(k, metric));
  const min    = Math.min(...values);
  const max    = Math.max(...values);

  const stops = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div
      className="absolute bottom-14 left-3 z-[1000] pointer-events-none"
      style={{ minWidth: 130 }}
    >
      <div className="glass rounded-lg p-2.5">
        <p className="tactical-text mb-2">{getMetricLabel(metric)}</p>
        {/* Gradient bar */}
        <div
          className="h-2.5 rounded-full mb-1.5"
          style={{
            background: `linear-gradient(to right, ${stops.map(t => interpolateColor(t, metric)).join(", ")})`,
          }}
        />
        {/* Min / Max labels */}
        <div className="flex justify-between">
          <span className="font-mono text-2xs text-text-muted">{fmtVal(min, metric)}</span>
          <span className="font-mono text-2xs text-text-muted">{fmtVal(max, metric)}</span>
        </div>
        {/* Tick marks */}
        <div className="flex justify-between mt-2 gap-0.5">
          {stops.slice(0, -1).map((t, i) => {
            const val = min + t * (max - min);
            const color = interpolateColor(t, metric);
            return (
              <div key={i} className="flex flex-col items-center" style={{ minWidth: 0 }}>
                <div className="w-2 h-2 rounded-full mb-0.5" style={{ background: color }} />
                <span className="font-mono text-2xs" style={{ color, fontSize: 8 }}>
                  {fmtVal(val, metric)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

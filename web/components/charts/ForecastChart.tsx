"use client";

import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from "recharts";
import type { ForecastPoint } from "@/types";
import { CHART_GRID, AXIS_TICK, LEGEND_STYLE, REF_DASH } from "@/lib/chart-theme";

interface Props {
  data: ForecastPoint[];
  height?: number;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-lg p-3 text-xs space-y-1.5 min-w-[180px]">
      <p className="text-text-secondary font-medium border-b border-border pb-1.5 mb-1.5">{label}</p>
      {payload.filter((p: any) => p.value != null).map((p: any) => (
        <div key={p.name} className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-text-secondary text-xs">{p.name}</span>
          </div>
          <span className="font-mono text-text-primary">ARS {(p.value / 1e9).toFixed(2)}B</span>
        </div>
      ))}
    </div>
  );
}

export function ForecastChart({ data, height = 280 }: Props) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="gradActual" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#22C55E" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid {...CHART_GRID} />
        <XAxis
          dataKey="label"
          tick={AXIS_TICK}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={v => `${(v / 1e9).toFixed(1)}B`}
          tick={AXIS_TICK}
          axisLine={false}
          tickLine={false}
          width={42}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={LEGEND_STYLE} iconType="circle" iconSize={8} />
        <ReferenceLine x={data[5]?.label} stroke="#1A3D20" strokeDasharray={REF_DASH} label={{ value: "Hoy", fill: "#3E5A3E", fontSize: 10 }} />
        <Area
          type="monotone"
          dataKey="actual"
          name="Real"
          stroke="#22C55E"
          strokeWidth={2}
          fill="url(#gradActual)"
          dot={false}
          connectNulls={false}
        />
        <Line
          type="monotone"
          dataKey="forecast_30d"
          name="Fcst 30d"
          stroke="#0DB87E"
          strokeWidth={2}
          strokeDasharray="5 3"
          dot={{ r: 4, fill: "#0DB87E", strokeWidth: 0 }}
          connectNulls={false}
        />
        <Line
          type="monotone"
          dataKey="forecast_90d"
          name="Fcst 90d"
          stroke="#A3E635"
          strokeWidth={1.5}
          strokeDasharray="5 3"
          dot={{ r: 3, fill: "#A3E635", strokeWidth: 0 }}
          connectNulls={false}
        />
        <Line
          type="monotone"
          dataKey="forecast_180d"
          name="Fcst 180d"
          stroke="#E8A020"
          strokeWidth={1.5}
          strokeDasharray="5 3"
          dot={false}
          connectNulls={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

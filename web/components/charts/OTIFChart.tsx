"use client";

import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Cell, ReferenceLine,
} from "recharts";
import type { OTIFData } from "@/types";
import { CHART_GRID, AXIS_TICK, AXIS_TICK_LABEL, REF_DASH } from "@/lib/chart-theme";

interface RadarProps { data: OTIFData[]; height?: number; }
interface BarProps   { data: OTIFData[]; height?: number; }

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-lg p-2.5 text-xs min-w-[140px]">
      <p className="text-text-secondary font-medium mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center justify-between gap-2">
          <span className="text-text-secondary">{p.name}</span>
          <span className="font-mono text-text-primary font-medium">{p.value.toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
}

export function OTIFBarChart({ data, height = 200 }: BarProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid {...CHART_GRID} vertical={false} />
        <XAxis dataKey="region" tick={AXIS_TICK_LABEL} axisLine={false} tickLine={false} />
        <YAxis domain={[80, 100]} tickFormatter={v => `${v}%`} tick={AXIS_TICK} axisLine={false} tickLine={false} width={36} />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine y={92} stroke="#22C55E" strokeDasharray={REF_DASH} strokeWidth={1.5} label={{ value: "Target 92%", fill: "#3E5A3E", fontSize: 10, position: "right" }} />
        <Bar dataKey="otif_pct" name="OTIF%" radius={[3, 3, 0, 0]} maxBarSize={36}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.otif_pct >= d.target_pct ? "#0DB87E" : "#E03E3E"} fillOpacity={0.85} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function OTIFRadar({ data, height = 240 }: RadarProps) {
  const radarData = data.map(d => ({
    region: d.region,
    OTIF:   d.otif_pct,
    Target: d.target_pct,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={radarData}>
        <PolarGrid stroke="rgba(26,61,32,0.6)" />
        <PolarAngleAxis dataKey="region" tick={{ fill: "#7A9C7A", fontSize: 11 }} />
        <PolarRadiusAxis domain={[80, 100]} tick={{ fill: "#3E5A3E", fontSize: 9 }} tickCount={3} />
        <Tooltip content={<CustomTooltip />} />
        <Radar name="OTIF%" dataKey="OTIF" stroke="#22C55E" fill="#22C55E" fillOpacity={0.18} strokeWidth={2} />
        <Radar name="Target" dataKey="Target" stroke="#E8A020" fill="none" strokeDasharray="4 2" strokeWidth={1.5} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

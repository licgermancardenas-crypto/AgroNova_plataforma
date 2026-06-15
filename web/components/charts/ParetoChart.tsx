"use client";

import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import type { Producto } from "@/types";

interface Props {
  data: Producto[];
  height?: number;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-lg p-3 text-xs space-y-1.5 min-w-[180px]">
      <p className="text-text-primary font-medium truncate max-w-[160px]">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-text-secondary">{p.name}</span>
          </div>
          <span className="font-mono text-text-primary">
            {p.name === "% Acum." ? `${p.value.toFixed(1)}%` : `ARS ${(p.value / 1e6).toFixed(0)}M`}
          </span>
        </div>
      ))}
    </div>
  );
}

export function ParetoChart({ data, height = 260 }: Props) {
  const top15 = data.slice(0, 15).map(p => ({
    name:      p.nombre.split(" ").slice(0, 2).join(" "),
    revenue:   p.revenue_ars,
    cumPct:    p.cumulative_pct,
    abc:       p.abc,
  }));

  const barColor = (abc: string) => abc === "A" ? "#1E6FDB" : abc === "B" ? "#06C8FF" : "#3E5C7A";

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={top15} margin={{ top: 8, right: 40, left: -16, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(26,37,64,0.4)" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fill: "#3E5C7A", fontSize: 9 }}
          angle={-45}
          textAnchor="end"
          height={50}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          yAxisId="rev"
          tickFormatter={v => `${(v / 1e6).toFixed(0)}M`}
          tick={{ fill: "#3E5C7A", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          width={42}
        />
        <YAxis
          yAxisId="pct"
          orientation="right"
          domain={[0, 100]}
          tickFormatter={v => `${v}%`}
          tick={{ fill: "#3E5C7A", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          width={36}
        />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine yAxisId="pct" y={80} stroke="#E8A020" strokeDasharray="4 2" strokeWidth={1.5} />
        <Bar yAxisId="rev" dataKey="revenue" name="Revenue ARS" radius={[3, 3, 0, 0]}>
          {top15.map((entry, i) => (
            <rect key={i} fill={barColor(entry.abc)} />
          ))}
        </Bar>
        <Line
          yAxisId="pct"
          type="monotone"
          dataKey="cumPct"
          name="% Acum."
          stroke="#E8A020"
          strokeWidth={2}
          dot={{ r: 2, fill: "#E8A020", strokeWidth: 0 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

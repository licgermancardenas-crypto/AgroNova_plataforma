"use client";

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import type { MonthlyRevenue } from "@/types";

interface Props {
  data: MonthlyRevenue[];
  showUSD?: boolean;
  height?: number;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-lg p-3 text-xs space-y-1.5 min-w-[160px]">
      <p className="text-text-secondary font-medium border-b border-border pb-1.5 mb-1.5">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-text-secondary">{p.name}</span>
          </div>
          <span className="font-mono font-medium text-text-primary">
            {p.name.includes("USD")
              ? `USD ${(p.value / 1e6).toFixed(1)}M`
              : `ARS ${(p.value / 1e9).toFixed(2)}B`}
          </span>
        </div>
      ))}
    </div>
  );
}

export function AreaRevenueChart({ data, showUSD = true, height = 260 }: Props) {
  const slice = data.filter((_, i) => i % 2 === 0); // every 2 months for cleaner axis

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={slice} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="gradARS" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#1E6FDB" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#1E6FDB" stopOpacity={0.0} />
          </linearGradient>
          <linearGradient id="gradUSD" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#06C8FF" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#06C8FF" stopOpacity={0.0} />
          </linearGradient>
          <linearGradient id="gradMargen" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#0DB87E" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#0DB87E" stopOpacity={0.0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(26,37,64,0.4)" />
        <XAxis
          dataKey="label"
          tick={{ fill: "#3E5C7A", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          interval={5}
        />
        <YAxis
          yAxisId="ars"
          orientation="left"
          tickFormatter={v => `${(v / 1e9).toFixed(1)}B`}
          tick={{ fill: "#3E5C7A", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        {showUSD && (
          <YAxis
            yAxisId="usd"
            orientation="right"
            tickFormatter={v => `${(v / 1e6).toFixed(0)}M`}
            tick={{ fill: "#3E5C7A", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={42}
          />
        )}
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ paddingTop: 8, fontSize: 11, color: "#7A9EC4" }}
          iconType="circle"
          iconSize={8}
        />
        <Area
          yAxisId="ars"
          type="monotone"
          dataKey="revenue_ars"
          name="Revenue ARS"
          stroke="#1E6FDB"
          strokeWidth={2}
          fill="url(#gradARS)"
          dot={false}
          activeDot={{ r: 4, fill: "#1E6FDB", strokeWidth: 0 }}
        />
        <Area
          yAxisId="ars"
          type="monotone"
          dataKey="margen_ars"
          name="Margen ARS"
          stroke="#0DB87E"
          strokeWidth={1.5}
          fill="url(#gradMargen)"
          dot={false}
          activeDot={{ r: 3, fill: "#0DB87E", strokeWidth: 0 }}
        />
        {showUSD && (
          <Area
            yAxisId="usd"
            type="monotone"
            dataKey="revenue_usd"
            name="Revenue USD"
            stroke="#06C8FF"
            strokeWidth={1.5}
            strokeDasharray="4 2"
            fill="url(#gradUSD)"
            dot={false}
            activeDot={{ r: 3, fill: "#06C8FF", strokeWidth: 0 }}
          />
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
}

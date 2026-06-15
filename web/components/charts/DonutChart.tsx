"use client";

import { useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface Slice {
  name: string;
  value: number;
  color: string;
}

interface Props {
  data: Slice[];
  innerRadius?: number;
  outerRadius?: number;
  height?: number;
  centerLabel?: string;
  centerValue?: string;
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="glass rounded-lg p-2.5 text-xs">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="w-2 h-2 rounded-full" style={{ background: d.payload.color }} />
        <span className="text-text-secondary">{d.name}</span>
      </div>
      <p className="text-text-primary font-mono font-semibold">{d.value.toLocaleString()}</p>
      <p className="text-text-muted">{((d.value / d.payload.total) * 100).toFixed(1)}%</p>
    </div>
  );
}

export function DonutChart({
  data,
  innerRadius = 55,
  outerRadius = 80,
  height = 240,
  centerLabel,
  centerValue,
}: Props) {
  const total = useMemo(() => data.reduce((s, d) => s + d.value, 0), [data]);
  const enriched = data.map(d => ({ ...d, total }));

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={enriched}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={2}
            dataKey="value"
          >
            {enriched.map((entry, i) => (
              <Cell key={i} fill={entry.color} stroke="transparent" />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, color: "#7A9EC4", paddingTop: 8 }}
          />
        </PieChart>
      </ResponsiveContainer>
      {/* Center label */}
      {centerValue && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
          style={{ top: `calc(50% - ${height / 2}px)`, height }}>
          <p className="text-lg font-bold text-text-primary font-mono leading-none">{centerValue}</p>
          {centerLabel && <p className="text-2xs text-text-muted mt-1">{centerLabel}</p>}
        </div>
      )}
    </div>
  );
}

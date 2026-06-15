"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";

interface DataItem {
  name: string;
  value: number;
  color?: string;
  target?: number;
}

interface Props {
  data: DataItem[];
  formatter?: (v: number) => string;
  colorDefault?: string;
  height?: number;
  showTarget?: boolean;
}

function CustomTooltip({ active, payload, label, formatter }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-lg p-2.5 text-xs">
      <p className="text-text-secondary mb-1">{label}</p>
      <p className="text-text-primary font-mono font-medium">
        {formatter ? formatter(payload[0].value) : payload[0].value}
      </p>
    </div>
  );
}

export function HorizontalBar({
  data,
  formatter,
  colorDefault = "#22C55E",
  height,
  showTarget = false,
}: Props) {
  const h = height ?? Math.max(200, data.length * 36 + 32);

  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 48, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(26,61,32,0.4)" horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={formatter}
          tick={{ fill: "#3E5A3E", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={130}
          tick={{ fill: "#7A9C7A", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip formatter={formatter} />} />
        <Bar dataKey="value" radius={[0, 3, 3, 0]} maxBarSize={22}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color ?? colorDefault} fillOpacity={0.9} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// Shared Recharts styling constants — import these instead of repeating inline values.

/** CartesianGrid props (dark green tactical grid) */
export const CHART_GRID = {
  strokeDasharray: "3 3",
  stroke: "rgba(26,61,32,0.4)",
} as const;

/** Tick style for numeric / value axes (Y-axis with numbers) */
export const AXIS_TICK = { fill: "#3E5A3E", fontSize: 10 } as const;

/** Tick style for category / label axes (Y-axis with names, X-axis with dates) */
export const AXIS_TICK_LABEL = { fill: "#7A9C7A", fontSize: 11 } as const;

/** Legend wrapperStyle */
export const LEGEND_STYLE = {
  fontSize: 11,
  color: "#7A9C7A",
  paddingTop: 8,
} as const;

/** Stroke dash pattern for reference lines (target lines, "Hoy", 80% threshold) */
export const REF_DASH = "4 2" as const;

/**
 * contentStyle for inline Recharts <Tooltip> (use only when a custom
 * tooltip component is not feasible). Prefer custom components + .glass class.
 */
export const TOOLTIP_STYLE = {
  background: "#071209",
  border: "1px solid #1A3D20",
  borderRadius: 8,
  fontSize: 11,
  color: "#DCE8DC",
} as const;

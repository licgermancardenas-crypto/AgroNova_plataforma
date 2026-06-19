"use client";

import type { GisMetric } from "@/types";

interface LayerDef {
  key: string;
  label: string;
  color: string;
  shape: "circle" | "square" | "line" | "diamond" | "dashed";
  active: boolean;
}

interface Props {
  metric: GisMetric;
  layers: Record<string, boolean>;
}

const METRIC_LABEL: Record<GisMetric, string> = {
  revenue:  "Revenue ARS",
  clientes: "Clientes Activos",
  margen:   "Margen %",
  churn:    "Riesgo Churn",
  otif:     "OTIF %",
};

const ALL_LAYER_DEFS: LayerDef[] = [
  { key: "choropleth",    label: "Coroplético Prov.",  color: "#22C55E", shape: "square",  active: false },
  { key: "heatmap",       label: "Heatmap Comercial",  color: "#4ADE80", shape: "circle",  active: false },
  { key: "departamentos", label: "Departamentos",      color: "#4ADE80", shape: "dashed",  active: false },
  { key: "municipios",    label: "Municipios",         color: "#0EA5E9", shape: "circle",  active: false },
  { key: "vial",          label: "Red Vial Nacional",  color: "#E8A020", shape: "line",    active: false },
  { key: "puertos",       label: "Puertos y Nodos",    color: "#A3E635", shape: "diamond", active: false },
  { key: "sucursales",    label: "Sucursales",         color: "#22C55E", shape: "circle",  active: false },
  { key: "depositos",     label: "Depósitos",          color: "#0EA5E9", shape: "square",  active: false },
  { key: "clientes",      label: "Clientes",           color: "#F97316", shape: "circle",  active: false },
  { key: "radios",        label: "Radios Cobertura",   color: "#A3E635", shape: "dashed",  active: false },
  { key: "hotspots",      label: "Hotspots",           color: "#E8A020", shape: "dashed",  active: false },
  { key: "territorios",   label: "Territorios",        color: "#C084FC", shape: "square",  active: false },
  { key: "buffers",       label: "Buffers Cobertura",  color: "#A3E635", shape: "dashed",  active: false },
  { key: "candidatos",    label: "Candidatas",         color: "#E8A020", shape: "diamond", active: false },
  { key: "serviceareas",  label: "Service Areas",      color: "#22C55E", shape: "square",  active: false },
];

function ShapeIcon({ shape, color }: { shape: LayerDef["shape"]; color: string }) {
  if (shape === "circle") {
    return <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: color, boxShadow: `0 0 4px ${color}80`, flexShrink: 0 }} />;
  }
  if (shape === "square") {
    return <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 1, background: `${color}44`, border: `1px solid ${color}`, flexShrink: 0 }} />;
  }
  if (shape === "diamond") {
    return (
      <span style={{ display: "inline-block", width: 8, height: 8, background: `${color}44`, border: `1.5px solid ${color}`, transform: "rotate(45deg)", flexShrink: 0 }} />
    );
  }
  if (shape === "line") {
    return <span style={{ display: "inline-block", width: 12, height: 2, background: color, borderRadius: 1, flexShrink: 0 }} />;
  }
  // dashed
  return <span style={{ display: "inline-block", width: 12, height: 2, background: `repeating-linear-gradient(90deg,${color} 0,${color} 3px,transparent 3px,transparent 5px)`, flexShrink: 0 }} />;
}

function ChoroplethGradient({ metric }: { metric: GisMetric }) {
  const isInverted = metric === "churn";
  const stops = isInverted
    ? "from-[#22C55E] to-[#E03E3E]"
    : "from-[#071209] to-[#22C55E]";
  const [minLabel, maxLabel] = isInverted ? ["Bajo riesgo", "Alto riesgo"] : ["Mínimo", "Máximo"];

  return (
    <div className="mt-2">
      <div className={`h-2 rounded-full bg-gradient-to-r ${stops}`} />
      <div className="flex justify-between mt-0.5" style={{ fontSize: 8, color: "#7A9C7A" }}>
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  );
}

export default function MapLegendAdvanced({ metric, layers }: Props) {
  const activeLayers = ALL_LAYER_DEFS.filter(l => layers[l.key]);
  if (activeLayers.length === 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 60,
        right: 52,
        zIndex: 1000,
        background: "rgba(7,18,9,0.88)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(34,197,94,0.18)",
        borderRadius: 8,
        padding: "10px 12px",
        minWidth: 160,
        maxWidth: 190,
        boxShadow: "0 0 24px rgba(34,197,94,0.08), 0 4px 16px rgba(0,0,0,0.4)",
        pointerEvents: "none",
      }}
    >
      <div style={{ fontSize: 9, fontFamily: "monospace", color: "#4ADE80", marginBottom: 7, letterSpacing: "0.08em", textTransform: "uppercase" }}>
        LEYENDA · {METRIC_LABEL[metric]}
      </div>

      {/* Choropleth gradient if active */}
      {layers.choropleth && <ChoroplethGradient metric={metric} />}

      <div style={{ marginTop: layers.choropleth ? 8 : 0, display: "flex", flexDirection: "column", gap: 5 }}>
        {activeLayers
          .filter(l => l.key !== "choropleth")
          .map(l => (
            <div key={l.key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "#B0C8B0" }}>
              <ShapeIcon shape={l.shape} color={l.color} />
              <span>{l.label}</span>
            </div>
          ))}
      </div>

      {/* Puertos legend if active */}
      {layers.puertos && (
        <div style={{ marginTop: 8, borderTop: "1px solid rgba(34,197,94,0.12)", paddingTop: 6 }}>
          <div style={{ fontSize: 9, color: "#7A9C7A", marginBottom: 4 }}>Tipo de nodo</div>
          {[
            { color: "#A3E635", label: "Terminal Granaria" },
            { color: "#0EA5E9", label: "Puerto Principal" },
            { color: "#38BDF8", label: "Puerto Fluvial" },
          ].map(n => (
            <div key={n.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 9, color: "#B0C8B0", marginBottom: 3 }}>
              <span style={{ display: "inline-block", width: 7, height: 7, background: `${n.color}44`, border: `1.5px solid ${n.color}`, transform: "rotate(45deg)", flexShrink: 0 }} />
              <span>{n.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Vial legend if active */}
      {layers.vial && (
        <div style={{ marginTop: 8, borderTop: "1px solid rgba(34,197,94,0.12)", paddingTop: 6 }}>
          <div style={{ fontSize: 9, color: "#7A9C7A", marginBottom: 4 }}>Red vial</div>
          {[
            { color: "#E8A020", label: "Ruta Nacional Primaria" },
            { color: "#A3E635", label: "Ruta Nacional Secundaria" },
          ].map(n => (
            <div key={n.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 9, color: "#B0C8B0", marginBottom: 3 }}>
              <span style={{ display: "inline-block", width: 12, height: 2, background: n.color, borderRadius: 1, flexShrink: 0 }} />
              <span>{n.label}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 8, borderTop: "1px solid rgba(34,197,94,0.10)", paddingTop: 4, fontSize: 8, color: "#3E5A3E", fontFamily: "monospace" }}>
        EPSG:4326 · WGS84
      </div>
    </div>
  );
}

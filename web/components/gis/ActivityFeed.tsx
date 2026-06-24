"use client";

import { memo } from "react";
import { GitCommit, Layers, Users, AlertTriangle, Rocket, Database, Code2, Zap } from "lucide-react";

type FeedType = "deploy" | "module" | "data" | "alert" | "feature" | "fix";

interface FeedItem {
  id: string;
  time: string;
  title: string;
  body: string;
  type: FeedType;
  color: string;
}

const TYPE_ICON: Record<FeedType, React.ReactNode> = {
  deploy:  <Rocket   size={10} />,
  module:  <Layers   size={10} />,
  data:    <Database size={10} />,
  alert:   <AlertTriangle size={10} />,
  feature: <Zap     size={10} />,
  fix:     <Code2   size={10} />,
};

const FEED: FeedItem[] = [
  {
    id: "ux04",
    time: "Hoy",
    title: "UX-04 Command Center",
    body: "Executive Header · KPI Ribbon · System Status · Activity Feed",
    type: "deploy",
    color: "#22C55E",
  },
  {
    id: "ux03",
    time: "Hoy",
    title: "UX-03 Responsive Layout",
    body: "Mobile drawer panels · FAB toggles · 100dvh · touch optimization",
    type: "deploy",
    color: "#22C55E",
  },
  {
    id: "ux02",
    time: "Ayer",
    title: "UX-02 Story Mode",
    body: "6 escenas · FlyTo transitions · auto-play · StoryPanel glassmorphism",
    type: "feature",
    color: "#0EA5E9",
  },
  {
    id: "ux01",
    time: "Ayer",
    title: "UX-01 Polish & Premium",
    body: "Tab bar redesign · popup unification · scrollbar · React.memo",
    type: "feature",
    color: "#0EA5E9",
  },
  {
    id: "gis27",
    time: "GIS-27",
    title: "Network Digital Twin",
    body: "200k envíos · 5 depósitos · bottleneck detection · flow viz",
    type: "module",
    color: "#A3E635",
  },
  {
    id: "gis26",
    time: "GIS-26",
    title: "Territory Optimization Engine",
    body: "KNN PostGIS · 2.571 conflictos · simulación redistribución",
    type: "module",
    color: "#A3E635",
  },
  {
    id: "gis25",
    time: "GIS-25",
    title: "Customer Intelligence",
    body: "3.387 clientes reales Neon · segmentación tier/churn/revenue",
    type: "data",
    color: "#F97316",
  },
  {
    id: "gis24",
    time: "GIS-24",
    title: "Command Center UI",
    body: "⌘K Palette · Global Search · Tour Cinematográfico · Bookmarks",
    type: "feature",
    color: "#0EA5E9",
  },
  {
    id: "gis23",
    time: "GIS-23",
    title: "Camera Control System",
    body: "FlyTo · presets ARG/PAM/NOA/NEA/CUY/PAT · pitch/bearing",
    type: "feature",
    color: "#0EA5E9",
  },
  {
    id: "gis22",
    time: "GIS-22",
    title: "Earth Night Mode",
    body: "NASA Earth map engine · city lights · atmospheric effects",
    type: "module",
    color: "#A3E635",
  },
  {
    id: "gis21",
    time: "GIS-21",
    title: "Mapbox Terrain 3D",
    body: "Terrain · Satellite overlay · Sky layer · Hillshade",
    type: "module",
    color: "#A3E635",
  },
  {
    id: "gis12",
    time: "GIS-12",
    title: "Temporal Analytics Engine",
    body: "2016–2026 · compound growth model · OTIF/Churn/Revenue curves",
    type: "module",
    color: "#A3E635",
  },
  {
    id: "v1",
    time: "v1.0",
    title: "AgroNova v1.0 Launch",
    body: "9 páginas · 20 KPIs mock · Next.js 15 · glassmorphism dark",
    type: "deploy",
    color: "#22C55E",
  },
];

const ActivityFeed = memo(function ActivityFeed() {
  return (
    <div className="flex flex-col gap-2 p-3">
      <p className="tactical-text flex items-center gap-1.5 flex-shrink-0">
        <GitCommit size={9} /><span>Historial de actividad</span>
      </p>
      <div className="relative flex flex-col">
        {/* Vertical timeline line */}
        <div
          className="absolute left-[15px] top-2 bottom-2 w-px"
          style={{ background: "linear-gradient(to bottom, rgba(34,197,94,0.30), rgba(34,197,94,0.05))" }}
        />

        {FEED.map((item, i) => (
          <div key={item.id} className="flex gap-3 py-2 relative">
            {/* Timeline dot */}
            <div className="flex-shrink-0 flex items-start pt-0.5" style={{ width: 32 }}>
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center border flex-shrink-0"
                style={{
                  background:  `${item.color}14`,
                  borderColor: `${item.color}40`,
                  color:        item.color,
                  zIndex: 1,
                }}
              >
                {TYPE_ICON[item.type]}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span
                  className="font-mono font-bold"
                  style={{ fontSize: 10, color: item.color }}
                >
                  {item.title}
                </span>
                <span
                  className="px-1.5 py-px rounded font-mono flex-shrink-0"
                  style={{ fontSize: 7.5, background: "rgba(26,61,32,0.5)", color: "#3E5A3E", border: "1px solid rgba(34,197,94,0.15)" }}
                >
                  {item.time}
                </span>
              </div>
              <p className="tactical-text leading-relaxed" style={{ fontSize: 9 }}>
                {item.body}
              </p>
              {i < FEED.length - 1 && (
                <div className="mt-2 h-px" style={{ background: "rgba(34,197,94,0.07)" }} />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

export default ActivityFeed;

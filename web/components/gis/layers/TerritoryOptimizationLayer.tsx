"use client";

import { useEffect, useRef, memo } from "react";
import { useMapEvents } from "react-leaflet";
import L from "leaflet";
import type {
  TerritoryAnalysis, TerritoryBranch, TerritoryConflict, LoadStatus,
} from "@/types";

// ── constants ─────────────────────────────────────────────────────────────────

const LOAD_COLOR: Record<LoadStatus, string> = {
  NORMAL:     "#22C55E",
  ALTA_CARGA: "#F97316",
  SATURADA:   "#E03E3E",
};

const LINE_COLOR_BY_IMPROVEMENT = (pct: number): string => {
  if (pct >= 50) return "#E03E3E";   // critical
  if (pct >= 30) return "#F97316";   // warning
  return "#EAB308";                   // mild
};

interface Props {
  visible: boolean;
  data:    TerritoryAnalysis | null;
  showConflicts: boolean;
  showBranchRings: boolean;
  showConflictLines: boolean;
  simulatedClosed?: number | null;  // sucursal_id to "close" in simulation
}

function TerritoryOptimizationLayer({
  visible, data, showConflicts, showBranchRings, showConflictLines, simulatedClosed,
}: Props) {
  const groupRef       = useRef<L.LayerGroup | null>(null);
  const conflictRef    = useRef<L.LayerGroup | null>(null);
  const ringRef        = useRef<L.LayerGroup | null>(null);
  const simRef         = useRef<L.LayerGroup | null>(null);

  const map = useMapEvents({});

  // ── mount layer groups ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!map) return;
    const g    = L.layerGroup().addTo(map);
    const conf = L.layerGroup().addTo(map);
    const ring = L.layerGroup().addTo(map);
    const sim  = L.layerGroup().addTo(map);
    groupRef.current    = g;
    conflictRef.current = conf;
    ringRef.current     = ring;
    simRef.current      = sim;
    return () => {
      g.remove(); conf.remove(); ring.remove(); sim.remove();
    };
  }, [map]);

  // ── redraw when data/visibility changes ───────────────────────────────────
  useEffect(() => {
    const grp  = groupRef.current;
    const conf = conflictRef.current;
    const ring = ringRef.current;
    const sim  = simRef.current;
    if (!grp || !conf || !ring || !sim) return;

    grp.clearLayers();
    conf.clearLayers();
    ring.clearLayers();
    sim.clearLayers();

    if (!visible || !data) return;

    const branches  = data.branches;
    const conflicts = data.conflicts;

    // ── branch markers ─────────────────────────────────────────────────────
    branches.forEach((b: TerritoryBranch) => {
      const isClosed = simulatedClosed === b.sucursal_id;
      const color    = isClosed ? "#6B7280" : LOAD_COLOR[b.load_status];

      const icon = L.divIcon({
        className: "",
        iconSize:  [36, 36],
        iconAnchor:[18, 18],
        html: `
          <div style="
            width:36px; height:36px; border-radius:50%;
            background:${color}; border:3px solid ${isClosed ? "#4B5563" : "#fff"};
            display:flex; align-items:center; justify-content:center;
            font-size:11px; font-weight:700; color:#fff;
            box-shadow:0 2px 8px rgba(0,0,0,0.5);
            opacity:${isClosed ? 0.5 : 1};
          ">
            ${isClosed ? "✕" : b.n_clientes}
          </div>`,
      });

      const marker = L.marker([b.lat, b.lng], { icon })
        .addTo(grp as L.LayerGroup);

      marker.bindPopup(`
        <div style="min-width:220px; font-family:monospace; font-size:12px;">
          <div style="font-weight:700; font-size:13px; margin-bottom:6px;">${b.nombre}</div>
          <div style="color:${color}; font-weight:600; margin-bottom:4px;">${b.load_status}</div>
          <table style="width:100%; border-collapse:collapse;">
            <tr><td>Clientes</td><td style="text-align:right; font-weight:600;">${b.n_clientes.toLocaleString()}</td></tr>
            <tr><td>Revenue</td><td style="text-align:right;">ARS ${(b.revenue_total / 1e6).toFixed(1)}M</td></tr>
            <tr><td>OTIF avg</td><td style="text-align:right;">${b.otif_avg.toFixed(1)}%</td></tr>
            <tr><td>Dist avg</td><td style="text-align:right;">${b.avg_distance_km.toFixed(0)} km</td></tr>
            <tr><td>Conflictos</td><td style="text-align:right; color:#F97316;">${b.n_conflictos}</td></tr>
          </table>
          ${isClosed ? '<div style="color:#E03E3E; font-weight:700; margin-top:6px;">SIMULADA CERRADA</div>' : ""}
        </div>
      `);

      // ── influence rings ────────────────────────────────────────────────────
      if (showBranchRings && !isClosed) {
        [200_000, 400_000].forEach((radius, idx) => {
          L.circle([b.lat, b.lng], {
            radius,
            color: color,
            weight: 1,
            fillOpacity: idx === 0 ? 0.05 : 0.02,
            opacity: 0.3,
            dashArray: "6 4",
          }).addTo(ring as L.LayerGroup);
        });
      }
    });

    // ── conflict lines (subsample for performance) ─────────────────────────
    if (showConflicts && showConflictLines) {
      // Show top-200 by improvement_km to avoid DOM bloat at low zoom
      const sample = conflicts.slice(0, 200);
      sample.forEach((c: TerritoryConflict) => {
        const nearest = branches.find(b => b.sucursal_id === c.nearest_id);
        if (!nearest) return;

        const color = LINE_COLOR_BY_IMPROVEMENT(c.improvement_pct);

        L.polyline([[c.lat, c.lon], [nearest.lat, nearest.lng]], {
          color,
          weight: 1.5,
          opacity: 0.55,
          dashArray: "4 3",
        })
          .addTo(conf as L.LayerGroup)
          .bindTooltip(
            `${c.razon_social}<br/>` +
            `Ahorro: ${c.improvement_km.toFixed(0)} km (${c.improvement_pct.toFixed(0)}%)<br/>` +
            `${c.current_nombre} → ${c.nearest_nombre}`,
            { sticky: true, opacity: 0.9 }
          );
      });
    }

    // ── simulation overlay — mark affected clients ─────────────────────────
    if (simulatedClosed && showConflicts) {
      const affected = conflicts.filter(c => c.current_id === simulatedClosed);
      const remaining = branches.filter(b => b.sucursal_id !== simulatedClosed);

      affected.slice(0, 300).forEach((c: TerritoryConflict) => {
        // Find nearest among remaining
        let best: TerritoryBranch | null = null;
        let bestDist = Infinity;
        remaining.forEach(b => {
          const dx = (b.lat - c.lat);
          const dy = (b.lng - c.lon);
          const d = dx * dx + dy * dy;
          if (d < bestDist) { bestDist = d; best = b; }
        });
        if (!best) return;

        L.circleMarker([c.lat, c.lon], {
          radius: 4,
          color: "#A78BFA",
          fillColor: "#A78BFA",
          fillOpacity: 0.7,
          weight: 1,
        })
          .addTo(sim as L.LayerGroup)
          .bindTooltip(
            `${c.razon_social}<br/>Reasignado a: ${(best as TerritoryBranch).nombre}`,
            { sticky: true }
          );
      });
    }
  }, [visible, data, showConflicts, showBranchRings, showConflictLines, simulatedClosed]);

  return null;
}

export default memo(TerritoryOptimizationLayer);

"use client";

import { useEffect, useRef, useState } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

interface RouteRiskRecord {
  deposito_id: number;
  nombre: string;
  incidencia_score: number;
  risk_level: "Alto" | "Medio" | "Bajo";
  pct_demorado: number;
  pct_entregado: number;
}

interface RouteRiskData {
  by_deposito: RouteRiskRecord[];
}

const RISK_COLOR: Record<string, string> = {
  Alto:  "#E03E3E",
  Medio: "#E8A020",
  Bajo:  "#22C55E",
};

// Depot → sucursal route definitions using current map marker positions
const DEPOT_ROUTES = [
  { id: 1, from: [-32.87, -60.70] as [number, number], to: [-32.95, -60.65] as [number, number], deposito_id: 1, label: "CL Rosario → Rosario Hub",    ton: 4200 },
  { id: 2, from: [-32.87, -60.70] as [number, number], to: [-34.62, -58.38] as [number, number], deposito_id: 1, label: "CL Rosario → CABA Central",  ton: 2800 },
  { id: 3, from: [-31.38, -64.22] as [number, number], to: [-31.42, -64.18] as [number, number], deposito_id: 2, label: "CL Córdoba → Córdoba Agro",  ton: 1900 },
  { id: 4, from: [-31.38, -64.22] as [number, number], to: [-32.89, -68.84] as [number, number], deposito_id: 2, label: "CL Córdoba → Mendoza",       ton: 1100 },
  { id: 5, from: [-24.83, -65.45] as [number, number], to: [-24.79, -65.41] as [number, number], deposito_id: 3, label: "CL Salta → Salta Norte",     ton: 640  },
  { id: 6, from: [-31.38, -64.22] as [number, number], to: [-24.79, -65.41] as [number, number], deposito_id: 3, label: "CL Córdoba → Salta Norte",   ton: 880  },
];

const MAX_TON = 4200;
function routeWeight(ton: number): number {
  return Math.round(1.5 + (ton / MAX_TON) * 3.5);
}

interface Props { visible: boolean; }

export default function RoutingRiskLayer({ visible }: Props) {
  const map = useMap();
  const layerRef = useRef<L.LayerGroup | null>(null);
  const [riskData, setRiskData] = useState<RouteRiskData | null>(null);

  useEffect(() => {
    fetch("/data/gis_outputs/route_risk.json")
      .then(r => r.json())
      .then(setRiskData)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; }
    if (!visible) return;

    const riskMap: Record<number, RouteRiskRecord> = {};
    (riskData?.by_deposito ?? []).forEach(r => { riskMap[r.deposito_id] = r; });

    const group = L.layerGroup();

    DEPOT_ROUTES.forEach(route => {
      const risk = riskMap[route.deposito_id];
      const level = risk?.risk_level ?? "Medio";
      const color = RISK_COLOR[level];
      const weight = routeWeight(route.ton);

      const line = L.polyline([route.from, route.to], {
        color,
        weight,
        opacity: 0.75,
        dashArray: level === "Alto" ? "8 4" : undefined,
      });

      const score = risk?.incidencia_score?.toFixed(1) ?? "—";
      const demorado = risk?.pct_demorado?.toFixed(1) ?? "—";
      const entregado = risk?.pct_entregado?.toFixed(1) ?? "—";

      line.bindPopup(`
        <div style="font-size:11px;min-width:190px;font-family:system-ui,sans-serif">
          <div style="font-weight:700;font-size:12px;margin-bottom:6px;color:#DCE8DC;border-bottom:1px solid #1A3D20;padding-bottom:4px">
            🚛 ${route.label}
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px 8px">
            <span style="color:#7A9C7A">Riesgo</span>
            <span style="font-family:monospace;font-weight:700;color:${color};text-align:right">${level}</span>
            <span style="color:#7A9C7A">Score incidencia</span>
            <span style="font-family:monospace;color:#DCE8DC;text-align:right">${score}</span>
            <span style="color:#7A9C7A">Demorado</span>
            <span style="font-family:monospace;color:#E8A020;text-align:right">${demorado}%</span>
            <span style="color:#7A9C7A">Entregado</span>
            <span style="font-family:monospace;color:#22C55E;text-align:right">${entregado}%</span>
            <span style="color:#7A9C7A">Carga estimada</span>
            <span style="font-family:monospace;color:#DCE8DC;text-align:right">${route.ton.toLocaleString("es-AR")} ton/mes</span>
          </div>
        </div>`, { maxWidth: 240, className: "agronova-popup" }
      );

      line.on({
        mouseover(e) { (e.target as L.Polyline).setStyle({ opacity: 1, weight: weight + 1 }); },
        mouseout(e) { (e.target as L.Polyline).setStyle({ opacity: 0.75, weight }); },
      });

      group.addLayer(line);
    });

    group.addTo(map);
    layerRef.current = group;
    return () => { if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; } };
  }, [visible, riskData, map]);

  return null;
}

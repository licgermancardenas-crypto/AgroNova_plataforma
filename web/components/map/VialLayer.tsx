"use client";

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

export type VialRouteType = "nacional_primaria" | "nacional_secundaria" | "provincial";

interface VialRoute {
  id: number;
  label: string;
  numero: string;
  type: VialRouteType;
  coords: [number, number][];
}

const ROUTE_COLOR: Record<VialRouteType, string> = {
  nacional_primaria:   "#E8A020",
  nacional_secundaria: "#A3E635",
  provincial:          "#4ADE80",
};

const ROUTE_WEIGHT: Record<VialRouteType, number> = {
  nacional_primaria:   2.0,
  nacional_secundaria: 1.4,
  provincial:          1.0,
};

// Major Argentine national routes (approximate polylines)
const VIAL_ROUTES: VialRoute[] = [
  {
    id: 1, label: "RN 9 — Buenos Aires · Rosario · Córdoba · Salta · Jujuy",
    numero: "RN 9", type: "nacional_primaria",
    coords: [
      [-34.60, -58.43], [-33.98, -59.09], [-32.89, -60.70],
      [-31.64, -60.70], [-31.42, -64.18],
      [-27.78, -64.26], [-26.82, -65.21],
      [-24.78, -65.42], [-23.19, -65.47],
    ],
  },
  {
    id: 2, label: "RN 7 — Buenos Aires · San Luis · Mendoza",
    numero: "RN 7", type: "nacional_primaria",
    coords: [
      [-34.60, -58.43], [-34.56, -59.11],
      [-34.59, -60.95], [-33.88, -62.28],
      [-33.30, -66.34], [-32.89, -68.85],
    ],
  },
  {
    id: 3, label: "RN 3 — Buenos Aires · Bahía Blanca · Comodoro · Río Gallegos",
    numero: "RN 3", type: "nacional_primaria",
    coords: [
      [-34.60, -58.43], [-35.05, -58.76],
      [-36.78, -59.86], [-38.72, -62.27],
      [-40.81, -63.00], [-45.86, -67.49],
      [-51.62, -69.22],
    ],
  },
  {
    id: 4, label: "RN 14 — Buenos Aires · Concordia · Posadas",
    numero: "RN 14", type: "nacional_secundaria",
    coords: [
      [-34.11, -59.03], [-33.11, -58.30],
      [-31.39, -58.01], [-30.41, -57.85],
      [-28.45, -56.02], [-27.37, -55.90],
    ],
  },
  {
    id: 5, label: "RN 34 — Santa Fe · Santiago del Estero · Tucumán · Salta · Jujuy",
    numero: "RN 34", type: "nacional_secundaria",
    coords: [
      [-31.64, -60.70], [-30.70, -61.50],
      [-27.78, -64.26], [-26.82, -65.21],
      [-24.78, -65.42],
    ],
  },
  {
    id: 6, label: "RN 40 — Mendoza · San Juan · La Rioja · Neuquén",
    numero: "RN 40", type: "nacional_secundaria",
    coords: [
      [-39.10, -70.30], [-37.30, -70.15],
      [-35.50, -69.80], [-33.50, -68.50],
      [-32.89, -68.85], [-30.87, -68.89],
      [-29.41, -66.85],
    ],
  },
];

interface Props { visible: boolean; }

export default function VialLayer({ visible }: Props) {
  const map = useMap();
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; }
    if (!visible) return;

    const group = L.layerGroup();

    VIAL_ROUTES.forEach(route => {
      const color  = ROUTE_COLOR[route.type];
      const weight = ROUTE_WEIGHT[route.type];

      const line = L.polyline(route.coords, {
        color,
        weight,
        opacity: 0.55,
        dashArray: route.type === "provincial" ? "4 4" : undefined,
      });

      line.bindTooltip(
        `<div style="font-size:10px;font-family:system-ui,sans-serif;padding:3px 6px;background:#0D1F0F;border:1px solid ${color}50;border-radius:4px">
          <div style="font-weight:700;color:${color}">${route.numero}</div>
          <div style="color:#7A9C7A;font-size:9px">${route.label}</div>
        </div>`,
        { sticky: true, direction: "top", className: "" }
      );

      line.on({
        mouseover(e) { (e.target as L.Polyline).setStyle({ opacity: 1, weight: weight + 1 }); },
        mouseout(e)  { (e.target as L.Polyline).setStyle({ opacity: 0.55, weight }); },
      });

      group.addLayer(line);
    });

    group.addTo(map);
    layerRef.current = group;

    return () => { if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; } };
  }, [visible, map]);

  return null;
}

export { VIAL_ROUTES, ROUTE_COLOR };

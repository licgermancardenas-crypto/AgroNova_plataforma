"use client";

import { useEffect, useRef, useState } from "react";
import { useMapEvents } from "react-leaflet";
import L from "leaflet";
import type { ClienteMapMarker } from "@/types";
import { fmtARS } from "@/lib/formatters";

interface Props {
  clientes: ClienteMapMarker[];
  visible: boolean;
}

const CLUSTER_ZOOM = 7;
const JITTER = 0.22; // ~22km spread for province centroid jitter

const RISK_COLOR: Record<string, string> = {
  High:   "#E03E3E",
  Medium: "#E8A020",
  Low:    "#0DB87E",
};
const TIER_SIZE: Record<string, number> = { A: 10, B: 8, C: 6, D: 5 };

function dotIcon(color: string, size: number) {
  return L.divIcon({
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};opacity:0.85;box-shadow:0 0 ${size}px ${color}55;border:1px solid ${color}"></div>`,
    className: "",
    iconSize:  [size, size],
    iconAnchor:[Math.floor(size / 2), Math.floor(size / 2)],
  });
}

function clusterIcon(count: number, maxCount: number) {
  const t    = Math.sqrt(count / maxCount);
  const size = Math.round(18 + t * 28);
  const opacity = 0.45 + t * 0.35;
  return L.divIcon({
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:rgba(249,115,22,${opacity});border:1.5px solid #F97316;display:flex;align-items:center;justify-content:center;font-family:monospace;font-size:${Math.max(9,size/3.5)}px;font-weight:700;color:#FED7AA;box-shadow:0 0 ${size/2}px rgba(249,115,22,0.35)">${count}</div>`,
    className:  "",
    iconSize:   [size, size],
    iconAnchor: [Math.floor(size / 2), Math.floor(size / 2)],
  });
}

function gridKey(lat: number, lon: number, zoom: number): string {
  const cell = Math.max(0.5, 3 / (zoom - 3));
  return `${Math.floor(lat / cell)},${Math.floor(lon / cell)}`;
}

export default function ClientClusterLayer({ clientes, visible }: Props) {
  const [zoom, setZoom] = useState(5);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const mapRef   = useRef<L.Map | null>(null);

  const map = useMapEvents({
    zoomend() { setZoom(map.getZoom()); },
  });

  useEffect(() => { mapRef.current = map; }, [map]);

  useEffect(() => {
    if (!mapRef.current) return;
    if (layerRef.current) mapRef.current.removeLayer(layerRef.current);
    if (!visible) return;

    const group = L.layerGroup();

    if (zoom >= CLUSTER_ZOOM) {
      clientes.forEach((c, i) => {
        // Stable jitter seeded by index
        const seed = i * 2654435761;
        const dlat = ((seed & 0xFFFF) / 0xFFFF - 0.5) * JITTER * 2;
        const dlon = (((seed >> 8) & 0xFFFF) / 0xFFFF - 0.5) * JITTER * 2;
        const lat  = c.lat + dlat;
        const lon  = c.lng + dlon;

        const marker = L.marker([lat, lon], {
          icon: dotIcon(RISK_COLOR[c.risk_level] ?? "#0DB87E", TIER_SIZE[c.tier] ?? 6),
        });
        marker.bindPopup(
          `<div style="font-size:11px;font-family:system-ui,sans-serif;min-width:150px">
             <div style="font-weight:700;color:#DCE8DC;margin-bottom:4px">${c.razon_social}</div>
             <div style="color:#7A9C7A">Tier <span style="color:#DCE8DC">${c.tier}</span> · ${c.region}</div>
             <div style="color:#7A9C7A">Revenue <span style="font-family:monospace;color:#22C55E">${fmtARS(c.revenue_ars, true)}</span></div>
             <div style="color:#7A9C7A">Riesgo churn: <span style="color:${RISK_COLOR[c.risk_level]}">${c.risk_level}</span></div>
           </div>`,
          { maxWidth: 200 }
        );
        group.addLayer(marker);
      });
    } else {
      const cells: Record<string, { count: number; lats: number[]; lons: number[] }> = {};
      clientes.forEach(c => {
        const key = gridKey(c.lat, c.lng, zoom);
        if (!cells[key]) cells[key] = { count: 0, lats: [], lons: [] };
        cells[key].count++;
        cells[key].lats.push(c.lat);
        cells[key].lons.push(c.lng);
      });

      const maxCount = Math.max(...Object.values(cells).map(c => c.count));
      Object.entries(cells).forEach(([, cell]) => {
        const lat = cell.lats.reduce((a, b) => a + b, 0) / cell.lats.length;
        const lon = cell.lons.reduce((a, b) => a + b, 0) / cell.lons.length;
        const marker = L.marker([lat, lon], { icon: clusterIcon(cell.count, maxCount) });
        marker.bindPopup(`<div style="font-size:11px;font-family:system-ui,sans-serif;color:#DCE8DC">${cell.count} clientes en esta zona</div>`);
        group.addLayer(marker);
      });
    }

    group.addTo(mapRef.current);
    layerRef.current = group;

    return () => {
      if (mapRef.current && layerRef.current) mapRef.current.removeLayer(layerRef.current);
    };
  }, [clientes, visible, zoom]);

  return null;
}

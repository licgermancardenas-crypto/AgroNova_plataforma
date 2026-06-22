"use client";

import { useEffect, useRef, useState } from "react";
import { useMapEvents } from "react-leaflet";
import L from "leaflet";
import type { ClienteMapMarker } from "@/types";
import { fmtARS } from "@/lib/formatters";

interface Props {
  clientes:       ClienteMapMarker[];
  visible:        boolean;
  filterProvince?: string | null;
}

// Zoom < 9 → clusters  |  zoom >= 9 → individual markers
const INDIVIDUAL_ZOOM = 9;

const RISK_COLOR: Record<string, string> = {
  High:   "#E03E3E",
  Medium: "#E8A020",
  Low:    "#0DB87E",
};

const TIER_COLOR: Record<string, string> = {
  A: "#22C55E",
  B: "#A3E635",
  C: "#E8A020",
  D: "#E03E3E",
};

const TIER_SIZE: Record<string, number> = { A: 11, B: 9, C: 7, D: 6 };

function dotIcon(tier: string, riskColor: string) {
  const size  = TIER_SIZE[tier] ?? 7;
  const color = TIER_COLOR[tier] ?? "#A3E635";
  return L.divIcon({
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:1.5px solid ${riskColor};box-shadow:0 0 ${size + 2}px ${color}66"></div>`,
    className:  "",
    iconSize:   [size, size],
    iconAnchor: [Math.floor(size / 2), Math.floor(size / 2)],
  });
}

function clusterIcon(count: number, maxCount: number) {
  const t    = Math.sqrt(count / maxCount);
  const size = Math.round(20 + t * 26);
  const alpha = 0.45 + t * 0.35;
  return L.divIcon({
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:rgba(249,115,22,${alpha});border:1.5px solid #F97316;display:flex;align-items:center;justify-content:center;font-family:monospace;font-size:${Math.max(9, Math.round(size / 3.2))}px;font-weight:700;color:#FED7AA;box-shadow:0 0 ${Math.round(size / 2)}px rgba(249,115,22,0.35)">${count}</div>`,
    className:  "",
    iconSize:   [size, size],
    iconAnchor: [Math.floor(size / 2), Math.floor(size / 2)],
  });
}

function gridKey(lat: number, lon: number, zoom: number): string {
  const cell = Math.max(0.5, 3 / Math.max(1, zoom - 3));
  return `${Math.floor(lat / cell)},${Math.floor(lon / cell)}`;
}

function buildPopup(c: ClienteMapMarker): string {
  const riskColor  = RISK_COLOR[c.risk_level] ?? "#0DB87E";
  const tierColor  = TIER_COLOR[c.tier] ?? "#A3E635";
  const churnPct   = Math.round(c.churn_risk * 100);
  const churnBar   = `<div style="height:4px;background:rgba(255,255,255,0.08);border-radius:2px;overflow:hidden;margin-top:3px"><div style="height:100%;width:${churnPct}%;background:${riskColor};border-radius:2px"></div></div>`;
  return `
<div style="font-family:system-ui,sans-serif;min-width:220px;max-width:252px;background:#071209;border-radius:6px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.6)">
  <div style="background:rgba(34,197,94,0.10);padding:8px 10px;border-bottom:1px solid rgba(34,197,94,0.14)">
    <div style="font-weight:700;font-size:12px;color:#DCE8DC;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.razon_social}</div>
    <div style="font-size:10px;color:#7A9C7A">${c.provincia} · ${c.municipio}</div>
  </div>
  <div style="padding:8px 10px;display:flex;flex-direction:column;gap:5px">
    <div style="display:flex;gap:5px;flex-wrap:wrap">
      <span style="background:rgba(34,197,94,0.10);border:1px solid rgba(34,197,94,0.25);padding:2px 6px;border-radius:3px;font-size:9px;color:#22C55E;font-weight:600;letter-spacing:0.04em">${c.categoria.toUpperCase()}</span>
      <span style="background:rgba(255,255,255,0.04);border:1px solid ${tierColor}44;padding:2px 6px;border-radius:3px;font-size:9px;color:${tierColor};font-weight:700">TIER ${c.tier}</span>
      <span style="background:rgba(255,255,255,0.04);border:1px solid ${riskColor}44;padding:2px 6px;border-radius:3px;font-size:9px;color:${riskColor};font-weight:600">${c.region}</span>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:baseline;padding-top:2px">
      <span style="font-size:10px;color:#7A9C7A">Revenue</span>
      <span style="font-family:monospace;font-size:12px;font-weight:700;color:#22C55E">${fmtARS(c.revenue_ars, true)}</span>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:10px;color:#7A9C7A">Margen bruto</span>
      <span style="font-family:monospace;font-size:11px;color:#A3E635">${c.margen_pct.toFixed(1)}%</span>
    </div>
    <div>
      <div style="display:flex;justify-content:space-between">
        <span style="font-size:10px;color:#7A9C7A">Riesgo churn</span>
        <span style="font-size:10px;color:${riskColor};font-weight:600">${c.risk_level} · ${churnPct}%</span>
      </div>
      ${churnBar}
    </div>
    <div style="display:flex;justify-content:space-between;padding-top:4px;border-top:1px solid rgba(255,255,255,0.05)">
      <span style="font-size:10px;color:#7A9C7A">Último pedido</span>
      <span style="font-size:10px;color:#DCE8DC;font-family:monospace">${c.ultima_compra}</span>
    </div>
  </div>
</div>`;
}

export default function ClientClusterLayer({ clientes, visible, filterProvince = null }: Props) {
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
    if (!visible && !filterProvince) return;

    const visible_clientes = filterProvince
      ? clientes.filter(c => c.provincia === filterProvince)
      : clientes;

    const group = L.layerGroup();

    // When drilling into a province always show individual markers
    if (zoom >= INDIVIDUAL_ZOOM || filterProvince) {
      visible_clientes.forEach(c => {
        const marker = L.marker([c.lat, c.lng], {
          icon: dotIcon(c.tier, RISK_COLOR[c.risk_level] ?? "#0DB87E"),
        });
        marker.bindPopup(buildPopup(c), { maxWidth: 260, className: "agronova-popup" });
        group.addLayer(marker);
      });
    } else {
      // Cluster view
      const cells: Record<string, { count: number; lats: number[]; lons: number[] }> = {};
      visible_clientes.forEach(c => {
        const key = gridKey(c.lat, c.lng, zoom);
        if (!cells[key]) cells[key] = { count: 0, lats: [], lons: [] };
        cells[key].count++;
        cells[key].lats.push(c.lat);
        cells[key].lons.push(c.lng);
      });

      const maxCount = Math.max(...Object.values(cells).map(c => c.count), 1);
      Object.values(cells).forEach(cell => {
        const lat = cell.lats.reduce((a, b) => a + b, 0) / cell.lats.length;
        const lon = cell.lons.reduce((a, b) => a + b, 0) / cell.lons.length;
        const marker = L.marker([lat, lon], { icon: clusterIcon(cell.count, maxCount) });
        marker.bindPopup(
          `<div style="font-size:11px;font-family:system-ui,sans-serif;color:#DCE8DC;padding:4px 2px">${cell.count} cliente${cell.count > 1 ? "s" : ""} — zoom para ver detalle</div>`,
          { maxWidth: 200 }
        );
        group.addLayer(marker);
      });
    }

    group.addTo(mapRef.current);
    layerRef.current = group;

    return () => {
      if (mapRef.current && layerRef.current) mapRef.current.removeLayer(layerRef.current);
    };
  }, [clientes, visible, zoom, filterProvince]);

  return null;
}

"use client";

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

export interface PuertoNode {
  id: number;
  nombre: string;
  tipo: "puerto_principal" | "puerto_fluvial" | "terminal_granaria";
  lat: number;
  lon: number;
  capacidad_mton_anio: number;
  principales_granos: string[];
  operador: string;
}

export const PUERTOS: PuertoNode[] = [
  {
    id: 1,
    nombre: "Puerto Rosario",
    tipo: "terminal_granaria",
    lat: -32.947,
    lon: -60.640,
    capacidad_mton_anio: 80,
    principales_granos: ["Soja", "Maíz", "Trigo"],
    operador: "Complejo Up-River",
  },
  {
    id: 2,
    nombre: "San Lorenzo / Complejo San Martín",
    tipo: "terminal_granaria",
    lat: -32.748,
    lon: -60.732,
    capacidad_mton_anio: 60,
    principales_granos: ["Soja", "Girasol"],
    operador: "ADM / Bunge / Cargill",
  },
  {
    id: 3,
    nombre: "Puerto Bahía Blanca",
    tipo: "puerto_principal",
    lat: -38.718,
    lon: -62.266,
    capacidad_mton_anio: 25,
    principales_granos: ["Trigo", "Cebada", "Girasol"],
    operador: "Consorcio Puerto Bahía Blanca",
  },
  {
    id: 4,
    nombre: "Puerto Quequén",
    tipo: "puerto_fluvial",
    lat: -38.571,
    lon: -58.735,
    capacidad_mton_anio: 12,
    principales_granos: ["Trigo", "Maíz"],
    operador: "Consorcio Puerto Quequén",
  },
  {
    id: 5,
    nombre: "Puerto Buenos Aires",
    tipo: "puerto_principal",
    lat: -34.603,
    lon: -58.381,
    capacidad_mton_anio: 15,
    principales_granos: ["Soja", "Subproductos"],
    operador: "AGP S.E.",
  },
];

const TYPE_COLOR: Record<string, string> = {
  terminal_granaria:  "#A3E635",
  puerto_principal:   "#0EA5E9",
  puerto_fluvial:     "#38BDF8",
};

const TYPE_LABEL: Record<string, string> = {
  terminal_granaria:  "Terminal Granaria",
  puerto_principal:   "Puerto Principal",
  puerto_fluvial:     "Puerto Fluvial",
};

function puertoIcon(tipo: string, cap: number) {
  const color = TYPE_COLOR[tipo] ?? "#A3E635";
  const size = Math.round(14 + (cap / 80) * 10);
  return L.divIcon({
    html: `
      <div style="position:relative;width:${size + 8}px;height:${size + 8}px;display:flex;align-items:center;justify-content:center">
        <div style="width:${size}px;height:${size}px;background:${color}22;border:2px solid ${color};border-radius:3px;transform:rotate(45deg);box-shadow:0 0 12px ${color}60"></div>
        <div style="position:absolute;width:${size - 4}px;height:${size - 4}px;background:${color}44;border-radius:2px;transform:rotate(45deg)"></div>
        <div style="position:absolute;width:3px;height:3px;border-radius:50%;background:${color}"></div>
      </div>`,
    className: "",
    iconSize: [size + 8, size + 8],
    iconAnchor: [Math.floor((size + 8) / 2), Math.floor((size + 8) / 2)],
  });
}

interface Props { visible: boolean; }

export default function PuertosLayer({ visible }: Props) {
  const map = useMap();
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; }
    if (!visible) return;

    const group = L.layerGroup();

    PUERTOS.forEach(p => {
      const color = TYPE_COLOR[p.tipo] ?? "#A3E635";
      const marker = L.marker([p.lat, p.lon], { icon: puertoIcon(p.tipo, p.capacidad_mton_anio) });

      marker.bindPopup(`
        <div style="font-size:11px;min-width:200px;font-family:system-ui,sans-serif">
          <div style="font-weight:700;font-size:12px;margin-bottom:6px;color:#DCE8DC;border-bottom:1px solid ${color}40;padding-bottom:4px">
            ⚓ ${p.nombre}
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px 8px">
            <span style="color:#7A9C7A">Tipo</span>
            <span style="color:${color};font-weight:600;text-align:right">${TYPE_LABEL[p.tipo]}</span>
            <span style="color:#7A9C7A">Capacidad</span>
            <span style="font-family:monospace;color:#DCE8DC;text-align:right">${p.capacidad_mton_anio}M ton/año</span>
            <span style="color:#7A9C7A">Operador</span>
            <span style="font-family:monospace;color:#DCE8DC;text-align:right;font-size:9px">${p.operador}</span>
          </div>
          <div style="margin-top:5px;color:#7A9C7A;font-size:9px">
            Granos: <span style="color:#A3E635">${p.principales_granos.join(", ")}</span>
          </div>
        </div>`, { maxWidth: 240, className: "agronova-popup" }
      );

      marker.bindTooltip(
        `<div style="font-size:10px;padding:2px 5px;background:#0D1F0F;border:1px solid ${color}50;border-radius:4px;color:${color};font-weight:600">⚓ ${p.nombre}</div>`,
        { sticky: false, direction: "top", className: "" }
      );

      group.addLayer(marker);
    });

    group.addTo(map);
    layerRef.current = group;

    return () => { if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; } };
  }, [visible, map]);

  return null;
}

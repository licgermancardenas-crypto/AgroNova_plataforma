"use client";

import { useEffect, useRef, useState } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

const CLUSTER_COLOR: Record<string, string> = {
  "Zona Aislada de Alto Potencial":  "#E8A020",
  "Cluster Comercial Activo":        "#4ADE80",
};

function candidateIcon(score: number): L.DivIcon {
  const color = score >= 63 ? "#E8A020" : "#A3E635";
  const size = score >= 63 ? 18 : 14;
  return L.divIcon({
    html: `<div style="position:relative;width:${size}px;height:${size}px">
      <div style="position:absolute;inset:0;border-radius:50%;background:${color};opacity:0.25;animation:ping 1.8s cubic-bezier(0,0,0.2,1) infinite"></div>
      <div style="position:absolute;inset:3px;border-radius:50%;background:${color};border:2px solid ${color};box-shadow:0 0 10px ${color}88;display:flex;align-items:center;justify-content:center">
        <div style="width:4px;height:4px;background:#0B1A0C;border-radius:50%"></div>
      </div>
    </div>`,
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

interface Props { visible: boolean; }

export default function CandidateBranchLayer({ visible }: Props) {
  const map = useMap();
  const layerRef = useRef<L.LayerGroup | null>(null);
  const [geoData, setGeoData] = useState<GeoJSON.FeatureCollection | null>(null);

  useEffect(() => {
    fetch("/data/gis_outputs/candidate_branches.geojson")
      .then(r => r.json())
      .then(setGeoData)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; }
    if (!visible || !geoData) return;

    const group = L.layerGroup();

    geoData.features.forEach(f => {
      if (f.geometry.type !== "Point") return;
      const [lon, lat] = (f.geometry as GeoJSON.Point).coordinates;
      const p = f.properties ?? {};
      const score: number = p.opportunity_score ?? 0;
      const clusterColor = CLUSTER_COLOR[p.cluster ?? ""] ?? "#E8A020";

      const marker = L.marker([lat, lon], { icon: candidateIcon(score) });
      marker.bindPopup(`
        <div style="font-size:11px;min-width:200px;font-family:system-ui,sans-serif">
          <div style="font-weight:700;font-size:12px;margin-bottom:6px;color:#DCE8DC;border-bottom:1px solid #1A3D20;padding-bottom:4px">
            📍 Sucursal Candidata
          </div>
          <div style="font-size:13px;font-weight:600;color:#E8A020;margin-bottom:6px">${p.ciudad_candidata ?? ""}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px 8px;margin-bottom:6px">
            <span style="color:#7A9C7A">Región</span>
            <span style="font-family:monospace;color:#DCE8DC;text-align:right">${p.macro_region ?? ""}</span>
            <span style="color:#7A9C7A">Oportunidad</span>
            <span style="font-family:monospace;color:#E8A020;text-align:right;font-weight:700">${score.toFixed(1)}/100</span>
            <span style="color:#7A9C7A">Potencial agr.</span>
            <span style="font-family:monospace;color:#DCE8DC;text-align:right">${p.agr_ha_m ?? 0}M ha</span>
            <span style="color:#7A9C7A">Dist. suc. más cercana</span>
            <span style="font-family:monospace;color:#E03E3E;text-align:right">${p.dist_sucursal_mas_cercana_km ?? 0} km</span>
          </div>
          <div style="padding:5px;background:#0B1A0C;border-radius:4px;border-left:2px solid ${clusterColor}">
            <span style="color:${clusterColor};font-size:10px;font-weight:600">${p.cluster ?? ""}</span>
            <div style="color:#7A9C7A;font-size:10px;margin-top:2px">${(p.justificacion ?? "").substring(0, 100)}…</div>
          </div>
        </div>`, { maxWidth: 260, className: "agronova-popup" }
      );
      group.addLayer(marker);
    });

    group.addTo(map);
    layerRef.current = group;
    return () => { if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; } };
  }, [visible, geoData, map]);

  return null;
}

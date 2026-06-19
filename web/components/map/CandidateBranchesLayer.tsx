"use client";

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

interface Props { visible: boolean }

// Diamond icon, color + size by priority/score
function candidateIcon(score: number): L.DivIcon {
  const size = Math.round(18 + score * 12);     // 18-30px
  // High=red (expansion urgente), Mid=orange, Low=lime
  const col  = score > 0.7 ? "#E03E3E" : score > 0.5 ? "#E8A020" : "#A3E635";
  const glow = score > 0.7 ? "rgba(224,62,62,0.7)" : score > 0.5 ? "rgba(232,160,32,0.6)" : "rgba(163,230,53,0.5)";
  return L.divIcon({
    html: `<div style="
      width:${size}px;height:${size}px;
      background:${col}20;
      border:2.5px solid ${col};
      border-radius:3px;
      transform:rotate(45deg);
      box-shadow:0 0 ${Math.round(8+score*14)}px ${glow}, inset 0 0 ${Math.round(4+score*6)}px ${col}30;
    "></div>`,
    className: "",
    iconSize:  [size, size],
    iconAnchor:[size / 2, size / 2],
  });
}

function popupHtml(p: Record<string, unknown>): string {
  const ciudad  = String(p.ciudad_candidata ?? "Ciudad");
  const prov    = String(p.provincia ?? "");
  const region  = String(p.macro_region ?? "");
  const opp     = Number(p.opportunity_score ?? 0);
  const gap     = Number(p.gap_score ?? 0);
  const ha      = Number(p.agr_ha_m ?? 0);
  const oppCol  = opp > 0.7 ? "#22C55E" : opp > 0.5 ? "#E8A020" : "#7A9C7A";
  return `
    <div style="font-size:11px;min-width:175px;font-family:system-ui,sans-serif">
      <div style="font-weight:700;font-size:12px;margin-bottom:6px;color:#E8A020;
        border-bottom:1px solid rgba(232,160,32,0.25);padding-bottom:4px">
        ◆ Candidata Expansión
      </div>
      <div style="font-size:13px;color:#DCE8DC;font-weight:600;margin-bottom:6px">
        ${ciudad}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px 8px">
        <span style="color:#7A9C7A">Provincia</span>
        <span style="font-family:monospace;color:#B0C8B0;text-align:right;font-size:9px">${prov}</span>
        <span style="color:#7A9C7A">Región</span>
        <span style="font-family:monospace;color:#B0C8B0;text-align:right">${region}</span>
        <span style="color:#7A9C7A">Oportunidad</span>
        <span style="font-family:monospace;color:${oppCol};text-align:right;font-weight:700">
          ${(opp * 100).toFixed(0)}%
        </span>
        <span style="color:#7A9C7A">Gap Score</span>
        <span style="font-family:monospace;color:#0EA5E9;text-align:right">${gap.toFixed(2)}</span>
        <span style="color:#7A9C7A">Agro (Mha)</span>
        <span style="font-family:monospace;color:#DCE8DC;text-align:right">${ha.toFixed(1)}</span>
      </div>
    </div>`;
}

export default function CandidateBranchesLayer({ visible }: Props) {
  const map      = useMap();
  const layerRef = useRef<L.FeatureGroup | null>(null);
  const loadedRef= useRef(false);

  useEffect(() => {
    if (!visible) {
      if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; }
      return;
    }
    if (layerRef.current) { layerRef.current.addTo(map); return; }
    if (loadedRef.current) return;
    loadedRef.current = true;

    fetch("/data/gis_outputs/candidate_branches.geojson")
      .then(r => r.json())
      .then((data: GeoJSON.FeatureCollection) => {
        const group = L.featureGroup();
        data.features.forEach(feat => {
          if (feat.geometry.type !== "Point") return;
          const [lon, lat] = (feat.geometry as GeoJSON.Point).coordinates;
          const p          = feat.properties ?? {};
          const score      = Number(p.opportunity_score ?? 0);
          const marker     = L.marker([lat, lon], { icon: candidateIcon(score) });
          marker.bindPopup(popupHtml(p), { className: "agronova-popup", maxWidth: 240 });
          group.addLayer(marker);
        });
        layerRef.current = group;
        if (visible) group.addTo(map);
      })
      .catch(() => { loadedRef.current = false; });

    return () => {
      if (layerRef.current) map.removeLayer(layerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, map]);

  return null;
}

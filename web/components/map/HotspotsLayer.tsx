"use client";

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

interface Props { visible: boolean }

// intensity_score → color (low=yellow, high=red)
function hotspotColor(score: number): string {
  const t = Math.max(0, Math.min(1, score));
  const r = Math.round(232 + t * (224 - 232));
  const g = Math.round(160 - t * 160);
  const b = Math.round(32  - t * 32);
  return `rgb(${r},${g},${b})`;
}

function tooltipHtml(p: Record<string, unknown>): string {
  const score   = Number(p.intensity_score ?? 0);
  const area    = Number(p.area_km2 ?? 0);
  const clients = Number(p.n_clientes ?? 0);
  const prov    = String(p.dominant_provincia ?? "");
  const color   = hotspotColor(score);
  return `
    <div style="font-size:11px;min-width:155px;font-family:system-ui,sans-serif">
      <div style="font-weight:700;font-size:12px;margin-bottom:6px;color:#E8A020;
        border-bottom:1px solid rgba(232,160,32,0.25);padding-bottom:4px">
        ◈ Hotspot Comercial
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px 8px">
        <span style="color:#7A9C7A">Intensidad</span>
        <span style="font-family:monospace;color:${color};text-align:right;font-weight:700">
          ${(score * 100).toFixed(0)}%
        </span>
        <span style="color:#7A9C7A">Clientes</span>
        <span style="font-family:monospace;color:#DCE8DC;text-align:right">${clients.toLocaleString()}</span>
        <span style="color:#7A9C7A">Área</span>
        <span style="font-family:monospace;color:#DCE8DC;text-align:right">${area.toFixed(0)} km²</span>
        <span style="color:#7A9C7A">Provincia</span>
        <span style="font-family:monospace;color:#B0C8B0;text-align:right">${prov}</span>
      </div>
    </div>`;
}

export default function HotspotsLayer({ visible }: Props) {
  const map      = useMap();
  const layerRef = useRef<L.GeoJSON | null>(null);
  const loadedRef= useRef(false);

  useEffect(() => {
    if (!visible) {
      if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; }
      return;
    }
    if (layerRef.current) { layerRef.current.addTo(map); return; }
    if (loadedRef.current) return;
    loadedRef.current = true;

    fetch("/data/gis_outputs/hotspots.geojson")
      .then(r => r.json())
      .then((data: GeoJSON.FeatureCollection) => {
        const layer = L.geoJSON(data as GeoJSON.GeoJsonObject, {
          style: (feat) => {
            const score = Number(feat?.properties?.intensity_score ?? 0);
            const col   = hotspotColor(score);
            return {
              color:       col,
              weight:      2,
              opacity:     1,
              fillColor:   col,
              fillOpacity: 0.38 + score * 0.22,  // 0.38–0.60 based on intensity
              dashArray:   undefined,
            };
          },
          onEachFeature: (feat, lyr) => {
            const p = feat.properties ?? {};
            lyr.bindTooltip(tooltipHtml(p), { sticky: true, opacity: 0.97 });
            lyr.on({
              mouseover(e) {
                (e.target as L.Path).setStyle({ fillOpacity: 0.75, weight: 3 });
                (e.target as L.Path).bringToFront();
              },
              mouseout(e) {
                const score = Number(feat.properties?.intensity_score ?? 0);
                (e.target as L.Path).setStyle({ fillOpacity: 0.38 + score * 0.22, weight: 2 });
              },
            });
          },
        });
        layerRef.current = layer;
        if (visible) layer.addTo(map);
      })
      .catch(() => { loadedRef.current = false; });

    return () => {
      if (layerRef.current) { map.removeLayer(layerRef.current); }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, map]);

  return null;
}

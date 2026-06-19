"use client";

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

interface Props { visible: boolean }

const BUFFER_COLORS = ["#22C55E", "#0EA5E9", "#A3E635", "#E8A020", "#C084FC"];

function tooltipHtml(p: Record<string, unknown>): string {
  const nombre   = String(p.nombre ?? "Cobertura");
  const radius   = Number(p.radius_km ?? 0);
  const sucId    = Number(p.sucursal_id ?? 0);
  const color    = BUFFER_COLORS[sucId % BUFFER_COLORS.length];
  return `
    <div style="font-size:11px;min-width:145px;font-family:system-ui,sans-serif">
      <div style="font-weight:700;font-size:12px;margin-bottom:6px;color:${color};
        border-bottom:1px solid ${color}30;padding-bottom:4px">
        ◎ Cobertura
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px 8px">
        <span style="color:#7A9C7A">Sucursal</span>
        <span style="font-family:monospace;color:#DCE8DC;text-align:right;font-size:9px">${nombre}</span>
        <span style="color:#7A9C7A">Radio</span>
        <span style="font-family:monospace;color:${color};text-align:right">${radius.toFixed(0)} km</span>
      </div>
    </div>`;
}

export default function CoverageBuffersLayer({ visible }: Props) {
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

    fetch("/data/gis_outputs/coverage_buffers.geojson")
      .then(r => r.json())
      .then((data: GeoJSON.FeatureCollection) => {
        const layer = L.geoJSON(data as GeoJSON.GeoJsonObject, {
          style: (feat) => {
            const id  = Number(feat?.properties?.sucursal_id ?? 0);
            const col = BUFFER_COLORS[id % BUFFER_COLORS.length];
            return {
              color:       col,
              weight:      1,
              opacity:     0.5,
              fillColor:   col,
              fillOpacity: 0.04,
              dashArray:   "6 4",
            };
          },
          onEachFeature: (feat, lyr) => {
            const p   = feat.properties ?? {};
            const id  = Number(p.sucursal_id ?? 0);
            const col = BUFFER_COLORS[id % BUFFER_COLORS.length];
            lyr.bindTooltip(tooltipHtml(p), { sticky: true, opacity: 0.97 });
            lyr.on({
              mouseover(e) {
                (e.target as L.Path).setStyle({ fillOpacity: 0.14, weight: 2, opacity: 0.9, dashArray: undefined });
                (e.target as L.Path).bringToFront();
              },
              mouseout(e) {
                (e.target as L.Path).setStyle({ fillOpacity: 0.04, weight: 1, opacity: 0.5, dashArray: "6 4" });
              },
            });
            // Keep color reference to avoid unused-var lint
            void col;
          },
        });
        layerRef.current = layer;
        if (visible) layer.addTo(map);
      })
      .catch(() => { loadedRef.current = false; });

    return () => {
      if (layerRef.current) map.removeLayer(layerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, map]);

  return null;
}

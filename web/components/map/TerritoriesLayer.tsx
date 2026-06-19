"use client";

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

interface Props { visible: boolean }

// One distinct color per sucursal territory
const TERRITORY_COLORS = ["#22C55E", "#0EA5E9", "#A3E635", "#E8A020", "#C084FC"];

function tooltipHtml(p: Record<string, unknown>): string {
  const nombre   = String(p.nombre ?? "Territorio");
  const clientes = Number(p.n_clientes_territorio ?? 0);
  const area     = Number(p.area_km2 ?? 0);
  const provs    = Array.isArray(p.provincias) ? (p.provincias as string[]).join(", ") : String(p.provincias ?? "");
  const idx      = Number(p.sucursal_id ?? 0);
  const color    = TERRITORY_COLORS[idx % TERRITORY_COLORS.length];
  return `
    <div style="font-size:11px;min-width:165px;font-family:system-ui,sans-serif">
      <div style="font-weight:700;font-size:12px;margin-bottom:6px;color:${color};
        border-bottom:1px solid ${color}30;padding-bottom:4px">
        ▣ ${nombre}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px 8px">
        <span style="color:#7A9C7A">Clientes</span>
        <span style="font-family:monospace;color:#DCE8DC;text-align:right">${clientes.toLocaleString()}</span>
        <span style="color:#7A9C7A">Área</span>
        <span style="font-family:monospace;color:#DCE8DC;text-align:right">${area.toLocaleString()} km²</span>
        <span style="color:#7A9C7A">Provincias</span>
        <span style="font-family:monospace;color:#B0C8B0;text-align:right;font-size:9px">${provs}</span>
      </div>
    </div>`;
}

export default function TerritoriesLayer({ visible }: Props) {
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

    fetch("/data/gis_outputs/territories.geojson")
      .then(r => r.json())
      .then((data: GeoJSON.FeatureCollection) => {
        const layer = L.geoJSON(data as GeoJSON.GeoJsonObject, {
          style: (feat) => {
            const idx = Number(feat?.properties?.sucursal_id ?? 0);
            const col = TERRITORY_COLORS[idx % TERRITORY_COLORS.length];
            return {
              color:       col,
              weight:      2,
              opacity:     0.8,
              fillColor:   col,
              fillOpacity: 0.08,
            };
          },
          onEachFeature: (feat, lyr) => {
            const p = feat.properties ?? {};
            const idx  = Number(p.sucursal_id ?? 0);
            const col  = TERRITORY_COLORS[idx % TERRITORY_COLORS.length];
            lyr.bindTooltip(tooltipHtml(p), { sticky: true, opacity: 0.97 });
            lyr.on({
              mouseover(e) {
                (e.target as L.Path).setStyle({ fillOpacity: 0.22, weight: 3, color: col });
                (e.target as L.Path).bringToFront();
              },
              mouseout(e) {
                (e.target as L.Path).setStyle({ fillOpacity: 0.08, weight: 2, color: col });
              },
            });
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

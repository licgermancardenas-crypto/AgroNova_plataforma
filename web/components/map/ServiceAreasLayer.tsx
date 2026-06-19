"use client";

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

interface Props { visible: boolean }

function tooltipHtml(p: Record<string, unknown>): string {
  const facility = String(p.facility ?? "Instalación");
  const breakMin = Number(p.break_min ?? 0);
  const radius   = Number(p.radius_km ?? 0);
  const source   = String(p.source ?? "local");
  const color    = String(p.color ?? "#22C55E");
  const label    = breakMin === 30 ? "30 min" : breakMin === 60 ? "1 hora" : "2 horas";
  return `
    <div style="font-size:11px;min-width:160px;font-family:system-ui,sans-serif">
      <div style="font-weight:700;font-size:12px;margin-bottom:6px;color:${color};
        border-bottom:1px solid ${color}30;padding-bottom:4px">
        ◐ Área de Servicio
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px 8px">
        <span style="color:#7A9C7A">Instalación</span>
        <span style="font-family:monospace;color:#DCE8DC;text-align:right;font-size:9px">${facility}</span>
        <span style="color:#7A9C7A">Alcance</span>
        <span style="font-family:monospace;color:${color};text-align:right;font-weight:700">${label}</span>
        ${radius > 0 ? `
        <span style="color:#7A9C7A">Radio aprox.</span>
        <span style="font-family:monospace;color:#B0C8B0;text-align:right">${radius.toFixed(0)} km</span>` : ""}
        <span style="color:#7A9C7A">Fuente</span>
        <span style="font-family:monospace;color:#4B6B4B;text-align:right">${source}</span>
      </div>
    </div>`;
}

export default function ServiceAreasLayer({ visible }: Props) {
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

    fetch("/data/gis_outputs/service_areas_all.geojson")
      .then(r => r.json())
      .then((data: GeoJSON.FeatureCollection) => {
        // Sort largest break first so smaller ones render on top
        const sorted = [...data.features].sort(
          (a, b) => Number(b.properties?.break_min ?? 0) - Number(a.properties?.break_min ?? 0)
        );
        const layer = L.geoJSON({ ...data, features: sorted } as GeoJSON.GeoJsonObject, {
          style: (feat) => {
            const color = String(feat?.properties?.color ?? "#22C55E");
            return {
              color,
              weight:      1.5,
              opacity:     0.8,
              fillColor:   color,
              fillOpacity: 0.07,
            };
          },
          onEachFeature: (feat, lyr) => {
            const p     = feat.properties ?? {};
            const color = String(p.color ?? "#22C55E");
            lyr.bindTooltip(tooltipHtml(p), { sticky: true, opacity: 0.97 });
            lyr.on({
              mouseover(e) {
                (e.target as L.Path).setStyle({ fillOpacity: 0.22, weight: 2.5 });
                (e.target as L.Path).bringToFront();
              },
              mouseout(e) {
                (e.target as L.Path).setStyle({ fillOpacity: 0.07, weight: 1.5 });
              },
            });
            void color;
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

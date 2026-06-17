"use client";

import { useEffect, useRef, useState } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

interface Props { visible: boolean; }

function hotspotColor(intensity: number): string {
  const t = Math.max(0, Math.min(1, intensity / 100));
  const r = Math.round(7   + t * (34  - 7));
  const g = Math.round(18  + t * (197 - 18));
  const b = Math.round(9   + t * (94  - 9));
  return `rgb(${r},${g},${b})`;
}

export default function HotspotPolygonLayer({ visible }: Props) {
  const map = useMap();
  const layerRef = useRef<L.GeoJSON | null>(null);
  const [geoData, setGeoData] = useState<GeoJSON.FeatureCollection | null>(null);

  useEffect(() => {
    fetch("/data/gis_outputs/hotspots.geojson")
      .then(r => r.json())
      .then(setGeoData)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; }
    if (!visible || !geoData) return;

    const layer = L.geoJSON(geoData as any, {
      style: (f) => {
        const intensity: number = f?.properties?.intensity_score ?? 0;
        const color = hotspotColor(intensity);
        return { fillColor: color, fillOpacity: 0.22 + (intensity / 100) * 0.18, color, weight: 0.5, opacity: 0.5 };
      },
      onEachFeature: (f, l) => {
        const p = f.properties ?? {};
        const intensity: number = p.intensity_score ?? 0;
        const color = hotspotColor(intensity);
        l.bindPopup(`
          <div style="font-size:11px;min-width:160px;font-family:system-ui,sans-serif">
            <div style="font-weight:700;font-size:12px;margin-bottom:6px;color:#DCE8DC;border-bottom:1px solid #1A3D20;padding-bottom:4px">
              🔥 Hotspot Comercial
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px 8px">
              <span style="color:#7A9C7A">Intensidad</span>
              <span style="font-family:monospace;font-weight:700;text-align:right" style="color:${color}">${intensity.toFixed(1)}/100</span>
              <span style="color:#7A9C7A">Clientes</span>
              <span style="font-family:monospace;color:#DCE8DC;text-align:right">${(p.n_clientes ?? 0).toLocaleString("es-AR")}</span>
              <span style="color:#7A9C7A">Provincia</span>
              <span style="font-family:monospace;color:#DCE8DC;text-align:right">${p.dominant_provincia ?? ""}</span>
              <span style="color:#7A9C7A">Área</span>
              <span style="font-family:monospace;color:#DCE8DC;text-align:right">${Math.round((p.area_km2 ?? 0) / 1000)}k km²</span>
            </div>
          </div>`, { maxWidth: 220, className: "agronova-popup" }
        );
        (l as L.Path).on({
          mouseover(e) { (e.target as L.Path).setStyle({ fillOpacity: 0.55, weight: 1.5 }); },
          mouseout(e) {
            const int: number = (e.target as any).feature?.properties?.intensity_score ?? 0;
            (e.target as L.Path).setStyle({ fillOpacity: 0.22 + (int / 100) * 0.18, weight: 0.5 });
          },
        });
      },
    });
    layer.addTo(map);
    layerRef.current = layer;
    return () => { if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; } };
  }, [visible, geoData, map]);

  return null;
}

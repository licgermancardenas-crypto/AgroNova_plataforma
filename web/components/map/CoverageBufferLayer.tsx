"use client";

import { useEffect, useRef, useState } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

interface Props { visible: boolean; }

export default function CoverageBufferLayer({ visible }: Props) {
  const map = useMap();
  const layerRef = useRef<L.GeoJSON | null>(null);
  const [geoData, setGeoData] = useState<GeoJSON.FeatureCollection | null>(null);

  useEffect(() => {
    fetch("/data/gis_outputs/coverage_buffers.geojson")
      .then(r => r.json())
      .then(setGeoData)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; }
    if (!visible || !geoData) return;

    const layer = L.geoJSON(geoData as any, {
      style: () => ({
        fillColor: "#22C55E",
        fillOpacity: 0.06,
        color: "#22C55E",
        weight: 1.2,
        opacity: 0.35,
        dashArray: "5 5",
      }),
      onEachFeature: (f, l) => {
        const p = f.properties ?? {};
        l.bindPopup(`
          <div style="font-size:11px;min-width:155px;font-family:system-ui,sans-serif">
            <div style="font-weight:700;font-size:12px;margin-bottom:6px;color:#22C55E;border-bottom:1px solid #1A3D20;padding-bottom:4px">
              Zona de Cobertura
            </div>
            ${p.sucursal_id ? `<div style="color:#7A9C7A">Sucursal ID: <span style="color:#DCE8DC;font-family:monospace">${p.sucursal_id}</span></div>` : ""}
            ${p.radio_km ? `<div style="color:#7A9C7A">Radio: <span style="color:#DCE8DC;font-family:monospace">${p.radio_km} km</span></div>` : ""}
          </div>`, { maxWidth: 200, className: "agronova-popup" }
        );
        (l as L.Path).on({
          mouseover(e) { (e.target as L.Path).setStyle({ fillOpacity: 0.14, weight: 2 }); },
          mouseout(e) { (e.target as L.Path).setStyle({ fillOpacity: 0.06, weight: 1.2 }); },
        });
      },
    });
    layer.addTo(map);
    layerRef.current = layer;
    return () => { if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; } };
  }, [visible, geoData, map]);

  return null;
}

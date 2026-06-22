"use client";

import { useEffect, useRef, useState } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

interface Props { visible: boolean; }

export default function DepartamentosLayer({ visible }: Props) {
  const map = useMap();
  const layerRef = useRef<L.GeoJSON | null>(null);
  const [geoData, setGeoData] = useState<GeoJSON.FeatureCollection | null>(null);

  useEffect(() => {
    fetch("/data/geo/departamentos_hq.geojson")
      .then(r => r.json())
      .then(setGeoData)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; }
    if (!visible || !geoData) return;

    const layer = L.geoJSON(geoData as any, {
      style: {
        color: "#4ADE80",
        weight: 0.5,
        opacity: 0.30,
        fillColor: "transparent",
        fillOpacity: 0,
      },
      onEachFeature: (f, l) => {
        const p = f.properties ?? {};
        const nombre = p.nombre ?? p.nam ?? p.NAME ?? "Departamento";
        const prov = (p.provincia as { nombre?: string })?.nombre ?? p.nam_prov ?? "";
        l.bindTooltip(
          `<div style="font-size:10px;font-family:system-ui,sans-serif;padding:3px 6px;background:#0D1F0F;border:1px solid #1A3D20;border-radius:4px">
            <div style="font-weight:600;color:#DCE8DC">${nombre}</div>
            ${prov ? `<div style="color:#7A9C7A;font-size:9px">${prov}</div>` : ""}
          </div>`,
          { sticky: true, direction: "top", className: "" }
        );
        (l as L.Path).on({
          mouseover(e) { (e.target as L.Path).setStyle({ opacity: 0.75, weight: 1.2, color: "#22C55E" }); },
          mouseout(e)  { (e.target as L.Path).setStyle({ opacity: 0.30, weight: 0.5, color: "#4ADE80" }); },
        });
      },
    });

    layer.addTo(map);
    layerRef.current = layer;

    return () => { if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; } };
  }, [visible, geoData, map]);

  return null;
}

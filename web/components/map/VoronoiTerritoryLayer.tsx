"use client";

import { useEffect, useRef, useState } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

const TERRITORY_COLORS: Record<string, string> = {
  "Rosario":    "#22C55E",
  "Pergamino":  "#4ADE80",
  "Tandil":     "#0DB87E",
  "Río Cuarto": "#A3E635",
  "Paraná":     "#0EA5E9",
};

interface Props { visible: boolean; }

export default function VoronoiTerritoryLayer({ visible }: Props) {
  const map = useMap();
  const layerRef = useRef<L.GeoJSON | null>(null);
  const [geoData, setGeoData] = useState<GeoJSON.FeatureCollection | null>(null);

  useEffect(() => {
    fetch("/data/gis_outputs/territories.geojson")
      .then(r => r.json())
      .then(setGeoData)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; }
    if (!visible || !geoData) return;

    const layer = L.geoJSON(geoData as any, {
      style: (f) => {
        const color = TERRITORY_COLORS[f?.properties?.nombre ?? ""] ?? "#22C55E";
        return { fillColor: color, fillOpacity: 0.07, color, weight: 1.5, opacity: 0.45, dashArray: "8 4" };
      },
      onEachFeature: (f, l) => {
        const p = f.properties ?? {};
        const color = TERRITORY_COLORS[p.nombre ?? ""] ?? "#22C55E";
        l.bindPopup(`
          <div style="font-size:11px;min-width:165px;font-family:system-ui,sans-serif">
            <div style="font-weight:700;font-size:12px;margin-bottom:6px;color:#DCE8DC;border-bottom:1px solid #1A3D20;padding-bottom:4px">
              <span style="color:${color}">⬡</span> Territorio · ${p.nombre ?? ""}
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px 8px">
              <span style="color:#7A9C7A">Clientes</span>
              <span style="font-family:monospace;color:#DCE8DC;text-align:right">${(p.n_clientes_territorio ?? 0).toLocaleString("es-AR")}</span>
              <span style="color:#7A9C7A">Área</span>
              <span style="font-family:monospace;color:#DCE8DC;text-align:right">${Math.round((p.area_km2 ?? 0) / 1000)}k km²</span>
            </div>
            <div style="color:#7A9C7A;margin-top:5px;font-size:10px">${(p.provincias ?? []).slice(0, 4).join(", ")}${(p.provincias ?? []).length > 4 ? "…" : ""}</div>
          </div>`, { maxWidth: 230, className: "agronova-popup" }
        );
        (l as L.Path).on({
          mouseover(e) { (e.target as L.Path).setStyle({ fillOpacity: 0.18, weight: 2.5 }); },
          mouseout(e) { (e.target as L.Path).setStyle({ fillOpacity: 0.07, weight: 1.5 }); },
        });
      },
    });
    layer.addTo(map);
    layerRef.current = layer;
    return () => { if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; } };
  }, [visible, geoData, map]);

  return null;
}

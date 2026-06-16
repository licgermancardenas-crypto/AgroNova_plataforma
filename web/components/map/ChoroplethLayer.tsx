"use client";

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import type { GisMetric, ProvinceKPI } from "@/types";
import { provinceColor, getMetricValue, KPI_INDEX } from "@/lib/geo-data";
import { fmtARS, fmtNumber } from "@/lib/formatters";

interface Props {
  geoData: GeoJSON.FeatureCollection | null;
  metric: GisMetric;
  allKpis: ProvinceKPI[];
  onProvinceClick: (kpi: ProvinceKPI) => void;
}

function popupHtml(kpi: ProvinceKPI, metric: GisMetric): string {
  const metricColor = metric === "churn" ? "#E03E3E" : "#22C55E";
  const metricVal = metric === "revenue"
    ? fmtARS(kpi.revenue_ars, true)
    : metric === "clientes"
    ? fmtNumber(kpi.n_activos)
    : metric === "margen"
    ? `${kpi.margen_pct.toFixed(1)}%`
    : `${(kpi.churn_score * 100).toFixed(0)}%`;

  return `
    <div style="font-size:11px;min-width:170px;font-family:system-ui,sans-serif">
      <div style="font-weight:700;font-size:12px;margin-bottom:8px;color:#DCE8DC;border-bottom:1px solid #1A3D20;padding-bottom:5px">
        ${kpi.nombre}
        <span style="font-weight:400;font-size:10px;color:#7A9C7A;margin-left:4px">${kpi.macro_region}</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 8px">
        <span style="color:#7A9C7A">Revenue</span>
        <span style="font-family:monospace;color:#22C55E;text-align:right">${fmtARS(kpi.revenue_ars, true)}</span>
        <span style="color:#7A9C7A">Part. %</span>
        <span style="font-family:monospace;color:#A3E635;text-align:right">${kpi.revenue_pct.toFixed(1)}%</span>
        <span style="color:#7A9C7A">Clientes</span>
        <span style="font-family:monospace;color:#DCE8DC;text-align:right">${fmtNumber(kpi.n_activos)} / ${fmtNumber(kpi.n_clientes)}</span>
        <span style="color:#7A9C7A">Margen</span>
        <span style="font-family:monospace;color:#DCE8DC;text-align:right">${kpi.margen_pct.toFixed(1)}%</span>
        <span style="color:#7A9C7A">OTIF</span>
        <span style="font-family:monospace;color:${kpi.otif_pct >= 90 ? "#22C55E" : kpi.otif_pct >= 85 ? "#E8A020" : "#E03E3E"};text-align:right">${kpi.otif_pct.toFixed(1)}%</span>
        <span style="color:#7A9C7A">Riesgo Churn</span>
        <span style="font-family:monospace;color:${kpi.churn_score > 0.35 ? "#E03E3E" : kpi.churn_score > 0.25 ? "#E8A020" : "#22C55E"};text-align:right">${(kpi.churn_score * 100).toFixed(0)}%</span>
      </div>
      <div style="margin-top:8px;padding-top:6px;border-top:1px solid #1A3D20;display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:10px;color:#7A9C7A">Métrica activa</span>
        <span style="font-family:monospace;font-weight:700;color:${metricColor}">${metricVal}</span>
      </div>
    </div>`;
}

export default function ChoroplethLayer({ geoData, metric, allKpis, onProvinceClick }: Props) {
  const map = useMap();
  const layerRef = useRef<L.GeoJSON | null>(null);

  useEffect(() => {
    if (!geoData) return;

    if (layerRef.current) {
      map.removeLayer(layerRef.current);
    }

    const layer = L.geoJSON(geoData as GeoJSON.GeoJsonObject, {
      style: (feature) => {
        const nombre = feature?.properties?.nombre ?? "";
        const kpi = KPI_INDEX[nombre];
        return {
          fillColor:   kpi ? provinceColor(kpi, metric, allKpis) : "#071209",
          fillOpacity: kpi ? 0.72 : 0.08,
          color:       "#1A3D20",
          weight:      0.8,
          opacity:     0.9,
        };
      },
      onEachFeature: (feature, layer) => {
        const nombre = feature.properties?.nombre ?? "";
        const kpi = KPI_INDEX[nombre];

        if (kpi) {
          layer.bindPopup(popupHtml(kpi, metric), {
            className:   "agronova-popup",
            maxWidth:    240,
            closeButton: true,
          });

          layer.on({
            mouseover(e) {
              const l = e.target as L.Path;
              l.setStyle({ fillOpacity: 0.92, weight: 1.8, color: "#22C55E" });
              l.bringToFront();
            },
            mouseout(e) {
              const l = e.target as L.Path;
              l.setStyle({ fillOpacity: 0.72, weight: 0.8, color: "#1A3D20" });
            },
            click() {
              onProvinceClick(kpi);
            },
          });
        }
      },
    });

    layer.addTo(map);
    layerRef.current = layer;

    return () => {
      if (layerRef.current) map.removeLayer(layerRef.current);
    };
  }, [geoData, metric, allKpis, map, onProvinceClick]);

  return null;
}

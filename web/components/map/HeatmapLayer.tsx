"use client";

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import type { ProvinceKPI, GisMetric } from "@/types";
import { getMetricValue } from "@/lib/geo-data";

interface Props {
  kpis: ProvinceKPI[];
  metric: GisMetric;
  visible: boolean;
}

export default function HeatmapLayer({ kpis, metric, visible }: Props) {
  const map       = useMap();
  const layerRef  = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }
    if (!visible || kpis.length === 0) return;

    const values = kpis.map(k => getMetricValue(k, metric));
    const max    = Math.max(...values);
    const min    = Math.min(...values);

    const group = L.layerGroup();

    kpis.forEach(kpi => {
      const val = getMetricValue(kpi, metric);
      if (val <= 0) return;

      const t = max === min ? 0 : (val - min) / (max - min);

      const isChurn = metric === "churn";
      const baseR   = isChurn ? [224, 62,  62]  : [34,  197, 94];
      const peakR   = isChurn ? [255, 100, 100] : [163, 230, 53];

      // Outer halo — very soft, blends provinces together
      group.addLayer(L.circle([kpi.lat, kpi.lon], {
        radius:      Math.round(70_000 + t * 280_000),
        color:       "transparent",
        fillColor:   `rgba(${baseR[0]},${baseR[1]},${baseR[2]},1)`,
        fillOpacity: 0.025 + t * 0.045,
        interactive: false,
      }));

      // Mid-ring — concentrated glow
      group.addLayer(L.circle([kpi.lat, kpi.lon], {
        radius:      Math.round(25_000 + t * 95_000),
        color:       "transparent",
        fillColor:   `rgba(${baseR[0]},${baseR[1]},${baseR[2]},1)`,
        fillOpacity: 0.06 + t * 0.10,
        interactive: false,
      }));

      // Core peak (only for t > 0.45 to avoid clutter)
      if (t > 0.45) {
        group.addLayer(L.circle([kpi.lat, kpi.lon], {
          radius:      Math.round(8_000 + t * 28_000),
          color:       "transparent",
          fillColor:   `rgba(${peakR[0]},${peakR[1]},${peakR[2]},1)`,
          fillOpacity: 0.12 + t * 0.18,
          interactive: false,
        }));
      }
    });

    group.addTo(map);
    layerRef.current = group;

    return () => {
      if (layerRef.current) map.removeLayer(layerRef.current);
    };
  }, [kpis, metric, visible, map]);

  return null;
}

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

      const t       = max === min ? 0 : (val - min) / (max - min);
      const radius  = Math.round(30_000 + t * 120_000); // 30–150 km in meters
      const opacity = 0.04 + t * 0.14;

      const color = metric === "churn"
        ? `rgba(224,62,62,${opacity})`
        : `rgba(34,197,94,${opacity})`;

      const circle = L.circle([kpi.lat, kpi.lon], {
        radius,
        color:       "transparent",
        fillColor:   color,
        fillOpacity: 1,
        interactive: false,
      });
      group.addLayer(circle);
    });

    group.addTo(map);
    layerRef.current = group;

    return () => {
      if (layerRef.current) map.removeLayer(layerRef.current);
    };
  }, [kpis, metric, visible, map]);

  return null;
}

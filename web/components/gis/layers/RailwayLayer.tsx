"use client";

import { useEffect, useRef, useState, memo } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import type { RailwayFeatureProps } from "@/types";
import { TRANSPORT_STYLE, railwayTooltip } from "@/lib/transport-network";

interface Props { visible: boolean; }

const STYLE = TRANSPORT_STYLE.ferrocarril;
const PANE  = "railwayPane";

function RailwayLayer({ visible }: Props) {
  const map = useMap();
  const [data, setData] = useState<GeoJSON.FeatureCollection | null>(null);
  const groupRef = useRef<L.LayerGroup | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!visible || fetchedRef.current) return;
    fetchedRef.current = true;
    fetch("/data/geo/transport/railway.geojson")
      .then(r => r.json())
      .then(setData)
      .catch(() => { fetchedRef.current = false; });
  }, [visible]);

  useEffect(() => {
    if (!map.getPane(PANE)) {
      const pane = map.createPane(PANE);
      pane.style.zIndex = "415";
    }
  }, [map]);

  useEffect(() => {
    if (groupRef.current) { map.removeLayer(groupRef.current); groupRef.current = null; }
    if (!visible || !data) return;

    const group = L.layerGroup();
    const renderer = L.canvas({ pane: PANE });

    // subtle glow — a wider, faint duplicate underneath the crisp line
    const glow = L.geoJSON(data, {
      pane: PANE,
      style: () => ({ color: STYLE.color, weight: STYLE.weight + 3, opacity: 0.12, renderer }),
      interactive: false,
    });
    glow.addTo(group);

    const main = L.geoJSON(data, {
      pane: PANE,
      style: () => ({ color: STYLE.color, weight: STYLE.weight, opacity: STYLE.opacity, dashArray: STYLE.dashArray, renderer }),
      onEachFeature: (feature, layer) => {
        const p = feature.properties as RailwayFeatureProps;
        layer.bindTooltip(
          railwayTooltip(p.nombre, p.operador, p.tipo, STYLE.color),
          { sticky: true, direction: "top" },
        );
        layer.on({
          mouseover: (e) => (e.target as L.Path).setStyle({ weight: STYLE.weight + 1.5, opacity: 1 }),
          mouseout:  (e) => (e.target as L.Path).setStyle({ weight: STYLE.weight, opacity: STYLE.opacity }),
        });
      },
    });
    main.addTo(group);

    group.addTo(map);
    groupRef.current = group;
    return () => { if (map && groupRef.current) { map.removeLayer(groupRef.current); groupRef.current = null; } };
  }, [visible, data, map]);

  return null;
}

export default memo(RailwayLayer);

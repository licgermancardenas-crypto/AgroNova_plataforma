"use client";

import { useEffect, useRef, useState, memo } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import type { RoadFeatureProps } from "@/types";
import { TRANSPORT_STYLE, roadTooltip } from "@/lib/transport-network";

interface Props { visible: boolean; }

const STYLE = TRANSPORT_STYLE.provincial;
const PANE  = "roadProvincialPane";

function RoadProvincialLayer({ visible }: Props) {
  const map = useMap();
  const [data, setData] = useState<GeoJSON.FeatureCollection | null>(null);
  const layerRef = useRef<L.GeoJSON | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!visible || fetchedRef.current) return;
    fetchedRef.current = true;
    fetch("/data/geo/transport/road_provincial.geojson")
      .then(r => r.json())
      .then(setData)
      .catch(() => { fetchedRef.current = false; });
  }, [visible]);

  useEffect(() => {
    if (!map.getPane(PANE)) {
      const pane = map.createPane(PANE);
      pane.style.zIndex = "405";
    }
  }, [map]);

  useEffect(() => {
    if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; }
    if (!visible || !data) return;

    const renderer = L.canvas({ pane: PANE });
    const gj = L.geoJSON(data, {
      pane: PANE,
      style: () => ({ color: STYLE.color, weight: STYLE.weight, opacity: STYLE.opacity, renderer }),
      onEachFeature: (feature, layer) => {
        const p = feature.properties as RoadFeatureProps;
        layer.bindTooltip(
          roadTooltip(p.nombre, "Ruta Provincial", p.longitud_km, p.provincia, STYLE.color),
          { sticky: true, direction: "top" },
        );
        layer.on({
          mouseover: (e) => (e.target as L.Path).setStyle({ weight: STYLE.weight + 1.2, opacity: 1 }),
          mouseout:  (e) => (e.target as L.Path).setStyle({ weight: STYLE.weight, opacity: STYLE.opacity }),
        });
      },
    });

    gj.addTo(map);
    layerRef.current = gj;
    return () => { if (map && layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; } };
  }, [visible, data, map]);

  return null;
}

export default memo(RoadProvincialLayer);

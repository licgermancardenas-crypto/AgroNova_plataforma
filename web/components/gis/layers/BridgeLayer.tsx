"use client";

import { useEffect, useRef, useState, memo } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import type { BridgeFeatureProps } from "@/types";
import { TRANSPORT_COLOR, bridgeTooltip } from "@/lib/transport-network";

interface Props { visible: boolean; }

const COLOR = TRANSPORT_COLOR.puente;
const PANE  = "bridgePane";

function bridgeIcon(): L.DivIcon {
  return L.divIcon({
    className: "",
    iconSize: [7, 7],
    iconAnchor: [3.5, 3.5],
    html: `<div style="width:7px;height:7px;border-radius:1px;background:${COLOR}55;border:1.2px solid ${COLOR};transform:rotate(45deg)"></div>`,
  });
}

function BridgeLayer({ visible }: Props) {
  const map = useMap();
  const [data, setData] = useState<GeoJSON.FeatureCollection | null>(null);
  const groupRef = useRef<L.LayerGroup | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!visible || fetchedRef.current) return;
    fetchedRef.current = true;
    fetch("/data/geo/transport/bridges.geojson")
      .then(r => r.json())
      .then(setData)
      .catch(() => { fetchedRef.current = false; });
  }, [visible]);

  useEffect(() => {
    if (!map.getPane(PANE)) {
      const pane = map.createPane(PANE);
      pane.style.zIndex = "420";
    }
  }, [map]);

  useEffect(() => {
    if (groupRef.current) { map.removeLayer(groupRef.current); groupRef.current = null; }
    if (!visible || !data) return;

    const group = L.layerGroup();
    const renderer = L.canvas({ pane: PANE });

    L.geoJSON(data, {
      pane: PANE,
      style: () => ({ color: COLOR, weight: 1.2, opacity: 0.45, renderer }),
      interactive: false,
    }).addTo(group);

    data.features.forEach((feature) => {
      const layer = L.geoJSON(feature);
      const center = layer.getBounds().isValid() ? layer.getBounds().getCenter() : null;
      if (!center) return;
      const p = feature.properties as BridgeFeatureProps;
      L.marker(center, { icon: bridgeIcon(), pane: PANE })
        .bindTooltip(bridgeTooltip(p.nombre, p.tipo, COLOR), { direction: "top" })
        .addTo(group);
    });

    group.addTo(map);
    groupRef.current = group;
    return () => { if (map && groupRef.current) { map.removeLayer(groupRef.current); groupRef.current = null; } };
  }, [visible, data, map]);

  return null;
}

export default memo(BridgeLayer);

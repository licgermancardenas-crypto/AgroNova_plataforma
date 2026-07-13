"use client";

import { useEffect, useRef, useState, memo } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import type { InfraFeatureProps, InfraCategoria } from "@/types";
import { TRANSPORT_COLOR, infraTooltip } from "@/lib/transport-network";

interface Props { visible: boolean; }

const PANE = "transportInfraPane";

const CATEGORY_LABEL: Record<InfraCategoria, string> = {
  peaje:       "Estación de peaje",
  combustible: "Estación de servicio",
};

const CATEGORY_RADIUS: Record<InfraCategoria, number> = {
  peaje:       4.5,
  combustible: 3,
};

function TransportInfrastructureLayer({ visible }: Props) {
  const map = useMap();
  const [data, setData] = useState<Record<InfraCategoria, GeoJSON.FeatureCollection> | null>(null);
  const groupRef = useRef<L.LayerGroup | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!visible || fetchedRef.current) return;
    fetchedRef.current = true;
    Promise.all([
      fetch("/data/geo/transport/toll_stations.geojson").then(r => r.json()),
      fetch("/data/geo/transport/fuel_stations.geojson").then(r => r.json()),
    ])
      .then(([peaje, combustible]) => setData({ peaje, combustible }))
      .catch(() => { fetchedRef.current = false; });
  }, [visible]);

  useEffect(() => {
    if (!map.getPane(PANE)) {
      const pane = map.createPane(PANE);
      pane.style.zIndex = "425";
    }
  }, [map]);

  useEffect(() => {
    if (groupRef.current) { map.removeLayer(groupRef.current); groupRef.current = null; }
    if (!visible || !data) return;

    const group = L.layerGroup();
    const renderer = L.canvas({ pane: PANE });

    (Object.entries(data) as [InfraCategoria, GeoJSON.FeatureCollection][]).forEach(([categoria, fc]) => {
      const color = TRANSPORT_COLOR[categoria];
      L.geoJSON(fc, {
        pane: PANE,
        pointToLayer: (feature, latlng) => L.circleMarker(latlng, {
          renderer,
          radius: CATEGORY_RADIUS[categoria],
          color,
          weight: 1,
          fillColor: color,
          fillOpacity: 0.55,
        }),
        onEachFeature: (feature, layer) => {
          const p = feature.properties as InfraFeatureProps;
          layer.bindTooltip(infraTooltip(p.nombre, CATEGORY_LABEL[categoria], color), { direction: "top" });
        },
      }).addTo(group);
    });

    group.addTo(map);
    groupRef.current = group;
    return () => { if (map && groupRef.current) { map.removeLayer(groupRef.current); groupRef.current = null; } };
  }, [visible, data, map]);

  return null;
}

export default memo(TransportInfrastructureLayer);

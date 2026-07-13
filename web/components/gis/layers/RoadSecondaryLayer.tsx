"use client";

import { useEffect, useRef, useState, memo } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import type { RoadFeatureProps, RoadSecondaryIndexEntry } from "@/types";
import { TRANSPORT_STYLE, roadTooltip } from "@/lib/transport-network";

interface Props {
  visible: boolean;
  /** Terciaria red is split per provincia (136k features nationwide) — only
   *  fetched/rendered once the user drills into a province. */
  filterProvince?: string | null;
}

const STYLE = TRANSPORT_STYLE.terciaria;
const PANE  = "roadSecondaryPane";

function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/,/g, "")
    .replace(/\s+/g, "-");
}

function RoadSecondaryLayer({ visible, filterProvince = null }: Props) {
  const map = useMap();
  const [index, setIndex] = useState<RoadSecondaryIndexEntry[] | null>(null);
  const cacheRef = useRef<Map<string, GeoJSON.FeatureCollection>>(new Map());
  const [tick, forceTick] = useState(0);
  const layerRef = useRef<L.GeoJSON | null>(null);

  useEffect(() => {
    if (!visible || index) return;
    fetch("/data/geo/transport/road_secondary/index.json")
      .then(r => r.json())
      .then(setIndex)
      .catch(() => {});
  }, [visible, index]);

  useEffect(() => {
    if (!visible || !filterProvince) return;
    const slug = slugify(filterProvince);
    if (cacheRef.current.has(slug)) return;
    fetch(`/data/geo/transport/road_secondary/${slug}.geojson`)
      .then(r => { if (!r.ok) throw new Error("no data for province"); return r.json(); })
      .then((fc: GeoJSON.FeatureCollection) => { cacheRef.current.set(slug, fc); forceTick(t => t + 1); })
      .catch(() => {});
  }, [visible, filterProvince]);

  useEffect(() => {
    if (!map.getPane(PANE)) {
      const pane = map.createPane(PANE);
      pane.style.zIndex = "400";
    }
  }, [map]);

  useEffect(() => {
    if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; }
    if (!visible || !filterProvince) return;

    const slug = slugify(filterProvince);
    const data = cacheRef.current.get(slug);
    if (!data) return;

    const renderer = L.canvas({ pane: PANE });
    const gj = L.geoJSON(data, {
      pane: PANE,
      style: () => ({ color: STYLE.color, weight: STYLE.weight, opacity: STYLE.opacity, dashArray: STYLE.dashArray, renderer }),
      onEachFeature: (feature, layer) => {
        const p = feature.properties as RoadFeatureProps;
        layer.bindTooltip(
          roadTooltip(p.nombre, "Camino Terciario", p.longitud_km, filterProvince, STYLE.color),
          { sticky: true, direction: "top" },
        );
      },
    });

    gj.addTo(map);
    layerRef.current = gj;
    return () => { if (map && layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; } };
  }, [visible, filterProvince, map, tick]);

  return null;
}

export default memo(RoadSecondaryLayer);

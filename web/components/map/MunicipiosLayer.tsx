"use client";

import { useEffect, useRef, useState } from "react";
import { useMapEvents } from "react-leaflet";
import L from "leaflet";

interface MunicipioFeature {
  type: "Feature";
  geometry: { type: "MultiPoint"; coordinates: [number, number][] };
  properties: {
    gid: number;
    nam: string;
    fna: string;
    gna: string;
    nam_prov: string;
    cod_prov: string;
  };
}

// nam_prov in the GeoJSON uses the full IGN name for TdF
const PROV_TO_NAM_PROV: Record<string, string> = {
  "Tierra del Fuego": "Tierra del Fuego, Antártida e Islas del Atlántico Sur",
};

interface Props {
  visible:         boolean;
  filterProvince?: string | null;
}

const MIN_ZOOM_INDIVIDUAL = 8;

function muniIcon(name: string) {
  const initial = (name ?? "M")[0].toUpperCase();
  return L.divIcon({
    html: `<div style="width:8px;height:8px;border-radius:50%;background:#0EA5E9;border:1px solid #38BDF8;opacity:0.85;box-shadow:0 0 6px rgba(14,165,233,0.5)"></div>`,
    className: "",
    iconSize: [8, 8],
    iconAnchor: [4, 4],
  });
}

function clusterIcon(count: number) {
  const size = Math.min(42, 20 + Math.round(Math.log(count) * 5));
  return L.divIcon({
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:rgba(14,165,233,0.25);border:1.5px solid #0EA5E9;display:flex;align-items:center;justify-content:center;font-family:monospace;font-size:${Math.max(8,size/3.5)}px;font-weight:700;color:#BAE6FD">${count > 999 ? "1k+" : count}</div>`,
    className: "",
    iconSize: [size, size],
    iconAnchor: [Math.floor(size / 2), Math.floor(size / 2)],
  });
}

// Province grid key for clustering
function gridKey(lat: number, lon: number, zoom: number): string {
  const cell = Math.max(0.5, 4 / Math.max(1, zoom - 3));
  return `${Math.floor(lat / cell)},${Math.floor(lon / cell)}`;
}

export default function MunicipiosLayer({ visible, filterProvince = null }: Props) {
  const [zoom, setZoom] = useState(5);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [features, setFeatures] = useState<MunicipioFeature[]>([]);

  const map = useMapEvents({
    zoomend() { setZoom(map.getZoom()); },
  });

  useEffect(() => { mapRef.current = map; }, [map]);

  useEffect(() => {
    fetch("/data/geojson/municipios_2022.geojson")
      .then(r => r.json())
      .then((fc: { features: MunicipioFeature[] }) => setFeatures(fc.features))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    if (layerRef.current) { mapRef.current.removeLayer(layerRef.current); layerRef.current = null; }
    if (!visible && !filterProvince) return;
    if (features.length === 0) return;

    const namProv = filterProvince
      ? (PROV_TO_NAM_PROV[filterProvince] ?? filterProvince)
      : null;
    const visibleFeatures = namProv
      ? features.filter(f => f.properties.nam_prov === namProv)
      : features;

    const group = L.layerGroup();

    // When drilling into a province always show individual markers
    if (zoom >= MIN_ZOOM_INDIVIDUAL || filterProvince) {
      visibleFeatures.forEach(f => {
        if (!f.geometry?.coordinates?.length) return;
        const coords = f.geometry.coordinates[0];
        const lat = coords[1];
        const lon = coords[0];
        if (!isFinite(lat) || !isFinite(lon)) return;

        const p = f.properties;
        const marker = L.marker([lat, lon], { icon: muniIcon(p.nam) });
        marker.bindTooltip(
          `<div style="font-size:10px;font-family:system-ui,sans-serif;padding:3px 6px;background:#0D1F0F;border:1px solid #0EA5E960;border-radius:4px">
            <div style="font-weight:600;color:#BAE6FD">${p.nam ?? "Municipio"}</div>
            <div style="color:#7A9C7A;font-size:9px">${p.gna ?? ""} · ${p.nam_prov ?? ""}</div>
          </div>`,
          { sticky: true, direction: "top", className: "" }
        );
        group.addLayer(marker);
      });
    } else {
      // Grid cluster
      const cells: Record<string, { count: number; lats: number[]; lons: number[]; prov: string }> = {};
      visibleFeatures.forEach(f => {
        if (!f.geometry?.coordinates?.length) return;
        const coords = f.geometry.coordinates[0];
        const lat = coords[1];
        const lon = coords[0];
        if (!isFinite(lat) || !isFinite(lon)) return;
        const key = gridKey(lat, lon, zoom);
        if (!cells[key]) cells[key] = { count: 0, lats: [], lons: [], prov: f.properties.nam_prov ?? "" };
        cells[key].count++;
        cells[key].lats.push(lat);
        cells[key].lons.push(lon);
      });

      Object.entries(cells).forEach(([, cell]) => {
        const lat = cell.lats.reduce((a, b) => a + b, 0) / cell.lats.length;
        const lon = cell.lons.reduce((a, b) => a + b, 0) / cell.lons.length;
        const marker = L.marker([lat, lon], { icon: clusterIcon(cell.count) });
        marker.bindTooltip(
          `<div style="font-size:10px;font-family:system-ui,sans-serif;padding:3px 6px;background:#0D1F0F;border:1px solid #0EA5E960;border-radius:4px;color:#BAE6FD">${cell.count} municipios</div>`,
          { sticky: true, direction: "top", className: "" }
        );
        group.addLayer(marker);
      });
    }

    group.addTo(mapRef.current);
    layerRef.current = group;

    return () => { if (mapRef.current && layerRef.current) { mapRef.current.removeLayer(layerRef.current); } };
  }, [features, visible, zoom, filterProvince]);

  return null;
}

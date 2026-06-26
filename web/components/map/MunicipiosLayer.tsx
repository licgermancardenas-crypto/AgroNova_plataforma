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

interface CustomerCoord {
  lat: number;
  lon: number;
}

// nam_prov in the GeoJSON uses the full IGN name for TdF
const PROV_TO_NAM_PROV: Record<string, string> = {
  "Tierra del Fuego": "Tierra del Fuego, Antártida e Islas del Atlántico Sur",
};

interface MuniClickData { name: string; lat: number; lon: number; }

interface Props {
  visible:                boolean;
  filterProvince?:        string | null;
  selectedMunicipality?:  string | null;
  onMunicipalityClick?:   (data: MuniClickData | null) => void;
}

const MIN_ZOOM_INDIVIDUAL = 8;

// Municipalities are "with clients" if any customer is within this radius
const CLIENT_RADIUS_KM = 10;

// Approximate planar distance in km (fast — no trig for pre-filtering)
function approxDistKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dlat = lat1 - lat2;
  const dlon = (lon1 - lon2) * Math.cos((lat1 * Math.PI) / 180);
  return Math.sqrt(dlat * dlat + dlon * dlon) * 111;
}

// Build the set of municipality GIDs that have at least one customer within CLIENT_RADIUS_KM
function buildClientSet(
  features: MunicipioFeature[],
  customers: CustomerCoord[]
): Set<number> {
  const result = new Set<number>();
  const degLat = CLIENT_RADIUS_KM / 111;       // ~0.225°
  const degLon = CLIENT_RADIUS_KM / (111 * 0.8); // rough lon tolerance

  for (const f of features) {
    if (!f.geometry?.coordinates?.length) continue;
    const [lon, lat] = f.geometry.coordinates[0];
    if (!isFinite(lat) || !isFinite(lon)) continue;
    for (const c of customers) {
      // Fast bounding box pre-filter
      if (Math.abs(c.lat - lat) > degLat || Math.abs(c.lon - lon) > degLon) continue;
      if (approxDistKm(lat, lon, c.lat, c.lon) <= CLIENT_RADIUS_KM) {
        result.add(f.properties.gid);
        break;
      }
    }
  }
  return result;
}

// Cluster icon — colors depend on whether the cluster contains municipalities with clients
function clusterIcon(count: number, hasClients: boolean) {
  const size = Math.min(40, 18 + Math.round(Math.log(count) * 5));
  const bg     = hasClients ? "rgba(14,165,233,0.16)" : "rgba(74,222,128,0.14)";
  const border = hasClients ? "#38BDF8"               : "#4ADE80";
  const fg     = hasClients ? "#BAE6FD"               : "#86EFAC";
  return L.divIcon({
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:${bg};border:1.5px solid ${border};
      display:flex;align-items:center;justify-content:center;
      font-family:monospace;font-size:${Math.max(8, size / 3.5)}px;
      font-weight:700;color:${fg}
    ">${count > 999 ? "1k+" : count}</div>`,
    className: "",
    iconSize:  [size, size],
    iconAnchor:[Math.floor(size / 2), Math.floor(size / 2)],
  });
}

// Province grid key for spatial clustering
function gridKey(lat: number, lon: number, zoom: number): string {
  const cell = Math.max(0.5, 4 / Math.max(1, zoom - 3));
  return `${Math.floor(lat / cell)},${Math.floor(lon / cell)}`;
}

export default function MunicipiosLayer({
  visible, filterProvince = null, selectedMunicipality = null, onMunicipalityClick,
}: Props) {
  const [zoom, setZoom]           = useState(5);
  const layerRef                  = useRef<L.LayerGroup | null>(null);
  const mapRef                    = useRef<L.Map | null>(null);
  const selectedRef               = useRef<string | null>(null);
  const [features, setFeatures]   = useState<MunicipioFeature[]>([]);
  const [clientGids, setClientGids] = useState<Set<number>>(new Set());

  const map = useMapEvents({ zoomend() { setZoom(map.getZoom()); } });

  useEffect(() => { mapRef.current = map; }, [map]);

  // Load municipality centroids
  useEffect(() => {
    fetch("/data/geojson/municipios_2022.geojson")
      .then(r => r.json())
      .then((fc: { features: MunicipioFeature[] }) => setFeatures(fc.features))
      .catch(() => {});
  }, []);

  // Load customer coordinates and compute proximity set (browser caches the JSON)
  useEffect(() => {
    if (features.length === 0) return;
    fetch("/data/customers/customers.json")
      .then(r => r.json())
      .then((customers: CustomerCoord[]) => {
        const valid = customers.filter(c => isFinite(c.lat) && isFinite(c.lon));
        setClientGids(buildClientSet(features, valid));
      })
      .catch(() => {});
  }, [features]);

  // Keep selectedRef in sync with prop (stale-closure-safe toggle)
  useEffect(() => { selectedRef.current = selectedMunicipality; }, [selectedMunicipality]);

  // Render / re-render whenever any dependency changes
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

    if (zoom >= MIN_ZOOM_INDIVIDUAL || filterProvince) {
      // ── Individual circleMarkers ───────────────────────────────────────────
      visibleFeatures.forEach(f => {
        if (!f.geometry?.coordinates?.length) return;
        const [lon, lat] = f.geometry.coordinates[0];
        if (!isFinite(lat) || !isFinite(lon)) return;

        const p          = f.properties;
        const hasClient  = clientGids.has(p.gid);
        const isSelected = p.nam === selectedMunicipality;

        const baseStyle: L.CircleMarkerOptions = isSelected
          ? { radius: 9, color: "#FCD34D", weight: 2.5, fillColor: "#FCD34D", fillOpacity: 0.20, opacity: 1 }
          : hasClient
          ? { radius: 6, color: "#38BDF8", weight: 1.5, fillColor: "#0EA5E9", fillOpacity: 0.22, opacity: 0.80 }
          : { radius: 5, color: "#4ADE80", weight: 1.2, fillColor: "transparent", fillOpacity: 0,    opacity: 0.45 };

        const hoverStyle: L.CircleMarkerOptions = isSelected
          ? { opacity: 1, weight: 3, fillOpacity: 0.35, fillColor: "#FCD34D" }
          : hasClient
          ? { opacity: 1, weight: 2, fillOpacity: 0.38, fillColor: "#0EA5E9" }
          : { opacity: 0.90, weight: 2, fillOpacity: 0.10, fillColor: "#4ADE80" };

        const marker = L.circleMarker([lat, lon], baseStyle);

        marker.bindTooltip(
          `<div style="font-size:10px;font-family:system-ui,sans-serif;padding:4px 8px;
              background:#0D1F0F;border:1px solid ${hasClient ? "#38BDF860" : "#4ADE8060"};border-radius:5px">
            <div style="font-weight:600;color:${hasClient ? "#BAE6FD" : "#86EFAC"}">${p.nam ?? "Municipio"}</div>
            <div style="color:#7A9C7A;font-size:9px;margin-top:1px">
              ${p.gna ?? ""} · ${p.nam_prov ?? ""}
              ${hasClient ? ' &nbsp;<span style="color:#38BDF8">● clientes</span>' : ""}
            </div>
          </div>`,
          { sticky: true, direction: "top", className: "" }
        );

        marker.on("mouseover", () => marker.setStyle(hoverStyle));
        marker.on("mouseout",  () => marker.setStyle(baseStyle));
        marker.on("click", () => {
          const isCur = selectedRef.current === p.nam;
          onMunicipalityClick?.(isCur ? null : { name: p.nam, lat, lon });
          if (!isCur) mapRef.current?.flyTo([lat, lon], 11, { animate: true, duration: 0.7 });
        });

        group.addLayer(marker);
      });

    } else {
      // ── Grid cluster ───────────────────────────────────────────────────────
      type CellEntry = { count: number; lats: number[]; lons: number[]; hasClient: boolean };
      const cells: Record<string, CellEntry> = {};

      visibleFeatures.forEach(f => {
        if (!f.geometry?.coordinates?.length) return;
        const [lon, lat] = f.geometry.coordinates[0];
        if (!isFinite(lat) || !isFinite(lon)) return;
        const key = gridKey(lat, lon, zoom);
        if (!cells[key]) cells[key] = { count: 0, lats: [], lons: [], hasClient: false };
        cells[key].count++;
        cells[key].lats.push(lat);
        cells[key].lons.push(lon);
        if (clientGids.has(f.properties.gid)) cells[key].hasClient = true;
      });

      Object.entries(cells).forEach(([, cell]) => {
        const lat = cell.lats.reduce((a, b) => a + b, 0) / cell.lats.length;
        const lon = cell.lons.reduce((a, b) => a + b, 0) / cell.lons.length;
        const marker = L.marker([lat, lon], { icon: clusterIcon(cell.count, cell.hasClient) });
        const label = cell.hasClient
          ? `${cell.count} municipios · <span style="color:#38BDF8">con clientes</span>`
          : `${cell.count} municipios`;
        marker.bindTooltip(
          `<div style="font-size:10px;font-family:system-ui,sans-serif;padding:3px 7px;
              background:#0D1F0F;border:1px solid ${cell.hasClient ? "#38BDF860" : "#4ADE8060"};
              border-radius:4px;color:${cell.hasClient ? "#BAE6FD" : "#86EFAC"}">${label}</div>`,
          { sticky: true, direction: "top", className: "" }
        );
        group.addLayer(marker);
      });
    }

    group.addTo(mapRef.current);
    layerRef.current = group;

    return () => {
      if (mapRef.current && layerRef.current) mapRef.current.removeLayer(layerRef.current);
    };
  }, [features, visible, zoom, filterProvince, clientGids, selectedMunicipality]);

  return null;
}

"use client";

import { MapContainer, TileLayer, Marker, Popup, Circle, ZoomControl, Polyline } from "react-leaflet";
import L from "leaflet";
import type { SucursalMarker, DepositoMarker, ClienteMapMarker, GISRoute, ProvinceKPI, GisMetric, BasemapId } from "@/types";
import { fmtARS } from "@/lib/formatters";
import { PROVINCE_KPIS } from "@/lib/geo-data";
import ChoroplethLayer       from "./ChoroplethLayer";
import ClientClusterLayer    from "./ClientClusterLayer";
import HeatmapLayer          from "./HeatmapLayer";
import MapLegend             from "./MapLegend";
import VoronoiTerritoryLayer from "./VoronoiTerritoryLayer";
import CoverageBufferLayer   from "./CoverageBufferLayer";
import CandidateBranchLayer  from "./CandidateBranchLayer";
import HotspotPolygonLayer   from "./HotspotPolygonLayer";
import RoutingRiskLayer      from "./RoutingRiskLayer";
import DepartamentosLayer    from "./DepartamentosLayer";
import MunicipiosLayer       from "./MunicipiosLayer";
import VialLayer             from "./VialLayer";
import PuertosLayer          from "./PuertosLayer";
import ScaleCoordsControl    from "./ScaleCoordsControl";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// ── Icons ─────────────────────────────────────────────────────────────────────

const sucursalIcon = L.divIcon({
  html: `<div style="position:relative;width:20px;height:20px;display:flex;align-items:center;justify-content:center">
    <div style="position:absolute;width:20px;height:20px;border-radius:50%;background:rgba(34,197,94,0.15);border:1.5px solid #22C55E;animation:none;box-shadow:0 0 16px rgba(34,197,94,0.6)"></div>
    <div style="width:8px;height:8px;border-radius:50%;background:#22C55E"></div>
  </div>`,
  className: "",
  iconSize:  [20, 20],
  iconAnchor:[10, 10],
});

const depositoIcon = L.divIcon({
  html: `<div style="position:relative;width:18px;height:18px;display:flex;align-items:center;justify-content:center">
    <div style="position:absolute;width:18px;height:18px;background:rgba(14,165,233,0.15);border:1.5px solid #0EA5E9;border-radius:3px;transform:rotate(0deg);box-shadow:0 0 12px rgba(14,165,233,0.5)"></div>
    <div style="width:7px;height:7px;background:#0EA5E9;border-radius:1px"></div>
  </div>`,
  className: "",
  iconSize:  [18, 18],
  iconAnchor:[9, 9],
});

// ── Basemap definitions ───────────────────────────────────────────────────────

export const BASEMAPS: Record<BasemapId, { url: string; attribution: string; label: string }> = {
  dark: {
    label: "Dark Matter",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap &copy; CARTO",
  },
  voyager: {
    label: "Carto Voyager",
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap &copy; CARTO",
  },
  esri_gray: {
    label: "Esri Gray",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ",
  },
  osm_hot: {
    label: "OSM Humanitarian",
    url: "https://tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap contributors, Tiles courtesy of HOT",
  },
  esri_imagery: {
    label: "Esri Imagery",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri &mdash; Source: Esri, Maxar, GeoEye, Earthstar Geographics",
  },
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  sucursales:         SucursalMarker[];
  depositos:          DepositoMarker[];
  clientes:           ClienteMapMarker[];
  routes?:            GISRoute[];
  // Basemap
  basemap:            BasemapId;
  // Layer toggles — analysis
  showChoropleth:     boolean;
  showHeatmap:        boolean;
  showRadios:         boolean;
  // Layer toggles — GIS-07
  showVoronoi:        boolean;
  showBuffers:        boolean;
  showCandidatos:     boolean;
  showHotspots:       boolean;
  showRoutingRisk:    boolean;
  // Layer toggles — GIS-08 real world
  showDepartamentos:  boolean;
  showMunicipios:     boolean;
  showVial:           boolean;
  showPuertos:        boolean;
  showCoords:         boolean;
  // Markers
  showSucursales:     boolean;
  showDepositos:      boolean;
  showClientes:       boolean;
  // Metric
  metric:             GisMetric;
  // GeoJSON
  geoData:            GeoJSON.FeatureCollection | null;
  geoLoading:         boolean;
  // Callbacks
  onProvinceClick:    (kpi: ProvinceKPI) => void;
}

export default function LeafletMap({
  sucursales, depositos, clientes, routes = [],
  basemap,
  showChoropleth, showHeatmap, showRadios,
  showVoronoi, showBuffers, showCandidatos, showHotspots, showRoutingRisk,
  showDepartamentos, showMunicipios, showVial, showPuertos, showCoords,
  showSucursales, showDepositos, showClientes,
  metric, geoData, geoLoading, onProvinceClick,
}: Props) {
  const bm = BASEMAPS[basemap];

  return (
    <MapContainer
      center={[-34, -64]}
      zoom={5}
      style={{ height: "100%", width: "100%" }}
      zoomControl={false}
    >
      <ZoomControl position="bottomright" />
      <TileLayer key={basemap} url={bm.url} attribution={bm.attribution} />

      {/* Scale bar + mouse coordinates */}
      <ScaleCoordsControl showCoords={showCoords} />

      {/* ── Polygon layers — bottom ──────────────────────────────── */}

      {/* Voronoi territory polygons */}
      <VoronoiTerritoryLayer visible={showVoronoi} />

      {/* Department borders */}
      <DepartamentosLayer visible={showDepartamentos} />

      {/* Province choropleth */}
      {showChoropleth && !geoLoading && geoData && (
        <ChoroplethLayer
          geoData={geoData}
          metric={metric}
          allKpis={PROVINCE_KPIS}
          onProvinceClick={onProvinceClick}
        />
      )}

      {/* Hotspot polygons */}
      <HotspotPolygonLayer visible={showHotspots} />

      {/* Coverage buffer polygons */}
      <CoverageBufferLayer visible={showBuffers} />

      {/* Commercial activity heatmap */}
      {showHeatmap && <HeatmapLayer kpis={PROVINCE_KPIS} metric={metric} visible={showHeatmap} />}

      {/* ── Line layers ──────────────────────────────────────────── */}

      {/* National road network */}
      <VialLayer visible={showVial} />

      {/* Sucursal coverage radii */}
      {showRadios && sucursales.map(s => (
        <Circle
          key={`r${s.id}`}
          center={[s.lat, s.lng]}
          radius={s.radio_km * 1000}
          pathOptions={{ color: "#22C55E", fillColor: "#22C55E", fillOpacity: 0.04, weight: 1, opacity: 0.25, dashArray: "6 4" }}
        />
      ))}

      {/* Logistics routing with risk coloring */}
      <RoutingRiskLayer visible={showRoutingRisk} />

      {/* Legacy static routes (non-risk view) */}
      {!showRoutingRisk && routes.map(r => (
        <Polyline
          key={`rt${r.id}`}
          positions={[r.from, r.to]}
          pathOptions={{
            color:     r.activo ? r.color : "#3E5A3E",
            weight:    r.activo ? 2 : 1,
            opacity:   r.activo ? 0.7 : 0.25,
            dashArray: r.activo ? undefined : "6 4",
          }}
        >
          <Popup>
            <div style={{ fontSize: 11 }}>
              <div style={{ fontWeight: 700, marginBottom: 3, color: "#DCE8DC" }}>{r.label}</div>
              {r.toneladas_mes && (
                <div style={{ color: "#7A9C7A" }}>Carga: <span style={{ color: "#22C55E", fontFamily: "monospace" }}>{r.toneladas_mes.toLocaleString()} ton/mes</span></div>
              )}
              <div style={{ color: "#7A9C7A" }}>Estado: <span style={{ color: r.activo ? "#22C55E" : "#E8A020" }}>{r.activo ? "Activa" : "Inactiva"}</span></div>
            </div>
          </Popup>
        </Polyline>
      ))}

      {/* ── Point / cluster layers ───────────────────────────────── */}

      {/* Ports & logistics nodes */}
      <PuertosLayer visible={showPuertos} />

      {/* Municipalities (zoom-aware clustering) */}
      <MunicipiosLayer visible={showMunicipios} />

      {/* Sucursales — green glow markers */}
      {showSucursales && sucursales.map(s => (
        <Marker key={`s${s.id}`} position={[s.lat, s.lng]} icon={sucursalIcon}>
          <Popup>
            <div style={{ fontSize: 11, minWidth: 155 }}>
              <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6, color: "#22C55E", borderBottom: "1px solid #1A3D20", paddingBottom: 4 }}>
                ◉ Sucursal · {s.nombre}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px 8px" }}>
                <span style={{ color: "#7A9C7A" }}>Revenue</span>
                <span style={{ color: "#22C55E", fontFamily: "monospace", textAlign: "right" }}>{fmtARS(s.revenue_ars, true)}</span>
                <span style={{ color: "#7A9C7A" }}>Clientes</span>
                <span style={{ color: "#DCE8DC", fontFamily: "monospace", textAlign: "right" }}>{s.clientes}</span>
                <span style={{ color: "#7A9C7A" }}>OTIF</span>
                <span style={{ color: s.otif_pct >= 92 ? "#22C55E" : "#E8A020", fontFamily: "monospace", textAlign: "right" }}>{s.otif_pct}%</span>
                <span style={{ color: "#7A9C7A" }}>Radio</span>
                <span style={{ color: "#DCE8DC", fontFamily: "monospace", textAlign: "right" }}>{s.radio_km} km</span>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Depósitos — blue square markers */}
      {showDepositos && depositos.map(d => (
        <Marker key={`d${d.id}`} position={[d.lat, d.lng]} icon={depositoIcon}>
          <Popup>
            <div style={{ fontSize: 11, minWidth: 150 }}>
              <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6, color: "#0EA5E9", borderBottom: "1px solid #0EA5E940", paddingBottom: 4 }}>
                ▣ Depósito · {d.nombre}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px 8px" }}>
                <span style={{ color: "#7A9C7A" }}>Capacidad</span>
                <span style={{ fontFamily: "monospace", color: "#DCE8DC", textAlign: "right" }}>{d.capacidad_ton.toLocaleString()} ton</span>
                <span style={{ color: "#7A9C7A" }}>Ocupación</span>
                <span style={{ fontFamily: "monospace", color: d.ocupacion_pct > 85 ? "#E03E3E" : d.ocupacion_pct > 70 ? "#E8A020" : "#22C55E", textAlign: "right" }}>{d.ocupacion_pct}%</span>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Clients — orange cluster */}
      <ClientClusterLayer clientes={clientes} visible={showClientes} />

      {/* Candidate branch locations */}
      <CandidateBranchLayer visible={showCandidatos} />

      {/* Dynamic legend */}
      <MapLegend metric={metric} kpis={PROVINCE_KPIS} />
    </MapContainer>
  );
}

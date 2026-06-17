"use client";

import { MapContainer, TileLayer, Marker, Popup, Circle, ZoomControl, Polyline } from "react-leaflet";
import L from "leaflet";
import type { SucursalMarker, DepositoMarker, ClienteMapMarker, GISRoute, ProvinceKPI, GisMetric } from "@/types";
import { fmtARS } from "@/lib/formatters";
import { PROVINCE_KPIS } from "@/lib/geo-data";
import ChoroplethLayer      from "./ChoroplethLayer";
import ClientClusterLayer   from "./ClientClusterLayer";
import HeatmapLayer         from "./HeatmapLayer";
import MapLegend            from "./MapLegend";
import VoronoiTerritoryLayer from "./VoronoiTerritoryLayer";
import CoverageBufferLayer   from "./CoverageBufferLayer";
import CandidateBranchLayer  from "./CandidateBranchLayer";
import HotspotPolygonLayer   from "./HotspotPolygonLayer";
import RoutingRiskLayer      from "./RoutingRiskLayer";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const sucursalIcon = L.divIcon({
  html: `<div style="width:16px;height:16px;border-radius:50%;background:#22C55E;border:2px solid #4ADE80;box-shadow:0 0 14px rgba(34,197,94,0.8)"></div>`,
  className: "",
  iconSize:  [16, 16],
  iconAnchor:[8, 8],
});

const depositoIcon = L.divIcon({
  html: `<div style="width:12px;height:12px;border-radius:3px;background:#E8A020;border:2px solid #E8A020;box-shadow:0 0 8px rgba(232,160,32,0.5)"></div>`,
  className: "",
  iconSize:  [12, 12],
  iconAnchor:[6, 6],
});

interface Props {
  sucursales:        SucursalMarker[];
  depositos:         DepositoMarker[];
  clientes:          ClienteMapMarker[];
  routes?:           GISRoute[];
  // Layer toggles — existing
  showChoropleth:    boolean;
  showHeatmap:       boolean;
  showSucursales:    boolean;
  showDepositos:     boolean;
  showClientes:      boolean;
  showRadios:        boolean;
  // Layer toggles — GIS-07
  showVoronoi:       boolean;
  showBuffers:       boolean;
  showCandidatos:    boolean;
  showHotspots:      boolean;
  showRoutingRisk:   boolean;
  // Metric
  metric:            GisMetric;
  // GeoJSON
  geoData:           GeoJSON.FeatureCollection | null;
  geoLoading:        boolean;
  // Callbacks
  onProvinceClick:   (kpi: ProvinceKPI) => void;
}

export default function LeafletMap({
  sucursales, depositos, clientes, routes = [],
  showChoropleth, showHeatmap, showSucursales, showDepositos, showClientes, showRadios,
  showVoronoi, showBuffers, showCandidatos, showHotspots, showRoutingRisk,
  metric, geoData, geoLoading, onProvinceClick,
}: Props) {
  return (
    <MapContainer
      center={[-34, -64]}
      zoom={5}
      style={{ height: "100%", width: "100%" }}
      zoomControl={false}
    >
      <ZoomControl position="bottomright" />
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution="&copy; OpenStreetMap &copy; CARTO"
      />

      {/* Voronoi territory polygons (bottom-most layer) */}
      <VoronoiTerritoryLayer visible={showVoronoi} />

      {/* Choropleth province fill */}
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
      {showHeatmap && (
        <HeatmapLayer kpis={PROVINCE_KPIS} metric={metric} visible={showHeatmap} />
      )}

      {/* Sucursal coverage radii (simple circles) */}
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

      {/* Legacy static routes (kept for non-risk view) */}
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
              {r.toneladas_mes && <div style={{ color: "#7A9C7A" }}>Carga: <span style={{ color: "#22C55E", fontFamily: "monospace" }}>{r.toneladas_mes.toLocaleString()} ton/mes</span></div>}
              <div style={{ color: "#7A9C7A" }}>Estado: <span style={{ color: r.activo ? "#22C55E" : "#E8A020" }}>{r.activo ? "Activa" : "Inactiva"}</span></div>
            </div>
          </Popup>
        </Polyline>
      ))}

      {/* Sucursales */}
      {showSucursales && sucursales.map(s => (
        <Marker key={`s${s.id}`} position={[s.lat, s.lng]} icon={sucursalIcon}>
          <Popup>
            <div style={{ fontSize: 11, minWidth: 150 }}>
              <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6, color: "#DCE8DC" }}>{s.nombre}</div>
              <div style={{ color: "#7A9C7A" }}>Revenue: <span style={{ color: "#22C55E", fontFamily: "monospace" }}>{fmtARS(s.revenue_ars, true)}</span></div>
              <div style={{ color: "#7A9C7A" }}>Clientes: <span style={{ color: "#DCE8DC", fontFamily: "monospace" }}>{s.clientes}</span></div>
              <div style={{ color: "#7A9C7A" }}>OTIF: <span style={{ color: s.otif_pct >= 92 ? "#22C55E" : "#E8A020", fontFamily: "monospace" }}>{s.otif_pct}%</span></div>
              <div style={{ color: "#7A9C7A" }}>Radio: <span style={{ color: "#DCE8DC", fontFamily: "monospace" }}>{s.radio_km} km</span></div>
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Depositos */}
      {showDepositos && depositos.map(d => (
        <Marker key={`d${d.id}`} position={[d.lat, d.lng]} icon={depositoIcon}>
          <Popup>
            <div style={{ fontSize: 11, minWidth: 140 }}>
              <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6, color: "#DCE8DC" }}>{d.nombre}</div>
              <div style={{ color: "#7A9C7A" }}>Capacidad: <span style={{ fontFamily: "monospace", color: "#DCE8DC" }}>{d.capacidad_ton.toLocaleString()} ton</span></div>
              <div style={{ color: "#7A9C7A" }}>Ocupación: <span style={{ fontFamily: "monospace", color: d.ocupacion_pct > 85 ? "#E03E3E" : d.ocupacion_pct > 70 ? "#E8A020" : "#22C55E" }}>{d.ocupacion_pct}%</span></div>
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Clients with zoom-aware clustering */}
      <ClientClusterLayer clientes={clientes} visible={showClientes} />

      {/* Candidate branch locations */}
      <CandidateBranchLayer visible={showCandidatos} />

      {/* Dynamic legend */}
      <MapLegend metric={metric} kpis={PROVINCE_KPIS} />
    </MapContainer>
  );
}

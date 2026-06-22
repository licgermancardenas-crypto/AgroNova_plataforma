"use client";

import { MapContainer, TileLayer, Marker, Popup, Circle, ZoomControl, Polyline } from "react-leaflet";
import L from "leaflet";
import type { SucursalMarker, DepositoMarker, ClienteMapMarker, GISRoute, ProvinceKPI, GisMetric, BasemapId } from "@/types";
import { fmtARS } from "@/lib/formatters";
import ChoroplethLayer   from "./ChoroplethLayer";
import ClientClusterLayer from "./ClientClusterLayer";
import HeatmapLayer      from "./HeatmapLayer";
import MapLegend         from "./MapLegend";
import DepartamentosLayer     from "./DepartamentosLayer";
import MunicipiosLayer        from "./MunicipiosLayer";
import VialLayer              from "./VialLayer";
import PuertosLayer           from "./PuertosLayer";
import ScaleCoordsControl     from "./ScaleCoordsControl";
import HotspotsLayer          from "./HotspotsLayer";
import TerritoriesLayer       from "./TerritoriesLayer";
import CoverageBuffersLayer   from "./CoverageBuffersLayer";
import CandidateBranchesLayer from "./CandidateBranchesLayer";
import ServiceAreasLayer      from "./ServiceAreasLayer";
import DeckOverlay            from "./DeckOverlay";
import FlowAnimationLayer    from "@/components/gis/FlowAnimationLayer";
import VehicleLayer          from "@/components/gis/VehicleLayer";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// ── Icons ─────────────────────────────────────────────────────────────────────

// Sucursal: hex-shaped pulse icon (30x30, prominent)
const sucursalIcon = L.divIcon({
  html: `<div style="position:relative;width:30px;height:30px;display:flex;align-items:center;justify-content:center">
    <div style="position:absolute;width:30px;height:30px;border-radius:50%;
      background:rgba(34,197,94,0.08);border:2px solid #22C55E;
      box-shadow:0 0 0 4px rgba(34,197,94,0.12),0 0 20px rgba(34,197,94,0.5)"></div>
    <div style="position:absolute;width:18px;height:18px;border-radius:50%;
      background:rgba(34,197,94,0.18);border:1.5px solid rgba(34,197,94,0.7)"></div>
    <div style="width:8px;height:8px;border-radius:50%;background:#22C55E;
      box-shadow:0 0 8px rgba(34,197,94,0.9)"></div>
  </div>`,
  className: "",
  iconSize:  [30, 30],
  iconAnchor:[15, 15],
});

// Depósito: size proportional to ocupacion_pct
function makeDepositoIcon(ocupacion: number): L.DivIcon {
  const size  = Math.round(14 + (ocupacion / 100) * 12); // 14-26px
  const color = ocupacion > 85 ? "#E03E3E" : ocupacion > 70 ? "#E8A020" : "#0EA5E9";
  const glow  = ocupacion > 85 ? "rgba(224,62,62,0.6)" : ocupacion > 70 ? "rgba(232,160,32,0.5)" : "rgba(14,165,233,0.5)";
  return L.divIcon({
    html: `<div style="position:relative;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center">
      <div style="position:absolute;width:${size}px;height:${size}px;
        background:${color}18;border:1.5px solid ${color};border-radius:3px;
        box-shadow:0 0 10px ${glow}"></div>
      <div style="width:${Math.round(size*0.4)}px;height:${Math.round(size*0.4)}px;
        background:${color};border-radius:1px"></div>
    </div>`,
    className: "",
    iconSize:  [size, size],
    iconAnchor:[size / 2, size / 2],
  });
}

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
  osm_topo: {
    label: "OpenTopoMap",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: "Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap (CC-BY-SA)",
  },
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  sucursales:         SucursalMarker[];
  depositos:          DepositoMarker[];
  clientes:           ClienteMapMarker[];
  routes?:            GISRoute[];
  // Basemap
  basemap:          BasemapId;
  // Layer toggles
  showChoropleth:   boolean;
  showHeatmap:      boolean;
  showDepartamentos:boolean;
  showMunicipios:   boolean;
  showVial:         boolean;
  showPuertos:      boolean;
  showSucursales:   boolean;
  showDepositos:    boolean;
  showClientes:     boolean;
  showRadios:       boolean;
  showCoords:       boolean;
  showHotspots:     boolean;
  showTerritorios:  boolean;
  showBuffers:      boolean;
  showCandidatos:   boolean;
  showServiceAreas: boolean;
  // Metric
  metric:           GisMetric;
  // KPIs (year-aware, passed from parent)
  allKpis:          ProvinceKPI[];
  // Selection
  selectedProvince:  string | null;
  compareProvinceA?: string | null;
  compareProvinceB?: string | null;
  // GeoJSON
  geoData:          GeoJSON.FeatureCollection | null;
  geoLoading:       boolean;
  // Deck.gl / WebGL (GIS-13)
  show3D:           boolean;
  show3DArcs:       boolean;
  showBeams:        boolean;
  metric3D:         GisMetric;
  // GIS-16 animation
  showFlows:        boolean;
  showVehicles:     boolean;
  showPulse:        boolean;
  animPlaying:      boolean;
  animSpeed:        1 | 2;
  // Callbacks
  onProvinceClick:    (kpi: ProvinceKPI) => void;
}

export default function LeafletMap({
  sucursales, depositos, clientes, routes = [],
  basemap,
  showChoropleth, showHeatmap, showDepartamentos, showMunicipios,
  showVial, showPuertos,
  showSucursales, showDepositos, showClientes, showRadios, showCoords,
  showHotspots, showTerritorios, showBuffers, showCandidatos, showServiceAreas,
  metric, allKpis, geoData, geoLoading, onProvinceClick, selectedProvince,
  compareProvinceA = null, compareProvinceB = null,
  show3D, show3DArcs, showBeams, metric3D,
  showFlows, showVehicles, showPulse, animPlaying, animSpeed,
}: Props) {
  const bm = BASEMAPS[basemap];

  return (
    <MapContainer
      center={[-34, -64]}
      zoom={5}
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      zoomControl={false}
    >
      <ZoomControl position="bottomright" />
      <TileLayer key={basemap} url={bm.url} attribution={bm.attribution} />

      {/* Scale bar + mouse coordinates */}
      <ScaleCoordsControl showCoords={showCoords} />

      {/* ── Polygon layers — bottom ──────────────────────────────── */}

      {/* Service areas (bottom-most polygon — largest shapes) */}
      <ServiceAreasLayer visible={showServiceAreas} />

      {/* Territorial Voronoi zones */}
      <TerritoriesLayer visible={showTerritorios} />

      {/* Coverage buffers */}
      <CoverageBuffersLayer visible={showBuffers} />

      {/* Hotspot polygons */}
      <HotspotsLayer visible={showHotspots} />

      {/* Department borders */}
      <DepartamentosLayer visible={showDepartamentos} />

      {/* Province choropleth — transparent in 3D mode, still handles clicks */}
      {showChoropleth && !geoLoading && geoData && (
        <ChoroplethLayer
          geoData={geoData}
          metric={metric}
          allKpis={allKpis}
          onProvinceClick={onProvinceClick}
          selectedProvince={selectedProvince}
          compareProvinceA={compareProvinceA}
          compareProvinceB={compareProvinceB}
          mode3D={show3D}
        />
      )}

      {/* Heatmap */}
      {showHeatmap && <HeatmapLayer kpis={allKpis} metric={metric} visible={showHeatmap} />}

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

      {/* Static routes */}
      {routes.map(r => (
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

      {/* Candidate expansion branches */}
      <CandidateBranchesLayer visible={showCandidatos} />

      {/* Municipalities (zoom-aware clustering; auto-shown when province selected) */}
      <MunicipiosLayer visible={showMunicipios} filterProvince={selectedProvince} />

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
        <Marker key={`d${d.id}`} position={[d.lat, d.lng]} icon={makeDepositoIcon(d.ocupacion_pct)}>
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

      {/* Clients — orange cluster; auto-shown filtered by province when drilling */}
      <ClientClusterLayer clientes={clientes} visible={showClientes} filterProvince={selectedProvince} />

      {/* Legend */}
      <MapLegend metric={metric} kpis={allKpis} />

      {/* ── Deck.gl WebGL overlay (GIS-13) ─────────────────────────── */}
      {(show3D || show3DArcs || showBeams) && (
        <DeckOverlay
          geoData={geoData}
          allKpis={allKpis}
          metric3D={metric3D}
          mode3D={show3D}
          showArcs={show3DArcs}
          showBeams={showBeams}
          sucursales={sucursales}
          onProvinceClick={onProvinceClick}
        />
      )}

      {/* ── GIS-16 canvas animation layers ─────────────────────────── */}
      {showFlows && (
        <FlowAnimationLayer
          sucursales={sucursales}
          allKpis={allKpis}
          playing={animPlaying}
          speed={animSpeed}
          showPulse={showPulse}
        />
      )}
      {showVehicles && (
        <VehicleLayer
          routes={routes}
          playing={animPlaying}
          speed={animSpeed}
        />
      )}
    </MapContainer>
  );
}

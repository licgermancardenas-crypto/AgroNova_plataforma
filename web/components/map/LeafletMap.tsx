"use client";

import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, ZoomControl } from "react-leaflet";
import L from "leaflet";
import type { SucursalMarker, DepositoMarker, ClienteMapMarker, ProvinceHeat, GISRoute } from "@/types";
import { fmtARS, riskBg } from "@/lib/formatters";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const sucursalIcon = L.divIcon({
  html: `<div style="width:14px;height:14px;border-radius:50%;background:#22C55E;border:2px solid #4ADE80;box-shadow:0 0 12px rgba(34,197,94,0.7)"></div>`,
  className: "",
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});
const depositoIcon = L.divIcon({
  html: `<div style="width:12px;height:12px;border-radius:3px;background:#E8A020;border:2px solid #E8A020;box-shadow:0 0 8px rgba(232,160,32,0.5)"></div>`,
  className: "",
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

function clientIcon(risk: string) {
  const c = risk === "High" ? "#E03E3E" : risk === "Medium" ? "#E8A020" : "#0DB87E";
  return L.divIcon({
    html: `<div style="width:8px;height:8px;border-radius:50%;background:${c};opacity:0.85"></div>`,
    className: "",
    iconSize: [8, 8],
    iconAnchor: [4, 4],
  });
}

function provinceIcon(revenue_pct: number) {
  const size = Math.max(6, Math.min(18, revenue_pct / 3));
  return L.divIcon({
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:rgba(34,197,94,0.25);border:1px solid rgba(34,197,94,0.6);box-shadow:0 0 ${size}px rgba(34,197,94,0.4)"></div>`,
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

interface Props {
  sucursales: SucursalMarker[];
  depositos: DepositoMarker[];
  clientes: ClienteMapMarker[];
  provinceHeat?: ProvinceHeat[];
  routes?: GISRoute[];
  showRadios?: boolean;
  showClientes?: boolean;
  showHeat?: boolean;
  showRoutes?: boolean;
  center?: [number, number];
  zoom?: number;
}

export default function LeafletMap({
  sucursales, depositos, clientes,
  provinceHeat = [], routes = [],
  showRadios = true, showClientes = true,
  showHeat = true, showRoutes = true,
  center = [-34, -64], zoom = 5,
}: Props) {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ height: "100%", width: "100%" }}
      zoomControl={false}
    >
      <ZoomControl position="bottomright" />
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; OpenStreetMap &copy; CARTO'
      />

      {/* Province heat zones */}
      {showHeat && provinceHeat.map(p => (
        <Circle
          key={`ph${p.nombre}`}
          center={[p.lat, p.lng]}
          radius={p.radio_km * 1000}
          pathOptions={{
            color: "#22C55E",
            fillColor: "#22C55E",
            fillOpacity: Math.min(0.18, p.revenue_pct / 200),
            weight: 1,
            opacity: 0.35,
          }}
        >
          <Popup>
            <div className="text-xs space-y-1">
              <p className="font-semibold text-sm">{p.nombre}</p>
              <p>Revenue: {fmtARS(p.revenue_ars, true)}</p>
              <p>Participación: {p.revenue_pct}%</p>
              <p>Clientes: {p.clientes}</p>
            </div>
          </Popup>
        </Circle>
      ))}

      {/* Logistics routes */}
      {showRoutes && routes.map(r => (
        <Polyline
          key={`rt${r.id}`}
          positions={[r.from, r.to]}
          pathOptions={{
            color: r.activo ? r.color : "#3E5A3E",
            weight: r.activo ? 2 : 1,
            opacity: r.activo ? 0.7 : 0.3,
            dashArray: r.activo ? undefined : "6 4",
          }}
        >
          <Popup>
            <div className="text-xs">
              <p className="font-semibold">{r.label}</p>
              {r.toneladas_mes && <p>Carga: {r.toneladas_mes.toLocaleString()} ton/mes</p>}
              <p>Estado: {r.activo ? "Activa" : "Inactiva"}</p>
            </div>
          </Popup>
        </Polyline>
      ))}

      {/* Coverage radii */}
      {showRadios && sucursales.map(s => (
        <Circle
          key={`r${s.id}`}
          center={[s.lat, s.lng]}
          radius={s.radio_km * 1000}
          pathOptions={{ color: "#22C55E", fillColor: "#22C55E", fillOpacity: 0.03, weight: 1, opacity: 0.2 }}
        />
      ))}

      {/* Sucursales */}
      {sucursales.map(s => (
        <Marker key={`s${s.id}`} position={[s.lat, s.lng]} icon={sucursalIcon}>
          <Popup>
            <div className="text-xs space-y-1">
              <p className="font-semibold text-sm">{s.nombre}</p>
              <p>Revenue: {fmtARS(s.revenue_ars, true)}</p>
              <p>Clientes: {s.clientes}</p>
              <p>OTIF: {s.otif_pct}%</p>
              <p>Radio: {s.radio_km} km</p>
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Depositos */}
      {depositos.map(d => (
        <Marker key={`d${d.id}`} position={[d.lat, d.lng]} icon={depositoIcon}>
          <Popup>
            <div className="text-xs space-y-1">
              <p className="font-semibold text-sm">{d.nombre}</p>
              <p>Capacidad: {d.capacidad_ton.toLocaleString()} ton</p>
              <p className={d.ocupacion_pct > 85 ? "text-red-400" : ""}>
                Ocupación: {d.ocupacion_pct}%
              </p>
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Clients */}
      {showClientes && clientes.map(c => (
        <Marker key={`c${c.cliente_id}`} position={[c.lat, c.lng]} icon={clientIcon(c.risk_level)}>
          <Popup>
            <div className="text-xs space-y-1">
              <p className="font-semibold">{c.razon_social}</p>
              <p>Tier: {c.tier} | Region: {c.region}</p>
              <p>Revenue: {fmtARS(c.revenue_ars, true)}</p>
              <p>Churn Risk: <span style={{ color: c.risk_level === "High" ? "#E03E3E" : c.risk_level === "Medium" ? "#E8A020" : "#0DB87E" }}>{c.risk_level}</span></p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

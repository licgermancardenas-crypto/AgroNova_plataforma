"use client";

import { MapContainer, TileLayer, Marker, Popup, Circle, ZoomControl } from "react-leaflet";
import L from "leaflet";
import type { SucursalMarker, DepositoMarker, ClienteMapMarker } from "@/types";
import { fmtARS, riskBg } from "@/lib/formatters";

// Fix default icon in webpack bundles
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const sucursalIcon = L.divIcon({
  html: `<div style="width:14px;height:14px;border-radius:50%;background:#1E6FDB;border:2px solid #4B9EF5;box-shadow:0 0 10px rgba(30,111,219,0.6)"></div>`,
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
    html: `<div style="width:8px;height:8px;border-radius:50%;background:${c};opacity:0.8"></div>`,
    className: "",
    iconSize: [8, 8],
    iconAnchor: [4, 4],
  });
}

interface Props {
  sucursales: SucursalMarker[];
  depositos: DepositoMarker[];
  clientes: ClienteMapMarker[];
  showRadios?: boolean;
  showClientes?: boolean;
}

export default function LeafletMap({
  sucursales, depositos, clientes,
  showRadios = true, showClientes = true,
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
        attribution='&copy; OpenStreetMap &copy; CARTO'
      />

      {/* Coverage radii */}
      {showRadios && sucursales.map(s => (
        <Circle
          key={`r${s.id}`}
          center={[s.lat, s.lng]}
          radius={s.radio_km * 1000}
          pathOptions={{ color: "#1E6FDB", fillColor: "#1E6FDB", fillOpacity: 0.04, weight: 1, opacity: 0.3 }}
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

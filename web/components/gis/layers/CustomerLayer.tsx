"use client";

import { useEffect, useRef, useState, memo } from "react";
import { useMapEvents } from "react-leaflet";
import L from "leaflet";
import type { CustomerGeo, CustomerFilters } from "@/types";
import { fmtARS } from "@/lib/formatters";

// ── constants ──────────────────────────────────────────────────────────────

const CHURN_COLOR = { Bajo: "#22C55E", Medio: "#F97316", Alto: "#E03E3E" } as const;
const TIER_SIZE   = { A: 12, B: 10, C: 8, D: 6 } as const;
const CLUSTER_ZOOM = 9;
const INFLUENCE_RADII = [25_000, 50_000, 100_000]; // metres

// ── helpers ────────────────────────────────────────────────────────────────

function haversineKm(la1: number, lo1: number, la2: number, lo2: number): number {
  const R = 6371;
  const dLa = (la2 - la1) * Math.PI / 180;
  const dLo = (lo2 - lo1) * Math.PI / 180;
  const a   = Math.sin(dLa / 2) ** 2
    + Math.cos(la1 * Math.PI / 180) * Math.cos(la2 * Math.PI / 180) * Math.sin(dLo / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function dotIcon(churn: string | undefined, revenue: number | undefined) {
  const color  = CHURN_COLOR[(churn as keyof typeof CHURN_COLOR) ?? "Medio"] ?? "#F97316";
  const rev    = revenue ?? 0;
  const base   = Math.max(7, Math.min(16, 7 + Math.log10(Math.max(rev, 1)) * 1.5));
  const size   = Math.round(base);
  const glow   = rev > 5e7 ? 10 : rev > 1e7 ? 6 : 3;
  return L.divIcon({
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;
      background:${color};border:1.5px solid ${color}99;
      box-shadow:0 0 ${glow}px ${color}88"></div>`,
    className: "",
    iconSize:   [size, size],
    iconAnchor: [Math.floor(size / 2), Math.floor(size / 2)],
  });
}

function clusterIcon(count: number, maxCount: number, avgChurn: string) {
  const t    = Math.sqrt(count / Math.max(maxCount, 1));
  const size = Math.round(22 + t * 24);
  const color = CHURN_COLOR[(avgChurn as keyof typeof CHURN_COLOR)] ?? "#F97316";
  const alpha = 0.35 + t * 0.35;
  return L.divIcon({
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;
      background:${color}${Math.round(alpha*255).toString(16).padStart(2,"0")};
      border:1.5px solid ${color};display:flex;align-items:center;justify-content:center;
      font-family:monospace;font-size:${Math.max(9,Math.round(size/3.2))}px;font-weight:700;
      color:#fff;box-shadow:0 0 ${Math.round(size/2)}px ${color}44">${count < 1000 ? count : "1k+"}</div>`,
    className: "",
    iconSize:   [size, size],
    iconAnchor: [Math.floor(size / 2), Math.floor(size / 2)],
  });
}

function gridKey(lat: number, lon: number, zoom: number): string {
  const cell = Math.max(0.4, 3.5 / Math.max(1, zoom - 3));
  return `${Math.floor(lat / cell)},${Math.floor(lon / cell)}`;
}

function buildPopupHtml(c: CustomerGeo): string {
  const churnColor = CHURN_COLOR[(c.churn_level as keyof typeof CHURN_COLOR)] ?? "#F97316";
  const churnPct   = Math.round((c.churn_score ?? 0) * 100);
  const bar = `<div style="height:3px;background:rgba(255,255,255,0.08);border-radius:2px;overflow:hidden;margin-top:2px">
    <div style="height:100%;width:${churnPct}%;background:${churnColor};border-radius:2px"></div></div>`;
  return `
<div style="font-family:system-ui,sans-serif;min-width:220px;max-width:252px;background:#071209;border-radius:6px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.6)">
  <div style="background:rgba(249,115,22,0.10);padding:8px 10px;border-bottom:1px solid rgba(249,115,22,0.18)">
    <div style="font-weight:700;font-size:12px;color:#DCE8DC;margin-bottom:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.razon_social}</div>
    <div style="font-size:9px;color:#7A9C7A">${c.segmento} · CUIT ${c.cuit ?? "—"}</div>
  </div>
  <div style="padding:8px 10px;display:flex;flex-direction:column;gap:4px">
    <div style="display:flex;gap:4px;flex-wrap:wrap">
      <span style="background:rgba(249,115,22,0.12);border:1px solid rgba(249,115,22,0.30);padding:2px 5px;border-radius:3px;font-size:9px;color:#F97316;font-weight:700">TIER ${c.tier ?? "?"}</span>
      <span style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.10);padding:2px 5px;border-radius:3px;font-size:9px;color:#A3E635">${c.provincia}</span>
      <span style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.10);padding:2px 5px;border-radius:3px;font-size:9px;color:#7A9C7A">${c.ciudad}</span>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:baseline;padding-top:2px">
      <span style="font-size:10px;color:#7A9C7A">Revenue</span>
      <span style="font-family:monospace;font-size:12px;font-weight:700;color:#22C55E">${fmtARS(c.revenue_ars ?? 0, true)}</span>
    </div>
    <div style="display:flex;justify-content:space-between">
      <span style="font-size:10px;color:#7A9C7A">Margen</span>
      <span style="font-size:10px;color:#A3E635;font-family:monospace">${c.margen_pct?.toFixed(1) ?? "—"}%</span>
    </div>
    <div style="display:flex;justify-content:space-between">
      <span style="font-size:10px;color:#7A9C7A">OTIF</span>
      <span style="font-size:10px;color:${(c.otif_pct ?? 0) >= 93 ? "#22C55E" : (c.otif_pct ?? 0) >= 88 ? "#F97316" : "#E03E3E"};font-family:monospace">${c.otif_pct?.toFixed(1) ?? "—"}%</span>
    </div>
    <div>
      <div style="display:flex;justify-content:space-between">
        <span style="font-size:10px;color:#7A9C7A">Churn</span>
        <span style="font-size:10px;color:${churnColor};font-weight:600">${c.churn_level} · ${churnPct}%</span>
      </div>
      ${bar}
    </div>
    <div style="display:flex;justify-content:space-between;padding-top:4px;border-top:1px solid rgba(255,255,255,0.05)">
      <span style="font-size:9px;color:#7A9C7A">Última compra</span>
      <span style="font-size:9px;color:#DCE8DC;font-family:monospace">${c.ultima_compra ?? "—"}</span>
    </div>
  </div>
</div>`;
}

function applyFilters(
  customers: CustomerGeo[],
  province:  string | null | undefined,
  filters:   CustomerFilters | null,
): CustomerGeo[] {
  let list = customers.filter(c => !c.is_outlier);
  if (province) list = list.filter(c => c.provincia === province);
  if (!filters) return list;

  if (filters.segmentos.length)   list = list.filter(c => filters.segmentos.includes(c.segmento ?? ""));
  if (filters.churnLevels.length) list = list.filter(c => filters.churnLevels.includes(c.churn_level ?? ""));
  if (filters.tiers.length)       list = list.filter(c => filters.tiers.includes(c.tier ?? ""));
  if (filters.provincias.length)  list = list.filter(c => filters.provincias.includes(c.provincia ?? ""));
  if (filters.revenueMin > 0)     list = list.filter(c => (c.revenue_ars ?? 0) >= filters.revenueMin);
  if (filters.revenueMax > 0)     list = list.filter(c => (c.revenue_ars ?? 0) <= filters.revenueMax);

  return list;
}

// ── component ──────────────────────────────────────────────────────────────

interface Sucursal { sucursal_id?: number; nombre: string; lat: number; lng: number; otif_pct?: number; }

interface Props {
  visible:          boolean;
  filterProvince?:  string | null;
  filters?:         CustomerFilters | null;
  selectedCustomer: CustomerGeo | null;
  onCustomerClick:  (c: CustomerGeo | null) => void;
  sucursales:       Sucursal[];
}

function CustomerLayerInner({
  visible, filterProvince = null, filters = null,
  selectedCustomer, onCustomerClick, sucursales,
}: Props) {
  const [zoom,      setZoom]      = useState(5);
  const [customers, setCustomers] = useState<CustomerGeo[]>([]);
  const layerRef   = useRef<L.LayerGroup | null>(null);
  const mapRef     = useRef<L.Map | null>(null);
  const selRef     = useRef<CustomerGeo | null>(null);
  const inflRef    = useRef<L.LayerGroup | null>(null);  // influence circles
  const routeRef   = useRef<L.LayerGroup | null>(null);  // sucursal line

  const map = useMapEvents({ zoomend() { setZoom(map.getZoom()); } });

  useEffect(() => { mapRef.current = map; }, [map]);
  useEffect(() => { selRef.current = selectedCustomer; }, [selectedCustomer]);

  // Load once
  useEffect(() => {
    fetch("/data/customers/customers.json")
      .then(r => r.json())
      .then((d: CustomerGeo[]) => setCustomers(d))
      .catch(() => {});
  }, []);

  // Draw/remove influence circles + sucursal line when selection changes
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;

    if (inflRef.current) { m.removeLayer(inflRef.current); inflRef.current = null; }
    if (routeRef.current) { m.removeLayer(routeRef.current); routeRef.current = null; }

    const c = selectedCustomer;
    if (!c) return;

    // FASE 8 — influence rings
    const inflGroup = L.layerGroup();
    INFLUENCE_RADII.forEach((r, i) => {
      const opacity = [0.10, 0.07, 0.04][i];
      const label   = [`${r / 1000} km`][0] ?? "";
      L.circle([c.lat, c.lon], {
        radius:      r,
        color:       "#F97316",
        fillColor:   "#F97316",
        fillOpacity: opacity,
        weight:      1,
        dashArray:   i === 0 ? undefined : "6 4",
        opacity:     0.45,
      }).bindTooltip(`Área de influencia ${r / 1000} km`, { sticky: true, direction: "top" })
        .addTo(inflGroup);
    });
    inflGroup.addTo(m);
    inflRef.current = inflGroup;

    // FASE 9 — route to nearest sucursal
    if (sucursales.length) {
      let nearest = sucursales[0];
      let minDist = Infinity;
      for (const s of sucursales) {
        const d = haversineKm(c.lat, c.lon, s.lat, s.lng);
        if (d < minDist) { minDist = d; nearest = s; }
      }
      const otif    = c.otif_pct ?? 90;
      const lineClr = otif >= 93 ? "#22C55E" : otif >= 88 ? "#F97316" : "#E03E3E";

      const routeGroup = L.layerGroup();
      L.polyline([[c.lat, c.lon], [nearest.lat, nearest.lng]], {
        color:   lineClr,
        weight:  2,
        opacity: 0.75,
        dashArray: "8 4",
      }).bindTooltip(
        `<div style="font-size:10px;font-family:system-ui,sans-serif;padding:3px 6px;background:#0D1F0F;border:1px solid #1A3D2060;border-radius:4px">
          <div style="color:#DCE8DC;font-weight:600">🏢 ${nearest.nombre}</div>
          <div style="color:#7A9C7A">Distancia: ${minDist.toFixed(0)} km</div>
          <div style="color:${lineClr}">OTIF: ${otif.toFixed(1)}%</div>
          <div style="color:#7A9C7A">Tiempo est.: ${Math.round(minDist / 60)} h</div>
        </div>`,
        { sticky: true, direction: "top" }
      ).addTo(routeGroup);

      // Branch marker
      L.circleMarker([nearest.lat, nearest.lng], {
        radius: 6, color: lineClr, fillColor: lineClr, fillOpacity: 0.85, weight: 2,
      }).bindTooltip(`Sucursal ${nearest.nombre}`, { permanent: false }).addTo(routeGroup);

      routeGroup.addTo(m);
      routeRef.current = routeGroup;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCustomer]);

  // Render markers / clusters
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    if (layerRef.current) { m.removeLayer(layerRef.current); layerRef.current = null; }
    if (!visible || customers.length === 0) return;

    const visible_list = applyFilters(customers, filterProvince, filters ?? null);
    const group = L.layerGroup();

    if (zoom >= CLUSTER_ZOOM) {
      visible_list.forEach(c => {
        const marker = L.marker([c.lat, c.lon], {
          icon:        dotIcon(c.churn_level, c.revenue_ars),
          zIndexOffset: (c.revenue_ars ?? 0) > 5e7 ? 200 : 0,
        });
        marker.bindPopup(buildPopupHtml(c), { maxWidth: 260, className: "agronova-popup" });
        marker.on("click", () => {
          const cur = selRef.current;
          onCustomerClick(cur?.cliente_id === c.cliente_id ? null : c);
        });
        group.addLayer(marker);
      });
    } else {
      // Grid clustering
      const cells: Record<string, { count: number; lats: number[]; lons: number[]; churnVotes: Record<string, number> }> = {};
      visible_list.forEach(c => {
        const key = gridKey(c.lat, c.lon, zoom);
        if (!cells[key]) cells[key] = { count: 0, lats: [], lons: [], churnVotes: { Bajo: 0, Medio: 0, Alto: 0 } };
        cells[key].count++;
        cells[key].lats.push(c.lat);
        cells[key].lons.push(c.lon);
        cells[key].churnVotes[c.churn_level ?? "Medio"] = (cells[key].churnVotes[c.churn_level ?? "Medio"] ?? 0) + 1;
      });

      const maxCount = Math.max(...Object.values(cells).map(c => c.count), 1);
      Object.values(cells).forEach(cell => {
        const lat      = cell.lats.reduce((a, b) => a + b, 0) / cell.lats.length;
        const lon      = cell.lons.reduce((a, b) => a + b, 0) / cell.lons.length;
        const dominant = Object.entries(cell.churnVotes).sort((a, b) => b[1] - a[1])[0][0];
        const marker = L.marker([lat, lon], { icon: clusterIcon(cell.count, maxCount, dominant) });
        marker.bindPopup(
          `<div style="font-size:11px;font-family:system-ui,sans-serif;color:#DCE8DC;padding:4px 2px">
            ${cell.count} cliente${cell.count > 1 ? "s" : ""} — zoom para ver detalle
          </div>`,
          { maxWidth: 200 }
        );
        group.addLayer(marker);
      });
    }

    group.addTo(m);
    layerRef.current = group;
    return () => { if (m && layerRef.current) { m.removeLayer(layerRef.current); layerRef.current = null; } };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customers, visible, zoom, filterProvince, filters]);

  return null;
}

export default memo(CustomerLayerInner);

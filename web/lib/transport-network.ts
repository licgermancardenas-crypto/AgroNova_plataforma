// GIS-28 — National Transport Network: shared style, tooltip and geometry helpers.

export const TRANSPORT_COLOR = {
  nacional:    "#F4C542",
  provincial:  "#B88A3D",
  terciaria:   "#666666",
  ferrocarril: "#8ED0FF",
  puente:      "#C7C7C7",
  peaje:       "#E8A020",
  combustible: "#4ADE80",
} as const;

export const TRANSPORT_STYLE = {
  nacional:    { color: TRANSPORT_COLOR.nacional,    weight: 2.8, opacity: 0.9 },
  provincial:  { color: TRANSPORT_COLOR.provincial,  weight: 1.8, opacity: 0.75 },
  terciaria:   { color: TRANSPORT_COLOR.terciaria,   weight: 1.0, opacity: 0.5, dashArray: "5 5" },
  ferrocarril: { color: TRANSPORT_COLOR.ferrocarril, weight: 2.0, opacity: 0.85, dashArray: "8 4" },
} as const;

function tooltipBox(color: string, rows: [string, string][]): string {
  const body = rows
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `<div style="display:flex;justify-content:space-between;gap:10px"><span style="color:#7A9C7A">${k}</span><span style="color:#DCE8DC;font-family:monospace;text-align:right">${v}</span></div>`)
    .join("");
  return `<div style="font-size:10px;font-family:system-ui,sans-serif;padding:6px 8px;background:#0D1F0F;border:1px solid ${color}50;border-radius:5px;min-width:150px">${body}</div>`;
}

export function roadTooltip(nombre: string, tipoLabel: string, longitudKm: number | undefined, provincia: string | undefined, color: string): string {
  return tooltipBox(color, [
    ["Nombre", nombre],
    ["Tipo", tipoLabel],
    ["Longitud", longitudKm ? `${longitudKm.toLocaleString("es-AR")} km` : "—"],
    ["Provincia", provincia ?? "—"],
    ["Fuente", "IGN"],
  ]);
}

export function railwayTooltip(nombre: string, operador: string, tipo: string, color: string): string {
  return tooltipBox(color, [
    ["Nombre", nombre],
    ["Operador", operador],
    ["Tipo", tipo],
    ["Fuente", "IGN"],
  ]);
}

export function bridgeTooltip(nombre: string, tipo: string, color: string): string {
  return tooltipBox(color, [
    ["Nombre", nombre],
    ["Tipo", tipo],
    ["Fuente", "IGN"],
  ]);
}

export function infraTooltip(nombre: string, categoriaLabel: string, color: string): string {
  return tooltipBox(color, [
    ["Nombre", nombre],
    ["Categoría", categoriaLabel],
    ["Fuente", "IGN"],
  ]);
}

// ── nearest-line-to-point (Fase 6 / Fase 7 — customer↔route snapping) ────────

export interface NearestResult {
  point:    [number, number]; // [lat, lon]
  distanceKm: number;
  feature:  GeoJSON.Feature;
}

function haversineKm(la1: number, lo1: number, la2: number, lo2: number): number {
  const R = 6371;
  const dLa = (la2 - la1) * Math.PI / 180;
  const dLo = (lo2 - lo1) * Math.PI / 180;
  const a = Math.sin(dLa / 2) ** 2
    + Math.cos(la1 * Math.PI / 180) * Math.cos(la2 * Math.PI / 180) * Math.sin(dLo / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Closest point on segment [a,b] to point p — all in [lon,lat] planar approximation (fine at road scale). */
function closestPointOnSegment(
  p: [number, number], a: [number, number], b: [number, number],
): [number, number] {
  const [px, py] = p, [ax, ay] = a, [bx, by] = b;
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return a;
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return [ax + t * dx, ay + t * dy];
}

function eachLineString(geom: GeoJSON.Geometry, cb: (coords: [number, number][]) => void) {
  if (geom.type === "LineString") cb(geom.coordinates as [number, number][]);
  else if (geom.type === "MultiLineString") (geom.coordinates as [number, number][][]).forEach(cb);
}

/**
 * Brute-force nearest point search across a FeatureCollection of lines.
 * Fine for a one-off computation on customer selection (thousands of features,
 * not per-frame) — not meant for continuous/animated use.
 */
interface SnapPoint {
  point:       [number, number]; // [lat, lon]
  featureIndex: number;
  partIndex:   number;
  segIndex:    number;
  distanceKm:  number;
}

function nearestOnFeatureCollection(lat: number, lon: number, fc: GeoJSON.FeatureCollection): SnapPoint | null {
  let best: SnapPoint | null = null;

  fc.features.forEach((feature, fi) => {
    if (!feature.geometry) return;
    const geom = feature.geometry;
    const parts: [number, number][][] =
      geom.type === "LineString" ? [geom.coordinates as [number, number][]]
      : geom.type === "MultiLineString" ? (geom.coordinates as [number, number][][])
      : [];

    parts.forEach((coords, pi) => {
      for (let i = 0; i < coords.length - 1; i++) {
        const a: [number, number] = [coords[i][0], coords[i][1]];
        const b: [number, number] = [coords[i + 1][0], coords[i + 1][1]];
        const [cx, cy] = closestPointOnSegment([lon, lat], a, b);
        const d = haversineKm(lat, lon, cy, cx);
        if (!best || d < best.distanceKm) {
          best = { point: [cy, cx], featureIndex: fi, partIndex: pi, segIndex: i, distanceKm: d };
        }
      }
    });
  });

  return best;
}

/**
 * GIS-28 Fase 7 — bend a straight from/to route toward the nearest road
 * corridor instead of cutting across open country. If both endpoints snap
 * onto the same mapped line, the route follows that line's actual vertices
 * between them; otherwise it just bends via both snapped points.
 */
export function snapRouteToRoad(
  from: [number, number], to: [number, number], fc: GeoJSON.FeatureCollection,
): [number, number][] {
  const a = nearestOnFeatureCollection(from[0], from[1], fc);
  const b = nearestOnFeatureCollection(to[0], to[1], fc);
  if (!a || !b || a.distanceKm > 100 || b.distanceKm > 100) return [from, to];

  if (a.featureIndex === b.featureIndex && a.partIndex === b.partIndex) {
    const geom = fc.features[a.featureIndex].geometry as GeoJSON.LineString | GeoJSON.MultiLineString;
    const coords = (geom.type === "LineString" ? geom.coordinates : geom.coordinates[a.partIndex]) as [number, number][];
    let i0 = a.segIndex, i1 = b.segIndex;
    const reversed = i0 > i1;
    if (reversed) [i0, i1] = [i1, i0];
    const mid = coords.slice(i0 + 1, i1 + 1).map((c): [number, number] => [c[1], c[0]]);
    if (reversed) mid.reverse();
    return [from, a.point, ...mid, b.point, to];
  }

  return [from, a.point, b.point, to];
}

export function findNearestLineFeature(
  lat: number, lon: number, fc: GeoJSON.FeatureCollection,
): NearestResult | null {
  let best: NearestResult | null = null;

  for (const feature of fc.features) {
    if (!feature.geometry) continue;
    eachLineString(feature.geometry, (coords) => {
      for (let i = 0; i < coords.length - 1; i++) {
        const a: [number, number] = [coords[i][0], coords[i][1]];
        const b: [number, number] = [coords[i + 1][0], coords[i + 1][1]];
        const [cx, cy] = closestPointOnSegment([lon, lat], a, b);
        const d = haversineKm(lat, lon, cy, cx);
        if (!best || d < best.distanceKm) {
          best = { point: [cy, cx], distanceKm: d, feature };
        }
      }
    });
  }

  return best;
}

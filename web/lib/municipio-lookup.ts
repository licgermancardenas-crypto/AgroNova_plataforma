// Real IGN municipio gazetteer (2313 points) — used to assign each customer
// to its nearest actual municipio, since the `ciudad` field on customer
// records doesn't reliably match their `provincia` (data quality issue in
// customers.json: ciudad is drawn from a national list uncorrelated to lat/lon).

export interface MunicipioPoint {
  nombre:    string;
  provincia: string;
  lat:       number;
  lon:       number;
}

// municipios_2022.geojson uses full/long province names for a couple of cases
// that don't match the short ProvinceKPI.nombre used everywhere else.
const PROVINCIA_ALIAS: Record<string, string> = {
  "Tierra del Fuego": "Tierra del Fuego, Antártida e Islas del Atlántico Sur",
};

let cache: MunicipioPoint[] | null = null;
let loading: Promise<MunicipioPoint[]> | null = null;

export function loadMunicipioPoints(): Promise<MunicipioPoint[]> {
  if (cache) return Promise.resolve(cache);
  if (loading) return loading;
  loading = fetch("/data/geojson/municipios_2022.geojson")
    .then(r => r.json())
    .then((fc: GeoJSON.FeatureCollection) => {
      const points: MunicipioPoint[] = [];
      for (const f of fc.features) {
        const props = f.properties as Record<string, unknown> | null;
        const nombre    = (props?.nam ?? props?.fna) as string | undefined;
        const provincia = props?.nam_prov as string | undefined;
        const geom = f.geometry as GeoJSON.MultiPoint | GeoJSON.Point | null;
        if (!nombre || !provincia || !geom) continue;
        const coord = geom.type === "MultiPoint" ? geom.coordinates[0] : geom.type === "Point" ? geom.coordinates : null;
        if (!coord) continue;
        points.push({ nombre, provincia, lat: coord[1], lon: coord[0] });
      }
      cache = points;
      return points;
    })
    .catch(() => { loading = null; return []; });
  return loading;
}

export function municipiosForProvincia(points: MunicipioPoint[], provinciaNombre: string): MunicipioPoint[] {
  const target = PROVINCIA_ALIAS[provinciaNombre] ?? provinciaNombre;
  return points.filter(p => p.provincia === target);
}

// Nearest-neighbour by simple planar distance (accurate enough at
// province scale — same ranking as haversine, much cheaper).
export function nearestMunicipioName(lat: number, lon: number, candidates: MunicipioPoint[]): string | null {
  if (!candidates.length) return null;
  let best: MunicipioPoint | null = null;
  let bestD2 = Infinity;
  const cosLat = Math.cos(lat * Math.PI / 180);
  for (const m of candidates) {
    const dLat = lat - m.lat;
    const dLon = (lon - m.lon) * cosLat;
    const d2 = dLat * dLat + dLon * dLon;
    if (d2 < bestD2) { bestD2 = d2; best = m; }
  }
  return best?.nombre ?? null;
}

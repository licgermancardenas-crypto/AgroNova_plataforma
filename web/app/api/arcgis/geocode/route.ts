/**
 * AgroNova GIS-14 — /api/arcgis/geocode
 *
 * Unified geocoding endpoint (forward + reverse).
 *
 * GET /api/arcgis/geocode?q=Rosario+Santa+Fe      → forward geocode
 * GET /api/arcgis/geocode?lat=-32.94&lon=-60.63   → reverse geocode
 *
 * Uses ArcGIS World Geocoder when ARCGIS_API_KEY is set,
 * falls back to a built-in Argentine city table otherwise.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface GeocodeResult {
  address: string;
  lat:     number;
  lon:     number;
  score:   number;          // 0–100; 100 = exact match
  source:  "arcgis" | "local";
}

interface GeocodeError {
  error: string;
}

// ── ArcGIS endpoints ───────────────────────────────────────────────────────────

const FORWARD_URL = "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates";
const REVERSE_URL = "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode";

// ── Local fallback table ───────────────────────────────────────────────────────

const CITY_COORDS: Record<string, [number, number]> = {
  "buenos aires":          [-34.6037, -58.3816],
  "rosario":               [-32.9468, -60.6393],
  "córdoba":               [-31.4135, -64.1810],
  "cordoba":               [-31.4135, -64.1810],
  "mendoza":               [-32.8895, -68.8458],
  "tucumán":               [-26.8083, -65.2176],
  "tucuman":               [-26.8083, -65.2176],
  "salta":                 [-24.7859, -65.4117],
  "mar del plata":         [-38.0055, -57.5426],
  "santa fe":              [-31.6333, -60.7000],
  "la plata":              [-34.9215, -57.9545],
  "bahía blanca":          [-38.7183, -62.2663],
  "neuquén":               [-38.9516, -68.0591],
  "posadas":               [-27.3671, -55.8962],
  "resistencia":           [-27.4606, -58.9869],
  "corrientes":            [-27.4696, -58.8306],
  "san juan":              [-31.5375, -68.5364],
  "paraná":                [-31.7333, -60.5333],
  "formosa":               [-26.1775, -58.1781],
  "jujuy":                 [-24.1858, -65.2995],
  "san miguel de tucumán": [-26.8083, -65.2176],
};

function localForward(address: string): GeocodeResult {
  const q = address.toLowerCase().trim();
  for (const [city, [lat, lon]] of Object.entries(CITY_COORDS)) {
    if (q.includes(city)) {
      return { address, lat, lon, score: 85, source: "local" };
    }
  }
  return { address, lat: -34.0, lon: -64.0, score: 0, source: "local" };
}

function localReverse(lat: number, lon: number): GeocodeResult {
  let bestName = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  let bestDist = Infinity;
  for (const [city, [clat, clon]] of Object.entries(CITY_COORDS)) {
    const d = (lat - clat) ** 2 + (lon - clon) ** 2;
    if (d < bestDist) { bestDist = d; bestName = city; }
  }
  const capitalized = bestName.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  return { address: `${capitalized}, Argentina`, lat, lon, score: 50, source: "local" };
}

// ── Handler ────────────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
): Promise<NextResponse<GeocodeResult | GeocodeError>> {
  const { searchParams } = new URL(request.url);
  const q   = searchParams.get("q")?.trim() ?? "";
  const lat = parseFloat(searchParams.get("lat") ?? "");
  const lon = parseFloat(searchParams.get("lon") ?? "");

  const apiKey     = process.env.ARCGIS_API_KEY ?? "";
  const configured = apiKey.length > 0;

  // ── Reverse geocode ─────────────────────────────────────────────────────────
  if (!isNaN(lat) && !isNaN(lon)) {
    if (!configured) {
      return NextResponse.json(localReverse(lat, lon));
    }
    try {
      const url = new URL(REVERSE_URL);
      url.searchParams.set("location",  `${lon},${lat}`);
      url.searchParams.set("f",         "json");
      url.searchParams.set("langCode",  "es");
      url.searchParams.set("token",     apiKey);

      const resp = await fetch(url.toString(), { cache: "no-store" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json() as {
        address?: { LongLabel?: string; Match_addr?: string };
        location?: { x?: number; y?: number };
        error?: { message?: string };
      };
      if (data.error) throw new Error(data.error.message ?? "ArcGIS error");

      const label = data.address?.LongLabel ?? data.address?.Match_addr ?? `${lat}, ${lon}`;
      return NextResponse.json({
        address: label,
        lat:     data.location?.y ?? lat,
        lon:     data.location?.x ?? lon,
        score:   90,
        source:  "arcgis",
      });
    } catch {
      return NextResponse.json(localReverse(lat, lon));
    }
  }

  // ── Forward geocode ─────────────────────────────────────────────────────────
  if (!q) {
    return NextResponse.json(
      { error: "Provide ?q=address OR ?lat=&lon=" },
      { status: 400 },
    );
  }

  if (!configured) {
    return NextResponse.json(localForward(q));
  }

  try {
    const url = new URL(FORWARD_URL);
    url.searchParams.set("SingleLine",    q);
    url.searchParams.set("f",             "json");
    url.searchParams.set("maxLocations",  "1");
    url.searchParams.set("countryCode",   "ARG");
    url.searchParams.set("langCode",      "es");
    url.searchParams.set("outFields",     "Match_addr,Score");
    url.searchParams.set("token",         apiKey);

    const resp = await fetch(url.toString(), { cache: "no-store" });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json() as {
      candidates?: Array<{
        address?: string;
        location?: { x?: number; y?: number };
        score?: number;
      }>;
    };

    const best = data.candidates?.[0];
    if (!best) return NextResponse.json(localForward(q));

    return NextResponse.json({
      address: best.address ?? q,
      lat:     best.location?.y ?? -34,
      lon:     best.location?.x ?? -64,
      score:   best.score ?? 0,
      source:  "arcgis",
    });
  } catch {
    return NextResponse.json(localForward(q));
  }
}

import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export const dynamic = "force-dynamic";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ArcGISStatus {
  // Core
  configured:        boolean;
  mode:              "arcgis" | "local";
  api_key_masked:    string | null;         // "…XXXX" or null
  active_services:   number;               // live services count
  // Individual service availability
  geocoding_active:  boolean;
  geocoding_source:  "arcgis_live" | "local_indec";
  routing_ready:     boolean;
  routing_source:    "arcgis_live" | "local_haversine";
  isochrones_ready:  boolean;
  // Service areas
  service_areas:            number;         // polygon count
  service_areas_sucursales: number;         // distinct facilities
  service_areas_source:     "arcgis_live" | "local_approx";
  last_updated:             string | null;  // ISO timestamp of geojson file
  // Capabilities map
  capabilities: {
    geocoding:       boolean;
    routing:         boolean;
    service_areas:   boolean;
    isochrones:      boolean;
    feature_layers:  boolean;
    scene_view:      boolean;
    offline_maps:    boolean;
  };
  message: string;
}

// ── Handler ────────────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse<ArcGISStatus>> {
  const apiKey     = process.env.ARCGIS_API_KEY ?? "";
  const configured = apiKey.length > 0;

  // Masked key — show only last 4 chars
  const api_key_masked: string | null = configured
    ? `…${apiKey.slice(-4)}`
    : null;

  // Read consolidated service-areas GeoJSON
  let serviceAreasCount   = 0;
  let serviceAreasFacil   = 0;
  let lastUpdated: string | null = null;

  try {
    const saPath = path.join(
      process.cwd(),
      "public", "data", "gis_outputs", "service_areas_all.geojson",
    );
    const raw   = await fs.readFile(saPath, "utf-8");
    const geoj  = JSON.parse(raw) as { features?: { properties?: { facility?: string } }[] };
    const feats = geoj.features ?? [];
    serviceAreasCount = feats.length;
    // Count unique facility names
    const facSet = new Set(feats.map(f => f.properties?.facility ?? "?"));
    serviceAreasFacil = facSet.size;
    // File mtime via stat
    const stat = await fs.stat(saPath);
    lastUpdated = stat.mtime.toISOString();
  } catch {
    // File may not exist yet — non-fatal
  }

  // Service source strings
  const source    = configured ? "arcgis_live"   : "local";
  const geoSrc    = configured ? "arcgis_live"   : "local_indec"     as const;
  const routeSrc  = configured ? "arcgis_live"   : "local_haversine" as const;
  const saSrc     = configured ? "arcgis_live"   : "local_approx"    as const;

  const capabilities = {
    geocoding:      true,
    routing:        true,
    service_areas:  true,
    isochrones:     true,
    feature_layers: false,
    scene_view:     false,
    offline_maps:   false,
  };

  // Count live services (always 4 when configured; 4 local otherwise — all available)
  const active_services = Object.values(capabilities).filter(Boolean).length;

  const status: ArcGISStatus = {
    configured,
    mode:                    configured ? "arcgis" : "local",
    api_key_masked,
    active_services,
    geocoding_active:        true,
    geocoding_source:        geoSrc,
    routing_ready:           true,
    routing_source:          routeSrc,
    isochrones_ready:        true,
    service_areas:           serviceAreasCount,
    service_areas_sucursales:serviceAreasFacil,
    service_areas_source:    saSrc,
    last_updated:            lastUpdated,
    capabilities,
    message: configured
      ? `ArcGIS REST API activo (key ${api_key_masked}). ${serviceAreasCount} polígonos de ${serviceAreasFacil} instalaciones.`
      : `Modo local — sin ARCGIS_API_KEY. ${serviceAreasCount} polígonos disponibles (local_approx). Agregar ARCGIS_API_KEY en .env para activar servicios en vivo.`,
  };

  void source; // suppress unused-var warning
  return NextResponse.json(status);
}

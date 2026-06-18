import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export interface ArcGISStatus {
  configured:        boolean;
  mode:              "arcgis" | "local";
  geocoding_active:  boolean;
  service_areas:     number;
  isochrones_ready:  boolean;
  routing_ready:     boolean;
  capabilities: {
    geocoding:       boolean;
    routing:         boolean;
    service_areas:   boolean;
    isochrones:      boolean;
    // Future
    feature_layers:  boolean;
    scene_view:      boolean;
    offline_maps:    boolean;
  };
  message: string;
}

export async function GET(): Promise<NextResponse<ArcGISStatus>> {
  const apiKey     = process.env.ARCGIS_API_KEY;
  const configured = Boolean(apiKey && apiKey.length > 0);

  // Count service area features from generated GeoJSON
  let serviceAreasCount = 0;
  try {
    const saPath = path.join(
      process.cwd(),
      "public",
      "data",
      "gis_outputs",
      "service_areas_all.geojson",
    );
    const raw  = await fs.readFile(saPath, "utf-8");
    const geoj = JSON.parse(raw) as { features?: unknown[] };
    serviceAreasCount = geoj.features?.length ?? 0;
  } catch {
    // File doesn't exist yet — non-fatal
  }

  const status: ArcGISStatus = {
    configured,
    mode:             configured ? "arcgis" : "local",
    geocoding_active: true,   // always available (local fallback)
    service_areas:    serviceAreasCount,
    isochrones_ready: true,   // backend ready, frontend draw pending GIS-10
    routing_ready:    true,   // backend ready, frontend draw pending GIS-10
    capabilities: {
      geocoding:      true,
      routing:        true,
      service_areas:  true,
      isochrones:     true,
      // Planned for future sprints
      feature_layers: false,
      scene_view:     false,
      offline_maps:   false,
    },
    message: configured
      ? `ArcGIS REST API active (key configured). ${serviceAreasCount} service area polygons loaded.`
      : `Modo local — sin ARCGIS_API_KEY. ${serviceAreasCount} polígonos de service areas pre-generados disponibles. Configurar ARCGIS_API_KEY para activar API en vivo.`,
  };

  return NextResponse.json(status);
}

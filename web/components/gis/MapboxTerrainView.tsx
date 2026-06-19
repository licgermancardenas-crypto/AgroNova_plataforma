"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import "mapbox-gl/dist/mapbox-gl.css";
import mapboxgl from "mapbox-gl";
import { useEffect, useRef, useState } from "react";
import { MapPin, AlertTriangle } from "lucide-react";
import type { ProvinceKPI, GisMetric, CameraTarget } from "@/types";
import { MAPBOX_TOKEN, isMapboxConfigured } from "@/lib/mapbox-config";
import { provinceColor, getMetricValue } from "@/lib/geo-data";

// ── Props ─────────────────────────────────────────────────────────────────────

export interface MapboxTerrainViewProps {
  geoData:          GeoJSON.FeatureCollection | null;
  allKpis:          ProvinceKPI[];
  metric:           GisMetric;
  selectedProvince: string | null;
  onProvinceClick:  (kpi: ProvinceKPI) => void;
  selectedYear:     number;
  showTerrain:      boolean;
  showSatellite:    boolean;
  // GIS-23 cinematic
  engineMode?:      "mapbox" | "earth";
  pitch?:           number;
  autoRotate?:      boolean;
  targetCamera?:    CameraTarget | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function enrichGeoJSON(
  geoData: GeoJSON.FeatureCollection,
  allKpis: ProvinceKPI[],
  metric:  GisMetric,
): GeoJSON.FeatureCollection {
  return {
    ...geoData,
    features: geoData.features.map(f => {
      const nombre = (f.properties?.nombre ?? "") as string;
      const kpi    = allKpis.find(k => k.nombre === nombre);
      return {
        ...f,
        properties: {
          ...f.properties,
          _color: kpi ? provinceColor(kpi, metric, allKpis) : "#071209",
          _val:   kpi ? getMetricValue(kpi, metric) : 0,
        },
      };
    }),
  };
}

// ── Fallback when no token ────────────────────────────────────────────────────

function NoTokenView() {
  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center gap-4"
      style={{ background: "#07120A" }}
    >
      <div
        className="glass rounded-2xl p-6 flex flex-col items-center gap-4 max-w-xs text-center"
        style={{ border: "1px solid rgba(232,160,32,0.3)" }}
      >
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center"
          style={{ background: "rgba(232,160,32,0.10)", border: "1px solid rgba(232,160,32,0.25)" }}
        >
          <AlertTriangle size={24} style={{ color: "#E8A020" }} />
        </div>
        <div>
          <p className="font-mono font-bold text-sm mb-1" style={{ color: "#E8A020" }}>
            Mapbox Token Requerido
          </p>
          <p className="tactical-text text-2xs leading-relaxed">
            Para usar el motor Mapbox Terrain, agregá tu token en{" "}
            <span className="font-mono text-primary">.env</span>:
          </p>
        </div>
        <div
          className="w-full rounded-lg p-3 text-left"
          style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(34,197,94,0.15)" }}
        >
          <p className="font-mono text-2xs" style={{ color: "#A3E635" }}>
            NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1...
          </p>
        </div>
        <p className="tactical-text text-2xs" style={{ color: "#4B6B4B" }}>
          Token gratuito en account.mapbox.com
        </p>
        <p className="tactical-text text-2xs" style={{ color: "#4B6B4B" }}>
          Sin token, seguís usando Leaflet sin limitaciones.
        </p>
      </div>
    </div>
  );
}

// ── Map loading overlay ───────────────────────────────────────────────────────

function LoadingOverlay() {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10"
      style={{ background: "#071209", pointerEvents: "none" }}
    >
      <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      <span className="tactical-text text-xs flex items-center gap-1.5">
        <MapPin size={10} className="text-primary" />
        Cargando terreno 3D…
      </span>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function MapboxTerrainView({
  geoData,
  allKpis,
  metric,
  selectedProvince,
  onProvinceClick,
  showTerrain,
  showSatellite,
  engineMode = "mapbox",
  pitch,
  autoRotate = false,
  targetCamera,
}: MapboxTerrainViewProps) {
  const containerRef   = useRef<HTMLDivElement>(null);
  const mapRef         = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Stable refs for event handlers (avoid stale closure in map.on)
  const onClickRef  = useRef(onProvinceClick);
  const allKpisRef  = useRef(allKpis);
  useEffect(() => { onClickRef.current = onProvinceClick; }, [onProvinceClick]);
  useEffect(() => { allKpisRef.current = allKpis; }, [allKpis]);

  // ── Initialize map (once) ──────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (!isMapboxConfigured()) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container:         containerRef.current,
      style:             "mapbox://styles/mapbox/satellite-streets-v12",
      center:            [-64, -38],
      zoom:              4,
      pitch:             40,
      bearing:           -8,
      attributionControl: false,
    });

    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");
    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    mapRef.current = map;

    map.on("load", () => {
      // ── Terrain DEM source ───────────────────────────────────────────────
      map.addSource("mapbox-dem", {
        type:     "raster-dem",
        url:      "mapbox://mapbox.mapbox-terrain-dem-v1",
        tileSize: 512,
        maxzoom:  14,
      });

      // ── Terrain exaggeration ─────────────────────────────────────────────
      map.setTerrain({ source: "mapbox-dem", exaggeration: 1.5 });

      // ── Hillshade (insert before first symbol layer) ──────────────────────
      const firstSymbol = map.getStyle().layers?.find(l => l.type === "symbol")?.id;
      map.addLayer(
        {
          id:     "agn-hillshade",
          type:   "hillshade",
          source: "mapbox-dem",
          paint:  {
            "hillshade-shadow-color":        "#071209",
            "hillshade-highlight-color":     "#4ADE80",
            "hillshade-accent-color":        "#1A3D20",
            "hillshade-exaggeration":        0.4,
            "hillshade-illumination-direction": 335,
          },
        },
        firstSymbol,
      );

      // ── Sky ───────────────────────────────────────────────────────────────
      map.addLayer({
        id:    "sky",
        type:  "sky",
        paint: {
          "sky-type":                         "atmosphere",
          "sky-atmosphere-sun":               [0.0, 90.0],
          "sky-atmosphere-sun-intensity":     12,
          "sky-atmosphere-color":             "rgba(7,18,9,1.0)",
          "sky-atmosphere-halo-color":        "rgba(34,197,94,0.1)",
          "sky-atmosphere-space-transition-range": [4000000, 8000000] as any,
        } as any,
      });

      // ── Fog ───────────────────────────────────────────────────────────────
      (map as any).setFog({
        color:            "rgb(7, 18, 9)",
        "high-color":     "#122A14",
        "horizon-blend":  0.04,
        "space-color":    "#071209",
        "star-intensity": 0.5,
        range:            [0.5, 10],
      });

      // ── 3D Buildings ──────────────────────────────────────────────────────
      map.addLayer(
        {
          id:           "agn-3d-buildings",
          source:       "composite",
          "source-layer": "building",
          filter:       ["==", "extrude", "true"],
          type:         "fill-extrusion",
          minzoom:      9,
          paint:        {
            "fill-extrusion-color":   "#1A3D20",
            "fill-extrusion-height":  ["interpolate", ["linear"], ["zoom"], 9, 0, 9.5, ["get", "height"]],
            "fill-extrusion-base":    ["interpolate", ["linear"], ["zoom"], 9, 0, 9.5, ["get", "min_height"]],
            "fill-extrusion-opacity": 0.7,
          },
        },
        firstSymbol,
      );

      setMapLoaded(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      setMapLoaded(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Province layer — add or update data (FASE 5) ───────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !geoData) return;

    const enriched = enrichGeoJSON(geoData, allKpis, metric);
    const src = map.getSource("agn-provinces") as mapboxgl.GeoJSONSource | undefined;

    if (src) {
      src.setData(enriched);
      return;
    }

    // First time: add source + layers
    map.addSource("agn-provinces", { type: "geojson", data: enriched });

    // Fill
    map.addLayer({
      id:     "agn-provinces-fill",
      type:   "fill",
      source: "agn-provinces",
      paint:  {
        "fill-color":   ["get", "_color"],
        "fill-opacity": ["case", ["==", ["get", "nombre"], selectedProvince ?? ""], 0.88, 0.55],
      },
    }, "agn-hillshade");

    // Outline
    map.addLayer({
      id:     "agn-provinces-outline",
      type:   "line",
      source: "agn-provinces",
      paint:  {
        "line-color":   ["case", ["==", ["get", "nombre"], selectedProvince ?? ""], "#22C55E", "#1A3D20"],
        "line-width":   ["case", ["==", ["get", "nombre"], selectedProvince ?? ""], 2.5, 0.8],
        "line-opacity": 0.9,
      },
    }, "agn-hillshade");

    // Province label overlay
    map.addLayer({
      id:     "agn-provinces-label",
      type:   "symbol",
      source: "agn-provinces",
      layout: {
        "text-field":             ["get", "nombre"],
        "text-font":              ["DIN Offc Pro Medium", "Arial Unicode MS Regular"],
        "text-size":              ["interpolate", ["linear"], ["zoom"], 4, 8, 8, 12],
        "text-max-width":         6,
        "text-anchor":            "center",
        "symbol-placement":       "point",
        "text-allow-overlap":     false,
        "text-ignore-placement":  false,
      },
      paint: {
        "text-color":       "#DCE8DC",
        "text-halo-color":  "#071209",
        "text-halo-width":  1.5,
        "text-opacity":     0.85,
      },
    });

    // Click handler
    map.on("click", "agn-provinces-fill", (e) => {
      if (!e.features?.length) return;
      const nombre = (e.features[0].properties?.nombre ?? "") as string;
      const kpi    = allKpisRef.current.find(k => k.nombre === nombre);
      if (kpi) onClickRef.current(kpi);
    });
    map.on("mouseenter", "agn-provinces-fill", () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "agn-provinces-fill", () => {
      map.getCanvas().style.cursor = "";
    });
  // selectedProvince intentionally excluded — handled by a dedicated effect below
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapLoaded, geoData, allKpis, metric]);

  // ── Selected province highlight ────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !map.getLayer("agn-provinces-fill")) return;
    const sel = selectedProvince ?? "";
    map.setPaintProperty("agn-provinces-fill", "fill-opacity",
      ["case", ["==", ["get", "nombre"], sel], 0.88, 0.55],
    );
    map.setPaintProperty("agn-provinces-outline", "line-color",
      ["case", ["==", ["get", "nombre"], sel], "#22C55E", "#1A3D20"],
    );
    map.setPaintProperty("agn-provinces-outline", "line-width",
      ["case", ["==", ["get", "nombre"], sel], 2.5, 0.8],
    );
  }, [mapLoaded, selectedProvince]);

  // ── Terrain toggle ─────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    if (showTerrain) {
      map.setTerrain({ source: "mapbox-dem", exaggeration: 1.5 });
      if (map.getLayer("agn-hillshade")) {
        map.setLayoutProperty("agn-hillshade", "visibility", "visible");
      }
    } else {
      (map as any).setTerrain(null);
      if (map.getLayer("agn-hillshade")) {
        map.setLayoutProperty("agn-hillshade", "visibility", "none");
      }
    }
  }, [mapLoaded, showTerrain]);

  // ── Satellite toggle — hide/show all raster layers ─────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const vis = (showSatellite ? "visible" : "none") as "visible" | "none";
    const layers = map.getStyle().layers ?? [];
    for (const layer of layers) {
      if (layer.type === "raster") {
        try { map.setLayoutProperty(layer.id, "visibility", vis); } catch { /* layer may be system-only */ }
      }
    }
  }, [mapLoaded, showSatellite]);

  // ── GIS-23: Earth / Mapbox atmosphere switching ────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    if (engineMode === "earth") {
      (map as any).setFog({
        color:            "rgb(5, 8, 20)",
        "high-color":     "#0a1428",
        "horizon-blend":  0.10,
        "space-color":    "#000a18",
        "star-intensity": 0.92,
        range:            [0.4, 7],
      });
      if (map.getLayer("sky")) {
        map.setPaintProperty("sky", "sky-atmosphere-color",      "rgba(5,8,20,1.0)" as any);
        map.setPaintProperty("sky", "sky-atmosphere-halo-color", "rgba(14,165,233,0.18)" as any);
      }
    } else {
      (map as any).setFog({
        color:            "rgb(7, 18, 9)",
        "high-color":     "#122A14",
        "horizon-blend":  0.04,
        "space-color":    "#071209",
        "star-intensity": 0.5,
        range:            [0.5, 10],
      });
      if (map.getLayer("sky")) {
        map.setPaintProperty("sky", "sky-atmosphere-color",      "rgba(7,18,9,1.0)" as any);
        map.setPaintProperty("sky", "sky-atmosphere-halo-color", "rgba(34,197,94,0.1)" as any);
      }
    }
  }, [mapLoaded, engineMode]);

  // ── GIS-23: Pitch sync ────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || pitch === undefined) return;
    map.easeTo({ pitch, duration: 600 });
  }, [mapLoaded, pitch]);

  // ── GIS-23: Auto-rotation ─────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !autoRotate) return;
    let animId: number;
    const spin = () => {
      if (mapRef.current) {
        const b = mapRef.current.getBearing();
        mapRef.current.setBearing((b + 0.04) % 360);
      }
      animId = requestAnimationFrame(spin);
    };
    animId = requestAnimationFrame(spin);
    return () => cancelAnimationFrame(animId);
  }, [mapLoaded, autoRotate]);

  // ── GIS-23: FlyTo target camera ───────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !targetCamera) return;
    map.flyTo({
      center:    targetCamera.center,
      zoom:      targetCamera.zoom,
      pitch:     targetCamera.pitch,
      bearing:   targetCamera.bearing,
      duration:  targetCamera.duration,
      essential: true,
    });
  }, [mapLoaded, targetCamera]);

  // ── Render ─────────────────────────────────────────────────────────────────
  if (!isMapboxConfigured()) {
    return <NoTokenView />;
  }

  return (
    <div className="relative w-full h-full">
      {!mapLoaded && <LoadingOverlay />}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}

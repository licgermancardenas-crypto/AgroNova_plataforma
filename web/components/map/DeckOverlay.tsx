"use client";

/**
 * GIS-13 — Deck.gl WebGL overlay synchronized with Leaflet viewport.
 * Rendered via createPortal into the Leaflet map container so it appears
 * above Leaflet tiles without breaking Leaflet navigation.
 *
 * All pointer-events are disabled so Leaflet keeps control.
 */

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useMap } from "react-leaflet";
import { DeckGL } from "@deck.gl/react";
import { GeoJsonLayer, ArcLayer, ScatterplotLayer } from "@deck.gl/layers";
import type { ProvinceKPI, GisMetric, SucursalMarker } from "@/types";
import { getMetricValue } from "@/lib/geo-data";

// ── Types ──────────────────────────────────────────────────────────────────────

interface DeckViewState {
  latitude:  number;
  longitude: number;
  zoom:      number;
  pitch:     number;
  bearing:   number;
}

type RGBAColor = [number, number, number, number];

interface FlowDatum {
  from:    [number, number];
  to:      [number, number];
  otif:    number;
  revPct:  number;
}

interface BeamDatum {
  position: [number, number];
  score:    number;
  nombre:   string;
}

export interface DeckOverlayProps {
  geoData:         GeoJSON.FeatureCollection | null;
  allKpis:         ProvinceKPI[];
  metric3D:        GisMetric;
  mode3D:          boolean;
  showArcs:        boolean;
  showBeams:       boolean;
  sucursales:      SucursalMarker[];
  onProvinceClick: (kpi: ProvinceKPI) => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function normalizeKpi(kpi: ProvinceKPI, metric: GisMetric, allKpis: ProvinceKPI[]): number {
  const values = allKpis.map(k => getMetricValue(k, metric));
  const min = Math.min(...values);
  const max = Math.max(...values);
  return max === min ? 0 : (getMetricValue(kpi, metric) - min) / (max - min);
}

const MAX_ELEV: Record<GisMetric, number> = {
  revenue:  700_000,
  clientes: 500_000,
  margen:   300_000,
  churn:    350_000,
  otif:     280_000,
};

function extrusionColor(t: number, metric: GisMetric): RGBAColor {
  if (metric === "churn") {
    // Low churn = green, high churn = red
    return [
      Math.round(7   + t * (224 - 7)),
      Math.round(62  + (1 - t) * (197 - 62)),
      Math.round(4   + t * (58 - 4)),
      210,
    ];
  }
  // Low = dark, high = bright green
  return [
    Math.round(7   + t * (34  - 7)),
    Math.round(18  + t * (197 - 18)),
    Math.round(9   + t * (94  - 9)),
    215,
  ];
}

function otifColor(otif: number): RGBAColor {
  if (otif >= 93) return [34,  197, 94,  200];
  if (otif >= 88) return [232, 160, 32,  200];
  return                 [224, 62,  62,  200];
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function DeckOverlay({
  geoData, allKpis, metric3D, mode3D, showArcs, showBeams,
  sucursales, onProvinceClick,
}: DeckOverlayProps) {
  const map = useMap();

  // Portal target — created inside Leaflet's container, z-index 400
  const [portalTarget, setPortalTarget] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = map.getContainer();
    const div       = document.createElement("div");
    div.style.cssText =
      "position:absolute;top:0;left:0;width:100%;height:100%;" +
      "pointer-events:none;z-index:400;";
    container.appendChild(div);
    setPortalTarget(div);
    return () => {
      try { container.removeChild(div); } catch { /* already removed */ }
    };
  }, [map]);

  // Viewport — synced from Leaflet on every map move
  const [viewState, setViewState] = useState<DeckViewState>({
    latitude: -34, longitude: -64, zoom: 5, pitch: 0, bearing: 0,
  });

  useEffect(() => {
    const sync = () => {
      const c = map.getCenter();
      setViewState({
        latitude:  c.lat,
        longitude: c.lng,
        zoom:      map.getZoom(),
        pitch:     mode3D ? 45 : 0,
        bearing:   mode3D ? -10 : 0,
      });
    };
    map.on("move",    sync);
    map.on("zoomend", sync);
    sync();
    return () => { map.off("move", sync).off("zoomend", sync); };
  }, [map, mode3D]);

  // Animation timer for beam pulsing (~12 fps — lightweight)
  const [animTime, setAnimTime] = useState(0);
  useEffect(() => {
    if (!showBeams) return;
    const id = setInterval(() => setAnimTime(t => (t + 1) % 100), 80);
    return () => clearInterval(id);
  }, [showBeams]);

  // KPI lookup (rebuilt when allKpis changes = when year changes)
  const kpiMap = useMemo(
    () => Object.fromEntries(allKpis.map(k => [k.nombre, k])),
    [allKpis],
  );

  // ── Arc flow data (sucursal → 2 nearest provinces) ──────────────────────────
  const flowData = useMemo<FlowDatum[]>(() => {
    if (!showArcs || allKpis.length === 0) return [];
    return sucursales.flatMap(s => {
      const sorted = [...allKpis]
        .map(k => ({ k, d: Math.hypot(s.lat - k.lat, s.lng - k.lon) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 2);
      return sorted.map(({ k }) => ({
        from:    [s.lng, s.lat] as [number, number],
        to:      [k.lon, k.lat] as [number, number],
        otif:    k.otif_pct,
        revPct:  k.revenue_pct,
      }));
    });
  }, [sucursales, allKpis, showArcs]);

  // ── Beam data (provinces with highest gap_score) ─────────────────────────────
  const beamData = useMemo<BeamDatum[]>(() => {
    if (!showBeams) return [];
    return [...allKpis]
      .filter(k => k.gap_score > 3)
      .sort((a, b) => b.gap_score - a.gap_score)
      .slice(0, 8)
      .map(k => ({
        position: [k.lon, k.lat] as [number, number],
        score:    Math.min(1, k.gap_score / 12),
        nombre:   k.nombre,
      }));
  }, [allKpis, showBeams]);

  // ── Static layers (no animation dependency) ──────────────────────────────────
  const staticLayers = useMemo(() => {
    const out = [];

    // Extruded choropleth (3D mode only)
    if (mode3D && geoData) {
      out.push(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        new (GeoJsonLayer as any)({
          id:       "extruded-provinces",
          data:     geoData,
          extruded: true,
          wireframe:true,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          getElevation: (f: any) => {
            const kpi = kpiMap[f?.properties?.nombre ?? ""];
            if (!kpi) return 0;
            return normalizeKpi(kpi, metric3D, allKpis) * MAX_ELEV[metric3D];
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          getFillColor: (f: any): RGBAColor => {
            const kpi = kpiMap[f?.properties?.nombre ?? ""];
            if (!kpi) return [26, 61, 32, 150];
            return extrusionColor(normalizeKpi(kpi, metric3D, allKpis), metric3D);
          },
          getLineColor: [34, 197, 94, 80] as RGBAColor,
          getLineWidth: 500,
          lineWidthMinPixels: 1,
          pickable: false, // clicks pass through to Leaflet choropleth underneath
          updateTriggers: {
            getElevation: [metric3D, kpiMap],
            getFillColor: [metric3D, kpiMap],
          },
        }),
      );
    }

    // Flow arcs (sucursal → province)
    if (showArcs && flowData.length > 0) {
      out.push(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        new (ArcLayer as any)({
          id:   "flow-arcs",
          data: flowData,
          getSourcePosition: (d: FlowDatum) => d.from,
          getTargetPosition: (d: FlowDatum) => d.to,
          getSourceColor:    (d: FlowDatum): RGBAColor => otifColor(d.otif),
          getTargetColor:    (d: FlowDatum): RGBAColor => {
            const c = otifColor(d.otif);
            return [c[0], c[1], c[2], 55];
          },
          getWidth:          (d: FlowDatum) => Math.max(1, d.revPct * 0.55),
          widthMinPixels:    1,
          widthMaxPixels:    8,
          getHeight:         0.4,
          pickable:          false,
        }),
      );
    }

    return out;
  }, [mode3D, geoData, kpiMap, metric3D, allKpis, showArcs, flowData]);

  // ── Animated layer (beams, depends on animTime) ──────────────────────────────
  const beamLayer = useMemo(() => {
    if (!showBeams || beamData.length === 0) return null;
    const phase = (animTime / 100) * Math.PI * 2;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new (ScatterplotLayer as any)({
      id:   "expansion-beams",
      data: beamData,
      getPosition:  (d: BeamDatum) => d.position,
      getRadius:    (d: BeamDatum) =>
        d.score * 110_000 * (1 + 0.32 * Math.sin(phase + d.score * 7.5)),
      getFillColor: (d: BeamDatum): RGBAColor =>
        d.score > 0.7 ? [224, 62,  62,  35] :
        d.score > 0.5 ? [232, 160, 32,  35] :
                        [163, 230, 53,  35],
      getLineColor: (d: BeamDatum): RGBAColor =>
        d.score > 0.7 ? [224, 62,  62,  210] :
        d.score > 0.5 ? [232, 160, 32,  210] :
                        [163, 230, 53,  210],
      stroked:            true,
      lineWidthMinPixels: 1.5,
      getLineWidth:       2500,
      pickable:           false,
      updateTriggers: { getRadius: [animTime] },
    });
  }, [showBeams, beamData, animTime]);

  // ── Combined layer list ───────────────────────────────────────────────────────
  const layers = useMemo(
    () => (beamLayer ? [...staticLayers, beamLayer] : staticLayers),
    [staticLayers, beamLayer],
  );

  if (!portalTarget) return null;

  return createPortal(
    <DeckGL
      viewState={viewState}
      controller={false}
      layers={layers}
      style={{ position: "absolute", width: "100%", height: "100%" }}
    />,
    portalTarget,
  );
}

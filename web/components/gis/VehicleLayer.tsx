"use client";

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import type { GISRoute } from "@/types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Vehicle {
  route:    GISRoute;
  progress: number;   // 0..1
  forward:  boolean;  // direction of travel
  speed:    number;   // per-frame delta
}

export interface VehicleLayerProps {
  routes:  GISRoute[];
  playing: boolean;
  speed:   1 | 2;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function rgba(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a.toFixed(3)})`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function VehicleLayer({ routes, playing, speed }: VehicleLayerProps) {
  const map = useMap();

  const rafRef      = useRef<number>(0);
  const vehiclesRef = useRef<Vehicle[]>([]);

  const playingRef  = useRef(playing);
  const speedRef    = useRef(speed);
  useEffect(() => { playingRef.current = playing; }, [playing]);
  useEffect(() => { speedRef.current   = speed;   }, [speed]);

  // Init one vehicle per active route, staggered
  useEffect(() => {
    vehiclesRef.current = routes
      .filter(r => r.activo)
      .map((r, i) => ({
        route:    r,
        progress: (i / routes.length) % 1,
        forward:  true,
        speed:    0.0009 + Math.random() * 0.0007,
      }));
  }, [routes]);

  useEffect(() => {
    const container = map.getContainer();
    const canvas    = document.createElement("canvas");
    canvas.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:451;";
    container.appendChild(canvas);

    const resize = () => {
      const rc = container.getBoundingClientRect();
      canvas.width  = rc.width;
      canvas.height = rc.height;
    };
    resize();
    map.on("resize", resize);

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const isPlaying = playingRef.current;
      const spd       = speedRef.current;

      for (const v of vehiclesRef.current) {
        if (isPlaying) {
          if (v.forward) {
            v.progress += v.speed * spd;
            if (v.progress >= 1) { v.progress = 1; v.forward = false; }
          } else {
            v.progress -= v.speed * spd;
            if (v.progress <= 0) { v.progress = 0; v.forward = true; }
          }
        }

        const [fLat, fLon] = v.route.from;
        const [tLat, tLon] = v.route.to;
        const t   = v.progress;
        const lat = fLat + (tLat - fLat) * t;
        const lon = fLon + (tLon - fLon) * t;
        const pt  = map.latLngToContainerPoint([lat, lon]);

        // Direction angle
        const dtLat = v.forward ? tLat - fLat : fLat - tLat;
        const dtLon = v.forward ? tLon - fLon : fLon - tLon;
        const ept   = map.latLngToContainerPoint([lat + dtLat * 0.01, lon + dtLon * 0.01]);
        const angle = Math.atan2(ept.y - pt.y, ept.x - pt.x);

        const col = v.route.color;

        // Route line segment (dimmed full path)
        const fromPt = map.latLngToContainerPoint([fLat, fLon]);
        const toPt   = map.latLngToContainerPoint([tLat, tLon]);
        ctx.strokeStyle = rgba(col, 0.18);
        ctx.lineWidth   = 1.5;
        ctx.setLineDash([6, 8]);
        ctx.beginPath();
        ctx.moveTo(fromPt.x, fromPt.y);
        ctx.lineTo(toPt.x, toPt.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Vehicle glow halo
        const halo = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, 14);
        halo.addColorStop(0, rgba(col, 0.3));
        halo.addColorStop(1, rgba(col, 0));
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 14, 0, Math.PI * 2);
        ctx.fill();

        // Vehicle body — arrow triangle
        ctx.save();
        ctx.translate(pt.x, pt.y);
        ctx.rotate(angle);

        // Cab
        ctx.fillStyle = rgba(col, 0.92);
        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.lineTo(-5, 4);
        ctx.lineTo(-5, -4);
        ctx.closePath();
        ctx.fill();

        // Trailer body
        ctx.fillStyle = rgba(col, 0.55);
        ctx.fillRect(-13, -3.5, 8, 7);

        ctx.restore();

        // Label
        ctx.font      = "bold 9px 'Share Tech Mono', monospace";
        ctx.fillStyle = rgba(col, 0.85);
        ctx.fillText(v.route.label.split("→")[0].trim(), pt.x + 14, pt.y - 8);
      }
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      map.off("resize", resize);
      try { container.removeChild(canvas); } catch { /* already removed */ }
    };
  }, [map]);

  return null;
}

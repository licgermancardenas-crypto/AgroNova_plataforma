"use client";

import { useEffect, useMemo, useRef } from "react";
import { useMap } from "react-leaflet";
import type { SucursalMarker, ProvinceKPI } from "@/types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Particle {
  fromLat: number;
  fromLon: number;
  toLat:   number;
  toLon:   number;
  progress: number;
  speed:    number;
  color:    string;
  size:     number;
  opacity:  number;
}

interface PulseRing {
  lat:      number;
  lon:      number;
  radius:   number;   // current px radius
  maxPx:    number;   // max px radius
  growPx:   number;   // px/frame growth
  color:    string;
  alpha:    number;
  lw:       number;   // line width
}

export interface FlowAnimationLayerProps {
  sucursales: SucursalMarker[];
  allKpis:    ProvinceKPI[];
  playing:    boolean;
  speed:      1 | 2;
  showPulse:  boolean;
}

// ── Helper ────────────────────────────────────────────────────────────────────

function rgba(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
}

function otifColor(otif: number): string {
  return otif >= 93 ? "#22C55E" : otif >= 88 ? "#E8A020" : "#E03E3E";
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function FlowAnimationLayer({
  sucursales, allKpis, playing, speed, showPulse,
}: FlowAnimationLayerProps) {
  const map = useMap();

  // Animation state held in refs — never triggers re-renders
  const rafRef       = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const pulseRef     = useRef<PulseRing[]>([]);

  // Stable refs for hot-loop values
  const playingRef   = useRef(playing);
  const speedRef     = useRef(speed);
  const pulseOnRef   = useRef(showPulse);
  useEffect(() => { playingRef.current   = playing;   }, [playing]);
  useEffect(() => { speedRef.current     = speed;     }, [speed]);
  useEffect(() => { pulseOnRef.current   = showPulse; }, [showPulse]);

  // ── Pre-compute flow connections (useMemo = no re-run on every render) ─────
  const particleInit = useMemo<Particle[]>(() => {
    const top8 = [...allKpis].sort((a, b) => b.revenue_ars - a.revenue_ars).slice(0, 8);
    const out: Particle[] = [];
    for (const suc of sucursales) {
      for (const prov of top8) {
        if (out.length >= 64) break;
        const color = otifColor(prov.otif_pct);
        // 1-2 particles per connection
        const lanes = prov.revenue_pct > 10 ? 2 : 1;
        for (let l = 0; l < lanes; l++) {
          out.push({
            fromLat:  suc.lat,
            fromLon:  suc.lng,
            toLat:    prov.lat,
            toLon:    prov.lon,
            progress: Math.random(),
            speed:    0.0012 + Math.random() * 0.0014,
            color,
            size:     2.5 + Math.random() * 2,
            opacity:  0.65 + Math.random() * 0.35,
          });
        }
      }
    }
    return out;
  }, [sucursales, allKpis]);

  // ── Pre-compute pulse rings ────────────────────────────────────────────────
  const pulseInit = useMemo<PulseRing[]>(() => {
    const rings: PulseRing[] = [];
    // Sucursales — always
    for (const s of sucursales) {
      rings.push({
        lat:    s.lat,
        lon:    s.lng,
        radius: 3 + Math.random() * 8,
        maxPx:  28 + Math.random() * 12,
        growPx: 0.28 + Math.random() * 0.14,
        color:  otifColor(s.otif_pct),
        alpha:  0.65,
        lw:     2,
      });
    }
    // Critical provinces (gap > 7 or OTIF < 88)
    for (const k of allKpis) {
      if (k.gap_score > 7 || k.otif_pct < 88) {
        rings.push({
          lat:    k.lat,
          lon:    k.lon,
          radius: Math.random() * 5,
          maxPx:  20 + k.gap_score * 1.5,
          growPx: 0.22 + Math.random() * 0.12,
          color:  k.otif_pct < 88 ? "#E03E3E" : "#E8A020",
          alpha:  0.45,
          lw:     1,
        });
      }
    }
    return rings;
  }, [sucursales, allKpis]);

  // Copy init into mutable refs when they change
  useEffect(() => {
    particlesRef.current = particleInit.map(p => ({ ...p }));
  }, [particleInit]);
  useEffect(() => {
    pulseRef.current = pulseInit.map(r => ({ ...r }));
  }, [pulseInit]);

  // ── Canvas lifecycle + animation loop ─────────────────────────────────────
  useEffect(() => {
    const container = map.getContainer();
    const canvas    = document.createElement("canvas");
    canvas.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:450;";
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

      // ── Particles ─────────────────────────────────────────────────
      for (const p of particlesRef.current) {
        if (isPlaying) {
          p.progress += p.speed * spd;
          if (p.progress > 1) p.progress = 0;
        }

        const t    = p.progress;
        // Head position
        const hLat = p.fromLat + (p.toLat - p.fromLat) * t;
        const hLon = p.fromLon + (p.toLon - p.fromLon) * t;
        const hPt  = map.latLngToContainerPoint([hLat, hLon]);

        // Trail start (15% behind head)
        const tBase = Math.max(0, t - 0.15);
        const tLat  = p.fromLat + (p.toLat - p.fromLat) * tBase;
        const tLon  = p.fromLon + (p.toLon - p.fromLon) * tBase;
        const tPt   = map.latLngToContainerPoint([tLat, tLon]);

        // Gradient trail line
        const dist = Math.hypot(hPt.x - tPt.x, hPt.y - tPt.y);
        if (dist > 0.5) {
          const grad = ctx.createLinearGradient(tPt.x, tPt.y, hPt.x, hPt.y);
          grad.addColorStop(0, rgba(p.color, 0));
          grad.addColorStop(1, rgba(p.color, p.opacity * 0.7));
          ctx.strokeStyle = grad;
          ctx.lineWidth   = p.size * 0.45;
          ctx.lineCap     = "round";
          ctx.beginPath();
          ctx.moveTo(tPt.x, tPt.y);
          ctx.lineTo(hPt.x, hPt.y);
          ctx.stroke();
        }

        // Head glow
        const grd = ctx.createRadialGradient(hPt.x, hPt.y, 0, hPt.x, hPt.y, p.size * 3);
        grd.addColorStop(0, rgba(p.color, p.opacity * 0.6));
        grd.addColorStop(1, rgba(p.color, 0));
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(hPt.x, hPt.y, p.size * 3, 0, Math.PI * 2);
        ctx.fill();

        // Head core
        ctx.fillStyle = rgba(p.color, p.opacity);
        ctx.beginPath();
        ctx.arc(hPt.x, hPt.y, p.size * 0.75, 0, Math.PI * 2);
        ctx.fill();
      }

      // ── Pulse rings ───────────────────────────────────────────────
      if (pulseOnRef.current) {
        for (const ring of pulseRef.current) {
          if (isPlaying) {
            ring.radius += ring.growPx * spd;
            if (ring.radius > ring.maxPx) ring.radius = 1;
          }
          const pt   = map.latLngToContainerPoint([ring.lat, ring.lon]);
          const fade = 1 - ring.radius / ring.maxPx;
          ctx.strokeStyle = rgba(ring.color, ring.alpha * fade);
          ctx.lineWidth   = ring.lw;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, ring.radius, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      map.off("resize", resize);
      try { container.removeChild(canvas); } catch { /* already removed */ }
    };
  }, [map]); // map never changes — stable ref

  return null;
}

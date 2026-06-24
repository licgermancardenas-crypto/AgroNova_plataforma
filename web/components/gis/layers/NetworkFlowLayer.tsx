"use client";

import { useEffect, useRef, memo } from "react";
import { useMap } from "react-leaflet";
import type { NetworkAnalysis, NetworkDepot, NetworkFlow, DepotStatus } from "@/types";

// ── constants ─────────────────────────────────────────────────────────────────

const DEPOT_COLOR: Record<DepotStatus, string> = {
  NORMAL:   "#22C55E",
  ALTO_USO: "#F97316",
  "CRÍTICO":"#E03E3E",
};

const FLOW_ALPHA = 0.55;

// ── helpers ────────────────────────────────────────────────────────────────────

function rgba(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a)).toFixed(2)})`;
}

// Cubic bezier point for arced flows
function bezier(
  t: number,
  x0: number, y0: number,
  cx: number, cy: number,
  x1: number, y1: number,
): [number, number] {
  const mt = 1 - t;
  return [
    mt * mt * x0 + 2 * mt * t * cx + t * t * x1,
    mt * mt * y0 + 2 * mt * t * cy + t * t * y1,
  ];
}

interface Particle {
  fromX: number; fromY: number;
  toX:   number; toY:   number;
  ctrlX: number; ctrlY: number;
  t:     number;   // 0..1 position along arc
  speed: number;
  color: string;
  size:  number;
}

interface PulseRing {
  x: number; y: number;
  r: number; maxR: number; growR: number;
  color: string;
  alpha: number;
}

// ── component ─────────────────────────────────────────────────────────────────

interface Props {
  visible:      boolean;
  data:         NetworkAnalysis | null;
  showFlows:    boolean;
  showBottlenecks: boolean;
  simClosedId?: number | null;
}

function NetworkFlowLayer({ visible, data, showFlows, showBottlenecks, simClosedId }: Props) {
  const map         = useMap();
  const canvasRef   = useRef<HTMLCanvasElement | null>(null);
  const rafRef      = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const pulseRef    = useRef<PulseRing[]>([]);

  // ── canvas lifecycle ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!map) return;
    const container = map.getContainer();
    const canvas    = document.createElement("canvas");
    canvas.style.cssText =
      "position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:448;";
    container.appendChild(canvas);
    canvasRef.current = canvas;

    const resize = () => {
      const rc = container.getBoundingClientRect();
      canvas.width  = rc.width;
      canvas.height = rc.height;
    };
    resize();
    map.on("resize moveend zoomend", resize);

    return () => {
      map.off("resize moveend zoomend", resize);
      cancelAnimationFrame(rafRef.current);
      canvas.remove();
      canvasRef.current = null;
    };
  }, [map]);

  // ── rebuild particles + pulses when data changes ────────────────────────────
  useEffect(() => {
    if (!visible || !data) {
      particlesRef.current = [];
      pulseRef.current     = [];
      return;
    }

    const newParticles: Particle[] = [];
    const newPulse: PulseRing[]    = [];

    if (showFlows) {
      // Max envíos for thickness normalisation
      const maxEnvios = Math.max(...data.flows.map(f => f.n_envios), 1);

      data.flows.forEach((f: NetworkFlow) => {
        const closed = simClosedId === f.deposito_id;
        if (closed) return;

        // Convert lat/lon to pixel coords (at initial position — will be updated in draw)
        // We store lat/lon and convert each frame for pan/zoom correctness
        const lanes = Math.max(1, Math.round((f.n_envios / maxEnvios) * 3));
        const color = f.flow_color;

        for (let l = 0; l < lanes; l++) {
          newParticles.push({
            fromX: f.deposito_lat, fromY: f.deposito_lon,  // stored as lat/lon
            toX:   f.region_lat,   toY:   f.region_lon,
            ctrlX: (f.deposito_lat + f.region_lat) / 2 + (Math.random() - 0.5) * 3,
            ctrlY: (f.deposito_lon + f.region_lon) / 2 + (Math.random() - 0.5) * 3,
            t:     Math.random(),
            speed: 0.0010 + Math.random() * 0.0012,
            color,
            size:  2 + Math.random() * 2,
          });
        }
      });
    }

    if (showBottlenecks) {
      data.depots.forEach((d: NetworkDepot) => {
        const isClosed = simClosedId === d.deposito_id;
        const color = isClosed ? "#6B7280" : DEPOT_COLOR[d.load_status];
        // Multiple rings for CRÍTICO
        const rings = d.load_status === "CRÍTICO" ? 3 : d.load_status === "ALTO_USO" ? 2 : 1;
        for (let i = 0; i < rings; i++) {
          newPulse.push({
            x: d.lat, y: d.lon,  // lat/lon — converted in draw
            r:     5 + i * 8 + Math.random() * 4,
            maxR:  22 + i * 10,
            growR: 0.22 + Math.random() * 0.1 - i * 0.04,
            color,
            alpha: isClosed ? 0.15 : 0.55 - i * 0.12,
          });
        }
      });
    }

    particlesRef.current = newParticles;
    pulseRef.current     = newPulse;
  }, [visible, data, showFlows, showBottlenecks, simClosedId]);

  // ── animation loop ──────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !map) return;

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      const canvas = canvasRef.current;
      if (!canvas || !visible) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Helper: lat/lon → canvas pixel
      const toXY = (lat: number, lon: number): [number, number] => {
        const pt = map.latLngToContainerPoint([lat, lon]);
        return [pt.x, pt.y];
      };

      // Particles (flow arcs)
      const pts = particlesRef.current;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        p.t = (p.t + p.speed) % 1;

        const [fx, fy] = toXY(p.fromX, p.fromY);
        const [tx, ty] = toXY(p.toX,   p.toY);
        const [cx, cy] = toXY(p.ctrlX,  p.ctrlY);
        const [px, py] = bezier(p.t, fx, fy, cx, cy, tx, ty);

        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fillStyle = rgba(p.color, FLOW_ALPHA);
        ctx.fill();

        // Draw static arc line (faint)
        if (i % 3 === 0) {  // every 3rd particle to avoid redundancy
          ctx.beginPath();
          ctx.moveTo(fx, fy);
          ctx.quadraticCurveTo(cx, cy, tx, ty);
          ctx.strokeStyle = rgba(p.color, 0.12);
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // Pulse rings (bottlenecks)
      const rings = pulseRef.current;
      for (let i = 0; i < rings.length; i++) {
        const r = rings[i];
        r.r = r.r >= r.maxR ? 3 : r.r + r.growR;
        const [rx, ry] = toXY(r.x, r.y);
        ctx.beginPath();
        ctx.arc(rx, ry, r.r, 0, Math.PI * 2);
        ctx.strokeStyle = rgba(r.color, r.alpha * (1 - r.r / r.maxR));
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [map, visible]);

  return null;
}

export default memo(NetworkFlowLayer);

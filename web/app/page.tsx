"use client";

import { useState, useEffect, useRef, memo, useMemo } from "react";
import Link from "next/link";
import {
  Map, Brain, Users, Network, Leaf, Play, BarChart3,
  Github, Mail, ExternalLink, ChevronDown, Layers,
  Database, Globe, Cpu, Zap, Server, Shield, GitBranch,
  Terminal, Star, ArrowRight, Activity,
} from "lucide-react";
import { useCountUp } from "@/hooks/useCountUp";

// ── Data ─────────────────────────────────────────────────────────────────────

const MODULES = [
  {
    id: "gis", icon: Map, title: "GIS Intelligence",
    desc: "Choropleth en 24 provincias · Heatmaps · Basemaps múltiples · Temporal 2016-2026",
    href: "/gis", color: "#22C55E", badge: "LIVE",
    stats: "24 provincias · 5 motores de mapa",
  },
  {
    id: "customer", icon: Users, title: "Customer Intelligence",
    desc: "3.387 clientes reales desde Neon PostgreSQL · Segmentación tier/churn/revenue",
    href: "/gis", color: "#F97316", badge: "GIS-25",
    stats: "3.387 clientes · Neon live",
  },
  {
    id: "territory", icon: Layers, title: "Territory Optimization",
    desc: "PostGIS KNN lateral join · 2.571 conflictos · Simulación de redistribución",
    href: "/gis", color: "#A3E635", badge: "GIS-26",
    stats: "2.571 conflictos · 5 sucursales",
  },
  {
    id: "network", icon: Network, title: "Network Digital Twin",
    desc: "200k envíos anuales · Detección de bottlenecks · Flow visualization en tiempo real",
    href: "/gis", color: "#0EA5E9", badge: "GIS-27",
    stats: "200k envíos · 5 depósitos",
  },
  {
    id: "ai", icon: Brain, title: "AI Spatial Analytics",
    desc: "Diagnóstico espacial · Pattern detection · ML pipeline Python listo",
    href: "/gis", color: "#C084FC", badge: "AI",
    stats: "Spatial diag · ML ready",
  },
  {
    id: "env", icon: Leaf, title: "Environmental Intelligence",
    desc: "Índices de sequía, heladas e inundaciones · Riesgo climático agregado por provincia",
    href: "/gis", color: "#0DB87E", badge: "ENV",
    stats: "24 provincias · 4 índices",
  },
  {
    id: "story", icon: Play, title: "Story Mode",
    desc: "6 escenas guiadas · FlyTo cinematográfico · Auto-play · Demo ejecutivo premium",
    href: "/gis", color: "#E8A020", badge: "UX-02",
    stats: "6 escenas · 8s auto-play",
  },
] as const;

const STACK_LAYERS = [
  {
    label: "Frontend",
    color: "#22C55E",
    icon: Globe,
    items: ["Next.js 15", "React 18", "TypeScript", "Tailwind CSS", "Recharts"],
  },
  {
    label: "Map Engines",
    color: "#0EA5E9",
    icon: Map,
    items: ["Leaflet OSM", "Mapbox GL", "ArcGIS Online", "Deck.gl", "React-Leaflet"],
  },
  {
    label: "Backend",
    color: "#A3E635",
    icon: Server,
    items: ["FastAPI", "Python 3.12", "SQLAlchemy", "Pydantic v2"],
  },
  {
    label: "Database",
    color: "#F97316",
    icon: Database,
    items: ["Neon PostgreSQL", "PostGIS 3.x", "GeoJSON", "WGS84"],
  },
  {
    label: "Deploy",
    color: "#C084FC",
    icon: Zap,
    items: ["Vercel Edge", "CI/CD", "ISR", "Next.js Build"],
  },
] as const;

const METRIC_ITEMS = [
  { label: "Registros procesados", value: 1900000, display: "1.9M", color: "#22C55E" },
  { label: "Sprints GIS",          value: 27,      display: "27+",  color: "#4ADE80" },
  { label: "Clientes reales",      value: 3387,    display: "3.387",color: "#0EA5E9" },
  { label: "Provincias",           value: 24,      display: "24",   color: "#A3E635" },
  { label: "Conflictos PostGIS",   value: 2571,    display: "2.571",color: "#F97316" },
  { label: "Story escenas",        value: 6,       display: "6",    color: "#E8A020" },
];

const TIMELINE_PHASES = [
  {
    phase: "v1.0",
    title: "Platform Launch",
    date: "Abr 2026",
    items: ["9 páginas analíticas", "20 KPIs mock", "Next.js 15 + Tailwind", "Dark glassmorphism"],
    color: "#22C55E",
  },
  {
    phase: "GIS-01→06",
    title: "GIS Foundation",
    date: "May 2026",
    items: ["Choropleth + heatmap", "KNN routing engine", "Voronoi territories", "Basemaps múltiples"],
    color: "#4ADE80",
  },
  {
    phase: "GIS-07→12",
    title: "Temporal Engine",
    date: "May 2026",
    items: ["2016-2026 histórico", "Compound growth model", "OTIF/Churn curves", "TimeSlider animado"],
    color: "#A3E635",
  },
  {
    phase: "GIS-20→24",
    title: "3D + Command Center",
    date: "Jun 2026",
    items: ["Mapbox Terrain 3D", "Earth Night Mode", "⌘K Command Palette", "Tour Cinematográfico"],
    color: "#0EA5E9",
  },
  {
    phase: "GIS-25→27",
    title: "Intelligence Suite",
    date: "Jun 2026",
    items: ["3.387 clientes Neon", "Territory PostGIS KNN", "Network Digital Twin", "Bottleneck detection"],
    color: "#C084FC",
  },
  {
    phase: "UX-01→05",
    title: "Premium Experience",
    date: "Jun 2026",
    items: ["Story Mode 6 escenas", "Responsive mobile", "Executive Command Center", "Corporate Landing"],
    color: "#E8A020",
  },
];

const NAV_LINKS = [
  { label: "Módulos",       href: "#modules"  },
  { label: "Stack",         href: "#stack"    },
  { label: "Evolución",     href: "#timeline" },
  { label: "Dashboard",     href: "/comercial" },
];

// ── Small components ──────────────────────────────────────────────────────────

const MetricCounter = memo(function MetricCounter({
  value, display, label, color,
}: { value: number; display: string; label: string; color: string }) {
  const count = useCountUp(value, 1800, 0);

  const formatted = useMemo(() => {
    if (value >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000)     return count.toLocaleString("es-AR");
    return count.toString();
  }, [count, value]);

  return (
    <div className="flex flex-col items-center gap-1 px-6 py-4">
      <span className="font-mono font-black" style={{ fontSize: 28, color, lineHeight: 1 }}>
        {formatted}
        {value >= 1_000_000 ? "" : value === 27 ? "+" : ""}
      </span>
      <span
        className="font-mono text-center leading-tight"
        style={{ fontSize: 9, color: "#3E5A3E", letterSpacing: "0.12em", textTransform: "uppercase" }}
      >
        {label}
      </span>
    </div>
  );
});

// ── GIS UI Mockup — stylized preview card ─────────────────────────────────────

function GisMockup({ variant = "map" }: { variant?: "map" | "kpi" | "story" }) {
  return (
    <div
      className="relative overflow-hidden rounded-xl"
      style={{
        background:     "rgba(5,12,6,0.95)",
        border:         "1px solid rgba(34,197,94,0.25)",
        boxShadow:      "0 8px 40px rgba(0,0,0,0.6), 0 0 60px rgba(34,197,94,0.06)",
        aspectRatio:    "16/9",
      }}
    >
      {/* Window chrome */}
      <div
        className="flex items-center gap-1.5 px-3 py-2 border-b"
        style={{ borderColor: "rgba(34,197,94,0.15)", background: "rgba(3,10,4,0.8)" }}
      >
        <span className="w-2 h-2 rounded-full" style={{ background: "#EF4444" }} />
        <span className="w-2 h-2 rounded-full" style={{ background: "#F59E0B" }} />
        <span className="w-2 h-2 rounded-full" style={{ background: "#22C55E" }} />
        <span
          className="ml-2 font-mono"
          style={{ fontSize: 8, color: "#3E5A3E", letterSpacing: "0.1em" }}
        >
          {variant === "map" ? "AGRONOVA · GIS INTELLIGENCE · LIVE" :
           variant === "kpi" ? "AGRONOVA · EXECUTIVE COMMAND CENTER" :
           "AGRONOVA · STORY MODE · SCENE 3/6"}
        </span>
        <div className="flex-1" />
        <span className="w-1.5 h-1.5 rounded-full blink" style={{ background: "#22C55E", boxShadow: "0 0 4px rgba(34,197,94,0.8)" }} />
      </div>

      {/* Content */}
      {variant === "map" && (
        <div className="relative p-2 h-full">
          {/* Simulated map */}
          <div className="absolute inset-2 rounded-lg overflow-hidden" style={{ top: 36 }}>
            <svg width="100%" height="100%" viewBox="0 0 300 160">
              {/* Argentina silhouette mockup — abstract shapes */}
              <rect width="300" height="160" fill="#071209" />
              {/* Provinces */}
              {[
                { x: 80,  y: 20,  w: 60, h: 45, c: "#22C55E", o: 0.7 },
                { x: 145, y: 15,  w: 50, h: 40, c: "#4ADE80", o: 0.6 },
                { x: 60,  y: 65,  w: 55, h: 40, c: "#22C55E", o: 0.5 },
                { x: 120, y: 55,  w: 65, h: 45, c: "#A3E635", o: 0.6 },
                { x: 185, y: 50,  w: 45, h: 35, c: "#22C55E", o: 0.4 },
                { x: 75,  y: 100, w: 50, h: 35, c: "#4ADE80", o: 0.5 },
                { x: 125, y: 100, w: 55, h: 30, c: "#22C55E", o: 0.7 },
                { x: 180, y: 90,  w: 40, h: 40, c: "#A3E635", o: 0.5 },
                { x: 60,  y: 132, w: 45, h: 20, c: "#22C55E", o: 0.3 },
                { x: 110, y: 128, w: 50, h: 22, c: "#4ADE80", o: 0.4 },
              ].map((s, i) => (
                <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx="3"
                  fill={s.c} fillOpacity={s.o} stroke={s.c} strokeWidth="0.5" strokeOpacity="0.4" />
              ))}
              {/* Markers */}
              {[
                { x: 140, y: 90, color: "#22C55E" },
                { x: 165, y: 75, color: "#22C55E" },
                { x: 185, y: 110, color: "#22C55E" },
                { x: 115, y: 65, color: "#F97316" },
                { x: 200, y: 65, color: "#0EA5E9" },
              ].map((m, i) => (
                <circle key={i} cx={m.x} cy={m.y} r="3.5" fill={m.color} opacity="0.9"
                  style={{ filter: `drop-shadow(0 0 3px ${m.color})` }} />
              ))}
              {/* Flow lines */}
              <line x1="140" y1="90" x2="165" y2="75" stroke="#22C55E" strokeWidth="1" opacity="0.4" strokeDasharray="3,2" />
              <line x1="165" y1="75" x2="185" y2="110" stroke="#0EA5E9" strokeWidth="1" opacity="0.4" strokeDasharray="3,2" />
            </svg>
            {/* Overlay panel indicators */}
            <div className="absolute right-1 top-1 flex flex-col gap-0.5">
              {["CHOROPLETH", "SUCURSALES", "CLIENTES"].map((l, i) => (
                <div key={i} className="flex items-center gap-1 px-1 py-0.5 rounded"
                  style={{ background: "rgba(5,12,6,0.85)", border: "1px solid rgba(34,197,94,0.20)" }}>
                  <span className="w-1 h-1 rounded-full" style={{ background: i === 0 ? "#22C55E" : i === 1 ? "#4ADE80" : "#F97316" }} />
                  <span style={{ fontSize: 5.5, color: "#3E5A3E", fontFamily: "monospace" }}>{l}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {variant === "kpi" && (
        <div className="p-3 flex flex-col gap-2" style={{ marginTop: 36 }}>
          {/* KPI ribbon simulation */}
          <div className="flex gap-1.5 overflow-hidden">
            {[
              { l: "Revenue", v: "ARS 4.7B", c: "#22C55E" },
              { l: "Clientes", v: "3.387",   c: "#4ADE80" },
              { l: "OTIF",     v: "87.3%",   c: "#0EA5E9" },
              { l: "Margen",   v: "32.4%",   c: "#A3E635" },
              { l: "Churn",    v: "22.4%",   c: "#F97316" },
            ].map((k, i) => (
              <div key={i} className="flex flex-col gap-0.5 px-2 py-1 rounded-lg flex-shrink-0"
                style={{ background: `${k.c}10`, border: `1px solid ${k.c}35` }}>
                <span style={{ fontSize: 6, color: "#3E5A3E", fontFamily: "monospace" }}>{k.l}</span>
                <span style={{ fontSize: 10, color: k.c, fontFamily: "monospace", fontWeight: 700 }}>{k.v}</span>
              </div>
            ))}
          </div>
          {/* Status badges */}
          <div className="flex gap-1 flex-wrap">
            {["● NEON", "● POSTGIS", "● ARCGIS", "● LEAFLET"].map((b, i) => (
              <span key={i} className="px-1.5 py-0.5 rounded font-mono"
                style={{ fontSize: 6, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.22)", color: "#22C55E" }}>
                {b}
              </span>
            ))}
          </div>
        </div>
      )}

      {variant === "story" && (
        <div className="p-3 flex gap-2" style={{ marginTop: 36 }}>
          <div className="flex-1 relative rounded-lg overflow-hidden"
            style={{ background: "#071209", border: "1px solid rgba(34,197,94,0.15)" }}>
            <svg width="100%" height="100" viewBox="0 0 200 100">
              <rect width="200" height="100" fill="#071209" />
              {[
                { x: 40, y: 15, w: 50, h: 40, c: "#22C55E", o: 0.6 },
                { x: 95, y: 10, w: 45, h: 35, c: "#4ADE80", o: 0.5 },
                { x: 35, y: 55, w: 45, h: 35, c: "#22C55E", o: 0.4 },
                { x: 85, y: 50, w: 55, h: 40, c: "#A3E635", o: 0.5 },
              ].map((s, i) => (
                <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx="3"
                  fill={s.c} fillOpacity={s.o} />
              ))}
            </svg>
          </div>
          <div className="w-24 flex flex-col gap-1.5">
            <div className="rounded-lg p-1.5" style={{ background: "rgba(14,165,233,0.12)", border: "1px solid rgba(14,165,233,0.30)" }}>
              <p style={{ fontSize: 6, color: "#0EA5E9", fontFamily: "monospace", fontWeight: 700 }}>STORY MODE</p>
              <p style={{ fontSize: 5.5, color: "#7A9C7A", fontFamily: "monospace" }}>Logistics Network</p>
              <div className="mt-1 h-0.5 rounded" style={{ background: "#0EA5E9", width: "50%" }} />
            </div>
            <div className="flex gap-0.5 mt-auto">
              {["PREV", "STOP", "NEXT"].map(b => (
                <span key={b} className="flex-1 text-center py-0.5 rounded"
                  style={{ fontSize: 5, color: "#4B6B4B", background: "rgba(7,18,9,0.7)", border: "1px solid rgba(34,197,94,0.18)", fontFamily: "monospace" }}>
                  {b}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none rounded-xl"
        style={{ boxShadow: "inset 0 0 40px rgba(34,197,94,0.04)" }} />
    </div>
  );
}

// ── Module card ───────────────────────────────────────────────────────────────

const ModuleCard = memo(function ModuleCard({
  icon: Icon, title, desc, href, color, badge, stats,
}: (typeof MODULES)[number]) {
  return (
    <Link
      href={href}
      className="group relative flex flex-col gap-3 p-5 rounded-2xl border transition-all duration-300"
      style={{
        background:   "rgba(5,12,6,0.70)",
        borderColor:  "rgba(26,61,32,0.60)",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = `${color}55`;
        (e.currentTarget as HTMLElement).style.boxShadow  = `0 8px 32px rgba(0,0,0,0.5), 0 0 20px ${color}12`;
        (e.currentTarget as HTMLElement).style.background  = `${color}08`;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(26,61,32,0.60)";
        (e.currentTarget as HTMLElement).style.boxShadow  = "none";
        (e.currentTarget as HTMLElement).style.background  = "rgba(5,12,6,0.70)";
      }}
    >
      {/* Badge */}
      <span
        className="absolute top-3 right-3 px-2 py-0.5 rounded-full font-mono font-bold"
        style={{ fontSize: 8, background: `${color}18`, color, border: `1px solid ${color}40`, letterSpacing: "0.1em" }}
      >
        {badge}
      </span>

      {/* Icon */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${color}14`, border: `1px solid ${color}35` }}
      >
        <Icon size={18} style={{ color }} />
      </div>

      {/* Content */}
      <div className="flex flex-col gap-1.5">
        <h3 className="font-mono font-bold" style={{ fontSize: 13, color: "#DCE8DC" }}>
          {title}
        </h3>
        <p style={{ fontSize: 11, color: "#7A9C7A", lineHeight: 1.55 }}>
          {desc}
        </p>
      </div>

      {/* Stats footer */}
      <div className="flex items-center gap-1.5 mt-auto pt-2 border-t" style={{ borderColor: "rgba(34,197,94,0.08)" }}>
        <Activity size={9} style={{ color: "#3E5A3E" }} />
        <span className="font-mono" style={{ fontSize: 8.5, color: "#3E5A3E", letterSpacing: "0.06em" }}>
          {stats}
        </span>
        <ArrowRight size={9} className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity" style={{ color }} />
      </div>
    </Link>
  );
});

// ── Main page ─────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen" style={{ background: "#030A04", color: "#DCE8DC" }}>

      {/* ── Sticky nav ─────────────────────────────────────────────────────── */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-10 transition-all duration-300"
        style={{
          height:         56,
          background:     scrolled ? "rgba(3,10,4,0.95)" : "transparent",
          backdropFilter: scrolled ? "blur(16px)" : "none",
          borderBottom:   scrolled ? "1px solid rgba(34,197,94,0.12)" : "1px solid transparent",
        }}
      >
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center font-mono font-black text-xs"
            style={{ background: "rgba(34,197,94,0.16)", border: "1px solid rgba(34,197,94,0.45)", color: "#22C55E" }}
          >
            AN
          </div>
          <div className="hidden sm:flex flex-col">
            <span className="font-mono font-black" style={{ fontSize: 11, color: "#22C55E", letterSpacing: "0.12em" }}>
              AGRONOVA
            </span>
            <span className="font-mono" style={{ fontSize: 7, color: "#3E5A3E", letterSpacing: "0.14em" }}>
              INTELLIGENCE PLATFORM
            </span>
          </div>
        </div>

        {/* Links */}
        <div className="hidden md:flex items-center gap-6">
          {NAV_LINKS.map(l => (
            <Link
              key={l.label}
              href={l.href}
              className="font-mono transition-colors"
              style={{ fontSize: 10, color: "#3E5A3E", letterSpacing: "0.10em", textTransform: "uppercase" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#22C55E"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#3E5A3E"; }}
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* CTA */}
        <Link
          href="/gis"
          className="flex items-center gap-2 px-4 py-2 rounded-xl font-mono font-bold transition-all"
          style={{
            fontSize:    10,
            background:  "rgba(34,197,94,0.14)",
            border:      "1px solid rgba(34,197,94,0.45)",
            color:       "#22C55E",
            letterSpacing: "0.10em",
            boxShadow:   "0 0 16px rgba(34,197,94,0.12)",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = "rgba(34,197,94,0.24)";
            (e.currentTarget as HTMLElement).style.boxShadow  = "0 0 24px rgba(34,197,94,0.25)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = "rgba(34,197,94,0.14)";
            (e.currentTarget as HTMLElement).style.boxShadow  = "0 0 16px rgba(34,197,94,0.12)";
          }}
        >
          <Map size={12} />
          ENTER GIS
        </Link>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section
        ref={heroRef}
        className="relative min-h-screen flex flex-col items-center justify-center text-center px-6"
        style={{ paddingTop: 56 }}
      >
        {/* Grid pattern background */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(rgba(34,197,94,0.04) 1px, transparent 1px),
              linear-gradient(90deg, rgba(34,197,94,0.04) 1px, transparent 1px)
            `,
            backgroundSize: "48px 48px",
          }}
        />
        {/* Radial glow center */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse 60% 55% at 50% 40%, rgba(34,197,94,0.06) 0%, transparent 70%)",
          }}
        />

        <div className="relative z-10 max-w-4xl mx-auto">
          {/* Pre-badge */}
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-8"
            style={{
              background:   "rgba(34,197,94,0.08)",
              border:       "1px solid rgba(34,197,94,0.28)",
              backdropFilter: "blur(8px)",
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full blink" style={{ background: "#22C55E", boxShadow: "0 0 5px rgba(34,197,94,0.9)" }} />
            <span className="font-mono" style={{ fontSize: 9, color: "#22C55E", letterSpacing: "0.14em" }}>
              LIVE · GIS v10.0 · GIS-27 · feature/geospatial-v2
            </span>
          </div>

          {/* Main title */}
          <h1
            className="font-mono font-black leading-none mb-4"
            style={{
              fontSize: "clamp(32px, 6vw, 72px)",
              color:    "#DCE8DC",
              letterSpacing: "-0.02em",
            }}
          >
            AgroNova
            <span style={{ color: "#22C55E", display: "block" }}>
              Intelligence
            </span>
            Platform
          </h1>

          {/* Subtitle */}
          <p
            className="font-mono mb-10 max-w-2xl mx-auto"
            style={{ fontSize: "clamp(11px, 1.5vw, 14px)", color: "#7A9C7A", lineHeight: 1.7, letterSpacing: "0.04em" }}
          >
            Decision Intelligence · GIS · AI · Supply Chain
            <br />
            <span style={{ color: "#3E5A3E" }}>
              27+ módulos GIS · 3.387 clientes reales · PostGIS · ArcGIS Live · Neon
            </span>
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/gis"
              className="flex items-center gap-2.5 px-7 py-3.5 rounded-2xl font-mono font-bold transition-all"
              style={{
                fontSize:    12,
                background:  "rgba(34,197,94,0.16)",
                border:      "1px solid rgba(34,197,94,0.50)",
                color:       "#22C55E",
                letterSpacing: "0.12em",
                boxShadow:   "0 0 30px rgba(34,197,94,0.18), inset 0 1px 0 rgba(255,255,255,0.04)",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = "rgba(34,197,94,0.26)";
                (e.currentTarget as HTMLElement).style.boxShadow  = "0 0 48px rgba(34,197,94,0.30), inset 0 1px 0 rgba(255,255,255,0.06)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = "rgba(34,197,94,0.16)";
                (e.currentTarget as HTMLElement).style.boxShadow  = "0 0 30px rgba(34,197,94,0.18), inset 0 1px 0 rgba(255,255,255,0.04)";
              }}
            >
              <Map size={14} />
              ENTER GIS
            </Link>
            <a
              href="#modules"
              className="flex items-center gap-2.5 px-7 py-3.5 rounded-2xl font-mono font-bold transition-all"
              style={{
                fontSize:    12,
                background:  "rgba(5,12,6,0.60)",
                border:      "1px solid rgba(34,197,94,0.22)",
                color:       "#7A9C7A",
                letterSpacing: "0.12em",
                backdropFilter: "blur(8px)",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(34,197,94,0.45)";
                (e.currentTarget as HTMLElement).style.color = "#DCE8DC";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(34,197,94,0.22)";
                (e.currentTarget as HTMLElement).style.color = "#7A9C7A";
              }}
            >
              <BarChart3 size={14} />
              VIEW MODULES
            </a>
          </div>
        </div>

        {/* Scroll indicator */}
        <a
          href="#metrics"
          className="absolute bottom-8 left-1/2 flex flex-col items-center gap-1 transition-opacity hover:opacity-60"
          style={{ transform: "translateX(-50%)" }}
        >
          <span className="font-mono" style={{ fontSize: 8, color: "#3E5A3E", letterSpacing: "0.12em" }}>SCROLL</span>
          <ChevronDown size={14} style={{ color: "#3E5A3E" }} className="animate-bounce" />
        </a>
      </section>

      {/* ── Metrics strip ──────────────────────────────────────────────────── */}
      <section
        id="metrics"
        className="relative border-y"
        style={{ borderColor: "rgba(34,197,94,0.12)", background: "rgba(3,10,4,0.85)", backdropFilter: "blur(12px)" }}
      >
        <div className="max-w-6xl mx-auto flex flex-wrap justify-center"
          style={{ borderColor: "rgba(34,197,94,0.10)" }}
        >
          {METRIC_ITEMS.map((m, i) => (
            <div key={m.label} className="flex items-center">
              {i > 0 && <div className="w-px self-stretch my-4" style={{ background: "rgba(34,197,94,0.12)" }} />}
              <MetricCounter {...m} />
            </div>
          ))}
        </div>
      </section>

      {/* ── Screenshots / Previews ────────────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="font-mono mb-2" style={{ fontSize: 10, color: "#22C55E", letterSpacing: "0.16em" }}>
              PRODUCT PREVIEW
            </p>
            <h2 className="font-mono font-black" style={{ fontSize: "clamp(22px, 4vw, 36px)", color: "#DCE8DC" }}>
              Command Center Completo
            </h2>
            <p className="mt-3" style={{ fontSize: 13, color: "#7A9C7A" }}>
              GIS · KPI Ribbon · Story Mode · System Status
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <GisMockup variant="map" />
              <p className="text-center mt-2 font-mono" style={{ fontSize: 9, color: "#3E5A3E", letterSpacing: "0.10em" }}>
                GIS INTELLIGENCE · LEAFLET + ARCGIS LIVE
              </p>
            </div>
            <div className="flex flex-col gap-4">
              <GisMockup variant="kpi" />
              <p className="text-center font-mono" style={{ fontSize: 9, color: "#3E5A3E", letterSpacing: "0.10em" }}>
                EXECUTIVE COMMAND CENTER
              </p>
              <GisMockup variant="story" />
              <p className="text-center font-mono" style={{ fontSize: 9, color: "#3E5A3E", letterSpacing: "0.10em" }}>
                STORY MODE · 6 SCENES
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Modules grid ─────────────────────────────────────────────────── */}
      <section id="modules" className="py-20 px-6 border-t" style={{ borderColor: "rgba(34,197,94,0.08)" }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="font-mono mb-2" style={{ fontSize: 10, color: "#22C55E", letterSpacing: "0.16em" }}>
              INTELLIGENCE MODULES
            </p>
            <h2 className="font-mono font-black" style={{ fontSize: "clamp(22px, 4vw, 36px)", color: "#DCE8DC" }}>
              7 Módulos de Inteligencia
            </h2>
            <p className="mt-3" style={{ fontSize: 13, color: "#7A9C7A" }}>
              Cada módulo conecta datos reales con insights accionables
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {MODULES.map(m => (
              <ModuleCard key={m.id} {...m} />
            ))}
          </div>
          <div className="mt-8 flex justify-center">
            <Link
              href="/gis"
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-mono font-bold transition-all"
              style={{
                fontSize:    11,
                background:  "rgba(34,197,94,0.10)",
                border:      "1px solid rgba(34,197,94,0.35)",
                color:       "#22C55E",
                letterSpacing: "0.10em",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = "rgba(34,197,94,0.20)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = "rgba(34,197,94,0.10)";
              }}
            >
              <Map size={12} />
              Explorar todos los módulos en el GIS
              <ExternalLink size={10} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Architecture ─────────────────────────────────────────────────── */}
      <section id="stack" className="py-20 px-6 border-t" style={{ borderColor: "rgba(34,197,94,0.08)", background: "rgba(3,10,4,0.50)" }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="font-mono mb-2" style={{ fontSize: 10, color: "#22C55E", letterSpacing: "0.16em" }}>
              ARCHITECTURE
            </p>
            <h2 className="font-mono font-black" style={{ fontSize: "clamp(22px, 4vw, 36px)", color: "#DCE8DC" }}>
              Stack Técnico
            </h2>
            <p className="mt-3" style={{ fontSize: 13, color: "#7A9C7A" }}>
              Production-grade. Zero compromises.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {STACK_LAYERS.map((layer, li) => {
              const Icon = layer.icon;
              return (
                <div key={layer.label} className="relative">
                  {/* Connection line */}
                  {li < STACK_LAYERS.length - 1 && (
                    <div
                      className="absolute left-1/2 bottom-0 translate-y-full w-px h-3 z-10"
                      style={{ background: `linear-gradient(to bottom, ${layer.color}40, ${STACK_LAYERS[li+1].color}40)` }}
                    />
                  )}
                  <div
                    className="rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4"
                    style={{
                      background:  `${layer.color}07`,
                      border:      `1px solid ${layer.color}25`,
                      boxShadow:   `0 2px 12px ${layer.color}08`,
                    }}
                  >
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center"
                        style={{ background: `${layer.color}16`, border: `1px solid ${layer.color}35` }}
                      >
                        <Icon size={16} style={{ color: layer.color }} />
                      </div>
                      <span
                        className="font-mono font-bold w-24"
                        style={{ fontSize: 10, color: layer.color, letterSpacing: "0.12em", textTransform: "uppercase" }}
                      >
                        {layer.label}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 flex-1">
                      {layer.items.map(item => (
                        <span
                          key={item}
                          className="px-3 py-1.5 rounded-lg font-mono"
                          style={{
                            fontSize:    10,
                            background:  `${layer.color}10`,
                            border:      `1px solid ${layer.color}30`,
                            color:       "#DCE8DC",
                          }}
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Timeline ─────────────────────────────────────────────────────── */}
      <section id="timeline" className="py-20 px-6 border-t" style={{ borderColor: "rgba(34,197,94,0.08)" }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="font-mono mb-2" style={{ fontSize: 10, color: "#22C55E", letterSpacing: "0.16em" }}>
              EVOLUTION
            </p>
            <h2 className="font-mono font-black" style={{ fontSize: "clamp(22px, 4vw, 36px)", color: "#DCE8DC" }}>
              De v1.0 a GIS-27
            </h2>
            <p className="mt-3" style={{ fontSize: 13, color: "#7A9C7A" }}>
              Cronología de sprints · GIS-01 → GIS-27 · UX-01 → UX-05
            </p>
          </div>
          <div className="relative">
            {/* Vertical line */}
            <div
              className="absolute left-6 top-0 bottom-0 w-px hidden sm:block"
              style={{ background: "linear-gradient(to bottom, rgba(34,197,94,0.30), rgba(34,197,94,0.04))" }}
            />
            <div className="flex flex-col gap-6">
              {TIMELINE_PHASES.map((phase, i) => (
                <div key={phase.phase} className="flex gap-6 items-start">
                  {/* Phase dot */}
                  <div className="flex-shrink-0 flex flex-col items-center hidden sm:flex" style={{ width: 48 }}>
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center border-2 z-10"
                      style={{ background: "#030A04", borderColor: phase.color }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: phase.color }} />
                    </div>
                  </div>
                  {/* Card */}
                  <div
                    className="flex-1 rounded-2xl p-5 border transition-all"
                    style={{
                      background:  `${phase.color}07`,
                      borderColor: `${phase.color}25`,
                    }}
                  >
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                      <div className="flex items-center gap-3">
                        <span
                          className="px-2.5 py-1 rounded-lg font-mono font-bold"
                          style={{ fontSize: 9, background: `${phase.color}18`, color: phase.color, border: `1px solid ${phase.color}40`, letterSpacing: "0.08em" }}
                        >
                          {phase.phase}
                        </span>
                        <h3 className="font-mono font-bold" style={{ fontSize: 13, color: "#DCE8DC" }}>
                          {phase.title}
                        </h3>
                      </div>
                      <span className="font-mono" style={{ fontSize: 9, color: "#3E5A3E" }}>
                        {phase.date}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {phase.items.map(item => (
                        <span
                          key={item}
                          className="flex items-center gap-1.5 font-mono"
                          style={{ fontSize: 10, color: "#7A9C7A" }}
                        >
                          <Star size={7} style={{ color: phase.color }} />
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Other modules quick links ─────────────────────────────────────── */}
      <section className="py-16 px-6 border-t" style={{ borderColor: "rgba(34,197,94,0.08)", background: "rgba(3,10,4,0.60)" }}>
        <div className="max-w-4xl mx-auto text-center">
          <p className="font-mono mb-2" style={{ fontSize: 10, color: "#22C55E", letterSpacing: "0.16em" }}>PLATFORM MODULES</p>
          <h2 className="font-mono font-black mb-8" style={{ fontSize: "clamp(20px, 3vw, 30px)", color: "#DCE8DC" }}>
            Plataforma Completa
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {[
              { label: "GIS",        href: "/gis",       icon: Map,      color: "#22C55E" },
              { label: "Comercial",  href: "/comercial",  icon: BarChart3, color: "#4ADE80" },
              { label: "Finanzas",   href: "/finanzas",   icon: Zap,      color: "#A3E635" },
              { label: "Clientes",   href: "/clientes",   icon: Users,    color: "#F97316" },
              { label: "Logística",  href: "/logistica",  icon: Network,  color: "#0EA5E9" },
              { label: "Inventario", href: "/inventario", icon: Database, color: "#C084FC" },
              { label: "ML · IA",    href: "/ml",         icon: Brain,    color: "#E8A020" },
              { label: "Copilot",    href: "/copilot",    icon: Terminal, color: "#0DB87E" },
            ].map(m => {
              const MIcon = m.icon;
              return (
                <Link
                  key={m.label}
                  href={m.href}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl border transition-all"
                  style={{ background: "rgba(5,12,6,0.70)", borderColor: "rgba(26,61,32,0.60)" }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = `${m.color}45`;
                    (e.currentTarget as HTMLElement).style.background = `${m.color}0A`;
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(26,61,32,0.60)";
                    (e.currentTarget as HTMLElement).style.background = "rgba(5,12,6,0.70)";
                  }}
                >
                  <MIcon size={18} style={{ color: m.color }} />
                  <span className="font-mono" style={{ fontSize: 9, color: "#7A9C7A", letterSpacing: "0.08em" }}>
                    {m.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer
        className="border-t px-6 py-10"
        style={{ borderColor: "rgba(34,197,94,0.12)", background: "rgba(3,10,4,0.95)" }}
      >
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          {/* Brand */}
          <div className="flex flex-col items-center sm:items-start gap-1">
            <span className="font-mono font-black" style={{ fontSize: 13, color: "#22C55E", letterSpacing: "0.12em" }}>
              AGRONOVA
            </span>
            <span className="font-mono" style={{ fontSize: 8, color: "#3E5A3E", letterSpacing: "0.14em" }}>
              INTELLIGENCE PLATFORM · v2.0 GIS-27
            </span>
            <span className="font-mono mt-1" style={{ fontSize: 8, color: "#3E5A3E" }}>
              Germán Cárdenas · 2026
            </span>
          </div>

          {/* Tech links */}
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/licgermancardenas-crypto/AgroNova_plataforma"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-xl font-mono transition-all border"
              style={{ fontSize: 10, color: "#7A9C7A", borderColor: "rgba(34,197,94,0.18)", background: "rgba(5,12,6,0.70)", letterSpacing: "0.08em" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#DCE8DC"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(34,197,94,0.40)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#7A9C7A"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(34,197,94,0.18)"; }}
            >
              <Github size={12} />
              GitHub
            </a>
            <a
              href="mailto:lic.germancardenas@gmail.com"
              className="flex items-center gap-2 px-4 py-2 rounded-xl font-mono transition-all border"
              style={{ fontSize: 10, color: "#7A9C7A", borderColor: "rgba(34,197,94,0.18)", background: "rgba(5,12,6,0.70)", letterSpacing: "0.08em" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#DCE8DC"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(34,197,94,0.40)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#7A9C7A"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(34,197,94,0.18)"; }}
            >
              <Mail size={12} />
              Email
            </a>
            <a
              href="https://agro-nova-plataforma.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-xl font-mono transition-all border"
              style={{ fontSize: 10, color: "#22C55E", borderColor: "rgba(34,197,94,0.35)", background: "rgba(34,197,94,0.08)", letterSpacing: "0.08em" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(34,197,94,0.16)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(34,197,94,0.08)"; }}
            >
              <ExternalLink size={12} />
              Live Demo
            </a>
          </div>

          {/* Status */}
          <div className="flex flex-col items-center sm:items-end gap-1">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full blink" style={{ background: "#22C55E", boxShadow: "0 0 5px rgba(34,197,94,0.9)" }} />
              <span className="font-mono font-bold" style={{ fontSize: 10, color: "#22C55E", letterSpacing: "0.10em" }}>ALL SYSTEMS OPERATIONAL</span>
            </div>
            <span className="font-mono" style={{ fontSize: 8, color: "#3E5A3E" }}>
              Vercel Edge · ISR · Next.js 15
            </span>
            <div className="flex gap-1 mt-1">
              {["Neon", "PostGIS", "ArcGIS", "Leaflet"].map(s => (
                <span key={s} className="px-1.5 py-0.5 rounded font-mono" style={{ fontSize: 7, background: "rgba(34,197,94,0.08)", color: "#3E5A3E", border: "1px solid rgba(34,197,94,0.15)" }}>
                  ● {s}
                </span>
              ))}
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}

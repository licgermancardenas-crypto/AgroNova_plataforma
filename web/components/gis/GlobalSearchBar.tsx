"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Search, X, MapPin, Building2, Package, Map } from "lucide-react";
import type { ProvinceKPI } from "@/types";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SearchResult {
  type:     "provincia" | "sucursal" | "deposito" | "municipio";
  id:       string;
  label:    string;
  sublabel: string;
  lat:      number;
  lon:      number;
  kpi?:     ProvinceKPI;
}

// ── Static cities index ───────────────────────────────────────────────────────

const MUNICIPIOS_STATIC: Omit<SearchResult, "type">[] = [
  { id:"bsas",        label:"Buenos Aires",           sublabel:"CABA",          lat:-34.60, lon:-58.38 },
  { id:"cordoba_c",   label:"Córdoba",                sublabel:"Córdoba",       lat:-31.42, lon:-64.18 },
  { id:"rosario",     label:"Rosario",                sublabel:"Santa Fe",      lat:-32.95, lon:-60.65 },
  { id:"mendoza_c",   label:"Mendoza",                sublabel:"Mendoza",       lat:-32.89, lon:-68.85 },
  { id:"tucuman_c",   label:"San Miguel de Tucumán",  sublabel:"Tucumán",       lat:-26.82, lon:-65.22 },
  { id:"laplata",     label:"La Plata",               sublabel:"Buenos Aires",  lat:-34.92, lon:-57.95 },
  { id:"salta_c",     label:"Salta",                  sublabel:"Salta",         lat:-24.79, lon:-65.41 },
  { id:"bblanca",     label:"Bahía Blanca",           sublabel:"Buenos Aires",  lat:-38.72, lon:-62.27 },
  { id:"santafe_c",   label:"Santa Fe",               sublabel:"Santa Fe",      lat:-31.62, lon:-60.70 },
  { id:"neuquen_c",   label:"Neuquén",                sublabel:"Neuquén",       lat:-38.95, lon:-68.06 },
  { id:"comodoro",    label:"Comodoro Rivadavia",     sublabel:"Chubut",        lat:-45.87, lon:-67.50 },
  { id:"posadas",     label:"Posadas",                sublabel:"Misiones",      lat:-27.36, lon:-55.90 },
  { id:"jujuy_c",     label:"San Salvador de Jujuy",  sublabel:"Jujuy",         lat:-24.19, lon:-65.30 },
  { id:"resistencia", label:"Resistencia",            sublabel:"Chaco",         lat:-27.45, lon:-58.99 },
  { id:"corrientes",  label:"Corrientes",             sublabel:"Corrientes",    lat:-27.47, lon:-58.84 },
  { id:"mar_plata",   label:"Mar del Plata",          sublabel:"Buenos Aires",  lat:-38.00, lon:-57.55 },
  { id:"san_juan_c",  label:"San Juan",               sublabel:"San Juan",      lat:-31.53, lon:-68.53 },
  { id:"rioja_c",     label:"La Rioja",               sublabel:"La Rioja",      lat:-29.41, lon:-66.86 },
  { id:"catamarca_c", label:"San Fernando del Valle", sublabel:"Catamarca",     lat:-28.47, lon:-65.78 },
  { id:"rio_gallegos",label:"Río Gallegos",           sublabel:"Santa Cruz",    lat:-51.62, lon:-69.22 },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalize(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

const TYPE_ICON: Record<SearchResult["type"], React.ReactNode> = {
  provincia: <MapPin size={9} />,
  sucursal:  <Building2 size={9} />,
  deposito:  <Package size={9} />,
  municipio: <Map size={9} />,
};

const TYPE_COLOR: Record<SearchResult["type"], string> = {
  provincia: "#22C55E",
  sucursal:  "#4ADE80",
  deposito:  "#0EA5E9",
  municipio: "#A3E635",
};

const TYPE_LABEL: Record<SearchResult["type"], string> = {
  provincia: "PROVINCIAS",
  sucursal:  "SUCURSALES",
  deposito:  "DEPÓSITOS",
  municipio: "MUNICIPIOS",
};

const ORDER: SearchResult["type"][] = ["provincia", "sucursal", "deposito", "municipio"];

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  provinces:  ProvinceKPI[];
  sucursales: { id: number; nombre: string; lat: number; lng: number }[];
  depositos:  { id: number; nombre: string; lat: number; lng: number }[];
  onSelect:   (result: SearchResult) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function GlobalSearchBar({ provinces, sucursales, depositos, onSelect }: Props) {
  const [query,   setQuery]   = useState("");
  const [open,    setOpen]    = useState(false);
  const [focused, setFocused] = useState(-1);
  const rootRef  = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const buildIndex = useCallback((): SearchResult[] => [
    ...provinces.map(p => ({ type: "provincia" as const, id: `p_${p.nombre}`, label: p.nombre, sublabel: p.macro_region, lat: p.lat, lon: p.lon, kpi: p })),
    ...sucursales.map(s => ({ type: "sucursal" as const, id: `s_${s.id}`, label: s.nombre, sublabel: "Sucursal AgroNova", lat: s.lat, lon: s.lng })),
    ...depositos.map(d => ({ type: "deposito" as const, id: `d_${d.id}`, label: d.nombre, sublabel: "Centro logístico", lat: d.lat, lon: d.lng })),
    ...MUNICIPIOS_STATIC.map(m => ({ type: "municipio" as const, ...m })),
  ], [provinces, sucursales, depositos]);

  const hits: SearchResult[] = useMemo(() => {
    if (!query.trim()) return [];
    const q = normalize(query);
    return buildIndex().filter(r => normalize(r.label).includes(q) || normalize(r.sublabel).includes(q)).slice(0, 14);
  }, [query, buildIndex]);

  const grouped = useMemo(() =>
    ORDER.reduce((acc, type) => {
      const items = hits.filter(h => h.type === type);
      if (items.length) acc[type] = items;
      return acc;
    }, {} as Partial<Record<SearchResult["type"], SearchResult[]>>),
  [hits]);

  function handleSelect(r: SearchResult) {
    setQuery(""); setOpen(false); setFocused(-1);
    onSelect(r);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setFocused(f => Math.min(f + 1, hits.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setFocused(f => Math.max(f - 1, -1)); }
    if (e.key === "Enter" && focused >= 0 && hits[focused]) handleSelect(hits[focused]);
    if (e.key === "Escape") { setOpen(false); setQuery(""); }
  }

  useEffect(() => {
    const h = (e: MouseEvent) => { if (!rootRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => { if (!open) setFocused(-1); }, [open]);

  let flatIdx = -1;

  return (
    <div ref={rootRef} className="relative flex-1 max-w-[280px] min-w-0">
      <div className="relative flex items-center">
        <Search size={9} className="absolute left-2.5 text-text-muted pointer-events-none" />
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKey}
          placeholder="Buscar provincia, sucursal, municipio..."
          className="w-full font-mono pl-7 pr-6 py-1 rounded outline-none transition-all"
          style={{ background: "rgba(7,18,9,0.7)", border: "1px solid rgba(34,197,94,0.18)", color: "#DCE8DC", fontSize: 9.5 }}
        />
        {query && (
          <button className="absolute right-2" onClick={() => { setQuery(""); setOpen(false); }}>
            <X size={8} className="text-text-muted hover:text-text-secondary" />
          </button>
        )}
      </div>

      {open && hits.length > 0 && (
        <div
          className="absolute top-full left-0 right-0 mt-1 rounded-xl z-[650] overflow-hidden"
          style={{
            background:     "rgba(4,10,5,0.98)",
            border:         "1px solid rgba(34,197,94,0.22)",
            backdropFilter: "blur(20px)",
            boxShadow:      "0 12px 40px rgba(0,0,0,0.7)",
            maxHeight:       300,
            overflowY:       "auto",
          }}
        >
          {(Object.keys(grouped) as SearchResult["type"][]).map(type => (
            <div key={type}>
              <div className="px-3 py-1 sticky top-0 flex items-center gap-1.5"
                style={{ background: "rgba(4,10,5,0.96)", borderBottom: "1px solid rgba(34,197,94,0.07)" }}>
                <span style={{ color: TYPE_COLOR[type] }}>{TYPE_ICON[type]}</span>
                <span className="tactical-text" style={{ color: TYPE_COLOR[type], fontSize: 7.5 }}>{TYPE_LABEL[type]}</span>
              </div>
              {grouped[type]!.map(r => {
                flatIdx++;
                const idx = flatIdx;
                const isActive = focused === idx;
                return (
                  <button key={r.id} onClick={() => handleSelect(r)} onMouseEnter={() => setFocused(idx)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-left transition-all"
                    style={{ background: isActive ? "rgba(34,197,94,0.08)" : "transparent" }}>
                    <span style={{ color: TYPE_COLOR[r.type] }}>{TYPE_ICON[r.type]}</span>
                    <div className="flex-1 min-w-0">
                      <span className="font-mono block truncate" style={{ color: isActive ? "#DCE8DC" : "#7A9C7A", fontSize: 10 }}>{r.label}</span>
                      <span className="tactical-text block" style={{ color: "#3E5A3E", fontSize: 7.5 }}>{r.sublabel}</span>
                    </div>
                    <span className="tactical-text flex-shrink-0" style={{ color: "#2A4A2A", fontSize: 7 }}>
                      {r.lat.toFixed(1)}, {r.lon.toFixed(1)}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

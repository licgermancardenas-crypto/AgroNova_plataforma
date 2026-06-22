"use client";

import { useState, useMemo, useCallback } from "react";
import { Search, X } from "lucide-react";
import type { CustomerGeo } from "@/types";
import { fmtARS } from "@/lib/formatters";

const CHURN_DOT: Record<string, string> = {
  Bajo:  "#22C55E",
  Medio: "#F97316",
  Alto:  "#E03E3E",
};

interface Props {
  customers:         CustomerGeo[];
  onSelect:          (c: CustomerGeo) => void;
  onFlyTo:           (lat: number, lon: number) => void;
  selectedCustomer:  CustomerGeo | null;
}

export default function CustomerSearchPanel({ customers, onSelect, onFlyTo, selectedCustomer }: Props) {
  const [q,        setQ]        = useState("");
  const [province, setProvince] = useState("");
  const [segment,  setSegment]  = useState("");

  const provinces = useMemo(
    () => [...new Set(customers.map(c => c.provincia ?? "").filter(Boolean))].sort(),
    [customers],
  );
  const segments = useMemo(
    () => [...new Set(customers.map(c => c.segmento).filter(Boolean))].sort(),
    [customers],
  );

  const results = useMemo(() => {
    if (!q && !province && !segment) return [];
    const lq = q.toLowerCase();
    return customers
      .filter(c => !c.is_outlier)
      .filter(c => {
        const matchQ  = !q || c.razon_social.toLowerCase().includes(lq)
          || (c.cuit ?? "").includes(lq)
          || (c.ciudad ?? "").toLowerCase().includes(lq);
        const matchP  = !province || c.provincia === province;
        const matchS  = !segment  || c.segmento  === segment;
        return matchQ && matchP && matchS;
      })
      .sort((a, b) => (b.revenue_ars ?? 0) - (a.revenue_ars ?? 0))
      .slice(0, 40);
  }, [q, province, segment, customers]);

  const clear = useCallback(() => { setQ(""); setProvince(""); setSegment(""); }, []);

  const inputCls = "w-full rounded px-2 py-1 text-xs font-mono outline-none bg-black/30 border border-white/10 text-[#DCE8DC] placeholder:text-[#4A6A4A] focus:border-[#F97316]/40";

  return (
    <div className="flex flex-col gap-2 h-full min-h-0">
      {/* Search inputs */}
      <div className="flex flex-col gap-1.5 flex-shrink-0">
        <div className="relative">
          <Search size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-[#4A6A4A]" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Nombre / CUIT / Ciudad…"
            className={inputCls + " pl-6"}
          />
          {q && (
            <button onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#4A6A4A] hover:text-[#DCE8DC]">
              <X size={10} />
            </button>
          )}
        </div>
        <select value={province} onChange={e => setProvince(e.target.value)} className={inputCls}>
          <option value="">Todas las provincias</option>
          {provinces.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={segment} onChange={e => setSegment(e.target.value)} className={inputCls}>
          <option value="">Todos los segmentos</option>
          {segments.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {(q || province || segment) && (
          <button onClick={clear} className="text-[9px] text-[#4A6A4A] hover:text-[#F97316] text-right font-mono transition-colors">
            ✕ limpiar filtros
          </button>
        )}
      </div>

      {/* Results count */}
      {results.length > 0 && (
        <div className="text-[9px] text-[#4A6A4A] font-mono flex-shrink-0">
          {results.length} resultado{results.length > 1 ? "s" : ""}{results.length === 40 ? " (top 40)" : ""}
        </div>
      )}

      {/* Result list */}
      <div className="flex flex-col gap-1 overflow-y-auto flex-1 min-h-0 pr-0.5" style={{ scrollbarWidth: "thin" }}>
        {results.map(c => {
          const isSelected = selectedCustomer?.cliente_id === c.cliente_id;
          return (
            <button
              key={c.cliente_id}
              onClick={() => {
                onSelect(c);
                onFlyTo(c.lat, c.lon);
              }}
              className="w-full text-left rounded p-2 transition-all"
              style={{
                background: isSelected ? "rgba(249,115,22,0.15)" : "rgba(255,255,255,0.03)",
                border:     `1px solid ${isSelected ? "rgba(249,115,22,0.40)" : "rgba(255,255,255,0.06)"}`,
              }}
            >
              <div className="flex items-start justify-between gap-1">
                <span
                  className="text-[10px] font-semibold leading-tight"
                  style={{ color: isSelected ? "#FDBA74" : "#DCE8DC" }}
                >
                  {c.razon_social}
                </span>
                <span
                  className="flex-shrink-0 w-1.5 h-1.5 rounded-full mt-1"
                  style={{ background: CHURN_DOT[c.churn_level ?? "Medio"] }}
                />
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[9px] font-mono" style={{ color: "#7A9C7A" }}>
                  {c.provincia}
                </span>
                <span className="text-[9px] font-mono" style={{ color: "#22C55E" }}>
                  {c.revenue_ars ? fmtARS(c.revenue_ars, true) : "—"}
                </span>
                <span
                  className="text-[8px] font-mono px-1 rounded"
                  style={{ background: "rgba(249,115,22,0.15)", color: "#F97316" }}
                >
                  T{c.tier}
                </span>
              </div>
            </button>
          );
        })}

        {results.length === 0 && (q || province || segment) && (
          <div className="text-[10px] text-[#4A6A4A] text-center mt-4 font-mono">
            Sin resultados
          </div>
        )}
        {!q && !province && !segment && (
          <div className="text-[10px] text-[#4A6A4A] text-center mt-4 font-mono leading-relaxed">
            Escribí un nombre, CUIT o ciudad
            <br />para buscar clientes
          </div>
        )}
      </div>
    </div>
  );
}

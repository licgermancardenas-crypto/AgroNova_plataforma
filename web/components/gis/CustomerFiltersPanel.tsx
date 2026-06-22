"use client";

import { useCallback } from "react";
import { RotateCcw } from "lucide-react";
import type { CustomerFilters } from "@/types";
import { fmtARS } from "@/lib/formatters";

interface Props {
  filters:    CustomerFilters;
  onChange:   (f: CustomerFilters) => void;
  totalCount: number;
  filteredCount: number;
}

const CHURN_COLOR: Record<string, string> = {
  Bajo:  "#22C55E",
  Medio: "#F97316",
  Alto:  "#E03E3E",
};

const SEGMENTOS = ["Agricultor", "Contratista", "Cooperativa", "Empresa"];
const TIERS     = ["A", "B", "C", "D"];
const CHURNS    = ["Bajo", "Medio", "Alto"];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[9px] font-mono font-bold tracking-widest mb-1.5" style={{ color: "#4A6A4A" }}>
      {children}
    </div>
  );
}

function Pill({
  label, active, color, onClick,
}: { label: string; active: boolean; color?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-2 py-0.5 rounded-full text-[9px] font-mono font-semibold transition-all"
      style={{
        background: active ? (color ? `${color}22` : "rgba(249,115,22,0.15)") : "rgba(255,255,255,0.04)",
        border:     `1px solid ${active ? (color ?? "#F97316") : "rgba(255,255,255,0.10)"}`,
        color:      active ? (color ?? "#F97316") : "#7A9C7A",
      }}
    >
      {label}
    </button>
  );
}

export const DEFAULT_FILTERS: CustomerFilters = {
  segmentos:  [],
  churnLevels: [],
  tiers:      [],
  provincias: [],
  revenueMin: 0,
  revenueMax: 999_999_999,
};

export default function CustomerFiltersPanel({ filters, onChange, totalCount, filteredCount }: Props) {
  const toggle = useCallback(<K extends keyof CustomerFilters>(
    key: K,
    value: string,
  ) => {
    const arr = filters[key] as string[];
    onChange({
      ...filters,
      [key]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value],
    });
  }, [filters, onChange]);

  const reset = useCallback(() => onChange(DEFAULT_FILTERS), [onChange]);

  const isDefault = (
    filters.segmentos.length === 0
    && filters.churnLevels.length === 0
    && filters.tiers.length === 0
    && filters.provincias.length === 0
    && filters.revenueMin === 0
    && filters.revenueMax === 999_999_999
  );

  const revBuckets: [string, number, number][] = [
    ["< 5M",   0,         4_999_999],
    ["5-20M",  5_000_000, 19_999_999],
    ["20-50M", 20_000_000, 49_999_999],
    ["> 50M",  50_000_000, 999_999_999],
  ];
  const activeBucket = revBuckets.find(
    ([, mn, mx]) => mn === filters.revenueMin && mx === filters.revenueMax,
  );

  return (
    <div className="flex flex-col gap-4 text-[#DCE8DC]">
      {/* Count + reset */}
      <div className="flex justify-between items-center">
        <span className="text-[9px] font-mono" style={{ color: "#4A6A4A" }}>
          {filteredCount.toLocaleString("es-AR")} / {totalCount.toLocaleString("es-AR")} clientes
        </span>
        {!isDefault && (
          <button
            onClick={reset}
            className="flex items-center gap-1 text-[9px] font-mono transition-colors"
            style={{ color: "#F97316" }}
          >
            <RotateCcw size={9} />
            resetear
          </button>
        )}
      </div>

      {/* Segmento */}
      <div>
        <SectionLabel>SEGMENTO</SectionLabel>
        <div className="flex flex-wrap gap-1">
          {SEGMENTOS.map(s => (
            <Pill
              key={s}
              label={s}
              active={filters.segmentos.includes(s)}
              onClick={() => toggle("segmentos", s)}
            />
          ))}
        </div>
      </div>

      {/* Churn */}
      <div>
        <SectionLabel>RIESGO CHURN</SectionLabel>
        <div className="flex gap-1">
          {CHURNS.map(c => (
            <Pill
              key={c}
              label={c}
              active={filters.churnLevels.includes(c)}
              color={CHURN_COLOR[c]}
              onClick={() => toggle("churnLevels", c)}
            />
          ))}
        </div>
      </div>

      {/* Tier */}
      <div>
        <SectionLabel>TIER</SectionLabel>
        <div className="flex gap-1">
          {TIERS.map(t => (
            <Pill
              key={t}
              label={`Tier ${t}`}
              active={filters.tiers.includes(t)}
              onClick={() => toggle("tiers", t)}
            />
          ))}
        </div>
      </div>

      {/* Revenue buckets */}
      <div>
        <SectionLabel>REVENUE ANUAL</SectionLabel>
        <div className="flex flex-wrap gap-1">
          {revBuckets.map(([label, mn, mx]) => {
            const isActive = activeBucket?.[0] === label;
            return (
              <button
                key={label}
                onClick={() => onChange({
                  ...filters,
                  revenueMin: isActive ? 0  : mn,
                  revenueMax: isActive ? 999_999_999 : mx,
                })}
                className="px-2 py-0.5 rounded-full text-[9px] font-mono font-semibold transition-all"
                style={{
                  background: isActive ? "rgba(163,230,53,0.15)" : "rgba(255,255,255,0.04)",
                  border:     `1px solid ${isActive ? "#A3E635" : "rgba(255,255,255,0.10)"}`,
                  color:      isActive ? "#A3E635" : "#7A9C7A",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active filter summary */}
      {!isDefault && (
        <div
          className="rounded p-2"
          style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.15)" }}
        >
          <div className="text-[9px] font-mono" style={{ color: "#F97316" }}>Filtros activos:</div>
          {filters.segmentos.length > 0    && <div className="text-[8px] mt-0.5" style={{ color: "#7A9C7A" }}>Segmento: {filters.segmentos.join(", ")}</div>}
          {filters.churnLevels.length > 0  && <div className="text-[8px] mt-0.5" style={{ color: "#7A9C7A" }}>Churn: {filters.churnLevels.join(", ")}</div>}
          {filters.tiers.length > 0        && <div className="text-[8px] mt-0.5" style={{ color: "#7A9C7A" }}>Tier: {filters.tiers.join(", ")}</div>}
          {activeBucket && <div className="text-[8px] mt-0.5" style={{ color: "#7A9C7A" }}>Revenue: {activeBucket[0]}</div>}
        </div>
      )}
    </div>
  );
}

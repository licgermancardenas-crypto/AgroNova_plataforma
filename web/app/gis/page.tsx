"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard, CardHeader } from "@/components/ui/glass-card";
import { KPICard } from "@/components/ui/kpi-card";
import { sucursales, depositos, clienteMarkers, regions } from "@/lib/mock-data";
import { fmtARS, fmtPctAbs } from "@/lib/formatters";
import { MapPin, Layers, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

const LeafletMap = dynamic(() => import("@/components/map/LeafletMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-bg-surface rounded-xl flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-primary-DEFAULT border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <p className="text-xs text-text-muted">Cargando mapa...</p>
      </div>
    </div>
  ),
});

export default function GISPage() {
  const [showRadios, setShowRadios] = useState(true);
  const [showClientes, setShowClientes] = useState(true);

  return (
    <AppLayout title="Dashboard GIS" subtitle="Cobertura · Sucursales · Depósitos · Clientes">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <KPICard label="Sucursales Activas" value="5"      subvalue="5 regiones cubiertas"  accent="blue"    icon={<MapPin size={18} />} />
        <KPICard label="Depósitos"          value="3"      subvalue="12,000 ton Rosario"    accent="cyan"    icon={<Layers size={18} />} />
        <KPICard label="Clientes Mapeados"  value="1,187"  subvalue="En 18 provincias"      accent="green"   icon={<MapPin size={18} />} />
        <KPICard label="Cobertura PAM"      value="64.8%"  subvalue="del revenue total"     accent="blue"    icon={<Layers size={18} />} />
      </div>

      {/* Map + controls */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-4">
        {/* Map — 3/4 */}
        <GlassCard className="lg:col-span-3 p-0 overflow-hidden" padding="none">
          {/* Map controls */}
          <div className="absolute top-3 left-3 z-[1000] flex gap-2">
            <button
              onClick={() => setShowRadios(p => !p)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium backdrop-blur-sm border transition-colors",
                showRadios
                  ? "bg-primary-dim border-primary-DEFAULT/40 text-primary-light"
                  : "bg-bg-surface/80 border-border text-text-muted"
              )}
            >
              {showRadios ? <Eye size={12} /> : <EyeOff size={12} />}
              Radios
            </button>
            <button
              onClick={() => setShowClientes(p => !p)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium backdrop-blur-sm border transition-colors",
                showClientes
                  ? "bg-primary-dim border-primary-DEFAULT/40 text-primary-light"
                  : "bg-bg-surface/80 border-border text-text-muted"
              )}
            >
              {showClientes ? <Eye size={12} /> : <EyeOff size={12} />}
              Clientes
            </button>
          </div>
          <div className="h-[480px] w-full relative">
            <LeafletMap
              sucursales={sucursales}
              depositos={depositos}
              clientes={clienteMarkers}
              showRadios={showRadios}
              showClientes={showClientes}
            />
          </div>
          {/* Legend */}
          <div className="flex items-center gap-5 px-4 py-2.5 border-t border-border text-2xs text-text-muted">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-primary-DEFAULT border border-primary-light" />
              <span>Sucursal</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-warning-DEFAULT" />
              <span>Depósito</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-success-DEFAULT" />
              <span>Cliente Low Risk</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-warning-DEFAULT" />
              <span>Medium Risk</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-danger-DEFAULT" />
              <span>High Risk</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-full border border-primary-DEFAULT/40 bg-primary-DEFAULT/10" />
              <span>Radio de cobertura</span>
            </div>
          </div>
        </GlassCard>

        {/* Side panel — 1/4 */}
        <div className="space-y-3">
          <GlassCard>
            <CardHeader title="Sucursales" subtitle="Revenue y clientes" />
            <div className="space-y-3">
              {sucursales.map(s => (
                <div key={s.id} className="p-2.5 rounded-lg bg-bg-elevated border border-border-subtle">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-2 h-2 rounded-full bg-primary-DEFAULT" />
                    <p className="text-xs font-medium text-text-primary truncate">{s.nombre}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-2xs">
                    <div>
                      <span className="text-text-muted">Revenue:</span>
                      <br /><span className="text-text-primary font-mono">{fmtARS(s.revenue_ars, true)}</span>
                    </div>
                    <div>
                      <span className="text-text-muted">OTIF:</span>
                      <br /><span className={cn("font-mono font-semibold", s.otif_pct >= 92 ? "text-success-DEFAULT" : "text-warning-DEFAULT")}>{fmtPctAbs(s.otif_pct)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>

          <GlassCard>
            <CardHeader title="Distribución Regional" />
            {regions.map(r => (
              <div key={r.region} className="flex items-center justify-between py-1.5 border-b border-border-subtle last:border-0">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-8 rounded-full bg-primary-DEFAULT opacity-70" style={{ height: `${r.revenue_pct / 5 + 8}px` }} />
                  <div>
                    <p className="text-xs font-medium text-text-primary">{r.region}</p>
                    <p className="text-2xs text-text-muted">{r.clientes} clientes</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-mono text-text-primary">{fmtARS(r.revenue_ars, true)}</p>
                  <p className="text-2xs text-text-muted">{r.revenue_pct.toFixed(1)}%</p>
                </div>
              </div>
            ))}
          </GlassCard>
        </div>
      </div>
    </AppLayout>
  );
}

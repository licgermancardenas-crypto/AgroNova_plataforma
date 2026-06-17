"use client";

import { useEffect, useState } from "react";
import { Truck, Warehouse, ShieldAlert, MapPinPlus } from "lucide-react";
import { ROUTING_ENDPOINTS, ESTADO_CARGA_COLOR, RISK_LEVEL_COLOR } from "@/lib/routing";
import type {
  TransportCosts, DepotLoad, RouteRisk, ExpansionSimulation,
} from "@/types";

interface RoutingState {
  transportCosts: TransportCosts | null;
  depotLoad: DepotLoad | null;
  routeRisk: RouteRisk | null;
  expansion: ExpansionSimulation[];
  loading: boolean;
  error: string | null;
}

function useRouting(): RoutingState {
  const [state, setState] = useState<RoutingState>({
    transportCosts: null, depotLoad: null, routeRisk: null, expansion: [],
    loading: true, error: null,
  });

  useEffect(() => {
    Promise.all([
      fetch(ROUTING_ENDPOINTS.transportCosts).then(r => r.json()),
      fetch(ROUTING_ENDPOINTS.depotLoad).then(r => r.json()),
      fetch(ROUTING_ENDPOINTS.routeRisk).then(r => r.json()),
      fetch(ROUTING_ENDPOINTS.expansionSimulations).then(r => r.json()),
    ])
      .then(([transportCosts, depotLoad, routeRisk, expansion]) => {
        setState({ transportCosts, depotLoad, routeRisk, expansion, loading: false, error: null });
      })
      .catch((e: Error) => setState(s => ({ ...s, loading: false, error: e.message })));
  }, []);

  return state;
}

export default function RoutingPanel() {
  const { transportCosts, depotLoad, routeRisk, expansion, loading, error } = useRouting();

  if (loading) {
    return (
      <div className="glass rounded-xl p-3 flex items-center justify-center h-32">
        <span className="tactical-text text-text-muted">Cargando routing…</span>
      </div>
    );
  }
  if (error) {
    return (
      <div className="glass rounded-xl p-3 border border-danger-DEFAULT/30">
        <span className="tactical-text text-danger-DEFAULT">Error: {error}</span>
      </div>
    );
  }

  const rankedExpansion = [...expansion].sort(
    (a, b) => b.reduccion_costos_ars_anual - a.reduccion_costos_ars_anual
  );

  return (
    <div className="flex flex-col gap-2.5">
      {/* Costo logístico por depósito */}
      <div className="glass rounded-xl p-3">
        <p className="tactical-text mb-2.5 flex items-center gap-1.5">
          <Truck size={10} /><span>Costo Logístico por Depósito</span>
        </p>
        <div className="space-y-2">
          {transportCosts?.by_deposito.map(d => (
            <div key={d.deposito_id} className="flex justify-between text-2xs">
              <span className="text-text-secondary truncate max-w-[90px]">{d.nombre}</span>
              <span className="font-mono text-primary">
                ${d.costo_estimado_ars.toLocaleString("es-AR")} · {d.tiempo_estimado_horas}h
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Carga de depósitos */}
      <div className="glass rounded-xl p-3">
        <p className="tactical-text mb-2.5 flex items-center gap-1.5">
          <Warehouse size={10} /><span>Carga de Depósitos</span>
        </p>
        <div className="space-y-2">
          {depotLoad?.by_deposito.map(d => (
            <div key={d.deposito_id}>
              <div className="flex justify-between text-2xs mb-0.5">
                <span className="text-text-secondary truncate max-w-[90px]">{d.nombre}</span>
                <span className="font-mono font-bold" style={{ color: ESTADO_CARGA_COLOR[d.estado_carga] }}>
                  {d.estado_carga}
                </span>
              </div>
              <p className="text-2xs text-text-muted">
                {d.peso_diario_promedio_ton.toFixed(1)}t/día · {d.utilizacion_flota_pct.toFixed(0)}% flota
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Riesgo de rutas */}
      <div className="glass rounded-xl p-3">
        <p className="tactical-text mb-2.5 flex items-center gap-1.5">
          <ShieldAlert size={10} /><span>Riesgo de Rutas</span>
        </p>
        <div className="space-y-2">
          {routeRisk?.by_deposito.map(r => (
            <div key={r.deposito_id} className="flex justify-between text-2xs">
              <span className="text-text-secondary truncate max-w-[90px]">{r.nombre}</span>
              <span className="font-mono font-bold" style={{ color: RISK_LEVEL_COLOR[r.risk_level] }}>
                {r.risk_level} ({r.incidencia_score.toFixed(1)})
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Impacto de nuevas sucursales */}
      <div className="glass rounded-xl p-3">
        <p className="tactical-text mb-2.5 flex items-center gap-1.5">
          <MapPinPlus size={10} /><span>Impacto de Nuevas Sucursales</span>
        </p>
        <div className="space-y-2.5">
          {rankedExpansion.map(e => (
            <div key={e.provincia}>
              <div className="flex justify-between text-2xs mb-0.5">
                <span className="text-text-primary font-semibold truncate max-w-[100px]">{e.ciudad_candidata}</span>
                <span className="font-mono text-primary">+{e.mejora_proximidad_pts.toFixed(1)} pts</span>
              </div>
              <p className="text-2xs text-text-muted">
                -{e.ahorro_km}km · +{e.nuevos_clientes_potenciales} clientes ·
                ${e.reduccion_costos_ars_anual.toLocaleString("es-AR")}/año
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

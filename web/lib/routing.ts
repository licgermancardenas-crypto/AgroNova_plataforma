import type { EstadoCarga, RiskLevel } from "@/types";

export const ROUTING_ENDPOINTS = {
  transportCosts:       "/data/gis_outputs/transport_costs.json",
  depotLoad:             "/data/gis_outputs/depot_load.json",
  routeRisk:             "/data/gis_outputs/route_risk.json",
  expansionSimulations:  "/data/gis_outputs/expansion_simulations.json",
} as const;

export const ESTADO_CARGA_COLOR: Record<EstadoCarga, string> = {
  "Saturado (relativo)":     "#E03E3E",
  "Equilibrado":              "#4ADE80",
  "Subutilizado (relativo)": "#E8A020",
};

export const RISK_LEVEL_COLOR: Record<RiskLevel, string> = {
  "Alto":  "#E03E3E",
  "Medio": "#E8A020",
  "Bajo":  "#22C55E",
};

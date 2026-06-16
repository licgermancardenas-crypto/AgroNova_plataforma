import type { CoverageLabel, OpportunityLabel, ExpansionPriority, ChurnLevel } from "@/types";

export const ANALYTICS_ENDPOINTS = {
  coverage:   "/data/gis_outputs/coverage_score.json",
  opportunity:"/data/gis_outputs/opportunity_score.json",
  expansion:  "/data/gis_outputs/expansion_targets.json",
  density:    "/data/gis_outputs/revenue_density.json",
  churn:      "/data/gis_outputs/churn_by_province.json",
} as const;

export const COVERAGE_COLOR: Record<CoverageLabel, string> = {
  "Sólida":        "#22C55E",
  "Media":         "#4ADE80",
  "Incipiente":    "#E8A020",
  "Sin Cobertura": "#E03E3E",
};

export const OPPORTUNITY_COLOR: Record<OpportunityLabel, string> = {
  "Alta Oportunidad":     "#22C55E",
  "Oportunidad Moderada": "#A3E635",
  "Oportunidad Baja":     "#E8A020",
  "Mercado Maduro":       "#7A9C7A",
};

export const EXPANSION_COLOR: Record<ExpansionPriority, string> = {
  Alta:  "#22C55E",
  Media: "#E8A020",
  Baja:  "#7A9C7A",
};

export const CHURN_COLOR: Record<ChurnLevel, string> = {
  Low:        "#22C55E",
  Medium:     "#E8A020",
  High:       "#E03E3E",
  "Sin Datos":"#3E5A3E",
};

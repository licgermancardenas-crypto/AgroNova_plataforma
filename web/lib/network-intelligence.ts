import type { LogisticsLabel, ClusterLabel, CoverageBucketLabel } from "@/types";

export const NETWORK_ENDPOINTS = {
  distanceMatrix:           "/data/gis_outputs/distance_matrix.json",
  nearestBranch:            "/data/gis_outputs/nearest_branch.json",
  coverageDistribution:     "/data/gis_outputs/coverage_distribution.json",
  logisticsScore:           "/data/gis_outputs/logistics_score.json",
  territorialClusters:      "/data/gis_outputs/territorial_clusters.json",
  expansionRecommendations: "/data/gis_outputs/expansion_recommendations.json",
} as const;

export const LOGISTICS_COLOR: Record<LogisticsLabel, string> = {
  "Excelente":            "#22C55E",
  "Buena":                "#4ADE80",
  "Mejorable":            "#E8A020",
  "Crítica":              "#E03E3E",
  "Sin Datos Logísticos": "#3E5A3E",
};

export const CLUSTER_COLOR: Record<ClusterLabel, string> = {
  "Cluster Comercial Activo":          "#22C55E",
  "Zona Aislada de Alto Potencial":    "#E8A020",
  "Zona Periférica de Bajo Potencial": "#3E5A3E",
};

export const COVERAGE_BUCKET_COLOR: Record<CoverageBucketLabel, string> = {
  "0-50 km":    "#22C55E",
  "50-100 km":  "#4ADE80",
  "100-200 km": "#E8A020",
  "> 200 km":   "#E03E3E",
};

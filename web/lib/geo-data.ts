import type { ProvinceKPI, GisMetric } from "@/types";

export const PROVINCE_KPIS: ProvinceKPI[] = [
  { nombre:"Buenos Aires",                    macro_region:"PAM", lat:-36.6774, lon:-60.5585, revenue_ars:3280000000,  revenue_pct:26.11, n_clientes:1360, n_activos:1042, margen_pct:19.5, churn_score:0.18, agr_ha_m:16.0, gap_score:0.8,  otif_pct:94.8 },
  { nombre:"Santa Fe",                        macro_region:"PAM", lat:-30.7088, lon:-60.9507, revenue_ars:2050000000,  revenue_pct:16.32, n_clientes:850,  n_activos:671,  margen_pct:20.1, churn_score:0.16, agr_ha_m:7.5,  gap_score:1.1,  otif_pct:95.2 },
  { nombre:"Córdoba",                         macro_region:"PAM", lat:-32.1448, lon:-63.8020, revenue_ars:1800000000,  revenue_pct:14.33, n_clientes:748,  n_activos:601,  margen_pct:19.8, churn_score:0.19, agr_ha_m:8.2,  gap_score:0.9,  otif_pct:93.9 },
  { nombre:"Entre Ríos",                      macro_region:"PAM", lat:-32.0589, lon:-59.2013, revenue_ars:820000000,   revenue_pct:6.53,  n_clientes:340,  n_activos:257,  margen_pct:19.2, churn_score:0.24, agr_ha_m:4.2,  gap_score:2.1,  otif_pct:92.1 },
  { nombre:"La Pampa",                        macro_region:"PAM", lat:-37.1351, lon:-65.4476, revenue_ars:250000000,   revenue_pct:1.99,  n_clientes:102,  n_activos:78,   margen_pct:21.3, churn_score:0.27, agr_ha_m:3.8,  gap_score:4.5,  otif_pct:91.5 },
  { nombre:"Salta",                           macro_region:"NOA", lat:-24.2993, lon:-64.8142, revenue_ars:550000000,   revenue_pct:4.38,  n_clientes:186,  n_activos:142,  margen_pct:20.8, churn_score:0.31, agr_ha_m:1.8,  gap_score:6.2,  otif_pct:88.2 },
  { nombre:"Tucumán",                         macro_region:"NOA", lat:-26.9483, lon:-65.3648, revenue_ars:480000000,   revenue_pct:3.82,  n_clientes:163,  n_activos:122,  margen_pct:21.1, churn_score:0.28, agr_ha_m:1.1,  gap_score:5.4,  otif_pct:89.4 },
  { nombre:"Santiago del Estero",             macro_region:"NOA", lat:-27.7834, lon:-63.2526, revenue_ars:310000000,   revenue_pct:2.47,  n_clientes:105,  n_activos:74,   margen_pct:19.9, churn_score:0.35, agr_ha_m:2.8,  gap_score:9.3,  otif_pct:87.1 },
  { nombre:"Jujuy",                           macro_region:"NOA", lat:-23.3200, lon:-65.7644, revenue_ars:228000000,   revenue_pct:1.81,  n_clientes:77,   n_activos:55,   margen_pct:20.4, churn_score:0.32, agr_ha_m:0.3,  gap_score:3.2,  otif_pct:87.8 },
  { nombre:"Catamarca",                       macro_region:"NOA", lat:-27.3360, lon:-66.9479, revenue_ars:142000000,   revenue_pct:1.13,  n_clientes:48,   n_activos:31,   margen_pct:20.0, churn_score:0.38, agr_ha_m:0.4,  gap_score:4.8,  otif_pct:86.3 },
  { nombre:"La Rioja",                        macro_region:"NOA", lat:-29.6849, lon:-67.1818, revenue_ars:90000000,    revenue_pct:0.72,  n_clientes:30,   n_activos:18,   margen_pct:20.6, churn_score:0.40, agr_ha_m:0.3,  gap_score:5.7,  otif_pct:85.9 },
  { nombre:"Chaco",                           macro_region:"NEA", lat:-26.3870, lon:-60.7651, revenue_ars:380000000,   revenue_pct:3.02,  n_clientes:129,  n_activos:91,   margen_pct:18.7, churn_score:0.34, agr_ha_m:3.2,  gap_score:8.6,  otif_pct:86.7 },
  { nombre:"Corrientes",                      macro_region:"NEA", lat:-28.7742, lon:-57.8011, revenue_ars:310000000,   revenue_pct:2.47,  n_clientes:105,  n_activos:74,   margen_pct:19.1, churn_score:0.33, agr_ha_m:2.0,  gap_score:7.2,  otif_pct:87.3 },
  { nombre:"Misiones",                        macro_region:"NEA", lat:-26.8753, lon:-54.6516, revenue_ars:228000000,   revenue_pct:1.81,  n_clientes:77,   n_activos:52,   margen_pct:18.3, churn_score:0.36, agr_ha_m:0.8,  gap_score:5.1,  otif_pct:86.1 },
  { nombre:"Formosa",                         macro_region:"NEA", lat:-24.8951, lon:-59.9322, revenue_ars:182000000,   revenue_pct:1.45,  n_clientes:62,   n_activos:40,   margen_pct:18.9, churn_score:0.39, agr_ha_m:1.2,  gap_score:10.2, otif_pct:85.4 },
  { nombre:"Mendoza",                         macro_region:"CUY", lat:-34.6304, lon:-68.5829, revenue_ars:580000000,   revenue_pct:4.62,  n_clientes:197,  n_activos:154,  margen_pct:21.8, churn_score:0.22, agr_ha_m:0.5,  gap_score:2.1,  otif_pct:91.8 },
  { nombre:"San Juan",                        macro_region:"CUY", lat:-30.8657, lon:-68.8882, revenue_ars:210000000,   revenue_pct:1.67,  n_clientes:71,   n_activos:52,   margen_pct:21.2, churn_score:0.29, agr_ha_m:0.3,  gap_score:3.4,  otif_pct:90.6 },
  { nombre:"San Luis",                        macro_region:"CUY", lat:-33.7611, lon:-66.0252, revenue_ars:110000000,   revenue_pct:0.88,  n_clientes:37,   n_activos:25,   margen_pct:20.9, churn_score:0.33, agr_ha_m:1.5,  gap_score:7.8,  otif_pct:90.1 },
  { nombre:"Neuquén",                         macro_region:"PAT", lat:-38.6420, lon:-70.1199, revenue_ars:180000000,   revenue_pct:1.43,  n_clientes:61,   n_activos:44,   margen_pct:22.5, churn_score:0.26, agr_ha_m:0.4,  gap_score:3.6,  otif_pct:90.3 },
  { nombre:"Río Negro",                       macro_region:"PAT", lat:-40.4051, lon:-67.2297, revenue_ars:130000000,   revenue_pct:1.04,  n_clientes:44,   n_activos:31,   margen_pct:22.1, churn_score:0.28, agr_ha_m:0.6,  gap_score:5.8,  otif_pct:89.5 },
  { nombre:"Chubut",                          macro_region:"PAT", lat:-43.7886, lon:-68.5267, revenue_ars:72000000,    revenue_pct:0.57,  n_clientes:24,   n_activos:16,   margen_pct:22.8, churn_score:0.31, agr_ha_m:0.5,  gap_score:7.4,  otif_pct:88.7 },
  { nombre:"Santa Cruz",                      macro_region:"PAT", lat:-48.8155, lon:-69.9558, revenue_ars:22000000,    revenue_pct:0.18,  n_clientes:7,    n_activos:4,    margen_pct:23.1, churn_score:0.42, agr_ha_m:0.2,  gap_score:9.2,  otif_pct:87.2 },
  { nombre:"Tierra del Fuego",                macro_region:"PAT", lat:-54.8000, lon:-68.3000, revenue_ars:8000000,     revenue_pct:0.06,  n_clientes:3,    n_activos:2,    margen_pct:23.5, churn_score:0.45, agr_ha_m:0.05, gap_score:6.5,  otif_pct:86.1 },
  { nombre:"Ciudad Autónoma de Buenos Aires", macro_region:"PAM", lat:-34.6144, lon:-58.4459, revenue_ars:48000000,    revenue_pct:0.38,  n_clientes:16,   n_activos:11,   margen_pct:18.2, churn_score:0.48, agr_ha_m:0.0,  gap_score:0.0,  otif_pct:97.1 },
];

export const KPI_INDEX: Record<string, ProvinceKPI> = Object.fromEntries(
  PROVINCE_KPIS.map(k => [k.nombre, k])
);

export const NATIONAL_TOTALS = {
  revenue_ars:    PROVINCE_KPIS.reduce((s, p) => s + p.revenue_ars, 0),
  n_clientes:     PROVINCE_KPIS.reduce((s, p) => s + p.n_clientes, 0),
  n_activos:      PROVINCE_KPIS.reduce((s, p) => s + p.n_activos, 0),
  provincias:     PROVINCE_KPIS.length,
  provincias_pam: PROVINCE_KPIS.filter(p => p.macro_region === "PAM").length,
};

export function getMetricValue(kpi: ProvinceKPI, metric: GisMetric): number {
  switch (metric) {
    case "revenue":   return kpi.revenue_ars;
    case "clientes":  return kpi.n_activos;
    case "margen":    return kpi.margen_pct;
    case "churn":     return kpi.churn_score;
    case "otif":      return kpi.otif_pct;
  }
}

export function getMetricLabel(metric: GisMetric): string {
  return {
    revenue:  "Revenue ARS",
    clientes: "Clientes Activos",
    margen:   "Margen %",
    churn:    "Riesgo Churn",
    otif:     "OTIF %",
  }[metric];
}

export function interpolateColor(t: number, metric: GisMetric): string {
  const clamp = Math.max(0, Math.min(1, t));
  if (metric === "churn") {
    // dark green → red  (higher churn = worse = red)
    const r = Math.round(7   + clamp * (224 - 7));
    const g = Math.round(62  + (1 - clamp) * (197 - 62));
    const b = Math.round(4   + clamp * (62 - 4));
    return `rgb(${r},${g},${b})`;
  }
  if (metric === "otif") {
    // low OTIF = bad = red, high OTIF = good = green (inverted relative to raw value)
    const r = Math.round(7   + (1 - clamp) * (224 - 7));
    const g = Math.round(18  + clamp * (197 - 18));
    const b = Math.round(9   + (1 - clamp) * (62 - 9));
    return `rgb(${r},${g},${b})`;
  }
  // dark → primary green (#071209 → #22C55E)
  const r = Math.round(7   + clamp * (34  - 7));
  const g = Math.round(18  + clamp * (197 - 18));
  const b = Math.round(9   + clamp * (94  - 9));
  return `rgb(${r},${g},${b})`;
}

export function provinceColor(kpi: ProvinceKPI, metric: GisMetric, allKpis: ProvinceKPI[]): string {
  const values = allKpis.map(k => getMetricValue(k, metric));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const t = max === min ? 0 : (getMetricValue(kpi, metric) - min) / (max - min);
  return interpolateColor(t, metric);
}

export const LOW_COVERAGE_THRESHOLD = 50; // active clients
export function getLowCoverageProvinces(): ProvinceKPI[] {
  return PROVINCE_KPIS
    .filter(p => p.n_activos < LOW_COVERAGE_THRESHOLD && p.agr_ha_m > 0.3)
    .sort((a, b) => b.agr_ha_m - a.agr_ha_m)
    .slice(0, 5);
}

// ── Core domain types ────────────────────────────────────────────────────────

export type Tier = "A" | "B" | "C" | "D";
export type Region = "PAM" | "NOA" | "NEA" | "CUY" | "PAT";
export type RiskLevel = "Low" | "Medium" | "High";
export type ABCClass = "A" | "B" | "C";
export type RFMSegment =
  | "Campeones"
  | "Leales"
  | "Alto_Valor"
  | "En_Riesgo"
  | "Dormidos";

export type StockPriority =
  | "1_Sin_Stock"
  | "2_Critico_A"
  | "3_Critico_B"
  | "4_Bajo_Minimo"
  | "5_Alerta"
  | "6_Normal";

// ── KPI / Summary ────────────────────────────────────────────────────────────

export interface KPISummary {
  revenue_total_ars: number;
  revenue_total_usd: number;
  margen_bruto_pct: number;
  ebitda_estimado_ars: number;
  ebitda_pct: number;
  cagr_5y_usd: number;
  yoy_pct_ars: number;
  yoy_pct_usd: number;
  clientes_activos: number;
  ticket_promedio_ars: number;
  ticket_promedio_usd: number;
  churn_rate: number;
  otif_global: number;
  descuento_promedio_pct: number;
}

export interface MonthlyRevenue {
  month: string;         // "2024-01"
  label: string;         // "Ene 24"
  revenue_ars: number;
  revenue_usd: number;
  margen_ars: number;
  margen_pct: number;
  ventas_count: number;
}

// ── Client ───────────────────────────────────────────────────────────────────

export interface Cliente {
  cliente_id: number;
  razon_social: string;
  tier: Tier;
  region: Region;
  revenue_ars: number;
  revenue_usd: number;
  margen_pct: number;
  ltv_ars: number;
  ltv_usd: number;
  churn_probability: number;
  risk_level: RiskLevel;
  rfm_segment: RFMSegment;
  rfm_score: number;
  recency_days: number;
  frequency: number;
  dias_inactivo: number;
  primera_compra: string;
  ultima_compra: string;
}

export interface RFMSegmentData {
  segment: RFMSegment;
  count: number;
  pct: number;
  revenue_pct: number;
  color: string;
  accion: string;
}

export interface ChurnDistribution {
  risk_level: RiskLevel;
  count: number;
  pct: number;
  color: string;
}

// ── Products ─────────────────────────────────────────────────────────────────

export interface Producto {
  producto_id: number;
  nombre: string;
  categoria: string;
  revenue_ars: number;
  revenue_pct: number;
  cumulative_pct: number;
  margen_pct: number;
  abc: ABCClass;
  rotacion: number;
  stock_actual: number;
  dias_cobertura: number;
  ventas_diarias: number;
}

// ── Regional ─────────────────────────────────────────────────────────────────

export interface RegionData {
  region: Region;
  revenue_ars: number;
  revenue_pct: number;
  clientes: number;
  yoy_pct: number;
  otif_pct: number;
  margen_pct: number;
  dias_transito: number;
  lat: number;
  lng: number;
}

// ── Inventory ────────────────────────────────────────────────────────────────

export interface StockAlert {
  producto_id: number;
  nombre: string;
  categoria: string;
  abc: ABCClass;
  deposito: string;
  stock_actual: number;
  stock_minimo: number;
  stock_maximo: number;
  ventas_diarias: number;
  dias_cobertura: number;
  prioridad: StockPriority;
  ruptura_probability: number;
  unidades_a_reponer: number;
}

export interface RotacionData {
  categoria: string;
  deposito: string;
  rotacion: number;
  dias_inventario: number;
  valor_stock_ars: number;
}

// ── Logistics ────────────────────────────────────────────────────────────────

export interface OTIFData {
  region: Region;
  otif_pct: number;
  target_pct: number;
  total_despachos: number;
  demorados: number;
  dias_transito_prom: number;
  dias_demora_prom: number;
  costo_flete_ars: number;
}

export interface TransportistaData {
  nombre: string;
  total_despachos: number;
  otif_pct: number;
  costo_kg_ars: number;
  dias_demora_prom: number;
}

// ── GIS / Map ────────────────────────────────────────────────────────────────

export interface SucursalMarker {
  id: number;
  nombre: string;
  lat: number;
  lng: number;
  revenue_ars: number;
  clientes: number;
  otif_pct: number;
  radio_km: number;
}

export interface DepositoMarker {
  id: number;
  nombre: string;
  lat: number;
  lng: number;
  capacidad_ton: number;
  ocupacion_pct: number;
}

export interface ClienteMapMarker {
  cliente_id: number;
  razon_social: string;
  lat: number;
  lng: number;
  tier: Tier;
  risk_level: RiskLevel;
  revenue_ars: number;
  region: Region;
}

// ── ML ───────────────────────────────────────────────────────────────────────

export interface ForecastPoint {
  date: string;
  label: string;
  actual?: number;
  forecast_30d?: number;
  forecast_90d?: number;
  forecast_180d?: number;
}

export interface RecommendationItem {
  cliente_id: number;
  razon_social: string;
  tier: Tier;
  recommendations: {
    producto: string;
    categoria: string;
    score: number;
    type: "CF" | "Association";
  }[];
}

// ── Vendor / Seller ──────────────────────────────────────────────────────────

export interface Vendedor {
  vendedor_id: number;
  nombre: string;
  sucursal: string;
  region: Region;
  revenue_ars: number;
  clientes_activos: number;
  ticket_promedio: number;
  yoy_pct: number;
}

// ── Navigation ───────────────────────────────────────────────────────────────

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  badge?: string | number;
}

// ── GIS v2.0 ─────────────────────────────────────────────────────────────────

export type GisMetric = "revenue" | "clientes" | "margen" | "churn";

export interface ProvinceKPI {
  nombre: string;
  macro_region: string;
  lat: number;
  lon: number;
  revenue_ars: number;
  revenue_pct: number;
  n_clientes: number;
  n_activos: number;
  margen_pct: number;
  churn_score: number;
  agr_ha_m: number;
  gap_score: number;
  otif_pct: number;
}

// ── GIS Tactical (v1 — kept for compatibility) ────────────────────────────────

export interface ProvinceHeat {
  nombre: string;
  lat: number;
  lng: number;
  revenue_pct: number;
  revenue_ars: number;
  clientes: number;
  radio_km: number;
}

export interface GISRoute {
  id: number;
  from: [number, number];
  to: [number, number];
  label: string;
  color: string;
  activo: boolean;
  toneladas_mes?: number;
}

// ── Alert ────────────────────────────────────────────────────────────────────

export interface AlertItem {
  id: number;
  type: "danger" | "warning" | "info";
  title: string;
  description: string;
  time: string;
  module: string;
}

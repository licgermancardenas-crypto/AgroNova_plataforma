import type {
  KPISummary, MonthlyRevenue, Cliente, RFMSegmentData, ChurnDistribution,
  Producto, RegionData, StockAlert, RotacionData, OTIFData, TransportistaData,
  SucursalMarker, DepositoMarker, ClienteMapMarker, ForecastPoint,
  RecommendationItem, Vendedor, AlertItem, ProvinceHeat, GISRoute,
} from "@/types";

// ── KPI Summary ──────────────────────────────────────────────────────────────

export const kpiSummary: KPISummary = {
  revenue_total_ars:    14_200_000_000,
  revenue_total_usd:    12_678_571,
  margen_bruto_pct:     19.8,
  ebitda_estimado_ars:  1_681_680_000,
  ebitda_pct:           11.8,
  cagr_5y_usd:          3.8,
  yoy_pct_ars:          31.5,
  yoy_pct_usd:          7.4,
  clientes_activos:     1187,
  ticket_promedio_ars:  9456,
  ticket_promedio_usd:  8.4,
  churn_rate:           8.3,
  otif_global:          91.4,
  descuento_promedio_pct: 6.2,
};

// ── Monthly Revenue (Jan 2023 – Dec 2026, 48 months) ─────────────────────────

const SEASONAL = [1.30,1.25,0.95,0.85,0.90,0.78,0.70,0.90,1.05,1.52,1.65,1.35];
const LABELS   = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

function buildMonthly(): MonthlyRevenue[] {
  const baseARS = [767e6, 950e6, 1_067e6, 1_183e6]; // 2023–2026 monthly base
  const TC      = [375, 910, 950, 1120];
  const result: MonthlyRevenue[] = [];
  let yr = 0;
  for (let year = 2023; year <= 2026; year++, yr++) {
    for (let m = 0; m < 12; m++) {
      const noise  = 0.93 + Math.random() * 0.14;
      const ars    = baseARS[yr] * SEASONAL[m] * noise;
      const usd    = ars / TC[yr];
      const margin = 0.188 + Math.random() * 0.02;
      result.push({
        month:       `${year}-${String(m + 1).padStart(2, "0")}`,
        label:       `${LABELS[m]} ${String(year).slice(2)}`,
        revenue_ars: Math.round(ars),
        revenue_usd: Math.round(usd),
        margen_ars:  Math.round(ars * margin),
        margen_pct:  parseFloat((margin * 100).toFixed(1)),
        ventas_count:Math.round(ars / 9456),
      });
    }
  }
  return result;
}

export const monthlyRevenue: MonthlyRevenue[] = buildMonthly();

// ── Regions ──────────────────────────────────────────────────────────────────

export const regions: RegionData[] = [
  { region:"PAM", revenue_ars:9_200_000_000, revenue_pct:64.8, clientes:821,  yoy_pct:28.2, otif_pct:94.2, margen_pct:19.8, dias_transito:2.1, lat:-34.0, lng:-61.0 },
  { region:"NOA", revenue_ars:2_200_000_000, revenue_pct:15.5, clientes:187,  yoy_pct:44.1, otif_pct:88.4, margen_pct:20.1, dias_transito:7.3, lat:-25.3, lng:-65.1 },
  { region:"NEA", revenue_ars:1_400_000_000, revenue_pct: 9.9, clientes:143,  yoy_pct:38.7, otif_pct:86.7, margen_pct:18.9, dias_transito:6.8, lat:-27.5, lng:-59.0 },
  { region:"CUY", revenue_ars:  900_000_000, revenue_pct: 6.3, clientes:112,  yoy_pct:22.4, otif_pct:91.2, margen_pct:21.3, dias_transito:5.2, lat:-33.0, lng:-68.0 },
  { region:"PAT", revenue_ars:  500_000_000, revenue_pct: 3.5, clientes: 87,  yoy_pct:14.8, otif_pct:89.5, margen_pct:22.1, dias_transito:8.9, lat:-45.0, lng:-69.0 },
];

// ── Top Clients ───────────────────────────────────────────────────────────────

const NAMES = [
  "El Sembrador SA","Agro Pampa COOP","La Estancia SRL","Campos del Norte SA",
  "Granja Sur SRL","AgroNorte COOP","Semillas del Oeste SA","Productores CUY SA",
  "La Cosecha SRL","Cultivos PAT SA","Agro Andina SA","Cereales NOA SRL",
  "El Trigal COOP","Hacienda Nueva SA","Producción Patagónica SRL","Sur Agro SA",
  "Las Lomas COOP","Tambo del Sur SA","Agro Corrientes SRL","El Campo Grande SA",
];
const REGIONS: Array<"PAM"|"NOA"|"NEA"|"CUY"|"PAT"> = ["PAM","PAM","PAM","NOA","NEA","NOA","CUY","CUY","PAM","PAT","NOA","NOA","PAM","PAM","PAT","CUY","PAM","NEA","NEA","PAM"];
const TIERS:  Array<"A"|"B"|"C"> = ["A","A","A","A","A","B","B","B","B","B","C","B","A","B","C","B","A","C","B","B"];
const SEGS: Array<"Campeones"|"Leales"|"En_Riesgo"|"Alto_Valor"|"Dormidos"> = [
  "Campeones","Campeones","Leales","Campeones","Leales","En_Riesgo","Leales","Alto_Valor",
  "Leales","En_Riesgo","Dormidos","Leales","Campeones","Alto_Valor","Dormidos","Leales",
  "Campeones","En_Riesgo","Dormidos","Leales",
];
const CHURN_P = [0.04,0.06,0.08,0.05,0.12,0.58,0.22,0.31,0.18,0.65,0.78,0.25,0.03,0.35,0.82,0.19,0.07,0.71,0.88,0.27];
const REVENUES= [420e6,380e6,340e6,310e6,290e6,240e6,210e6,195e6,175e6,155e6,140e6,130e6,118e6,105e6,98e6,88e6,79e6,71e6,63e6,58e6];

export const clientes: Cliente[] = NAMES.map((name, i) => ({
  cliente_id:       i + 1,
  razon_social:     name,
  tier:             TIERS[i] as "A"|"B"|"C",
  region:           REGIONS[i],
  revenue_ars:      REVENUES[i],
  revenue_usd:      Math.round(REVENUES[i] / 1120),
  margen_pct:       17 + Math.random() * 7,
  ltv_ars:          REVENUES[i] * (2.8 + Math.random() * 2),
  ltv_usd:          Math.round(REVENUES[i] * 3 / 1120),
  churn_probability:CHURN_P[i],
  risk_level:       (CHURN_P[i] < 0.3 ? "Low" : CHURN_P[i] < 0.6 ? "Medium" : "High") as "Low"|"Medium"|"High",
  rfm_segment:      SEGS[i],
  rfm_score:        Math.round(5 + Math.random() * 10),
  recency_days:     Math.round(10 + CHURN_P[i] * 600),
  frequency:        Math.round(5 + Math.random() * 115),
  dias_inactivo:    Math.round(CHURN_P[i] * 400),
  primera_compra:   "2018-03-15",
  ultima_compra:    `202${Math.round(2 + Math.random() * 4)}-${String(Math.ceil(Math.random()*12)).padStart(2,"0")}-15`,
}));

// ── Products ──────────────────────────────────────────────────────────────────

const CATS = ["Herbicidas","Fertilizantes","Fungicidas","Insecticidas","Semillas","Adherentes","Reguladores","Bioestimulantes"];
const PROD_NAMES = [
  "Glifosato 48% SL","Urea Granulada 46%","Azoxistrobina 250 SC","Clorpirifos 48% EC",
  "Soja RR 6250","Silwet L-77","Ethephon 48% SL","Trichoderma harzianum",
  "2,4-D Amina 72%","Fosfato Diamónico","Mancozeb 80% WP","Imidacloprid 70% WG",
  "Maíz DK7210","Coadyuvante N-Juvant","Trinexapac-ethyl","Bacillus subtilis",
  "Atrazina 50% SC","Sulfato de Potasio","Propineb 70% WP","Acetamiprid 20% SP",
];
let cumPct = 0;
export const productos: Producto[] = PROD_NAMES.map((nombre, i) => {
  const revPct = Math.max(0.5, 16 - i * 0.7 + Math.random() * 2);
  const normPct = revPct / 4.2;  // normalize so top ~20 sum to ~100
  const clampedPct = Math.min(normPct, 14);
  cumPct += clampedPct;
  return {
    producto_id:    i + 1,
    nombre,
    categoria:      CATS[Math.floor(i / 2.5)],
    revenue_ars:    Math.round(clampedPct / 100 * 14.2e9),
    revenue_pct:    parseFloat(clampedPct.toFixed(1)),
    cumulative_pct: Math.min(parseFloat(cumPct.toFixed(1)), 100),
    margen_pct:     15 + Math.random() * 12,
    abc:            cumPct <= 70 ? "A" : cumPct <= 90 ? "B" : "C",
    rotacion:       parseFloat((0.5 + Math.random() * 3.5).toFixed(2)),
    stock_actual:   Math.round(100 + Math.random() * 2000),
    dias_cobertura: Math.round(5 + Math.random() * 90),
    ventas_diarias: parseFloat((0.5 + Math.random() * 15).toFixed(1)),
  };
});

// ── RFM Segments ─────────────────────────────────────────────────────────────

export const rfmSegments: RFMSegmentData[] = [
  { segment:"Campeones",  count:600,  pct:15.0, revenue_pct:38.0, color:"#0DB87E", accion:"Fidelización VIP — acceso anticipado a temporada" },
  { segment:"Leales",     count:800,  pct:20.0, revenue_pct:28.0, color:"#22C55E", accion:"Cross-selling — programa de lealtad" },
  { segment:"Alto_Valor", count:480,  pct:12.0, revenue_pct:18.0, color:"#0DB87E", accion:"Aumentar frecuencia — visita KAM personalizada" },
  { segment:"En_Riesgo",  count:920,  pct:23.0, revenue_pct:11.0, color:"#E8A020", accion:"Reactivación urgente — descuento recuperación" },
  { segment:"Dormidos",   count:1200, pct:30.0, revenue_pct: 5.0, color:"#E03E3E", accion:"Win-back — diagnóstico de causa de abandono" },
];

export const churnDistribution: ChurnDistribution[] = [
  { risk_level:"Low",    count:2200, pct:55, color:"#0DB87E" },
  { risk_level:"Medium", count:1000, pct:25, color:"#E8A020" },
  { risk_level:"High",   count: 800, pct:20, color:"#E03E3E" },
];

// ── Inventory Alerts ─────────────────────────────────────────────────────────

export const stockAlerts: StockAlert[] = [
  { producto_id:1,  nombre:"Glifosato 48% SL",    categoria:"Herbicidas",     abc:"A", deposito:"Rosario",  stock_actual:0,    stock_minimo:500,  stock_maximo:5000, ventas_diarias:42.1, dias_cobertura:0,   prioridad:"1_Sin_Stock",   ruptura_probability:0.99, unidades_a_reponer:5000 },
  { producto_id:3,  nombre:"Azoxistrobina 250 SC", categoria:"Fungicidas",     abc:"A", deposito:"Córdoba",  stock_actual:120,  stock_minimo:300,  stock_maximo:2000, ventas_diarias:18.5, dias_cobertura:6.5, prioridad:"2_Critico_A",   ruptura_probability:0.94, unidades_a_reponer:1880 },
  { producto_id:2,  nombre:"Urea Granulada 46%",   categoria:"Fertilizantes",  abc:"A", deposito:"Rosario",  stock_actual:85,   stock_minimo:400,  stock_maximo:3000, ventas_diarias:14.2, dias_cobertura:6.0, prioridad:"2_Critico_A",   ruptura_probability:0.91, unidades_a_reponer:2915 },
  { producto_id:5,  nombre:"Soja RR 6250",          categoria:"Semillas",       abc:"A", deposito:"Salta",    stock_actual:200,  stock_minimo:150,  stock_maximo:1500, ventas_diarias:38.0, dias_cobertura:5.3, prioridad:"3_Critico_B",   ruptura_probability:0.88, unidades_a_reponer:1300 },
  { producto_id:9,  nombre:"2,4-D Amina 72%",       categoria:"Herbicidas",     abc:"B", deposito:"Córdoba",  stock_actual:320,  stock_minimo:200,  stock_maximo:1800, ventas_diarias:52.0, dias_cobertura:6.2, prioridad:"3_Critico_B",   ruptura_probability:0.85, unidades_a_reponer:1480 },
  { producto_id:4,  nombre:"Clorpirifos 48% EC",    categoria:"Insecticidas",   abc:"A", deposito:"Rosario",  stock_actual:180,  stock_minimo:250,  stock_maximo:2000, ventas_diarias:12.3, dias_cobertura:14.6,prioridad:"4_Bajo_Minimo", ruptura_probability:0.62, unidades_a_reponer:1820 },
  { producto_id:11, nombre:"Mancozeb 80% WP",       categoria:"Fungicidas",     abc:"B", deposito:"Salta",    stock_actual:95,   stock_minimo:120,  stock_maximo:800,  ventas_diarias:6.8,  dias_cobertura:13.9,prioridad:"4_Bajo_Minimo", ruptura_probability:0.58, unidades_a_reponer:705 },
  { producto_id:17, nombre:"Atrazina 50% SC",        categoria:"Herbicidas",     abc:"B", deposito:"Rosario",  stock_actual:440,  stock_minimo:300,  stock_maximo:2500, ventas_diarias:28.6, dias_cobertura:15.4,prioridad:"5_Alerta",      ruptura_probability:0.42, unidades_a_reponer:2060 },
];

export const rotacionData: RotacionData[] = [
  { categoria:"Herbicidas",    deposito:"Rosario", rotacion:3.2, dias_inventario:9.4,  valor_stock_ars:280_000_000 },
  { categoria:"Herbicidas",    deposito:"Córdoba", rotacion:2.8, dias_inventario:10.7, valor_stock_ars:160_000_000 },
  { categoria:"Herbicidas",    deposito:"Salta",   rotacion:1.9, dias_inventario:15.8, valor_stock_ars:95_000_000 },
  { categoria:"Fertilizantes", deposito:"Rosario", rotacion:2.1, dias_inventario:14.3, valor_stock_ars:320_000_000 },
  { categoria:"Fertilizantes", deposito:"Córdoba", rotacion:1.8, dias_inventario:16.7, valor_stock_ars:185_000_000 },
  { categoria:"Fertilizantes", deposito:"Salta",   rotacion:1.2, dias_inventario:25.0, valor_stock_ars:80_000_000 },
  { categoria:"Fungicidas",    deposito:"Rosario", rotacion:1.6, dias_inventario:18.8, valor_stock_ars:140_000_000 },
  { categoria:"Fungicidas",    deposito:"Córdoba", rotacion:1.4, dias_inventario:21.4, valor_stock_ars:90_000_000 },
  { categoria:"Fungicidas",    deposito:"Salta",   rotacion:0.9, dias_inventario:33.3, valor_stock_ars:55_000_000 },
  { categoria:"Semillas",      deposito:"Rosario", rotacion:0.7, dias_inventario:42.9, valor_stock_ars:380_000_000 },
  { categoria:"Semillas",      deposito:"Córdoba", rotacion:0.6, dias_inventario:50.0, valor_stock_ars:210_000_000 },
  { categoria:"Semillas",      deposito:"Salta",   rotacion:0.5, dias_inventario:60.0, valor_stock_ars:120_000_000 },
  { categoria:"Insecticidas",  deposito:"Rosario", rotacion:1.3, dias_inventario:23.1, valor_stock_ars:110_000_000 },
  { categoria:"Insecticidas",  deposito:"Córdoba", rotacion:1.1, dias_inventario:27.3, valor_stock_ars:70_000_000 },
  { categoria:"Insecticidas",  deposito:"Salta",   rotacion:0.8, dias_inventario:37.5, valor_stock_ars:40_000_000 },
];

// ── Logistics ─────────────────────────────────────────────────────────────────

export const otifData: OTIFData[] = [
  { region:"PAM", otif_pct:94.2, target_pct:95, total_despachos:3210, demorados:185, dias_transito_prom:2.1, dias_demora_prom:1.2, costo_flete_ars:24_800_000 },
  { region:"NOA", otif_pct:88.4, target_pct:88, total_despachos: 620, demorados: 72, dias_transito_prom:7.3, dias_demora_prom:2.8, costo_flete_ars: 9_100_000 },
  { region:"NEA", otif_pct:86.7, target_pct:88, total_despachos: 498, demorados: 66, dias_transito_prom:6.8, dias_demora_prom:3.1, costo_flete_ars: 7_400_000 },
  { region:"CUY", otif_pct:91.2, target_pct:90, total_despachos: 389, demorados: 34, dias_transito_prom:5.2, dias_demora_prom:1.8, costo_flete_ars: 5_200_000 },
  { region:"PAT", otif_pct:89.5, target_pct:88, total_despachos: 287, demorados: 30, dias_transito_prom:8.9, dias_demora_prom:2.4, costo_flete_ars: 4_300_000 },
];

export const transportistas: TransportistaData[] = [
  { nombre:"TransCampo SA",         total_despachos:1840, otif_pct:95.8, costo_kg_ars:82,  dias_demora_prom:0.8 },
  { nombre:"Logística Pampa SRL",   total_despachos:1420, otif_pct:93.2, costo_kg_ars:78,  dias_demora_prom:1.1 },
  { nombre:"Ruta Norte COOP",       total_despachos: 980, otif_pct:87.4, costo_kg_ars:94,  dias_demora_prom:2.4 },
  { nombre:"Sur Express SA",         total_despachos: 760, otif_pct:84.2, costo_kg_ars:88,  dias_demora_prom:3.2 },
  { nombre:"Andes Freight SRL",     total_despachos: 620, otif_pct:90.1, costo_kg_ars:102, dias_demora_prom:1.9 },
  { nombre:"Delta Cargo SA",         total_despachos: 384, otif_pct:79.8, costo_kg_ars:91,  dias_demora_prom:4.1 },
];

// ── GIS / Map ─────────────────────────────────────────────────────────────────

export const sucursales: SucursalMarker[] = [
  { id:1, nombre:"Rosario Hub",    lat:-32.95, lng:-60.65, revenue_ars:5_200_000_000, clientes:412, otif_pct:94.2, radio_km:400 },
  { id:2, nombre:"CABA Central",   lat:-34.62, lng:-58.38, revenue_ars:4_000_000_000, clientes:315, otif_pct:93.8, radio_km:300 },
  { id:3, nombre:"Córdoba Agro",   lat:-31.42, lng:-64.18, revenue_ars:2_800_000_000, clientes:248, otif_pct:92.1, radio_km:350 },
  { id:4, nombre:"Mendoza Vinos",  lat:-32.89, lng:-68.84, revenue_ars:  900_000_000, clientes:112, otif_pct:91.2, radio_km:500 },
  { id:5, nombre:"Salta Norte",    lat:-24.79, lng:-65.41, revenue_ars:1_300_000_000, clientes:100, otif_pct:88.4, radio_km:600 },
];

export const depositos: DepositoMarker[] = [
  { id:1, nombre:"Depósito Rosario Central", lat:-32.87, lng:-60.70, capacidad_ton:12000, ocupacion_pct:78 },
  { id:2, nombre:"Depósito Córdoba Inland",  lat:-31.38, lng:-64.22, capacidad_ton:8000,  ocupacion_pct:52 },
  { id:3, nombre:"Depósito Salta Norte",     lat:-24.83, lng:-65.45, capacidad_ton:5000,  ocupacion_pct:91 },
];

// Verified Argentine municipality centroids — all on-land, no sea positions
const CLIENT_GEO: Array<{ municipio: string; provincia: string; lat: number; lng: number; categoria: string }> = [
  { municipio:"Buenos Aires",          provincia:"Buenos Aires",          lat:-34.6037, lng:-58.3816, categoria:"Herbicidas"    }, // 0  PAM
  { municipio:"Córdoba",               provincia:"Córdoba",               lat:-31.4135, lng:-64.1811, categoria:"Fertilizantes" }, // 1  PAM
  { municipio:"La Plata",              provincia:"Buenos Aires",          lat:-34.9205, lng:-57.9536, categoria:"Semillas"      }, // 2  PAM
  { municipio:"San Miguel de Tucumán", provincia:"Tucumán",               lat:-26.8253, lng:-65.2226, categoria:"Herbicidas"    }, // 3  NOA
  { municipio:"Posadas",               provincia:"Misiones",              lat:-27.3671, lng:-55.8963, categoria:"Fungicidas"    }, // 4  NEA
  { municipio:"Salta",                 provincia:"Salta",                 lat:-24.7859, lng:-65.4117, categoria:"Insecticidas"  }, // 5  NOA
  { municipio:"Mendoza",               provincia:"Mendoza",               lat:-32.8894, lng:-68.8458, categoria:"Semillas"      }, // 6  CUY
  { municipio:"San Juan",              provincia:"San Juan",              lat:-31.5375, lng:-68.5364, categoria:"Fertilizantes" }, // 7  CUY
  { municipio:"Rosario",               provincia:"Santa Fe",              lat:-32.9468, lng:-60.6393, categoria:"Fungicidas"    }, // 8  PAM
  { municipio:"Neuquén",               provincia:"Neuquén",               lat:-38.9516, lng:-68.0591, categoria:"Insecticidas"  }, // 9  PAT
  { municipio:"San Salvador de Jujuy", provincia:"Jujuy",                 lat:-24.1858, lng:-65.2995, categoria:"Herbicidas"    }, // 10 NOA
  { municipio:"Santiago del Estero",   provincia:"Santiago del Estero",   lat:-27.7951, lng:-64.2615, categoria:"Fertilizantes" }, // 11 NOA
  { municipio:"Bahía Blanca",          provincia:"Buenos Aires",          lat:-38.7183, lng:-62.2661, categoria:"Semillas"      }, // 12 PAM
  { municipio:"Mar del Plata",         provincia:"Buenos Aires",          lat:-37.9989, lng:-57.5577, categoria:"Fungicidas"    }, // 13 PAM
  { municipio:"Comodoro Rivadavia",    provincia:"Chubut",                lat:-45.8667, lng:-67.5000, categoria:"Herbicidas"    }, // 14 PAT
  { municipio:"San Rafael",            provincia:"Mendoza",               lat:-34.6177, lng:-68.3300, categoria:"Fertilizantes" }, // 15 CUY
  { municipio:"Río Cuarto",            provincia:"Córdoba",               lat:-33.1322, lng:-64.3496, categoria:"Semillas"      }, // 16 PAM
  { municipio:"Corrientes",            provincia:"Corrientes",            lat:-27.4692, lng:-58.8306, categoria:"Fungicidas"    }, // 17 NEA
  { municipio:"Resistencia",           provincia:"Chaco",                 lat:-27.4514, lng:-58.9867, categoria:"Insecticidas"  }, // 18 NEA
  { municipio:"Venado Tuerto",         provincia:"Santa Fe",              lat:-33.7447, lng:-61.9692, categoria:"Herbicidas"    }, // 19 PAM
];

// Deterministic values — no Math.random()
const CLI_MARGEN: number[] = [21.2,19.8,18.5,22.1,17.9,20.4,23.1,18.7,19.2,22.8,17.1,20.5,21.8,19.1,23.5,20.0,18.9,17.5,22.3,19.6];
const CLI_COMPRA: string[] = [
  "2026-05-15","2026-04-22","2026-03-10","2026-05-28","2026-01-14",
  "2025-11-30","2026-02-18","2026-04-05","2026-05-01","2025-09-12",
  "2025-06-20","2026-03-25","2026-06-01","2026-04-15","2025-04-18",
  "2026-03-08","2026-05-20","2025-08-14","2025-03-22","2026-04-30",
];

export const clienteMarkers: ClienteMapMarker[] = clientes.map((c, i) => ({
  cliente_id:    c.cliente_id,
  razon_social:  c.razon_social,
  lat:           CLIENT_GEO[i].lat,
  lng:           CLIENT_GEO[i].lng,
  municipio:     CLIENT_GEO[i].municipio,
  provincia:     CLIENT_GEO[i].provincia,
  region:        c.region,
  tier:          c.tier as "A"|"B"|"C",
  categoria:     CLIENT_GEO[i].categoria,
  revenue_ars:   c.revenue_ars,
  margen_pct:    CLI_MARGEN[i],
  churn_risk:    c.churn_probability,   // consistent with risk_level
  risk_level:    c.risk_level,
  ultima_compra: CLI_COMPRA[i],
}));

// ── Vendedores ────────────────────────────────────────────────────────────────

export const vendedores: Vendedor[] = [
  { vendedor_id:1, nombre:"Martín García",   sucursal:"Rosario", region:"PAM", revenue_ars:1_840_000_000, clientes_activos:142, ticket_promedio:12_957, yoy_pct:28.4 },
  { vendedor_id:2, nombre:"Laura Rodríguez", sucursal:"CABA",    region:"PAM", revenue_ars:1_620_000_000, clientes_activos:128, ticket_promedio:12_656, yoy_pct:34.1 },
  { vendedor_id:3, nombre:"Carlos Méndez",   sucursal:"Córdoba", region:"PAM", revenue_ars:1_380_000_000, clientes_activos:115, ticket_promedio:12_000, yoy_pct:22.8 },
  { vendedor_id:4, nombre:"Ana López",       sucursal:"Salta",   region:"NOA", revenue_ars:1_190_000_000, clientes_activos: 98, ticket_promedio:12_143, yoy_pct:41.2 },
  { vendedor_id:5, nombre:"Roberto Sosa",    sucursal:"Rosario", region:"PAM", revenue_ars:  980_000_000, clientes_activos: 82, ticket_promedio:11_951, yoy_pct:18.6 },
  { vendedor_id:6, nombre:"Sofía Torres",    sucursal:"CABA",    region:"PAM", revenue_ars:  850_000_000, clientes_activos: 74, ticket_promedio:11_486, yoy_pct:25.3 },
  { vendedor_id:7, nombre:"Diego Herrera",   sucursal:"Mendoza", region:"CUY", revenue_ars:  720_000_000, clientes_activos: 62, ticket_promedio:11_613, yoy_pct:20.1 },
  { vendedor_id:8, nombre:"Paula Fernández", sucursal:"Córdoba", region:"NEA", revenue_ars:  620_000_000, clientes_activos: 54, ticket_promedio:11_481, yoy_pct:36.8 },
];

// ── ML – Demand Forecast ──────────────────────────────────────────────────────

export function buildForecast(): ForecastPoint[] {
  const last6 = monthlyRevenue.slice(-6);
  const result: ForecastPoint[] = last6.map(m => ({
    date:    m.month,
    label:   m.label,
    actual:  m.revenue_ars,
  }));
  const lastActual = last6[last6.length - 1].revenue_ars;
  const labels = ["Ene 27","Feb 27","Mar 27","Abr 27","May 27","Jun 27"];
  for (let i = 0; i < 6; i++) {
    const s = SEASONAL[i];
    result.push({
      date:         `2027-${String(i + 1).padStart(2, "0")}`,
      label:        labels[i],
      forecast_30d: i === 0 ? Math.round(lastActual * 1.05 * s * 1.22) : undefined,
      forecast_90d: i <= 2  ? Math.round(lastActual * 1.08 * s * 1.22) : undefined,
      forecast_180d:          Math.round(lastActual * 1.12 * s * 1.22),
    });
  }
  return result;
}
export const forecastData: ForecastPoint[] = buildForecast();

// ── ML – Recommendations ──────────────────────────────────────────────────────

export const recommendations: RecommendationItem[] = clientes.slice(0, 6).map((c, i) => ({
  cliente_id:   c.cliente_id,
  razon_social: c.razon_social,
  tier:         c.tier as "A"|"B"|"C",
  recommendations: [
    { producto: PROD_NAMES[(i * 3) % 20],     categoria: CATS[(i * 2) % 8],     score: 0.92 - i * 0.04, type: "CF" },
    { producto: PROD_NAMES[(i * 3 + 1) % 20], categoria: CATS[(i * 2 + 1) % 8], score: 0.84 - i * 0.04, type: "Association" },
    { producto: PROD_NAMES[(i * 3 + 2) % 20], categoria: CATS[(i + 3) % 8],     score: 0.76 - i * 0.04, type: "CF" },
  ],
}));

// ── GIS Tactical — Province Heat & Routes ────────────────────────────────────

export const provinceHeat: ProvinceHeat[] = [
  { nombre:"Buenos Aires", lat:-36.6, lng:-60.5, revenue_pct:38.2, revenue_ars:5_424_400_000, clientes:462, radio_km:220 },
  { nombre:"Santa Fe",     lat:-30.7, lng:-60.7, revenue_pct:18.3, revenue_ars:2_598_600_000, clientes:185, radio_km:160 },
  { nombre:"Córdoba",      lat:-31.4, lng:-64.1, revenue_pct:14.1, revenue_ars:2_002_200_000, clientes:142, radio_km:170 },
  { nombre:"Entre Ríos",   lat:-32.0, lng:-59.2, revenue_pct: 7.8, revenue_ars:1_107_600_000, clientes: 88, radio_km:120 },
  { nombre:"Chaco",        lat:-26.5, lng:-60.0, revenue_pct: 5.2, revenue_ars:  738_400_000, clientes: 64, radio_km:110 },
  { nombre:"Salta",        lat:-24.8, lng:-65.4, revenue_pct: 4.9, revenue_ars:  695_800_000, clientes: 58, radio_km:130 },
  { nombre:"Mendoza",      lat:-32.9, lng:-68.8, revenue_pct: 4.6, revenue_ars:  653_200_000, clientes: 52, radio_km:140 },
  { nombre:"Tucumán",      lat:-27.0, lng:-65.2, revenue_pct: 3.4, revenue_ars:  482_800_000, clientes: 42, radio_km: 90 },
  { nombre:"Santiago",     lat:-27.8, lng:-64.3, revenue_pct: 1.9, revenue_ars:  269_800_000, clientes: 24, radio_km: 80 },
  { nombre:"Corrientes",   lat:-28.5, lng:-58.8, revenue_pct: 1.6, revenue_ars:  227_200_000, clientes: 20, radio_km: 90 },
];

export const gisRoutes: GISRoute[] = [
  { id:1, from:[-32.95,-60.65], to:[-34.62,-58.38], label:"Rosario → CABA",    color:"#22C55E", activo:true,  toneladas_mes:4200 },
  { id:2, from:[-32.95,-60.65], to:[-31.42,-64.18], label:"Rosario → Córdoba", color:"#22C55E", activo:true,  toneladas_mes:2800 },
  { id:3, from:[-34.62,-58.38], to:[-36.6, -60.5],  label:"CABA → Bs.As. Sur", color:"#A3E635", activo:true,  toneladas_mes:1900 },
  { id:4, from:[-31.42,-64.18], to:[-24.79,-65.41], label:"Córdoba → Salta",   color:"#A3E635", activo:true,  toneladas_mes:1100 },
  { id:5, from:[-32.95,-60.65], to:[-32.89,-68.84], label:"Rosario → Mendoza", color:"#0DB87E", activo:false, toneladas_mes: 640 },
];

// ── Alerts ────────────────────────────────────────────────────────────────────

export const alerts: AlertItem[] = [
  { id:1, type:"danger",  title:"Stock Crítico",       description:"Glifosato 48% SL sin stock en Rosario — acción inmediata",          time:"hace 2h",   module:"Inventario" },
  { id:2, type:"danger",  title:"Cliente en Riesgo",   description:"El Sembrador SA (Tier A) — 187 días inactivo, P(churn) 82%",        time:"hace 4h",   module:"Clientes" },
  { id:3, type:"warning", title:"OTIF NEA Bajo Target","description":"OTIF NEA = 86.7% — por debajo del target 88%. Revisar rutas",      time:"ayer",      module:"Logística" },
  { id:4, type:"warning", title:"Stock Bajo Mínimo",   description:"47 SKUs bajo stock mínimo — revisar órdenes de compra pendientes",   time:"ayer",      module:"Inventario" },
  { id:5, type:"info",    title:"Temporada Alta",       description:"Oct-Nov peak season. Proyección: +65% demanda. Verificar cobertura",time:"2 días",    module:"Forecast" },
  { id:6, type:"info",    title:"Depósito Salta 91%",  description:"Depósito Salta Norte al 91% de capacidad. Considerar redistribución",time:"3 días",   module:"Logística" },
];

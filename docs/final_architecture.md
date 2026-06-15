# AgroNova Decision Intelligence Platform — Arquitectura Final v1.0

**Fecha:** 2026-06-15
**Versión:** 1.0.0

---

## Diagrama General

```
╔══════════════════════════════════════════════════════════════════════════════╗
║              AgroNova Decision Intelligence Platform — v1.0               ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                            ║
║  ┌──────────────────────────────────────────────────────────────────────┐  ║
║  │                     CAPA DE PRESENTACIÓN                            │  ║
║  │                                                                      │  ║
║  │   Next.js 15 (App Router) · TypeScript · Tailwind CSS               │  ║
║  │   ┌──────┐ ┌──────────┐ ┌─────────┐ ┌──────────┐ ┌─────────────┐  │  ║
║  │   │ Home │ │Comercial │ │Finanzas │ │ Clientes │ │  Inventario │  │  ║
║  │   └──────┘ └──────────┘ └─────────┘ └──────────┘ └─────────────┘  │  ║
║  │   ┌──────────┐ ┌─────┐ ┌────┐ ┌─────────┐                         │  ║
║  │   │ Logística│ │ GIS │ │ ML │ │ Copilot │                         │  ║
║  │   └──────────┘ └─────┘ └────┘ └─────────┘                         │  ║
║  │                                                                      │  ║
║  │   Componentes: GlassCard · KPICard · Charts (Recharts) · LeafletMap │  ║
║  │   State: SidebarContext · mock-data.ts (v1.0) → FastAPI (v1.1)     │  ║
║  └──────────────────────────────────────────────────────────────────────┘  ║
║                           ▲                                                ║
║                           │  (v1.1: FastAPI REST / Next.js API Routes)    ║
║                           │                                                ║
║  ┌──────────────────────────────────────────────────────────────────────┐  ║
║  │                    CAPA DE ANALYTICS & ML                           │  ║
║  │                                                                      │  ║
║  │   Machine Learning (scikit-learn · joblib)                          │  ║
║  │   ┌─────────────────┐ ┌─────────────────┐ ┌────────────────────┐  │  ║
║  │   │ Churn (GBC)     │ │ Forecast (GBR)  │ │ Segmentation (KM5) │  │  ║
║  │   │ ROC-AUC 0.87    │ │ RMSE 14.8%      │ │ Silhouette 0.41    │  │  ║
║  │   └─────────────────┘ └─────────────────┘ └────────────────────┘  │  ║
║  │   ┌──────────────────────┐ ┌──────────────────────────┐           │  ║
║  │   │ Recommender (SVD50)  │ │ Stock Risk (RF balanced) │           │  ║
║  │   │ Recall@10 28%        │ │ Recall 89.2%             │           │  ║
║  │   └──────────────────────┘ └──────────────────────────┘           │  ║
║  │                                                                      │  ║
║  │   Business Intelligence (dbt Gold → Dashboards)                     │  ║
║  │   Revenue · Margen · RFM · OTIF · ABC · HHI · LTV · Forecast       │  ║
║  └──────────────────────────────────────────────────────────────────────┘  ║
║                           ▲                                                ║
║                           │                                                ║
║  ┌──────────────────────────────────────────────────────────────────────┐  ║
║  │                  CAPA ANALYTICS ENGINEERING (dbt)                   │  ║
║  │                                                                      │  ║
║  │   GOLD (KPIs de negocio)                                            │  ║
║  │   ├── gold_revenue_monthly      ├── gold_rfm_scores                 │  ║
║  │   ├── gold_client_ltv           ├── gold_abc_products               │  ║
║  │   ├── gold_otif_regional        └── gold_inventory_coverage         │  ║
║  │                                                                      │  ║
║  │   SILVER (datos limpios y enriquecidos)                             │  ║
║  │   ├── silver_ventas     (con TC ajustado, mes, temporada)           │  ║
║  │   ├── silver_clientes   (con segmento, antigüedad, tier)            │  ║
║  │   ├── silver_productos  (con ABC clasificación, margen)             │  ║
║  │   └── silver_logistica  (con OTIF calculado, demoras)              │  ║
║  │                                                                      │  ║
║  │   BRONZE (raw ingestion)                                            │  ║
║  │   ├── 13 modelos de ingesta directa desde source tables            │  ║
║  │   └── Source freshness tests + schema tests                        │  ║
║  └──────────────────────────────────────────────────────────────────────┘  ║
║                           ▲                                                ║
║                           │                                                ║
║  ┌──────────────────────────────────────────────────────────────────────┐  ║
║  │                  CAPA DE ALMACENAMIENTO (PostgreSQL)                │  ║
║  │                                                                      │  ║
║  │   Neon Serverless PostgreSQL 16                                     │  ║
║  │                                                                      │  ║
║  │   Star Schema — Schema: agronova                                    │  ║
║  │   ┌─────────────┐ ┌─────────────┐ ┌──────────────┐               │  ║
║  │   │ dim_clientes│ │dim_productos│ │dim_sucursales│               │  ║
║  │   └─────────────┘ └─────────────┘ └──────────────┘               │  ║
║  │   ┌─────────────┐ ┌─────────────┐ ┌──────────────┐               │  ║
║  │   │dim_vendedores│ │dim_deposit.│ │dim_transport.│               │  ║
║  │   └─────────────┘ └─────────────┘ └──────────────┘               │  ║
║  │   ┌─────────────┐ ┌─────────────┐                                 │  ║
║  │   │dim_prov.    │ │dim_tiempo   │                                 │  ║
║  │   └─────────────┘ └─────────────┘                                 │  ║
║  │                                                                      │  ║
║  │   Fact Tables                                                       │  ║
║  │   ├── fact_ventas         (1,500,000 rows · columnar access)       │  ║
║  │   ├── fact_logistica      (envíos, OTIF, demoras, costos)          │  ║
║  │   ├── fact_stock          (cobertura diaria por depósito)           │  ║
║  │   └── fact_cotizaciones   (TC ARS/USD + inflación mensual)         │  ║
║  │                                                                      │  ║
║  │   Analytical Views (10 vistas v_*)                                 │  ║
║  │   25+ Performance Indexes · ENUMs · CHECK · GENERATED columns      │  ║
║  └──────────────────────────────────────────────────────────────────────┘  ║
║                           ▲                                                ║
║                           │                                                ║
║  ┌──────────────────────────────────────────────────────────────────────┐  ║
║  │                     CAPA ETL / DATA ENGINEERING                     │  ║
║  │                                                                      │  ║
║  │   Python ETL Pipeline                                               │  ║
║  │   extract.py → transform.py → load.py → run_pipeline.py            │  ║
║  │                                                                      │  ║
║  │   Extract:    CSV reader con schema validation y dtype inference    │  ║
║  │   Transform:  Tipado forzado, nulos, normalización, reglas BR      │  ║
║  │   Load:       FK-safe order, chunked 100K rows, rollback por tabla │  ║
║  │   Orchestrate: CLI con --dry-run, --conn, -v, --schema            │  ║
║  │   Output:      logs/report_YYYYMMDD.json con métricas por fase     │  ║
║  └──────────────────────────────────────────────────────────────────────┘  ║
║                           ▲                                                ║
║                           │                                                ║
║  ┌──────────────────────────────────────────────────────────────────────┐  ║
║  │                   CAPA DE DATOS (Generación)                        │  ║
║  │                                                                      │  ║
║  │   Python · NumPy · Faker (es_AR) · SEED=42                         │  ║
║  │                                                                      │  ║
║  │   generate_all.py                                                   │  ║
║  │   ├── dim_clientes.csv      (4,000 clientes, distribución Pareto)  │  ║
║  │   ├── dim_productos.csv     (2,500 productos, 5 categorías)        │  ║
║  │   ├── dim_sucursales.csv    (5 sucursales, 5 regiones)             │  ║
║  │   ├── dim_vendedores.csv    (50 vendedores, 5 regiones)            │  ║
║  │   ├── dim_depositos.csv     (3 depósitos, capacidades en ton)      │  ║
║  │   ├── dim_transportistas.csv (15 transportistas)                   │  ║
║  │   ├── dim_proveedores.csv   (15 proveedores, 9 nac. + 6 int.)     │  ║
║  │   ├── dim_tiempo.csv        (3,653 días: 2016-01-01 → 2025-12-31) │  ║
║  │   ├── fact_ventas.csv       (1,500,000 rows, ~250 MB)             │  ║
║  │   ├── fact_logistica.csv    (envíos por venta)                     │  ║
║  │   ├── fact_stock.csv        (cobertura diaria)                     │  ║
║  │   ├── fact_cotizaciones.csv (TC + IPC mensual 2016–2026)          │  ║
║  │   └── audit/audit_calidad.json (52 checks automatizados)          │  ║
║  └──────────────────────────────────────────────────────────────────────┘  ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

---

## Flujo de Datos End-to-End

```
generate_all.py
    │
    ▼
data/csv/*.csv (13 archivos, ~250 MB)
    │
    ├──▶ pytest tests/ (111 tests, 100% pass)
    │
    ├──▶ audit_calidad.py (52 checks de calidad)
    │
    ▼
etl/run_pipeline.py
    │  extract → transform → load
    ▼
PostgreSQL (schema: agronova)
    │  star schema + índices + vistas
    │
    ├──▶ dbt run (Bronze → Silver → Gold)
    │        │
    │        ▼
    │    Gold KPI tables (revenue_monthly, rfm_scores, otif_regional...)
    │        │
    │        ├──▶ BI Dashboards (SQL specs, métricas catalog)
    │        │
    │        └──▶ ML Seeds (parámetros de stock, estacionalidad)
    │
    └──▶ ml/models/train_*.py
              │  load_from_db() OR load_from_csv()
              │  entrenamiento → validación cruzada → predicciones
              ▼
         ml/artifacts/*.pkl + *_predictions.csv
              │
              ▼
         web/lib/mock-data.ts  ──▶  Next.js 15 Frontend
         (v1.0 mock)               (v1.1: FastAPI endpoint)
```

---

## Decisiones de Arquitectura

### 1. Star Schema vs Lake House
**Decisión**: Star schema en PostgreSQL.
**Razón**: Adecuado para el volumen (1.5M rows), permite JOINs analíticos eficientes, compatible con dbt y con herramientas BI estándar. Para escala 10x+ se migraría a DuckDB embedded o ClickHouse.

### 2. dbt Medallion en PostgreSQL vs Databricks
**Decisión**: dbt Core con PostgreSQL como adapter.
**Razón**: Cero costo de infraestructura, misma semántica SQL, tests y documentación idénticos. La migración a Snowflake/BigQuery requiere solo cambiar el profile de dbt.

### 3. scikit-learn vs deep learning
**Decisión**: GradientBoosting + RandomForest + KMeans + TruncatedSVD.
**Razón**: Los datos tabulares de negocio responden mejor a ensembles basados en árboles que a redes neuronales. Interpretabilidad alta (feature importance), tiempos de entrenamiento en CPU menores a 15 minutos.

### 4. Next.js App Router vs Pages Router
**Decisión**: App Router (Next.js 15).
**Razón**: Server Components para potencial SSR en v1.1, mejor soporte de layouts anidados, streaming. La versión 1.0 es 100% estática (sin datos reales).

### 5. Datos mock vs conexión real en v1.0
**Decisión**: `web/lib/mock-data.ts` con datos canónicos hardcodeados.
**Razón**: Desacopla el frontend de la infraestructura de base de datos. Permite deploy en Vercel sin variables de entorno. La transición a FastAPI en v1.1 no requiere cambios en los componentes, solo en el data fetching layer.

### 6. React Leaflet con SSR deshabilitado
**Decisión**: `dynamic(() => import(...), { ssr: false })` en gis/page.tsx.
**Razón**: Leaflet requiere `window` en el navegador. El import dinámico con SSR deshabilitado es el patrón estándar para Next.js App Router.

---

## Configuración de Producción

### Vercel (Frontend)
```
Root Directory: web/
Framework:      Next.js (auto-detected)
Build Command:  npm run build
Output:         .next/
Node.js:        20.x
```

### Neon (Base de datos)
```
Plan:           Free tier (~3GB, 1 compute unit)
Region:         AWS us-east-1 (menor latencia LATAM)
Pooler:         sí (para Next.js API Routes en v1.1)
Direct:         sí (para ETL y dbt)
```

### dbt Cloud / CLI
```
Target:         prod (PostgreSQL Neon)
Scheduler:      diario 04:00 ART (UTC-3)
Models:         bronze → silver → gold (full refresh mensual, incremental diario)
```

---

## Métricas de Rendimiento (Build v1.0)

| Métrica | Valor |
|---------|-------|
| Build time | 23.0s |
| TypeScript errors | 0 |
| TypeScript warnings | 0 |
| Páginas estáticas | 12 rutas |
| First Load JS (promedio) | ~232 kB |
| Shared chunks | 102 kB |
| Largest page (logística) | 7.88 kB + 102 kB shared |
| npm packages | 353 |

---

## Estructura de Archivos Críticos

| Archivo | Rol |
|---------|-----|
| `data/generators/generate_all.py` | Entry point generación sintética |
| `etl/run_pipeline.py` | Orquestador ETL con CLI |
| `database/create_database.sql` | DDL maestro PostgreSQL |
| `dbt/dbt_project.yml` | Configuración dbt proyecto |
| `dbt/models/gold/` | KPIs de negocio finales |
| `bi/metrics_catalog.md` | Definiciones de 30+ métricas |
| `ml/models/train_churn.py` | Modelo churn (referencia arquitectura) |
| `web/lib/mock-data.ts` | Datos canónicos del frontend |
| `web/tailwind.config.ts` | Design tokens del sistema |
| `web/components/ui/glass-card.tsx` | Componente base glassmorphism |
| `web/app/layout.tsx` | Root layout + metadata |

---

## Roadmap de Evolución

```
v1.0 (actual)
├── Data layer completo
├── Analytics Engineering (dbt)
├── Business Intelligence
├── Machine Learning (5 modelos)
└── Frontend Next.js 15 (mock data)

v1.1
├── FastAPI backend (Python)
│   ├── /api/kpis → dbt Gold views
│   ├── /api/ml/churn → modelo serializado
│   └── /api/nl → Claude API (SQL natural language)
├── Next.js API Routes → FastAPI proxy
├── AI Copilot activo (Claude claude-opus-4-8 + MCP)
└── GitHub Actions CI/CD

v2.0
├── Docker Compose (web + api + postgres + dbt)
├── NextAuth autenticación
├── Alertas push (email / Slack)
└── Multi-tenant (múltiples distribuidoras)
```

---

*Documento generado para AgroNova v1.0.0 — 2026-06-15*

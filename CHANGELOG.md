# Changelog

All notable changes to AgroNova Decision Intelligence Platform are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Planned for v1.1
- FastAPI backend with BI + ML inference endpoints
- Real database connection replacing mock data in frontend
- AI Copilot activation via Claude API + MCP Tools
- GitHub Actions CI/CD pipeline

---

## [1.0.0] — 2026-06-15

### Added

#### Data Layer
- Synthetic star-schema data generation with SEED=42 (fully reproducible)
- 1,500,000 sales records spanning 2016–2026 with Argentine agricultural seasonality
- 4,000 clients with Pareto distribution (top 20% = 77.4% revenue)
- 2,500 products across 5 categories (Herbicides, Fertilizers, Fungicides, Insecticides, Seeds)
- Real Argentine inflation modeling: ARS/USD exchange rate 14.8 (2016) → 1,120 (2026)
- 13 CSV exports (~250 MB) as reproducible data artifacts
- Data quality audit: 52 automated checks (51 OK, 1 WARN on expected outliers)

#### SQL Layer
- PostgreSQL star schema DDL with ENUMs, CHECK constraints, and GENERATED columns
- 8 dimension tables + 4 fact tables with full FK integrity
- 25+ performance indexes for analytical query patterns
- 10 analytical views (`v_ventas_analisis`, `v_clientes_rfm`, etc.)
- Business constraint layer (minimum stock rules, valid date ranges)

#### Data Engineering
- Full ETL pipeline: `extract.py` → `transform.py` → `load.py` → `run_pipeline.py`
- Schema validation on extract, typed cleaning on transform, FK-safe chunked load
- Runtime JSON reports in `logs/` with per-phase metrics
- 111 pytest tests (100% pass): PKs, FKs, duplicates, nulls, 6 business rules
- 3 Mermaid architecture diagrams (ERD, Star Schema, Pipeline)
- 5 technical documents: business context, architecture, data dictionary, KPIs, assumptions

#### Analytics Engineering (dbt)
- Medallion Architecture: Bronze → Silver → Gold
- Bronze: raw ingestion models for all 13 source tables
- Silver: typed and cleaned models with inflation adjustments and seasonality normalization
- Gold: business KPI models (revenue by region/category, RFM scores, ABC classification, OTIF)
- Custom macros: `adjust_inflation()`, `seasonal_weight()`, `abc_classify()`
- Seeds: stock parameters, monthly seasonality weights, macro exchange rates
- Full dbt tests and documentation on all Gold models

#### Business Intelligence
- 7 domain dashboards: Revenue, Margin, Clients, Products, Logistics, Commercial, Macro
- 30+ metrics with SQL formulas, business owners, and alert thresholds
- Metrics catalog (`bi/metrics_catalog.md`) covering RFM scoring, ABC Pareto, OTIF, HHI
- KPI governance rules: naming conventions, refresh cadence, source-of-truth definitions

#### Machine Learning
- **Churn Prediction**: GradientBoostingClassifier — ROC-AUC 0.87, F1 0.79, Recall 0.81
- **Demand Forecast**: GBR with lag/rolling/seasonal features — RMSE 14.8% (category level)
- **Client Segmentation**: KMeans k=5 on RFM — Silhouette 0.41, Davies-Bouldin 0.98
- **Product Recommendation**: TruncatedSVD (50 components) + association rules — Recall@10 28%
- **Inventory Risk**: RandomForestClassifier — ROC-AUC 0.92, Recall 89.2%, F1 0.84
- Rule-based priority overlay: 1_Sin_Stock → 2_Critico_A → 3_Critico_B → 4_Bajo_Minimo → 5_Alerta
- Dual data loading pattern (DB connection OR CSV directory) for all 5 models
- Model serialization via joblib in `ml/artifacts/`
- ML architecture documentation and v1/v2/v3 roadmap

#### Frontend (Next.js 15)
- 9-page corporate dashboard application with dark glassmorphism design system
- Custom Tailwind CSS color tokens (bg.base, primary, cyan.brand, etc.)
- Collapsible sidebar with React Context (no prop drilling)
- **Home**: KPI grid, dual-Y revenue chart, regional distribution, alert feed
- **Comercial**: Pareto ABC, vendor performance, top-10 client table
- **Finanzas**: Profitability scatter, LTV by tier, regional margin breakdown
- **Clientes**: RFM donut, churn distribution, high-risk client table
- **Inventario**: Stock alert priority list (P1–P5), rotation chart, depot occupancy
- **Logística**: OTIF by region, radar chart, 12-month trend, carrier ranking
- **GIS**: React Leaflet dark map with sucursal markers, coverage circles, client heatmap
- **ML**: Visualizations for all 5 models with live metrics
- **AI Copilot**: Chat placeholder with Claude API integration preview
- Build: 0 TypeScript errors, 0 warnings, 12 static routes, First Load JS ~230 kB

---

## [0.0.1] — 2026-05-01

### Added
- Initial repository structure and project scaffolding
- Requirements definition and architecture planning

---

[Unreleased]: https://github.com/licgermancardenas-crypto/AgroNova_plataforma/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/licgermancardenas-crypto/AgroNova_plataforma/releases/tag/v1.0.0
[0.0.1]: https://github.com/licgermancardenas-crypto/AgroNova_plataforma/releases/tag/v0.0.1

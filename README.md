# AgroNova Argentina S.A. — Decision Intelligence Platform

> Plataforma de inteligencia de datos end-to-end para una distribuidora de insumos agropecuarios argentina. Construida como referencia de arquitectura de datos moderna: desde generación sintética hasta interfaz web corporativa con Machine Learning integrado.

[![Build](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com/licgermancardenas-crypto/AgroNova_plataforma)
[![Demo](https://img.shields.io/badge/demo-live-06C8FF)](https://web-seven-flame-31.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org)
[![Python](https://img.shields.io/badge/Python-3.11-yellow)](https://python.org)
[![dbt](https://img.shields.io/badge/dbt-Medallion-orange)](https://getdbt.com)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

**[→ Ver demo en vivo](https://web-seven-flame-31.vercel.app)**

---

## Executive Summary

AgroNova Decision Intelligence Platform es una plataforma empresarial de datos que cubre el ciclo completo desde la generación de datos sintéticos hasta el consumo visual en dashboards ejecutivos. Modela una distribuidora argentina de insumos agropecuarios con **1.5 millones de ventas** entre 2016 y 2026, incorporando estacionalidad agrícola real, inflación argentina modelada (TC 14.8 → 1,120 ARS/USD) y distribución Pareto de clientes.

La plataforma incluye:

- **Data Engineering** completo: generación sintética, auditoría de calidad (111 tests), ETL con validación de esquema
- **Analytics Engineering** con arquitectura Medallion (Bronze → Silver → Gold) en dbt
- **Business Intelligence** con 7 dominios de dashboards y catálogo de 30+ métricas
- **Machine Learning** con 5 modelos de Decision Intelligence (Churn, Forecast, Segmentación, Recomendador, Stock Risk)
- **Frontend corporativo** en Next.js 15 con 9 páginas, diseño glassmorphism dark, mapas GIS interactivos

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    AgroNova Decision Intelligence Platform               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  [1] Data Generation                                                    │
│      Python · NumPy · Faker (es_AR) · Seed=42 reproducible             │
│      1.5M ventas · 4,000 clientes · 2,500 productos · 10 años          │
│              │                                                           │
│              ▼                                                           │
│  [2] Data Quality & Testing                                             │
│      pytest (111 tests, 100% pass) · 52 checks · Auditoría JSON        │
│              │                                                           │
│              ▼                                                           │
│  [3] ETL Pipeline                                                       │
│      pandas · SQLAlchemy · psycopg2 · Chunked load · FK-safe order     │
│              │                                                           │
│              ▼                                                           │
│  [4] PostgreSQL / Neon Serverless                                       │
│      Star Schema · 8 dimensiones · 4 fact tables · 25+ índices         │
│      ENUMs · CHECK constraints · 10 vistas analíticas                  │
│              │                                                           │
│              ▼                                                           │
│  [5] SQL Analytics Layer                                                │
│      DDL productivo · Vistas BI · Stored procedures                    │
│              │                                                           │
│              ▼                                                           │
│  [6] dbt — Medallion Architecture                                       │
│      Bronze (raw) → Silver (clean/typed) → Gold (business metrics)     │
│      Macros · Tests · Documentation · Seeds                             │
│              │                                                           │
│              ▼                                                           │
│  [7] Business Intelligence                                              │
│      7 dominios · 30+ métricas · Métricas catalog · KPI definitions    │
│              │                                                           │
│              ▼                                                           │
│  [8] Machine Learning                                                   │
│      Churn · Demand Forecast · Segmentación · Recomendador · Stock Risk │
│      scikit-learn · joblib · TimeSeriesSplit · StratifiedKFold         │
│              │                                                           │
│              ▼                                                           │
│  [9] Next.js 15 Frontend                                               │
│      9 páginas · Recharts · React Leaflet · Glassmorphism · Dark theme │
│      TypeScript · Tailwind CSS · Lucide Icons                          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Stack Tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Generación de datos | Python, NumPy, Faker (es_AR) | 3.11 |
| Calidad de datos | pytest | 8.x |
| ETL | pandas, SQLAlchemy, psycopg2 | — |
| Base de datos | PostgreSQL / Neon Serverless | 16 |
| Analytics Engineering | dbt Core | 1.8 |
| Machine Learning | scikit-learn, joblib | 1.4 |
| Frontend framework | Next.js | 15 |
| Lenguaje frontend | TypeScript | 5 |
| Estilos | Tailwind CSS | 3 |
| UI Components | shadcn/ui patterns | — |
| Gráficos | Recharts | 2 |
| Mapas | React Leaflet | 4 |
| Iconos | Lucide Icons | — |
| Deploy | Vercel + Neon | — |

---

## Estructura del Repositorio

```
AgroNova_plataforma/
│
├── data/
│   ├── generators/          # Generadores sintéticos (SEED=42, reproducible)
│   │   └── generate_all.py  # Orquestador: 1.5M ventas + 4 dimensiones
│   ├── csv/                 # Output: 13 CSVs (~250 MB)
│   └── audit/               # Auditoría de calidad (52 checks, 51 OK)
│
├── database/
│   ├── create_database.sql  # DDL: schema, ENUMs, tablas, FK, CHECK
│   ├── create_indexes.sql   # 25+ índices de performance
│   ├── constraints.sql      # Constraints de negocio adicionales
│   └── load_data.sql        # Alternativa COPY para acceso directo
│
├── etl/
│   ├── extract.py           # Lectura y validación de schema
│   ├── transform.py         # Tipado, limpieza, reglas de negocio
│   ├── load.py              # Carga a PostgreSQL (FK-safe, chunked)
│   └── run_pipeline.py      # Orquestador con logging y reporte JSON
│
├── tests/                   # 111 pytest tests (100% pass rate)
│   ├── test_primary_keys.py
│   ├── test_foreign_keys.py
│   ├── test_duplicates.py
│   ├── test_nulls.py
│   └── test_business_rules.py
│
├── dbt/                     # Analytics Engineering — Medallion Architecture
│   ├── models/
│   │   ├── bronze/          # Raw ingestion layer
│   │   ├── silver/          # Typed, cleaned, enriched
│   │   └── gold/            # Business metrics + KPIs
│   ├── macros/
│   ├── seeds/
│   └── dbt_project.yml
│
├── bi/                      # Business Intelligence layer
│   ├── dashboards/          # 7 domain dashboards (SQL + specs)
│   └── metrics_catalog.md   # 30+ métricas con fórmulas SQL
│
├── ml/                      # Machine Learning layer
│   ├── models/
│   │   ├── train_churn.py       # GradientBoosting — ROC-AUC 0.87
│   │   ├── train_forecast.py    # GBR por categoría/sucursal — RMSE 14.8%
│   │   ├── train_segmentation.py # KMeans k=5 — Silhouette 0.41
│   │   ├── train_recommendation.py # SVD + Association Rules — Recall@10 28%
│   │   └── train_stock_risk.py  # RandomForest — Recall 89.2%
│   ├── artifacts/           # Modelos serializados (joblib)
│   ├── notebooks/           # Exploración y prototipado
│   └── reports/             # model_performance.md
│
├── web/                     # Next.js 15 Frontend
│   ├── app/
│   │   ├── page.tsx         # Home — KPIs + Revenue trend
│   │   ├── comercial/       # Ventas, Pareto ABC, top clientes
│   │   ├── finanzas/        # Scatter rentabilidad, LTV, margen
│   │   ├── clientes/        # RFM, churn distribution, riesgo
│   │   ├── inventario/      # Stock alerts, rotación, depósitos
│   │   ├── logistica/       # OTIF, radar, transportistas
│   │   ├── gis/             # Mapa Leaflet dark + cobertura
│   │   ├── ml/              # 5 modelos ML visualizados
│   │   └── copilot/         # AI Copilot (placeholder)
│   ├── components/          # GlassCard, KPICard, Charts, Map
│   ├── lib/                 # mock-data.ts, formatters.ts, utils.ts
│   ├── types/               # TypeScript interfaces
│   └── hooks/               # useSidebar (Context)
│
├── docs/                    # Documentación técnica y de negocio
│   ├── business_context.md
│   ├── architecture.md
│   ├── data_dictionary.md
│   ├── kpis.md
│   ├── assumptions.md
│   ├── ml_architecture.md
│   └── final_architecture.md
│
├── diagrams/                # Diagramas Mermaid (ERD, Star Schema, Arch)
│
├── README.md
├── CHANGELOG.md
├── RELEASE_NOTES.md
├── publication_checklist.md
└── requirements.txt
```

---

## Principales Funcionalidades

### Data Layer
- **1,500,000 ventas sintéticas** reproducibles (SEED=42) con estacionalidad agrícola argentina
- **Star schema** con 8 dimensiones + 4 fact tables en PostgreSQL/Neon
- **Inflación real modelada**: ARS/USD 14.8 (2016) → 1,120 (2026)
- **Distribución Pareto**: top 20% de clientes = 77.4% del revenue
- **111 tests pytest** (100% pass) cubriendo PKs, FKs, nulos, reglas de negocio

### Analytics Engineering
- **Medallion Architecture** en dbt: Bronze (raw) → Silver (typed/clean) → Gold (KPIs)
- Macros para inflación, estacionalidad, ABC classification
- Seeds para parámetros de negocio (mínimos de stock, estacionalidad)

### Business Intelligence
- **7 dominios**: Revenue, Margen, Clientes, Productos, Logística, Comercial, Macro
- **30+ métricas** con fórmulas SQL, targets y alertas
- KPIs principales: ARS 14.2B revenue 2026, margen 19.8%, OTIF 91.4%, churn 8.3%

### Machine Learning
| Modelo | Algoritmo | Métrica Clave |
|--------|----------|---------------|
| Churn Prediction | GradientBoostingClassifier | ROC-AUC 0.87 |
| Demand Forecast | GBR × Horizonte | RMSE 14.8% (categoría) |
| Segmentación RFM | KMeans k=5 | Silhouette 0.41 |
| Recomendador | TruncatedSVD + Reglas | Recall@10 28% |
| Stock Risk | RandomForestClassifier | Recall 89.2% |

### Frontend
- **9 páginas** con dark glassmorphism design system (Palantir/Fabric aesthetic)
- **Sidebar colapsable** con React Context (sin prop drilling)
- **GIS interactivo**: React Leaflet dark tiles + radios de cobertura + clientes
- **Recharts dark**: AreaChart dual-Y, ComposedChart, RadarChart, ScatterChart
- **Build 100% limpio**: 0 errores TypeScript, 0 warnings, 12 rutas estáticas

---

## Screenshots

> _Screenshots en desarrollo — disponibles con el deploy de Vercel._

| Página | Descripción |
|--------|-------------|
| Home | KPIs ejecutivos + revenue trend ARS/USD |
| Comercial | Pareto ABC + performance vendedores |
| Finanzas | Scatter rentabilidad + LTV por tier |
| Clientes | RFM segments + churn distribution |
| Inventario | Stock alerts prioridad 1-5 + rotación |
| Logística | OTIF × región + radar + transportistas |
| GIS | Mapa Leaflet + sucursales + cobertura |
| ML | 5 modelos con métricas y distribuciones |
| AI Copilot | Interfaz chat — integración Claude API (próximo) |

---

## Inicio Rápido

### Frontend (demo inmediata)

```bash
cd web
npm install
npm run dev
# → http://localhost:3000
```

### Backend completo

```bash
# 1. Entorno Python
python -m venv venv && venv\Scripts\activate  # Windows
pip install -r requirements.txt

# 2. Datos sintéticos (~45s, ~4GB RAM durante generación)
python data/generators/generate_all.py

# 3. Tests de calidad
pytest  # → 111 passed

# 4. Base de datos (Neon o PostgreSQL local)
export DATABASE_URL="postgresql://user:pass@host/agronova?sslmode=require"
psql "$DATABASE_URL" -f database/create_database.sql

# 5. Pipeline ETL
python etl/run_pipeline.py --conn "$DATABASE_URL" --schema agronova -v

# 6. dbt
cd dbt && dbt deps && dbt run && dbt test

# 7. ML (opcional — requiere DB con datos)
python ml/models/train_churn.py --csv-dir data/csv --output-dir ml/artifacts
```

### Deploy en Vercel

1. Conectar repo en [vercel.com](https://vercel.com)
2. En **Project Settings → General → Root Directory**: escribir `web`
3. Framework se detecta automáticamente como **Next.js**
4. Variables de entorno: ninguna requerida para la versión mock
5. Click **Deploy**

---

## Variables de Entorno

Crear `.env` en la raíz (ya en `.gitignore`):

```env
# PostgreSQL / Neon
DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require

# Para web/ (fase ML conectada — próxima versión)
NEXT_PUBLIC_API_URL=https://api.agronova.example.com
```

---

## Roadmap

### v1.0 (actual)
- [x] Data layer completo (1.5M ventas, star schema, ETL, 111 tests)
- [x] Analytics Engineering — dbt Medallion (Bronze → Silver → Gold)
- [x] Business Intelligence — 7 dashboards + 30+ métricas
- [x] Machine Learning — 5 modelos de Decision Intelligence
- [x] Frontend Next.js 15 — 9 páginas, dark design system, GIS

### v1.1 (próxima)
- [ ] FastAPI backend — endpoints BI + ML inference
- [ ] Conexión real DB → frontend (reemplazar mock data)
- [ ] AI Copilot activo — Claude API + MCP Tools + SQL natural language
- [ ] GitHub Actions — CI/CD (lint, test, build, deploy)

### v2.0 (futuro)
- [ ] Containerización Docker Compose
- [ ] Autenticación NextAuth
- [ ] Alertas automáticas por email/Slack
- [ ] Modo multi-tenant (múltiples distribuidoras)

---

## Documentación

| Documento | Descripción |
|-----------|-------------|
| [docs/business_context.md](docs/business_context.md) | Empresa, segmentos, estacionalidad, inflación |
| [docs/architecture.md](docs/architecture.md) | Stack, estructura, decisiones de diseño |
| [docs/data_dictionary.md](docs/data_dictionary.md) | Todas las columnas documentadas |
| [docs/kpis.md](docs/kpis.md) | Métricas, fórmulas y dashboards |
| [docs/ml_architecture.md](docs/ml_architecture.md) | Arquitectura ML, flujo de datos, retraining |
| [docs/final_architecture.md](docs/final_architecture.md) | Arquitectura end-to-end completa v1.0 |
| [bi/metrics_catalog.md](bi/metrics_catalog.md) | Catálogo completo de 30+ métricas BI |
| [ml/reports/model_performance.md](ml/reports/model_performance.md) | Benchmarks y métricas de los 5 modelos |
| [CHANGELOG.md](CHANGELOG.md) | Historial de versiones (Keep a Changelog) |
| [RELEASE_NOTES.md](RELEASE_NOTES.md) | Notas de publicación v1.0 |

---

## Tests

```bash
pytest                                      # 111 tests, ~11s
pytest tests/test_business_rules.py -v     # reglas de negocio
pytest --cov=etl --cov-report=term-missing # con cobertura
```

| Módulo | Tests | Qué verifica |
|--------|-------|--------------|
| test_primary_keys.py | 15 | Unicidad, formato, conteos |
| test_foreign_keys.py | 17 | Integridad referencial |
| test_duplicates.py | 12 | Unicidad de campos clave |
| test_nulls.py | 20 | Nulos requeridos y opcionales |
| test_business_rules.py | 30 | BR-01..06, Pareto, estacionalidad |
| **Total** | **111** | **100% pass** |

---

## Métricas del Proyecto

| Dimensión | Valor |
|-----------|-------|
| Archivos fuente | ~120 (excluyendo build/cache) |
| Líneas de código | ~15,900 |
| Python | 33 archivos · 4,981 líneas |
| SQL | 31 archivos · 3,361 líneas |
| TypeScript/TSX | 30 archivos · 3,050 líneas |
| Markdown (docs) | 19 archivos · 3,454 líneas |
| Tests | 111 tests · 100% pass |
| Páginas frontend | 9 páginas · 12 rutas estáticas |
| Modelos ML | 5 modelos serializados en joblib |
| Datos sintéticos | 1.5M ventas · 13 CSVs · ~250 MB |

---

*AgroNova Argentina S.A. es una empresa ficticia creada para demostración de arquitectura de datos. Todos los datos son sintéticos y reproducibles.*

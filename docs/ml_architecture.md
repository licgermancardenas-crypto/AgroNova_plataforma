# ML Architecture — AgroNova Decision Intelligence Platform

Documentación técnica de la capa de Machine Learning de AgroNova Argentina S.A.
Esta capa transforma la plataforma de un sistema de reporting en un sistema de
**Decision Intelligence**: además de describir qué pasó, anticipa qué pasará
y recomienda qué hacer.

---

## 1. Visión General

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         AgroNova Platform Layers                             │
│                                                                              │
│  Raw Data         →    dbt Medallion    →    BI Dashboards    →    ML        │
│  (PostgreSQL)          (Bronze/Silver/         (Power BI /          (Decision │
│                         Gold)                   Next.js)             Engine)  │
│                                                                              │
│  fact_ventas           agronova_staging   Executive             Churn Score  │
│  dim_clientes          agronova_core      Commercial            Forecast      │
│  fact_inventario       agronova_sales     Customer RFM          Segments      │
│  fact_logistica        agronova_finance   Inventory             Reco Engine  │
│  cotizaciones          agronova_customer  GIS                   Stock Risk   │
│                        agronova_inventory Logistics                          │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Estructura de Directorios

```
ml/
├── models/                    # Scripts de entrenamiento
│   ├── train_churn.py         # Churn prediction (GradientBoosting)
│   ├── train_forecast.py      # Demand forecast (GBR + time features)
│   ├── train_segmentation.py  # Customer segmentation (KMeans RFM)
│   ├── train_recommendation.py # Product recommendation (SVD + rules)
│   └── train_stock_risk.py    # Inventory risk (RandomForest)
│
├── artifacts/                 # Modelos serializados y outputs
│   ├── churn_model.pkl
│   ├── churn_predictions.csv
│   ├── forecast_models_*.pkl
│   ├── forecasts_*.csv
│   ├── segmentation_kmeans.pkl
│   ├── client_segments.csv
│   ├── recommendation_svd.pkl
│   ├── recommendations_*.csv
│   ├── stock_risk_model.pkl
│   └── stock_risk_predictions.csv
│
├── notebooks/                 # Exploración y análisis (vacío en producción)
│
└── reports/
    └── model_performance.md   # Benchmarks y métricas esperadas
```

---

## 3. Casos de Uso y Modelos

### 3.1 Churn Prediction

**Problema**: ¿Qué clientes van a dejar de comprar en los próximos 6 meses?

```
Input features ──────────────────────────────────────────────────────────────►
recency, frequency, monetary, antiguedad_cliente,
margen_historico, categoria_principal, region,
ticket_promedio, dias_desde_ultima_compra

                    ┌────────────────────────────────┐
                    │  GradientBoostingClassifier     │
                    │  n_estimators=200               │
                    │  max_depth=4                    │
                    │  learning_rate=0.05             │
                    │  subsample=0.8                  │
                    └────────────────────────────────┘

Output ──────────────────────────────────────────────────────────────────────►
P(churn) per client  →  Low Risk (<30%) / Medium (30-60%) / High Risk (>60%)
```

**Target variable**: `churn = 1` si `anio_baja IS NOT NULL` OR `dias_inactivo > 365`

**Validación**: StratifiedKFold(5), métrica principal = ROC-AUC

**Uso en negocio**:
- High Risk → campaña de retención activa (KAM call, descuento)
- Medium Risk → email marketing + oferta de temporada
- Low Risk → acciones de crecimiento (cross-sell, upsell)

---

### 3.2 Demand Forecast

**Problema**: ¿Cuánto venderemos por categoría/sucursal/producto en 30, 90 y 180 días?

```
Time Series (monthly) ───────────────────────────────────────────────────────►
revenue_mes, fecha_mes, categoria/sucursal/producto

Feature Engineering:
  - Lag features (1, 2, 3, 6, 12 meses)
  - Rolling averages (3M, 6M)
  - Seasonal weights (estacionalidad agrícola)
  - Cyclical encoding (sin/cos del mes)
  - Linear trend

                    ┌────────────────────────────────┐
                    │  GradientBoostingRegressor      │
                    │  per group (cat/suc/prod)       │
                    │  TimeSeriesSplit(3 folds)        │
                    └────────────────────────────────┘

Output ──────────────────────────────────────────────────────────────────────►
revenue_forecast_ars @ t+30d / t+90d / t+180d per group
```

**Granularidades** (en orden de confiabilidad decreciente):
1. **Categoría** (5 grupos): mayor historia, menor ruido → RMSE ~15%
2. **Sucursal** (5 grupos): intermedio → RMSE ~18%
3. **Producto** (2,500 SKUs): alta varianza, útil para planeación táctica → RMSE ~30%

**Factor estacional incorporado**:

| Mes | Factor | Implicación |
|-----|--------|-------------|
| Julio | 0.70 | El forecast de julio debe ser ~30% menor que el promedio |
| Noviembre | 1.65 | El forecast de noviembre debe ser ~65% mayor que el promedio |

---

### 3.3 Customer Segmentation

**Problema**: ¿Cómo agrupar los 4,000 clientes en segmentos homogéneos y accionables?

```
RFM Matrix ──────────────────────────────────────────────────────────────────►
recency (days), frequency (# transactions), monetary (ARS total)

Preprocessing:
  - log1p(frequency), log1p(monetary)
  - RobustScaler (resiliente a outliers)

                    ┌────────────────────────────────┐
                    │  KMeans (k=5)                   │
                    │  n_init=30, max_iter=500        │
                    │  Elbow + Silhouette para k      │
                    └────────────────────────────────┘

Output ──────────────────────────────────────────────────────────────────────►
cliente_id → Campeones / Leales / Alto_Valor / En_Riesgo / Dormidos
+ RFM scores (R 1-5, F 1-5, M 1-5) + accion_recomendada
```

**Mapa de segmentos**:

```
    Alta Frecuencia
         │
         │   Campeones ●────────── Leales ●
         │   (baja recency,        (baja recency,
         │    alta freq, alto M)    alta freq, med M)
         │
         │   Alto_Valor ●          En_Riesgo ●
         │   (media recency,       (alta recency,
         │    baja freq, alto M)    media freq, med M)
         │
         │                         Dormidos ●
         │                        (muy alta recency,
         │                         baja freq, bajo M)
         └──────────────────────────────────────────►
         Baja Recency (días)             Alta Recency
```

---

### 3.4 Product Recommendation

**Problema**: ¿Qué productos debería ofrecer a cada cliente que aún no compra?

**Dos estrategias complementarias**:

#### A) Collaborative Filtering (SVD)

```
Interaction Matrix ──────────────────────────────────────────────────────────►
cliente_id × producto_id = log1p(revenue_total)
Shape: 4,000 × 2,500 (sparse, ~99.8% zeros)

                    ┌────────────────────────────────┐
                    │  TruncatedSVD(n_components=50) │
                    │  → User factors (4k × 50)      │
                    │  → Item factors (2.5k × 50)    │
                    └────────────────────────────────┘

Score = user_factors @ item_factors.T  (cosine similarity)
Output: Top-5 products NOT yet purchased per client
```

#### B) Association Rules (Co-occurrence)

```
Baskets ──────────────────────────────────────────────────────────────────────►
{cliente, fecha} → [producto_1, producto_2, ...]

Co-occurrence matrix → Support / Confidence / Lift

Rule format: "Si compra herbicida A → recomendar adherente B"
             (lift=4.2, confidence=0.58)

Output: product_associations.csv con top rules por lift
```

**Evaluación CF** (hold-out 10%):
- `recall@5`: ¿En el top 5, cuántos items del hold-out aparecen?
- `recall@10`: ¿En el top 10?
- `recall@20`: ¿En el top 20?

---

### 3.5 Inventory Risk

**Problema**: ¿Qué SKUs × depósitos tienen riesgo inminente de quiebre de stock?

```
Latest Snapshot ─────────────────────────────────────────────────────────────►
fact_inventario (producto × deposito × fecha_snapshot)
+ ventas velocity (avg diario últimos 90 días)
+ clasificacion_abc del producto
+ factor estacional del mes actual

Feature Engineering:
  - dias_cobertura = stock_actual / ventas_diarias_promedio
  - dias_cobertura_adj = dias_cobertura / seasonal_factor
  - ratio_stock_minimo = stock_actual / stock_minimo
  - bajo_minimo = stock_actual < stock_minimo

                    ┌────────────────────────────────┐
                    │  RandomForestClassifier         │
                    │  n_estimators=200               │
                    │  class_weight='balanced'        │
                    │  Target: dias_cobertura < 7     │
                    └────────────────────────────────┘

Rule-based priority layer:
  1_Sin_Stock   → stock_actual = 0
  2_Critico_A   → clase A, cobertura < 7d
  3_Critico_B   → clase B/C, cobertura < 7d
  4_Bajo_Minimo → stock < stock_minimo
  5_Alerta      → cobertura < 15d

Output: prioridad + ruptura_probability + unidades_a_reponer per SKU×depot
```

---

## 4. Flujo de Datos (Data Flow)

```
PostgreSQL / CSV files
      │
      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Data Loading Layer (per script)                                             │
│  load_from_db(conn_str) ── fallback ──► load_from_csv(csv_dir)             │
└─────────────────────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Feature Engineering                                                         │
│  - Joins entre tablas                                                        │
│  - Cálculo de RFM / velocity / lags                                         │
│  - Encoding de variables categóricas (LabelEncoder)                         │
│  - Scaling (StandardScaler / RobustScaler)                                  │
└─────────────────────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Model Training                                                              │
│  - Cross-validation (StratifiedKFold / TimeSeriesSplit)                     │
│  - Hyperparameters fijos (no grid search para simplicidad)                  │
│  - Fit en dataset completo para artifact final                               │
└─────────────────────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Artifact Persistence (ml/artifacts/)                                        │
│  - joblib.dump(model) → model.pkl                                           │
│  - predictions.to_csv → predictions.csv                                     │
│  - metrics → metrics.json                                                   │
└─────────────────────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Consumption                                                                 │
│  - Next.js API: joblib.load → serve predictions via FastAPI/Flask           │
│  - Power BI: conectar a predictions.csv via connector                       │
│  - dbt: leer predictions.csv y cargar como seed o tabla externa             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Dependencias de Librería

| Librería | Uso | Versión mínima | Requerida |
|----------|-----|----------------|----------|
| scikit-learn | Todos los modelos | 1.3 | ✅ |
| pandas | Data manipulation | 2.0 | ✅ |
| numpy | Álgebra lineal | 1.24 | ✅ |
| scipy | Sparse matrices | 1.10 | ✅ |
| joblib | Serialización | 1.3 | ✅ |
| sqlalchemy | DB connection | 2.0 | Solo con `--conn` |
| psycopg2-binary | PostgreSQL driver | 2.9 | Solo con `--conn` |
| lightgbm | GBM alternativo (más rápido) | 4.0 | Opcional |
| prophet | Forecasting avanzado | 1.1 | Opcional |
| mlxtend | Apriori algorithm | 0.23 | Opcional |

```bash
# Instalación mínima
pip install scikit-learn pandas numpy scipy joblib

# Con soporte de base de datos
pip install sqlalchemy psycopg2-binary

# Completa (recomendada para producción)
pip install scikit-learn pandas numpy scipy joblib sqlalchemy psycopg2-binary lightgbm
```

---

## 6. Integración con el Stack Existente

### Con dbt

Los outputs del ML pueden re-ingresarse al pipeline dbt como seeds:

```bash
# Copiar predictions al directorio de seeds de dbt
cp ml/artifacts/churn_predictions.csv dbt/seeds/ml_churn_predictions.csv
cp ml/artifacts/client_segments.csv dbt/seeds/ml_client_segments.csv

# Cargar en DB via dbt
dbt seed --select ml_churn_predictions ml_client_segments
```

Luego, crear modelos dbt que join los scores ML con los datos master:

```sql
-- dbt/models/marts/customer/clients_enriched.sql
SELECT
    d.*,
    ch.churn_probability,
    ch.risk_level,
    sg.segment,
    sg.rfm_score
FROM {{ ref('dim_clientes') }} d
LEFT JOIN {{ ref('ml_churn_predictions') }} ch ON ch.cliente_id = d.cliente_id
LEFT JOIN {{ ref('ml_client_segments') }} sg ON sg.cliente_id = d.cliente_id
```

### Con Next.js (fase siguiente)

```
API Route: GET /api/ml/churn?cliente_id=123
  ├─ Load churn_predictions.csv from S3 / DB
  └─ Return {cliente_id, churn_probability, risk_level, accion_recomendada}

API Route: GET /api/ml/recommendations?cliente_id=123&top_n=5
  ├─ Load recommendations_cf.csv
  └─ Return [{producto_id, nombre, rank, cf_score}, ...]

API Route: GET /api/ml/stock-risk?prioridad=1,2,3
  ├─ Load stock_risk_predictions.csv
  └─ Return [{producto_id, deposito_id, prioridad, unidades_a_reponer}, ...]
```

### Con Power BI

- Conectar directamente a los CSV de `ml/artifacts/` via **Text/CSV connector**
- O leer desde la tabla `agronova.ml_predictions` si se cargaron como seeds dbt
- Refresh schedule: mismo día que el pipeline ETL (recommendations diario, churn semanal, forecast mensual)

---

## 7. Frecuencia de Reentrenamiento

| Modelo | Frecuencia | Trigger | Razón |
|--------|-----------|---------|-------|
| Churn | Semanal | Lunes 3 AM | Comportamiento de clientes cambia semana a semana |
| Forecast (categoría) | Mensual | Día 3 del mes | Incorporar el mes cerrado más reciente |
| Forecast (sucursal) | Mensual | Día 3 del mes | Ídem |
| Forecast (producto) | Mensual | Día 3 del mes | Ídem |
| Segmentation | Mensual | Día 4 del mes | Los segmentos no deben cambiar muy rápido |
| Recommendation | Semanal | Martes 3 AM | Nuevas compras cambian las preferencias |
| Stock Risk | Diario | 5 AM | Alertas operativas requieren frescura diaria |

---

## 8. Roadmap ML

### v1.0 (implementado)
- [x] Churn Prediction (GBM, binary)
- [x] Demand Forecast (GBR + lags, 3 granularidades)
- [x] Customer Segmentation (KMeans, 5 clusters)
- [x] Product Recommendation (SVD + Association Rules)
- [x] Inventory Risk (RF, rule-based priority)

### v2.0 (propuesto)
- [ ] Price Elasticity Model — detectar sensibilidad al precio por cliente × categoría
- [ ] Lead Scoring — clientes potenciales de campos competidores
- [ ] LTV Regression — predecir el LTV futuro, no solo el histórico
- [ ] Anomaly Detection — detectar ventas anómalas (fraude, error de carga)
- [ ] Demand Forecast con Prophet — incorporar feriados agrícolas y eventos climáticos

### v3.0 (visión futura — LLM Integration)
- [ ] Natural Language Querying — "¿cuánto vendimos en NOA este año?" vía SQL generado por LLM
- [ ] Automated Insights — narrativa automática de anomalías y tendencias
- [ ] Sales Assistant — responder consultas de KAMs sobre clientes individuales

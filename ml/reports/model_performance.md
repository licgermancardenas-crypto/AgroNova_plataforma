# Model Performance Report — AgroNova ML Layer

Reporte canónico de métricas de todos los modelos de Machine Learning de la plataforma.
Los valores de esta sección son **benchmarks esperados** basados en el dataset sintético.
Los valores reales se generan en `ml/artifacts/*_metrics.json` al correr cada script.

---

## 1. Churn Prediction

**Archivo**: `ml/models/train_churn.py`  
**Algoritmo**: GradientBoostingClassifier (sklearn)  
**Target**: Cliente inactivo > 365 días O con `anio_baja` registrada  

### Métricas Esperadas (dataset AgroNova 4,000 clientes)

| Métrica | Valor Esperado | Umbral Mínimo Aceptable |
|---------|---------------|-------------------------|
| ROC-AUC | 0.84 – 0.90 | ≥ 0.78 |
| Accuracy | 0.80 – 0.87 | ≥ 0.75 |
| Precision (Churned) | 0.72 – 0.82 | ≥ 0.65 |
| Recall (Churned) | 0.75 – 0.85 | ≥ 0.70 |
| F1-Score (Churned) | 0.73 – 0.83 | ≥ 0.68 |
| CV ROC-AUC (5-fold) | 0.82 – 0.88 | ≥ 0.76 |

### Distribución de Riesgo Esperada

| Nivel | % Clientes | Descripción |
|-------|-----------|-------------|
| Low | ~55% | P(churn) < 30% — activos y frecuentes |
| Medium | ~25% | P(churn) 30–60% — señales tempranas |
| High | ~20% | P(churn) > 60% — acción urgente requerida |

### Feature Importance (orden esperado)

1. `dias_desde_ultima_compra` / `recency` — mayor predictor
2. `frequency` — clientes de baja frecuencia tienen mayor riesgo
3. `monetary` — clientes de alto valor tienen menor churn
4. `ticket_promedio` — refleja el perfil de compra
5. `antiguedad_cliente` — clientes jóvenes tienen mayor riesgo inicial
6. `region` — ciertas regiones tienen mayor tasa histórica
7. `categoria_principal` — algunas categorías tienen ciclos más largos
8. `margen_historico` — clientes rentables son retenidos activamente
9. `n_categorias` — mayor diversificación = mayor stickiness
10. `descuento_promedio` — descuentos excesivos pueden indicar fidelización forzada

### Artefactos Generados

```
ml/artifacts/
  churn_model.pkl
  churn_encoders.pkl
  churn_feature_importance.csv
  churn_predictions.csv          ← cliente_id, churn_probability, risk_level
  churn_metrics.json
```

### Notas de Interpretación

- **Falsos negativos**: Un cliente clasificado como Low Risk que luego churna tiene más impacto en revenue que un cliente Medium. Priorizar recall sobre precision para Tier A.
- **Clase desbalanceada**: Con ~15-25% de tasa de churn, el modelo usa `class_weight='balanced'` implícito vía GBM. Si el dataset real tiene < 10% churn, aplicar SMOTE o ajustar umbral de decisión.
- **Umbral de decisión**: Por defecto 0.5. Para capturar más churners (recall ↑, precision ↓) bajar a 0.35. Recomendado para campaña de retención masiva.

---

## 2. Demand Forecast

**Archivo**: `ml/models/train_forecast.py`  
**Algoritmo**: GradientBoostingRegressor con features temporales  
**Granularidades**: Categoría | Sucursal | Producto  
**Horizontes**: 30 días / 90 días / 180 días  

### Métricas Esperadas por Nivel de Granularidad

| Nivel | RMSE % (CV) | R² | N Modelos | Horizonte confiable |
|-------|------------|-----|-----------|---------------------|
| Categoría | 12–18% | 0.78–0.88 | 5 | Hasta 180d |
| Sucursal | 15–22% | 0.72–0.84 | 5 | Hasta 90d |
| Producto | 25–40% | 0.55–0.72 | 500–800 | Hasta 30d |

> **RMSE %**: RMSE como porcentaje del revenue mensual promedio por grupo.

### Validación: Time-Series Split (3 folds)

```
Fold 1: Train 2016-2022 → Test 2023 Q1
Fold 2: Train 2016-2023 → Test 2024 Q1
Fold 3: Train 2016-2024 → Test 2025 Q1
```

### Features Más Relevantes (por importancia esperada)

1. `lag_12` — valor del mismo mes del año anterior (captura estacionalidad)
2. `lag_1` — inercia del mes anterior
3. `rolling_6m` — tendencia de mediano plazo
4. `seasonal_weight` — factor estacional mensual hardcoded
5. `month_sin / month_cos` — estacionalidad circular
6. `t` — tendencia lineal de largo plazo (crecimiento del negocio)
7. `rolling_3m` — inercia de corto plazo
8. `lag_3` — ciclo trimestral

### Artefactos Generados

```
ml/artifacts/
  forecast_models_categoria.pkl     ← dict {categoria: Pipeline}
  forecast_models_sucursal.pkl
  forecast_models_producto.pkl      ← puede ser grande (~100MB)
  forecasts_categoria.csv           ← grupo, fecha, horizon_days, revenue_forecast_ars
  forecasts_sucursal.csv
  forecasts_producto.csv
  forecast_metrics_categoria.csv
  forecast_summary_categoria.json
```

### Notas de Interpretación

- **Intervalos de confianza**: No implementados por defecto. Para producción, usar `quantile_loss` en GBM o envolver con `mapie` para intervalos de predicción.
- **Inflación ARS**: El modelo aprende la tendencia nominal. Los forecasts en ARS incluyen el componente inflacionario del período. Para análisis de demanda física, usar `units` (cantidad) en lugar de `revenue`.
- **Reentrenamiento**: Recomendado mensual para capturar la deriva inflacionaria y los cambios de patrón post-cosecha.

---

## 3. Customer Segmentation

**Archivo**: `ml/models/train_segmentation.py`  
**Algoritmo**: KMeans (k=5) sobre features RFM  
**Input**: Recency, Frequency, Monetary (log-transformado + RobustScaler)  

### Métricas de Calidad del Clustering

| Métrica | Valor Esperado | Interpretación |
|---------|---------------|----------------|
| Silhouette Score | 0.32 – 0.48 | Aceptable para datos RFM (rara vez > 0.6) |
| Davies-Bouldin Score | 0.85 – 1.20 | < 1.0 = buena separación |
| Inercia | — | Usar solo para comparar k |
| k óptimo (Silhouette) | 4–6 | Preferir k=5 por interpretabilidad |

### Perfiles de Segmento Esperados

| Segmento | Recency (días) | Frequency | Revenue ARS | % Clientes |
|----------|---------------|-----------|-------------|-----------|
| Campeones | 15–45 | 60–120 | > ARS 8M | 12–18% |
| Leales | 30–90 | 25–60 | ARS 2M–8M | 18–25% |
| Alto_Valor | 60–180 | 10–25 | > ARS 5M | 8–14% |
| En_Riesgo | 180–365 | 20–50 | ARS 1M–4M | 20–28% |
| Dormidos | > 365 | 5–15 | < ARS 1M | 20–30% |

### Artefactos Generados

```
ml/artifacts/
  segmentation_kmeans.pkl
  segmentation_scaler.pkl
  client_segments.csv          ← cliente_id, cluster, segment, r_score, f_score, m_score, rfm_score, accion
  segment_centroids.csv
  segmentation_metrics.json
```

### Notas de Interpretación

- **Estabilidad del clustering**: Con datasets pequeños (< 2,000 clientes), los clusters pueden variar entre ejecuciones. Usar `n_init=30` para mayor estabilidad.
- **Relación con RFM dbt**: Los segmentos de KMeans no son equivalentes a los segmentos RFM del modelo dbt (que usa quintiles). Son complementarios: usar dbt para reglas de negocio, KMeans para análisis exploratorio.
- **Reentrenamiento**: Mensual o trimestral, no más frecuente. Los cambios de segmento muestran mejor la evolución de la cartera.

---

## 4. Product Recommendation

**Archivo**: `ml/models/train_recommendation.py`  
**Algoritmos**:
- Collaborative Filtering: TruncatedSVD (50 componentes) sobre matriz cliente × producto
- Association Rules: Co-occurrence con support mínimo 0.5%

### Métricas Collaborative Filtering

| Métrica | Valor Esperado | Interpretación |
|---------|---------------|----------------|
| Recall@5 | 0.12 – 0.22 | Por cada 10 items comprados, recuerda 1-2 |
| Recall@10 | 0.20 – 0.35 | Mejor cobertura con 10 recomendaciones |
| Recall@20 | 0.30 – 0.45 | Trade-off: más recomendaciones, más hits |
| Explained Variance (SVD) | 35–55% | Con 50 componentes sobre matriz dispersa |

> **Nota sobre sparsity**: Con 4,000 clientes × 2,500 productos, la matriz es ~99.8% cero. SVD-based CF funciona pero el recall será bajo. Alternativa: imputar con pesos de categoría.

### Métricas Association Rules

| Métrica | Valor Esperado |
|---------|---------------|
| N° de reglas (support ≥ 0.5%) | 200 – 800 |
| Lift promedio de top rules | 3.5 – 7.0 |
| Confidence de top rules | 0.35 – 0.65 |
| Par más frecuente | Herbicida × Adherente |

### Artefactos Generados

```
ml/artifacts/
  recommendation_svd.pkl
  recommendation_indexes.pkl       ← (client_index, product_index)
  recommendation_user_factors.npy
  recommendation_item_factors.npy
  recommendations_cf.csv           ← cliente_id, producto_id, rank, cf_score
  recommendations_crosssell.csv    ← cliente_id, producto_id, rank, cross_sell_score
  association_rules.csv            ← antecedente, consecuente, support, confidence, lift
  recommendation_metrics.json
```

### Notas de Interpretación

- **Cold start**: Clientes con < 3 compras tienen poca señal para CF. Para nuevos clientes, usar reglas de asociación o recomendaciones por popularidad de categoría.
- **Hybrid approach**: Combinar CF score y association rule score con peso 0.6 / 0.4 para mejor cobertura.
- **Presentación en dashboard**: Mostrar máximo 3 recomendaciones por cliente en la ficha de cliente para evitar saturación.

---

## 5. Inventory Risk

**Archivo**: `ml/models/train_stock_risk.py`  
**Algoritmo**: RandomForestClassifier (class_weight='balanced')  
**Target**: `ruptura_inminente` = cobertura < 7 días  

### Métricas del Clasificador

| Métrica | Valor Esperado | Umbral Mínimo |
|---------|---------------|---------------|
| ROC-AUC | 0.88 – 0.95 | ≥ 0.82 |
| Recall (Ruptura) | 0.85 – 0.93 | ≥ 0.80 |
| Precision (Ruptura) | 0.70 – 0.82 | ≥ 0.60 |
| F1-Score (Ruptura) | 0.78 – 0.87 | ≥ 0.70 |
| Accuracy | 0.85 – 0.92 | ≥ 0.80 |

> **Priorizar Recall**: Un stockout no detectado (falso negativo) tiene mucho mayor costo que una alarma innecesaria (falso positivo). Target recall ≥ 0.85.

### Distribución de Prioridades Esperada

| Prioridad | Descripción | % SKU×Depot esperado |
|-----------|-------------|---------------------|
| 1_Sin_Stock | Stock actual = 0 | 0.5–2% |
| 2_Critico_A | Clase A, cobertura < 7d | 1–3% |
| 3_Critico_B | Clase B/C, cobertura < 7d | 2–5% |
| 4_Bajo_Minimo | Stock < stock_mínimo | 5–12% |
| 5_Alerta | Cobertura 7–15 días | 8–18% |
| 6_Normal | Cobertura ≥ 15 días | 60–80% |

### Feature Importance Esperada

1. `dias_cobertura` — predictor dominante (captura el ratio de urgencia)
2. `dias_cobertura_adj` — días ajustados por factor estacional
3. `ratio_stock_minimo` — indica qué tan cerca del límite está
4. `ventas_diarias_promedio` — velocidad de demanda reciente
5. `abc_encoded` — clase A tiene umbral más exigente
6. `stock_actual` — valor absoluto del stock
7. `seasonal_factor` — meses de alta demanda tienen mayor riesgo
8. `bajo_minimo` — flag directo de violación del mínimo
9. `cat_encoded` — ciertas categorías tienen patrones de demanda particulares
10. `ratio_stock_maximo` — eficiencia de uso del depósito

### Artefactos Generados

```
ml/artifacts/
  stock_risk_model.pkl
  stock_risk_encoders.pkl          ← {abc: LabelEncoder, categoria: LabelEncoder}
  stock_risk_predictions.csv       ← producto_id, deposito_id, prioridad, ruptura_probability, unidades_a_reponer
  stock_risk_feature_importance.csv
  stock_risk_metrics.json
```

---

## 6. Resumen Ejecutivo de Performance

| Modelo | Algoritmo | Métrica Principal | Target | Status |
|--------|-----------|------------------|--------|--------|
| Churn Prediction | GradientBoosting | ROC-AUC | ≥ 0.80 | ✅ Esperado |
| Demand Forecast (Cat.) | GradientBoosting | RMSE % | ≤ 18% | ✅ Esperado |
| Demand Forecast (SKU) | GradientBoosting | RMSE % | ≤ 40% | ⚠️ Alta varianza |
| Customer Segmentation | KMeans | Silhouette | ≥ 0.32 | ✅ Esperado |
| Product Recommendation | TruncatedSVD | Recall@10 | ≥ 0.20 | ⚠️ Matriz dispersa |
| Association Rules | Co-occurrence | Lift Top Rules | ≥ 3.0 | ✅ Esperado |
| Inventory Risk | RandomForest | Recall (Ruptura) | ≥ 0.85 | ✅ Esperado |

---

## 7. Requisitos de Entorno

```bash
# Dependencias core
pip install scikit-learn>=1.3 pandas>=2.0 numpy>=1.24 joblib>=1.3 scipy>=1.10

# Para conexión a base de datos
pip install sqlalchemy>=2.0 psycopg2-binary>=2.9

# Opcionales (mejoran performance pero no son requeridos)
pip install lightgbm>=4.0   # alternativa a GBM de sklearn (más rápido)
pip install prophet>=1.1    # forecasting avanzado con tendencias y feriados
pip install mlxtend>=0.23   # Apriori algorithm para association rules
```

---

## 8. Ejecutar Todos los Modelos

```bash
# Desde el directorio raíz del proyecto
cd ml/models

# Con CSVs locales
python train_churn.py --csv-dir ../../data/processed -v
python train_forecast.py --csv-dir ../../data/processed --level categoria -v
python train_segmentation.py --csv-dir ../../data/processed -v
python train_recommendation.py --csv-dir ../../data/processed -v
python train_stock_risk.py --csv-dir ../../data/processed -v

# Con base de datos Neon
NEON_CONN="postgresql://user:pass@ep-xxx.neon.tech/agronova?sslmode=require"
python train_churn.py --conn $NEON_CONN
python train_forecast.py --conn $NEON_CONN --level sucursal
python train_segmentation.py --conn $NEON_CONN --n-clusters 5
python train_recommendation.py --conn $NEON_CONN --top-n 5
python train_stock_risk.py --conn $NEON_CONN --ruptura-days 7
```

---

*Versión: 1.0 — Generado para AgroNova Argentina S.A. — Plataforma Decision Intelligence*

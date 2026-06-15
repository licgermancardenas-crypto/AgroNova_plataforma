# Release Notes — AgroNova Decision Intelligence Platform v1.0.0

**Release Date:** 2026-06-15
**Version:** 1.0.0 (Production — Stable)
**Repository:** https://github.com/licgermancardenas-crypto/AgroNova_plataforma

---

## Objetivo del Proyecto

AgroNova Decision Intelligence Platform es una plataforma de datos empresarial construida para demostrar una arquitectura de analytics moderna y completa, aplicada al sector agropecuario argentino.

El proyecto modela a **AgroNova Argentina S.A.**, una distribuidora ficticia de insumos agropecuarios con operaciones en 5 regiones (PAM, NOA, NEA, CUY, PAT), 5 sucursales, 3 depósitos y una cartera de 4,000 clientes activos.

---

## Problema de Negocio

Las distribuidoras agropecuarias argentinas enfrentan una combinación de desafíos únicos que requieren inteligencia de datos avanzada:

1. **Estacionalidad extrema**: Las ventas fluctúan entre 0.70x (julio) y 1.65x (noviembre) del baseline, con picos críticos en octubre–noviembre (siembra gruesa) y enero (siembra fina).

2. **Inflación estructural**: La devaluación del ARS (14.8 → 1,120 ARS/USD en 10 años) distorsiona el análisis de revenue en moneda local, exigiendo análisis dual ARS/USD.

3. **Concentración de clientes**: El 20% superior de la cartera genera el 77.4% del revenue — los Campeones y Clientes de Alto Valor requieren gestión diferenciada.

4. **Riesgo de stock**: Los quiebres de stock en temporada alta (Herbicidas, Semillas) generan pérdidas de revenue y daño de relación con clientes A.

5. **Logística dispersa**: Red de sucursales con radios de cobertura de 300–600 km y OTIF variable por región (86.7% NEA vs 94.2% PAM).

---

## Capas Construidas

### Capa 1 — Data Generation
Generación sintética reproducible de 1.5 millones de transacciones de venta con:
- Estacionalidad agrícola argentina (pesos mensuales calibrados)
- Inflación real modelada año a año (ARS/USD histórico)
- Distribución Pareto de clientes con curva de abandono
- 13 entidades: clientes, productos, proveedores, sucursales, vendedores, depósitos, logística

### Capa 2 — Data Quality & SQL
Base de datos PostgreSQL con star schema productivo:
- 8 dimensiones + 4 fact tables con integridad referencial completa
- 25+ índices de performance para patrones analíticos
- 111 tests automatizados con pytest (100% pass rate)
- 52 checks de auditoría de calidad de datos

### Capa 3 — ETL Pipeline
Pipeline de carga modular con validación de esquema, transformación tipada y carga FK-safe:
- Extracción con detección automática de tipos y encoding
- Transformación con reglas de negocio (trimming, normalización, enriquecimiento)
- Carga chunked (100K filas) con rollback por tabla
- Reporte JSON por ejecución con métricas de cada fase

### Capa 4 — Analytics Engineering (dbt)
Arquitectura Medallion que transforma datos raw en KPIs de negocio:
- **Bronze**: 13 modelos de ingesta raw con source freshness tests
- **Silver**: Limpieza, tipado, ajuste inflacionario, normalización estacional
- **Gold**: Revenue por región/categoría, RFM scores, ABC Pareto, OTIF, LTV

### Capa 5 — Business Intelligence
Sistema de métricas con 7 dominios y 30+ indicadores:
- Revenue ARS 14.2B en 2026, CAGR 3.8% USD (2021–2026)
- Margen bruto 19.8%, EBITDA 11.8%
- 1,187 clientes activos, churn rate 8.3%
- OTIF global 91.4% (target 92%)

### Capa 6 — Machine Learning
5 modelos de Decision Intelligence en producción:

| Modelo | Caso de Uso | ROI Esperado |
|--------|-------------|--------------|
| Churn Prediction | Identificar 800 clientes High Risk antes de perderlos | Retención del 30–40% = ARS 150M+ |
| Demand Forecast | Planificar compras con 90 días de anticipación | Reducción de quiebres y sobrestock ~15% |
| Segmentación RFM | Personalizar acciones por los 5 segmentos | Uplift cross-sell Campeones ~25% |
| Recomendador | Sugerir productos complementarios por cliente | Ticket promedio +12–18% |
| Stock Risk | Prevenir quiebres P1/P2 antes de temporada | Cero quiebres en ítems A = ARS 80M+ |

### Capa 7 — Frontend Corporativo
Plataforma web de Decision Intelligence con estética Palantir/Databricks:
- 9 páginas especializadas por dominio de negocio
- Diseño dark glassmorphism con sistema de tokens Tailwind
- Mapa GIS interactivo con cobertura de sucursales
- Visualizaciones Recharts dark con datos canónicos del modelo

---

## Principales Capacidades

### Para Dirección / C-Level
- KPIs ejecutivos en tiempo real (revenue, margen, EBITDA, clientes activos)
- Comparativa ARS vs USD para análisis macroeconómico
- Dashboard Home con alertas operativas críticas

### Para Comercial
- Ranking de vendedores con efficiency score
- Pareto ABC de productos y análisis de concentración
- Top 10 clientes con riesgo de churn y margen por cuenta

### Para Finanzas
- Análisis de rentabilidad por segmento de producto
- LTV por tier de cliente vs promedio del tier
- Margen bruto regional con evolución

### Para Marketing / CRM
- Segmentos RFM (Campeones, Leales, Alto Valor, En Riesgo, Dormidos)
- Distribución de churn Low/Medium/High con acción recomendada
- Lista de clientes High Risk para outreach inmediato

### Para Inventario / Supply Chain
- Alertas de stock priorizadas P1 (Sin Stock) a P5 (Alerta)
- Rotación por categoría y depósito
- Capital inmovilizado por SKU de baja rotación

### Para Logística
- OTIF por región y transportista con ranking de cuadrante
- Evolución mensual de OTIF vs target
- Costos de flete como % del revenue

### Para IT / Data Science
- Arquitectura reproducible con SEED=42
- 5 modelos ML listos para integración vía API
- dbt Medallion desacoplado y testeable

---

## Casos de Uso Habilitados

1. **Diagnóstico de cartera**: Identificar los 920 clientes "En Riesgo" y los 1,200 "Dormidos" para campañas de reactivación diferenciadas.

2. **Planificación de siembra gruesa**: Con el forecast a 90 días, anticipar la demanda de Herbicidas (Glifosato) y Semillas (Soja RR) para noviembre con 3 meses de anticipación.

3. **Optimización de inventario**: Eliminar quiebres de ítems P1/P2 (Glifosato, Azoxistrobina) antes de temporada alta mediante replenishment automático.

4. **Cross-selling**: Recomendar productos complementarios a clientes Tier A que compran fertilizantes pero no fungicidas del mismo proveedor.

5. **Análisis de cobertura regional**: Detectar zonas de NEA (OTIF 86.7%) donde la logística requiere refuerzo de transportistas o apertura de nuevo punto de distribución.

6. **Reporting ejecutivo**: Revenue ARS 14.2B con contexto USD 3.8% CAGR, separando inflación de crecimiento real.

---

## Notas Técnicas

- **Datos**: 100% sintéticos y reproducibles. No contiene información real de ninguna empresa.
- **Base de datos**: Diseñada para Neon Serverless (PostgreSQL 16) con conexión pooler para Next.js y direct connection para ETL.
- **Frontend**: Versión 1.0 utiliza datos mock (`web/lib/mock-data.ts`). La conexión real a DB está planificada para v1.1 via FastAPI.
- **ML**: Modelos entrenables en CPU con datasets de ~4,000 clientes. Tiempo de entrenamiento total: ~8–12 minutos.
- **Deploy**: Configurado para Vercel (Root Directory: `web/`). Sin variables de entorno requeridas en v1.0 mock.

---

## Compatibilidad

| Componente | Versión mínima |
|------------|---------------|
| Python | 3.10+ |
| Node.js | 18.17+ |
| PostgreSQL | 14+ |
| dbt Core | 1.6+ |
| Navegador | Chrome 100+, Firefox 100+, Edge 100+ |

---

*AgroNova Argentina S.A. es una empresa ficticia. Todos los datos son sintéticos generados con SEED=42.*

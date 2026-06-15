# AgroNova Argentina S.A. — Plataforma de Datos

Plataforma BI/ML de produccion para una distribuidora ficticia de insumos agropecuarios argentina. Incluye generacion de datos sinteticos, pipeline ETL, base de datos PostgreSQL con star schema, suite de tests y documentacion completa.

## Stack

| Capa | Tecnologia |
|------|-----------|
| Datos sinteticos | Python 3.11 · NumPy · Faker (es_AR) |
| ETL | pandas · SQLAlchemy · psycopg2 |
| Base de datos | PostgreSQL 16 · Neon Serverless |
| Testing | pytest 8.x (111 tests, 100% pass) |
| Frontend (proxima fase) | Next.js 15 · shadcn/ui · Drizzle ORM |

## Modelo de Datos

**Star Schema** con 8 dimensiones + 4 tablas de hechos + cotizaciones externas:

- **1,500,000 ventas** (2016-2026) con estacionalidad agricola argentina
- **4,000 clientes** con distribucion Pareto (top 20% = 77.4% del revenue)
- **2,500 productos** en 5 categorias (Herbicidas, Fertilizantes, Fungicidas, Insecticidas, Semillas)
- **15 proveedores** (9 nacionales + 6 internacionales)
- **Inflacion real modelada**: TC ARS/USD 14.8 (2016) → 1,120 (2026)

## Estructura del Repositorio

```
AgroNova_plataforma/
├── data/
│   ├── generators/          # Generadores sinteticos (SEED=42, reproducible)
│   ├── csv/                 # Output: 13 CSVs (~250MB)
│   ├── sql/                 # DDL y vistas analiticas originales
│   └── audit/               # Auditoria de calidad (52 checks, 51 OK, 0 ERR)
├── etl/
│   ├── extract.py           # Lectura y validacion de schema
│   ├── transform.py         # Tipado, limpieza, reglas de negocio
│   ├── load.py              # Carga a PostgreSQL (FK-safe, chunked)
│   └── run_pipeline.py      # Orquestador con logging y reporte JSON
├── database/
│   ├── create_database.sql  # Schema, ENUMs, tablas, FK, CHECK constraints
│   ├── create_indexes.sql   # 25+ indices de performance
│   ├── constraints.sql      # Constraints adicionales de negocio
│   └── load_data.sql        # Alternativa COPY para acceso local al servidor
├── tests/                   # 111 pytest tests (PKs, FKs, nulls, BR)
├── diagrams/                # ERD, Star Schema, Arquitectura (Mermaid)
├── docs/                    # Contexto, arquitectura, diccionario, KPIs
└── logs/                    # Runtime logs y reportes JSON (gitignored)
```

## Instalacion

### 1. Clonar y crear entorno

```bash
git clone https://github.com/licgermancardenas-crypto/AgroNova_plataforma.git
cd AgroNova_plataforma
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate
pip install -r requirements.txt
```

### 2. Generar datos sinteticos

```bash
python data/generators/generate_all.py
```

Genera los 13 CSVs en `data/csv/`. Tiempo: ~45s. Requiere ~4GB RAM durante la generacion.

### 3. Ejecutar tests de calidad

```bash
pytest
# Resultado esperado: 111 passed in ~11s
```

### 4. Configurar base de datos

#### Opcion A — PostgreSQL local (Docker)

```bash
docker run --name agronova-pg -e POSTGRES_PASSWORD=agronova -p 5432:5432 -d postgres:16
psql -U postgres -h localhost -f database/create_database.sql
```

#### Opcion B — Neon Serverless (recomendado para demo)

1. Crear cuenta en [neon.tech](https://neon.tech)
2. Crear proyecto "agronova"
3. Copiar connection string (pooler para Next.js / direct para ETL)
4. Ejecutar DDL:
   ```bash
   psql "$DATABASE_URL" -f database/create_database.sql
   psql "$DATABASE_URL" -f database/constraints.sql
   ```

### 5. Ejecutar pipeline ETL

```bash
# Dry-run — extrae y transforma, no carga
python etl/run_pipeline.py --dry-run

# Carga completa
export DATABASE_URL="postgresql://user:pass@host/agronova?sslmode=require"
python etl/run_pipeline.py --conn "$DATABASE_URL" --schema agronova

# Verbose
python etl/run_pipeline.py --conn "$DATABASE_URL" -v
```

El pipeline genera `logs/report_YYYYMMDD_HHMMSS.json` con el resultado de cada fase.

### 6. Crear indices (post-carga)

```bash
psql "$DATABASE_URL" -f database/create_indexes.sql
```

## Variables de Entorno

Crear `.env` en la raiz (ya esta en `.gitignore`):

```
DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require
```

## Neon — Conexion Power BI

1. Neon dashboard → Connection Details → copiar "Direct connection"
2. Power BI Desktop → Obtener datos → PostgreSQL
3. Servidor: `ep-XXXX.region.aws.neon.tech:5432`
4. Base de datos: `agronova`
5. Schema: `agronova` → usar las 10 vistas `v_*`

## Tests

```bash
pytest                                      # todos los tests
pytest tests/test_business_rules.py -v     # un modulo
pytest -m slow                             # tests lentos
pytest --cov=etl --cov-report=term-missing # con cobertura
```

| Modulo | Tests | Que verifica |
|--------|-------|--------------|
| test_primary_keys.py | 15 | Unicidad, formato, conteos exactos |
| test_foreign_keys.py | 17 | Integridad referencial completa |
| test_duplicates.py | 12 | Unicidad de campos clave, cobertura |
| test_nulls.py | 20 | Nulos requeridos y opcionales |
| test_business_rules.py | 30 | BR-01..06, Pareto, estacionalidad |
| **Total** | **111** | **100% pass** |

## Auditoria de Calidad

```bash
python data/audit/audit_calidad.py
# Output: data/audit/reporte_calidad.json
# Resultado: 51 OK, 1 WARN (6 outliers en 1.5M filas), 0 ERR
```

## Documentacion

| Documento | Descripcion |
|-----------|-------------|
| [docs/business_context.md](docs/business_context.md) | Empresa, segmentos, estacionalidad, inflacion |
| [docs/architecture.md](docs/architecture.md) | Stack, estructura, decisiones de diseno |
| [docs/data_dictionary.md](docs/data_dictionary.md) | Todas las columnas documentadas |
| [docs/kpis.md](docs/kpis.md) | Metricas, formulas y dashboards |
| [docs/assumptions.md](docs/assumptions.md) | Supuestos y limitaciones del modelo sintetico |

## Diagramas (Mermaid)

Renderizados automaticamente en GitHub o con la extension Mermaid en VS Code:

- `diagrams/erd.mmd` — Diagrama entidad-relacion completo
- `diagrams/star_schema.mmd` — Star schema con metricas destacadas
- `diagrams/architecture.mmd` — Arquitectura de la plataforma

## Roadmap

- [x] Generacion de datos sinteticos (1.5M ventas, Pareto, estacionalidad)
- [x] Auditoria de calidad (52 checks, 51 OK)
- [x] DDL PostgreSQL con ENUMs, CHECK, GENERATED, 25+ indexes
- [x] 10 vistas analiticas para Power BI
- [x] Pipeline ETL con extract / transform / load / run_pipeline
- [x] Suite de tests pytest (111 tests, 100% pass)
- [x] Documentacion tecnica y de negocio (5 docs)
- [x] Diagramas Mermaid (ERD, Star Schema, Arquitectura)
- [ ] Frontend Next.js 15 + shadcn/ui
- [ ] Dashboard ejecutivo con Tremor / Recharts
- [ ] API Routes para queries BI desde el frontend
- [ ] Deploy Vercel + Neon

---

*AgroNova Argentina S.A. es una empresa ficticia creada para fines de demostracion de arquitectura de datos. Todos los datos son sinteticos.*

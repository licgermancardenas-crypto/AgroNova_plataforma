# Contexto de Negocio — AgroNova Argentina S.A.

## Descripcion de la Empresa

AgroNova Argentina S.A. es una distribuidora ficticia de insumos agropecuarios con presencia nacional. Opera como intermediaria entre fabricantes/importadores de agroquimicos y el segmento productor: grandes agricultores, cooperativas agropecuarias, distribuidores zonales y pymes rurales.

La empresa fue creada como caso de uso para esta plataforma de datos: los datos son sinteticos pero modelados con dinamicas reales del agronegocio argentino (estacionalidad, inflacion, dolarizacion de precios).

## Estructura Operativa

### Sucursales (5)
| Sucursal | Ciudad | Region | Foco |
|----------|--------|--------|------|
| Rosario Hub | Rosario | PAM | Cereales y oleaginosas |
| CABA Central | Buenos Aires | PAM | Clientes corporativos |
| Cordoba Agro | Cordoba | PAM | Maiz, soja, feedlots |
| Mendoza Vinos | Mendoza | CUY | Viticultura, fruticultura |
| Salta Norte | Salta | NOA | Citricos, tabaco, poroto |

### Depositos Logisticos (3)
- **Rosario Central**: 5,000 ton — mayor volumen nacional
- **Cordoba Inland**: 2,500 ton — redistribucion pampeana
- **Salta Norte**: 1,200 ton — NOA y NEA

### Regiones Comerciales (5)
- **PAM** (Pampeana): nucleo del negocio, ~65% del revenue
- **NOA** (Noroeste): cultivos regionales, mayor estacionalidad
- **NEA** (Noreste): soja, algodon, yerbatales
- **CUY** (Cuyo): viticultura, fruticultura, ajo
- **PAT** (Patagonia): frutas de pepita, lana, ganaderia extensiva

## Cartera de Clientes

**4,000 clientes** clasificados en cuatro segmentos:

| Segmento | Descripcion | % Clientes |
|----------|-------------|------------|
| Grandes Productores | +500 ha, compra directa | ~20% |
| Cooperativas | Federadas o independientes | ~15% |
| Distribuidores | Reventa en zona | ~25% |
| PYMES Agropecuarias | Productores medianos | ~40% |

### Ciclo de Vida del Cliente
- **Nuevo** (0-2 anos): volumen bajo, menor descuento
- **Activo** (3-7 anos): volumen creciente, descuentos regulares
- **Maduro** (+8 anos): alto volumen, condiciones especiales
- **Churned** (~30% del total): clientes dados de baja

### Pareto / Tier de Cliente
La distribucion de revenue sigue la ley de Pareto:

| Tier | % Clientes | % Revenue | Factor de Volumen |
|------|------------|-----------|-------------------|
| A    | 10%        | ~55%      | 8x - 20x          |
| B    | 20%        | ~22%      | 2x - 8x           |
| C    | 30%        | ~17%      | 0.5x - 2x         |
| D    | 40%        | ~6%       | 0.05x - 0.5x      |

*Top 20% clientes generan 77.4% del revenue total.*

## Catalogo de Productos

**2,500 SKUs** en 5 categorias principales:

| Categoria | Ejemplos | % Ventas |
|-----------|----------|----------|
| Herbicidas | Glifosato, 2,4-D, Atrazina | ~30% |
| Fertilizantes | Urea, MAP, DAP, Potasio | ~25% |
| Fungicidas | Triazoles, Estrobirulinas | ~20% |
| Insecticidas | Piretroides, Neonicotinoides | ~15% |
| Semillas | Soja RR, Maiz HT, Girasol | ~10% |

## Proveedores

**15 proveedores** con contratos marcos anuales:

### Nacionales (9)
FertiSur S.A., AgroPampa Insumos, NutriCampo Argentina, Semillas del Centro, BioAgro Santa Fe, QuimAgro Cordoba, AgroAndes S.A., Pampeana Crop Solutions, TecnoAgro Argentina

### Internacionales (6)
AgroBrasil Ltda., Midwest Crop Solutions USA, GreenSeed America, SinoAgro Chemicals, Bayer Agro Germany, EuroCrop Solutions

## Dinamicas del Mercado Argentino

### Estacionalidad Agricola
Las ventas tienen un patron estacional marcado por las campanas de siembra:

| Mes | Factor | Periodo |
|-----|--------|---------|
| Jun-Jul | 0.70 - 0.78 | Valle (invierno) |
| Ago-Sep | 0.90 - 1.05 | Pre-siembra soja |
| Oct-Nov | 1.52 - 1.65 | Pico siembra gruesa |
| Dic-Feb | 1.20 - 1.35 | Campana de verano |
| Mar-May | 0.85 - 1.00 | Cosecha, baja demanda |

### Dolarizacion de Precios
Los productos agroquimicos se cotizan en USD pero se facturan en ARS al tipo de cambio oficial BNA del dia. La inflacion acumulada 2016-2026 implica un factor de ~45x en precios nominales.

| Ano | TC USD/ARS | Factor Inflacion |
|-----|-----------|-----------------|
| 2016 | 14.8      | 1.0x            |
| 2019 | 63.0      | 7.2x            |
| 2022 | 189.0     | 22.1x           |
| 2024 | 910.0     | 45.0x           |
| 2026 | 1,120.0   | 58.0x           |

## Objetivos de la Plataforma BI

1. **Analisis de Revenue**: evolucion temporal, por region, producto y cliente
2. **Gestion de Clientes**: RFM, Pareto, churn prediction, tier management
3. **Supply Chain**: rotacion de inventario, cobertura de stock, performance de proveedores
4. **Logistica**: dias de transito, costos de flete por region, tasa de demoras
5. **KPIs Ejecutivos**: margen bruto %, revenue USD dolarizado, clientes activos netos

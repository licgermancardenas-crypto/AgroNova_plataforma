"""
test_nulls.py
Verifica ausencia de nulos en columnas obligatorias y
presencia permitida de nulos en columnas opcionales.
"""

import pytest


# Columnas NOT NULL por tabla (deben tener 0 nulos)
REQUIRED_COLS = {
    "dim_fecha": [
        "fecha_id", "fecha", "año", "semestre", "trimestre", "mes",
        "mes_nombre", "dia_semana", "dia_semana_nombre",
        "temporada", "temporada_agricola", "factor_estacional",
    ],
    "dim_region":    ["region_id", "nombre_region", "provincia_principal"],
    "dim_sucursal":  ["sucursal_id", "nombre", "provincia", "region_id"],
    "dim_deposito":  ["deposito_id", "nombre", "sucursal_id"],
    "dim_vendedor":  ["vendedor_id", "nombre", "apellido", "sucursal_id"],
    "dim_proveedor": ["proveedor_id", "nombre_proveedor", "tipo"],
    "dim_producto":  ["producto_id", "nombre_producto", "categoria", "subcategoria"],
    "dim_cliente":   ["cliente_id", "razon_social", "segmento"],
    "fact_ventas": [
        "venta_id", "fecha_id", "cliente_id", "producto_id",
        "sucursal_id", "vendedor_id", "cantidad",
        "precio_unitario_ars", "precio_unitario_usd",
        "total_ars", "total_usd",
    ],
    "fact_compras": [
        "compra_id", "fecha_id", "proveedor_id", "producto_id",
        "deposito_destino_id", "cantidad",
        "precio_unitario_usd", "precio_unitario_ars",
        "total_usd", "total_ars",
    ],
    "fact_inventario": [
        "inventario_id", "fecha_id", "producto_id", "deposito_id", "stock_actual",
    ],
    "fact_logistica": [
        "logistica_id", "fecha_despacho_id", "cliente_id",
        "deposito_origen_id", "region_destino_id",
    ],
    "cotizaciones": ["fecha", "fecha_id"],
}

# Columnas que SI pueden tener nulos (opcionales)
NULLABLE_COLS = {
    "dim_cliente":   ["año_baja", "superficie_ha"],
    "dim_proveedor": ["provincia", "ciudad", "puerto_ingreso"],
    "dim_vendedor":  ["email", "telefono"],
    "dim_producto":  ["proveedor_id_principal"],
}


def _check_no_nulls(df, tabla, columnas):
    for col in columnas:
        if col not in df.columns:
            pytest.skip(f"Columna '{col}' no existe en {tabla}")
        nulls = df[col].isna().sum()
        assert nulls == 0, (
            f"{tabla}.{col}: {nulls:,} valores nulos en columna obligatoria"
        )


class TestNulosObligatoriosDimensiones:

    def test_dim_fecha_no_nulls(self, dim_fecha):
        _check_no_nulls(dim_fecha, "dim_fecha", REQUIRED_COLS["dim_fecha"])

    def test_dim_region_no_nulls(self, dim_region):
        _check_no_nulls(dim_region, "dim_region", REQUIRED_COLS["dim_region"])

    def test_dim_sucursal_no_nulls(self, dim_sucursal):
        _check_no_nulls(dim_sucursal, "dim_sucursal", REQUIRED_COLS["dim_sucursal"])

    def test_dim_deposito_no_nulls(self, dim_deposito):
        _check_no_nulls(dim_deposito, "dim_deposito", REQUIRED_COLS["dim_deposito"])

    def test_dim_vendedor_no_nulls(self, dim_vendedor):
        _check_no_nulls(dim_vendedor, "dim_vendedor", REQUIRED_COLS["dim_vendedor"])

    def test_dim_proveedor_no_nulls(self, dim_proveedor):
        _check_no_nulls(dim_proveedor, "dim_proveedor", REQUIRED_COLS["dim_proveedor"])

    def test_dim_producto_no_nulls(self, dim_producto):
        _check_no_nulls(dim_producto, "dim_producto", REQUIRED_COLS["dim_producto"])

    def test_dim_cliente_no_nulls(self, dim_cliente):
        _check_no_nulls(dim_cliente, "dim_cliente", REQUIRED_COLS["dim_cliente"])


class TestNulosObligatoriosFacts:

    def test_fact_ventas_no_nulls(self, fact_ventas):
        _check_no_nulls(fact_ventas, "fact_ventas", REQUIRED_COLS["fact_ventas"])

    def test_fact_compras_no_nulls(self, fact_compras):
        _check_no_nulls(fact_compras, "fact_compras", REQUIRED_COLS["fact_compras"])

    def test_fact_inventario_no_nulls(self, fact_inventario):
        _check_no_nulls(fact_inventario, "fact_inventario", REQUIRED_COLS["fact_inventario"])

    def test_fact_logistica_no_nulls(self, fact_logistica):
        _check_no_nulls(fact_logistica, "fact_logistica", REQUIRED_COLS["fact_logistica"])

    def test_cotizaciones_no_nulls(self, cotizaciones):
        _check_no_nulls(cotizaciones, "cotizaciones", REQUIRED_COLS["cotizaciones"])


class TestNulosOpcionales:
    """Columnas nullable: verificar que tengan entre 0% y 100% nulos (existencia controlada)."""

    def test_dim_cliente_año_baja_nullable(self, dim_cliente):
        """año_baja es NULL para clientes activos — esperamos ~85% nulos."""
        pct_nulos = dim_cliente["año_baja"].isna().mean() * 100
        assert 70 <= pct_nulos <= 98, (
            f"Dim_Cliente.año_baja: {pct_nulos:.1f}% nulos, esperado 70-98% "
            f"(clientes activos no tienen baja)"
        )

    def test_dim_cliente_superficie_ha_nullable(self, dim_cliente):
        """superficie_ha es NULL para Agroindustrias y Distribuidores (~30% del total)."""
        pct_nulos = dim_cliente["superficie_ha"].isna().mean() * 100
        assert 20 <= pct_nulos <= 50, (
            f"Dim_Cliente.superficie_ha: {pct_nulos:.1f}% nulos, esperado 20-50%"
        )

    def test_dim_proveedor_puerto_nullable(self, dim_proveedor):
        """puerto_ingreso es NULL para proveedores nacionales (9/15 = 60%)."""
        pct_nulos = dim_proveedor["puerto_ingreso"].isna().mean() * 100
        assert 50 <= pct_nulos <= 70, (
            f"Dim_Proveedor.puerto_ingreso: {pct_nulos:.1f}% nulos, esperado ~60%"
        )

    def test_cotizaciones_valores_completos(self, cotizaciones):
        """Todas las series de cotizaciones deben estar completas."""
        for col in ["usd_ars_oficial", "usd_ars_blue", "soja_cbot_usd_ton", "urea_fob_usd_ton"]:
            nulls = cotizaciones[col].isna().sum()
            assert nulls == 0, f"Cotizaciones.{col}: {nulls} valores faltantes"

    def test_fact_ventas_margen_no_nulo(self, fact_ventas):
        nulls = fact_ventas["margen_bruto_ars"].isna().sum()
        assert nulls == 0, (
            f"Fact_Ventas.margen_bruto_ars: {nulls:,} nulos — el margen es obligatorio"
        )

    def test_dim_cliente_volumen_factor_no_nulo(self, dim_cliente):
        """volumen_factor no debe ser nulo (fue agregado en la correccion Pareto)."""
        if "volumen_factor" not in dim_cliente.columns:
            pytest.skip("volumen_factor no existe — regenerar Dim_Cliente")
        nulls = dim_cliente["volumen_factor"].isna().sum()
        assert nulls == 0, f"Dim_Cliente.volumen_factor: {nulls} nulos"

    def test_dim_cliente_tier_no_nulo(self, dim_cliente):
        if "tier_cliente" not in dim_cliente.columns:
            pytest.skip("tier_cliente no existe — regenerar Dim_Cliente")
        nulls = dim_cliente["tier_cliente"].isna().sum()
        assert nulls == 0, f"Dim_Cliente.tier_cliente: {nulls} nulos"
        valores = set(dim_cliente["tier_cliente"].unique())
        assert valores == {"A", "B", "C", "D"}, (
            f"Dim_Cliente.tier_cliente: valores inesperados: {valores}"
        )

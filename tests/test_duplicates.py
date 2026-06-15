"""
test_duplicates.py
Verifica ausencia de duplicados a nivel de PK y de combinaciones de negocio.
"""

import pytest


class TestDuplicadosDimensiones:

    def test_dim_fecha_sin_duplicados_fecha(self, dim_fecha):
        dups = dim_fecha["fecha"].duplicated().sum()
        assert dups == 0, f"Dim_Fecha: {dups} fechas duplicadas (campo 'fecha')"

    def test_dim_proveedor_nombre_unico(self, dim_proveedor):
        dups = dim_proveedor["nombre_proveedor"].duplicated().sum()
        assert dups == 0, (
            f"Dim_Proveedor: {dups} nombres de proveedor duplicados"
        )

    def test_dim_producto_nombre_unico(self, dim_producto):
        dups = dim_producto["nombre_producto"].duplicated().sum()
        assert dups == 0, (
            f"Dim_Producto: {dups} nombres de producto duplicados"
        )

    def test_dim_cliente_cuit_unico(self, dim_cliente):
        """CUIT debe ser unico por cliente (no dos empresas con el mismo CUIT)."""
        dups = dim_cliente["cuit"].duplicated().sum()
        assert dups == 0, (
            f"Dim_Cliente: {dups} CUITs duplicados — cada empresa debe tener CUIT propio"
        )

    def test_dim_vendedor_email_unico(self, dim_vendedor):
        dups = dim_vendedor["email"].dropna().duplicated().sum()
        assert dups == 0, (
            f"Dim_Vendedor: {dups} emails duplicados entre vendedores"
        )

    def test_dim_sucursal_nombre_unico(self, dim_sucursal):
        dups = dim_sucursal["nombre"].duplicated().sum()
        assert dups == 0, f"Dim_Sucursal: {dups} nombres de sucursal duplicados"


class TestDuplicadosFacts:

    def test_fact_ventas_sin_pk_dups(self, fact_ventas):
        dups = fact_ventas["venta_id"].duplicated().sum()
        assert dups == 0, f"Fact_Ventas: {dups} venta_id duplicados"

    def test_fact_compras_sin_pk_dups(self, fact_compras):
        dups = fact_compras["compra_id"].duplicated().sum()
        assert dups == 0, f"Fact_Compras: {dups} compra_id duplicados"

    def test_fact_inventario_uk_negocio(self, fact_inventario):
        """Un producto en un deposito solo puede tener un snapshot por fecha."""
        dups = fact_inventario.duplicated(
            subset=["fecha_id", "producto_id", "deposito_id"]
        ).sum()
        assert dups == 0, (
            f"Fact_Inventario: {dups} combinaciones (fecha, producto, deposito) duplicadas"
        )

    def test_fact_logistica_sin_pk_dups(self, fact_logistica):
        dups = fact_logistica["logistica_id"].duplicated().sum()
        assert dups == 0, f"Fact_Logistica: {dups} logistica_id duplicados"

    def test_cotizaciones_sin_fecha_dups(self, cotizaciones):
        dups = cotizaciones["fecha"].duplicated().sum()
        assert dups == 0, f"Cotizaciones: {dups} fechas duplicadas"

    def test_cotizaciones_fecha_id_dups(self, cotizaciones):
        dups = cotizaciones["fecha_id"].duplicated().sum()
        assert dups == 0, f"Cotizaciones: {dups} fecha_id duplicados"


class TestDuplicadosCobertura:
    """Verifica que los datos tienen la cobertura esperada (sin datos faltantes sistematicos)."""

    def test_todas_sucursales_en_ventas(self, fact_ventas, sucursal_ids):
        sucursales_con_ventas = set(fact_ventas["sucursal_id"].unique())
        sin_ventas = sucursal_ids - sucursales_con_ventas
        assert len(sin_ventas) == 0, (
            f"Sucursales sin ninguna venta: {sin_ventas}"
        )

    def test_todos_depositos_en_inventario(self, fact_inventario, deposito_ids):
        deps_con_inv = set(fact_inventario["deposito_id"].unique())
        sin_inv = deposito_ids - deps_con_inv
        assert len(sin_inv) == 0, (
            f"Depositos sin registros de inventario: {sin_inv}"
        )

    def test_todos_proveedores_con_compras(self, fact_compras, proveedor_ids):
        provs_con_compras = set(fact_compras["proveedor_id"].unique())
        sin_compras = proveedor_ids - provs_con_compras
        assert len(sin_compras) == 0, (
            f"Proveedores sin ordenes de compra: {sin_compras}"
        )

    def test_cobertura_anual_ventas(self, fact_ventas):
        """Debe haber ventas en todos los años de 2016 a 2026."""
        años = set(fact_ventas["fecha_id"].astype(str).str[:4].astype(int).unique())
        esperados = set(range(2016, 2027))
        faltantes = esperados - años
        assert len(faltantes) == 0, (
            f"Fact_Ventas: anos sin ventas: {faltantes}"
        )

    def test_cobertura_mensual_estacionalidad(self, fact_ventas):
        """Debe haber ventas en los 12 meses."""
        meses = set(fact_ventas["fecha_id"].astype(str).str[4:6].astype(int).unique())
        esperados = set(range(1, 13))
        faltantes = esperados - meses
        assert len(faltantes) == 0, (
            f"Fact_Ventas: meses sin ventas: {faltantes}"
        )

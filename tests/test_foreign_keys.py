"""
test_foreign_keys.py
Verifica integridad referencial entre todas las tablas del star schema.
"""

import pytest


class TestFKFechaId:
    """fecha_id presente en dim_fecha para todas las fact tables."""

    def test_fact_ventas_fecha_id(self, fact_ventas, fecha_ids):
        huerfanos = fact_ventas[~fact_ventas["fecha_id"].isin(fecha_ids)]
        assert len(huerfanos) == 0, (
            f"Fact_Ventas: {len(huerfanos):,} fecha_id sin match en Dim_Fecha"
        )

    def test_fact_compras_fecha_id(self, fact_compras, fecha_ids):
        huerfanos = fact_compras[~fact_compras["fecha_id"].isin(fecha_ids)]
        assert len(huerfanos) == 0, (
            f"Fact_Compras: {len(huerfanos):,} fecha_id sin match en Dim_Fecha"
        )

    def test_fact_inventario_fecha_id(self, fact_inventario, fecha_ids):
        huerfanos = fact_inventario[~fact_inventario["fecha_id"].isin(fecha_ids)]
        assert len(huerfanos) == 0, (
            f"Fact_Inventario: {len(huerfanos):,} fecha_id sin match en Dim_Fecha"
        )

    def test_fact_logistica_fecha_id(self, fact_logistica, fecha_ids):
        col = "fecha_despacho_id"
        huerfanos = fact_logistica[~fact_logistica[col].isin(fecha_ids)]
        assert len(huerfanos) == 0, (
            f"Fact_Logistica: {len(huerfanos):,} fecha_despacho_id sin match en Dim_Fecha"
        )

    def test_cotizaciones_fecha_id(self, cotizaciones, fecha_ids):
        huerfanos = cotizaciones[~cotizaciones["fecha_id"].isin(fecha_ids)]
        assert len(huerfanos) == 0, (
            f"Cotizaciones: {len(huerfanos):,} fecha_id sin match en Dim_Fecha"
        )


class TestFKClienteId:

    def test_fact_ventas_cliente_id(self, fact_ventas, cliente_ids):
        huerfanos = fact_ventas[~fact_ventas["cliente_id"].isin(cliente_ids)]
        assert len(huerfanos) == 0, (
            f"Fact_Ventas: {len(huerfanos):,} cliente_id sin match en Dim_Cliente"
        )

    def test_fact_logistica_cliente_id(self, fact_logistica, cliente_ids):
        huerfanos = fact_logistica[~fact_logistica["cliente_id"].isin(cliente_ids)]
        assert len(huerfanos) == 0, (
            f"Fact_Logistica: {len(huerfanos):,} cliente_id sin match en Dim_Cliente"
        )


class TestFKProductoId:

    def test_fact_ventas_producto_id(self, fact_ventas, producto_ids):
        huerfanos = fact_ventas[~fact_ventas["producto_id"].isin(producto_ids)]
        assert len(huerfanos) == 0, (
            f"Fact_Ventas: {len(huerfanos):,} producto_id sin match en Dim_Producto"
        )

    def test_fact_compras_producto_id(self, fact_compras, producto_ids):
        huerfanos = fact_compras[~fact_compras["producto_id"].isin(producto_ids)]
        assert len(huerfanos) == 0, (
            f"Fact_Compras: {len(huerfanos):,} producto_id sin match en Dim_Producto"
        )

    def test_fact_inventario_producto_id(self, fact_inventario, producto_ids):
        huerfanos = fact_inventario[~fact_inventario["producto_id"].isin(producto_ids)]
        assert len(huerfanos) == 0, (
            f"Fact_Inventario: {len(huerfanos):,} producto_id sin match en Dim_Producto"
        )


class TestFKSucursalId:

    def test_fact_ventas_sucursal_id(self, fact_ventas, sucursal_ids):
        huerfanos = fact_ventas[~fact_ventas["sucursal_id"].isin(sucursal_ids)]
        assert len(huerfanos) == 0, (
            f"Fact_Ventas: {len(huerfanos):,} sucursal_id sin match en Dim_Sucursal"
        )

    def test_dim_cliente_sucursal_id(self, dim_cliente, sucursal_ids):
        validos = dim_cliente[dim_cliente["sucursal_id_asignada"].notna()]
        huerfanos = validos[~validos["sucursal_id_asignada"].isin(sucursal_ids)]
        assert len(huerfanos) == 0, (
            f"Dim_Cliente: {len(huerfanos)} sucursal_id_asignada sin match en Dim_Sucursal"
        )


class TestFKVendedorId:

    def test_fact_ventas_vendedor_id(self, fact_ventas, vendedor_ids):
        huerfanos = fact_ventas[~fact_ventas["vendedor_id"].isin(vendedor_ids)]
        assert len(huerfanos) == 0, (
            f"Fact_Ventas: {len(huerfanos):,} vendedor_id sin match en Dim_Vendedor"
        )


class TestFKDepositoId:

    def test_fact_compras_deposito_id(self, fact_compras, deposito_ids):
        huerfanos = fact_compras[~fact_compras["deposito_destino_id"].isin(deposito_ids)]
        assert len(huerfanos) == 0, (
            f"Fact_Compras: {len(huerfanos):,} deposito_destino_id sin match en Dim_Deposito"
        )

    def test_fact_inventario_deposito_id(self, fact_inventario, deposito_ids):
        huerfanos = fact_inventario[~fact_inventario["deposito_id"].isin(deposito_ids)]
        assert len(huerfanos) == 0, (
            f"Fact_Inventario: {len(huerfanos):,} deposito_id sin match en Dim_Deposito"
        )

    def test_fact_logistica_deposito_id(self, fact_logistica, deposito_ids):
        huerfanos = fact_logistica[~fact_logistica["deposito_origen_id"].isin(deposito_ids)]
        assert len(huerfanos) == 0, (
            f"Fact_Logistica: {len(huerfanos):,} deposito_origen_id sin match en Dim_Deposito"
        )


class TestFKProveedorId:

    def test_fact_compras_proveedor_id(self, fact_compras, proveedor_ids):
        huerfanos = fact_compras[~fact_compras["proveedor_id"].isin(proveedor_ids)]
        assert len(huerfanos) == 0, (
            f"Fact_Compras: {len(huerfanos):,} proveedor_id sin match en Dim_Proveedor"
        )

    def test_dim_producto_proveedor_principal(self, dim_producto, proveedor_ids):
        validos = dim_producto[dim_producto["proveedor_id_principal"].notna()]
        huerfanos = validos[~validos["proveedor_id_principal"].isin(proveedor_ids)]
        assert len(huerfanos) == 0, (
            f"Dim_Producto: {len(huerfanos)} proveedor_id_principal sin match en Dim_Proveedor"
        )


class TestFKRegionId:

    def test_dim_sucursal_region_id(self, dim_sucursal, region_ids):
        huerfanos = dim_sucursal[~dim_sucursal["region_id"].isin(region_ids)]
        assert len(huerfanos) == 0, (
            f"Dim_Sucursal: {len(huerfanos)} region_id sin match en Dim_Region"
        )

    def test_fact_logistica_region_id(self, fact_logistica, region_ids):
        huerfanos = fact_logistica[~fact_logistica["region_destino_id"].isin(region_ids)]
        assert len(huerfanos) == 0, (
            f"Fact_Logistica: {len(huerfanos):,} region_destino_id sin match en Dim_Region"
        )

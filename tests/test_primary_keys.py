"""
test_primary_keys.py
Verifica que cada tabla tenga PK unica, no nula y con el formato correcto.
"""

import pytest
import re


class TestPrimaryKeysDimensiones:

    def test_dim_fecha_pk_unica(self, dim_fecha):
        dups = dim_fecha["fecha_id"].duplicated().sum()
        assert dups == 0, f"Dim_Fecha: {dups} fecha_id duplicados"

    def test_dim_fecha_pk_no_nula(self, dim_fecha):
        nulls = dim_fecha["fecha_id"].isna().sum()
        assert nulls == 0, f"Dim_Fecha: {nulls} fecha_id nulos"

    def test_dim_fecha_pk_formato(self, dim_fecha):
        """fecha_id debe ser YYYYMMDD (8 digitos entre 20160101 y 20261231)."""
        fuera = dim_fecha[
            (dim_fecha["fecha_id"] < 20160101) | (dim_fecha["fecha_id"] > 20261231)
        ]
        assert len(fuera) == 0, f"Dim_Fecha: {len(fuera)} fecha_id fuera del rango 2016-2026"

    def test_dim_region_pk_unica(self, dim_region):
        dups = dim_region["region_id"].duplicated().sum()
        assert dups == 0, f"Dim_Region: {dups} region_id duplicados"

    def test_dim_sucursal_pk_unica(self, dim_sucursal):
        dups = dim_sucursal["sucursal_id"].duplicated().sum()
        assert dups == 0, f"Dim_Sucursal: {dups} sucursal_id duplicados"

    def test_dim_deposito_pk_unica(self, dim_deposito):
        dups = dim_deposito["deposito_id"].duplicated().sum()
        assert dups == 0, f"Dim_Deposito: {dups} deposito_id duplicados"

    def test_dim_vendedor_pk_unica(self, dim_vendedor):
        dups = dim_vendedor["vendedor_id"].duplicated().sum()
        assert dups == 0, f"Dim_Vendedor: {dups} vendedor_id duplicados"

    def test_dim_proveedor_pk_unica(self, dim_proveedor):
        dups = dim_proveedor["proveedor_id"].duplicated().sum()
        assert dups == 0, f"Dim_Proveedor: {dups} proveedor_id duplicados"

    def test_dim_producto_pk_unica(self, dim_producto):
        dups = dim_producto["producto_id"].duplicated().sum()
        assert dups == 0, f"Dim_Producto: {dups} producto_id duplicados"

    def test_dim_producto_pk_formato(self, dim_producto):
        """producto_id debe tener formato P####."""
        patron = re.compile(r"^P\d{4}$")
        invalidos = dim_producto[~dim_producto["producto_id"].str.match(r"^P\d{4}$")]
        assert len(invalidos) == 0, (
            f"Dim_Producto: {len(invalidos)} producto_id con formato invalido"
        )

    def test_dim_cliente_pk_unica(self, dim_cliente):
        dups = dim_cliente["cliente_id"].duplicated().sum()
        assert dups == 0, f"Dim_Cliente: {dups} cliente_id duplicados"

    def test_dim_cliente_pk_formato(self, dim_cliente):
        """cliente_id debe tener formato C#####."""
        invalidos = dim_cliente[~dim_cliente["cliente_id"].str.match(r"^C\d{5}$")]
        assert len(invalidos) == 0, (
            f"Dim_Cliente: {len(invalidos)} cliente_id con formato invalido"
        )

    def test_dim_cliente_conteo(self, dim_cliente):
        assert len(dim_cliente) == 4000, (
            f"Dim_Cliente: se esperan 4.000 clientes, hay {len(dim_cliente)}"
        )

    def test_dim_producto_conteo(self, dim_producto):
        assert len(dim_producto) == 2500, (
            f"Dim_Producto: se esperan 2.500 productos, hay {len(dim_producto)}"
        )

    def test_dim_proveedor_conteo(self, dim_proveedor):
        assert len(dim_proveedor) == 15, (
            f"Dim_Proveedor: se esperan 15 proveedores, hay {len(dim_proveedor)}"
        )


class TestPrimaryKeysFacts:

    def test_fact_ventas_pk_unica(self, fact_ventas):
        dups = fact_ventas["venta_id"].duplicated().sum()
        assert dups == 0, f"Fact_Ventas: {dups} venta_id duplicados"

    def test_fact_ventas_pk_no_nula(self, fact_ventas):
        nulls = fact_ventas["venta_id"].isna().sum()
        assert nulls == 0, f"Fact_Ventas: {nulls} venta_id nulos"

    def test_fact_ventas_pk_secuencial(self, fact_ventas):
        """venta_id debe ser secuencial de 1 a N."""
        ids = fact_ventas["venta_id"].sort_values().reset_index(drop=True)
        assert ids.iloc[0] == 1, "Fact_Ventas: venta_id no comienza en 1"
        assert ids.iloc[-1] == len(fact_ventas), (
            f"Fact_Ventas: venta_id max={ids.iloc[-1]}, esperado={len(fact_ventas)}"
        )

    def test_fact_ventas_conteo(self, fact_ventas):
        assert len(fact_ventas) == 1_500_000, (
            f"Fact_Ventas: se esperan 1.500.000 filas, hay {len(fact_ventas):,}"
        )

    def test_fact_compras_pk_unica(self, fact_compras):
        dups = fact_compras["compra_id"].duplicated().sum()
        assert dups == 0, f"Fact_Compras: {dups} compra_id duplicados"

    def test_fact_inventario_pk_unica(self, fact_inventario):
        dups = fact_inventario["inventario_id"].duplicated().sum()
        assert dups == 0, f"Fact_Inventario: {dups} inventario_id duplicados"

    def test_fact_inventario_uk_compuesta(self, fact_inventario):
        """Combinacion (fecha_id, producto_id, deposito_id) debe ser unica."""
        dups = fact_inventario.duplicated(
            subset=["fecha_id", "producto_id", "deposito_id"]
        ).sum()
        assert dups == 0, (
            f"Fact_Inventario: {dups} combinaciones (fecha, producto, deposito) duplicadas"
        )

    def test_fact_logistica_pk_unica(self, fact_logistica):
        dups = fact_logistica["logistica_id"].duplicated().sum()
        assert dups == 0, f"Fact_Logistica: {dups} logistica_id duplicados"

    def test_cotizaciones_pk_unica(self, cotizaciones):
        dups = cotizaciones["fecha"].duplicated().sum()
        assert dups == 0, f"Cotizaciones: {dups} fechas duplicadas"

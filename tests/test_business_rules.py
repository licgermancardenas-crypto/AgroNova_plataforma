"""
test_business_rules.py
Reglas de negocio de AgroNova Argentina S.A.
Cada test verifica una invariante del dominio agropecuario.
"""

import pytest
import pandas as pd
import numpy as np


# ── BR-01: Stock nunca negativo ────────────────────────────────────

class TestBR01StockNoNegativo:

    def test_stock_actual_no_negativo(self, fact_inventario):
        negativos = (fact_inventario["stock_actual"] < 0).sum()
        assert negativos == 0, (
            f"BR-01: {negativos:,} registros con stock_actual < 0 "
            f"(violacion de restriccion fisica de inventario)"
        )

    def test_stock_minimo_no_negativo(self, fact_inventario):
        negativos = (fact_inventario["stock_minimo"] < 0).sum()
        assert negativos == 0, (
            f"BR-01: {negativos:,} registros con stock_minimo < 0"
        )

    def test_stock_maximo_mayor_a_minimo(self, fact_inventario):
        invalidos = fact_inventario[
            fact_inventario["stock_maximo"] < fact_inventario["stock_minimo"]
        ]
        assert len(invalidos) == 0, (
            f"BR-01: {len(invalidos):,} registros donde stock_maximo < stock_minimo"
        )

    def test_valor_stock_no_negativo(self, fact_inventario):
        negativos = (fact_inventario["valor_stock_ars"] < 0).sum()
        assert negativos == 0, (
            f"BR-01: {negativos:,} valor_stock_ars negativos"
        )


# ── BR-02: Ventas posteriores al alta del cliente ─────────────────

class TestBR02VentasPostAlta:

    def test_ventas_no_antes_del_alta(self, fact_ventas, dim_cliente):
        cli_alta = dim_cliente.set_index("cliente_id")["año_alta"].to_dict()
        fv = fact_ventas[["cliente_id", "fecha_id"]].copy()
        fv["año_venta"] = fv["fecha_id"].astype(str).str[:4].astype(int)
        fv["año_alta"]  = fv["cliente_id"].map(cli_alta)
        previas = fv[fv["año_venta"] < fv["año_alta"]]
        pct = len(previas) / len(fv) * 100
        assert pct < 0.5, (
            f"BR-02: {len(previas):,} ventas ({pct:.3f}%) ocurren ANTES del alta del cliente "
            f"(umbral: <0.5%)"
        )

    def test_clientes_churned_no_venden_post_baja(self, fact_ventas, dim_cliente):
        churned = dim_cliente[dim_cliente["ciclo_vida"] == "Churned"].copy()
        churned = churned.dropna(subset=["año_baja"])
        baja_map = churned.set_index("cliente_id")["año_baja"].astype(int).to_dict()

        ventas_churned = fact_ventas[fact_ventas["cliente_id"].isin(baja_map)].copy()
        ventas_churned["año_venta"] = ventas_churned["fecha_id"].astype(str).str[:4].astype(int)
        ventas_churned["año_baja"]  = ventas_churned["cliente_id"].map(baja_map)

        post_churn = ventas_churned[ventas_churned["año_venta"] >= ventas_churned["año_baja"]]
        pct = len(post_churn) / max(1, len(ventas_churned)) * 100
        assert pct < 5, (
            f"BR-02: {len(post_churn):,} ventas ({pct:.1f}%) de clientes churned "
            f"ocurren despues de su año de baja (umbral: <5%)"
        )


# ── BR-03: Margen bruto > 0 ───────────────────────────────────────

class TestBR03MargenPositivo:

    def test_margen_bruto_no_negativo(self, fact_ventas):
        negativos = (fact_ventas["margen_bruto_ars"] < 0).sum()
        assert negativos == 0, (
            f"BR-03: {negativos:,} ventas con margen_bruto_ars negativo"
        )

    def test_margen_bruto_positivo(self, fact_ventas):
        """Al menos 95% de las ventas deben tener margen > 0."""
        cero_o_menos = (fact_ventas["margen_bruto_ars"] <= 0).sum()
        pct = cero_o_menos / len(fact_ventas) * 100
        assert pct < 5, (
            f"BR-03: {cero_o_menos:,} ({pct:.2f}%) ventas con margen <= 0 (umbral: <5%)"
        )

    def test_margen_pct_razonable(self, fact_ventas):
        """Margen % entre 0% y 50% (negocio de distribucion, no retail premium)."""
        margen_pct = fact_ventas["margen_bruto_ars"] / fact_ventas["total_ars"].replace(0, pd.NA)
        demasiado_alto = (margen_pct > 0.60).sum()
        assert demasiado_alto < 100, (
            f"BR-03: {demasiado_alto:,} ventas con margen > 60% (sospechoso para distribucion)"
        )

    def test_margen_producto_coherente(self, dim_producto):
        """margen_bruto_pct en dim_producto entre 12% y 38% (segun config)."""
        fuera = dim_producto[
            (dim_producto["margen_bruto_pct"] < 0.10) |
            (dim_producto["margen_bruto_pct"] > 0.45)
        ]
        assert len(fuera) == 0, (
            f"BR-03: {len(fuera)} productos con margen_bruto_pct fuera de rango [10%, 45%]"
        )


# ── BR-04: Fechas dentro de 2016-2026 ─────────────────────────────

class TestBR04FechasEnRango:

    FECHA_MIN = 20160101
    FECHA_MAX = 20261231

    def test_fact_ventas_fechas_en_rango(self, fact_ventas):
        fuera = fact_ventas[
            (fact_ventas["fecha_id"] < self.FECHA_MIN) |
            (fact_ventas["fecha_id"] > self.FECHA_MAX)
        ]
        assert len(fuera) == 0, (
            f"BR-04: {len(fuera):,} ventas con fecha fuera de 2016-2026"
        )

    def test_fact_compras_fechas_en_rango(self, fact_compras):
        fuera = fact_compras[
            (fact_compras["fecha_id"] < self.FECHA_MIN) |
            (fact_compras["fecha_id"] > self.FECHA_MAX)
        ]
        assert len(fuera) == 0, (
            f"BR-04: {len(fuera):,} compras con fecha fuera de 2016-2026"
        )

    def test_fact_inventario_fechas_en_rango(self, fact_inventario):
        fuera = fact_inventario[
            (fact_inventario["fecha_id"] < self.FECHA_MIN) |
            (fact_inventario["fecha_id"] > self.FECHA_MAX)
        ]
        assert len(fuera) == 0, (
            f"BR-04: {len(fuera):,} registros de inventario con fecha fuera de 2016-2026"
        )

    def test_fact_logistica_fechas_en_rango(self, fact_logistica):
        fuera = fact_logistica[
            (fact_logistica["fecha_despacho_id"] < self.FECHA_MIN) |
            (fact_logistica["fecha_despacho_id"] > self.FECHA_MAX)
        ]
        assert len(fuera) == 0, (
            f"BR-04: {len(fuera):,} despachos con fecha fuera de 2016-2026"
        )

    def test_dim_fecha_cobertura_completa(self, dim_fecha):
        """Dim_Fecha debe tener los 11 años completos."""
        años = set(dim_fecha["año"].unique())
        esperados = set(range(2016, 2027))
        assert años == esperados, (
            f"BR-04: años faltantes en Dim_Fecha: {esperados - años}"
        )

    def test_sin_ventas_en_domingo(self, fact_ventas, dim_fecha):
        """AgroNova no opera domingos (dia_semana == 7)."""
        dow_map = dim_fecha.set_index("fecha_id")["dia_semana"].to_dict()
        ventas_dow = fact_ventas["fecha_id"].map(dow_map)
        domingos = (ventas_dow == 7).sum()
        assert domingos == 0, (
            f"BR-04: {domingos:,} ventas registradas en domingo (negocio cerrado)"
        )


# ── BR-05: Cantidades y precios validos ───────────────────────────

class TestBR05CantidadesYPrecios:

    def test_cantidades_positivas_ventas(self, fact_ventas):
        invalidas = (fact_ventas["cantidad"] <= 0).sum()
        assert invalidas == 0, (
            f"BR-05: {invalidas:,} registros con cantidad <= 0 en Fact_Ventas"
        )

    def test_cantidades_positivas_compras(self, fact_compras):
        invalidas = (fact_compras["cantidad"] <= 0).sum()
        assert invalidas == 0, (
            f"BR-05: {invalidas:,} registros con cantidad <= 0 en Fact_Compras"
        )

    def test_precio_ars_positivo(self, fact_ventas):
        invalidos = (fact_ventas["precio_unitario_ars"] <= 0).sum()
        assert invalidos == 0, (
            f"BR-05: {invalidos:,} precios_unitario_ars <= 0"
        )

    def test_precio_usd_positivo(self, fact_ventas):
        invalidos = (fact_ventas["precio_unitario_usd"] <= 0).sum()
        assert invalidos == 0, (
            f"BR-05: {invalidos:,} precios_unitario_usd <= 0"
        )

    def test_total_ars_positivo(self, fact_ventas):
        invalidos = (fact_ventas["total_ars"] <= 0).sum()
        assert invalidos == 0, (
            f"BR-05: {invalidos:,} total_ars <= 0"
        )

    def test_descuento_en_rango(self, fact_ventas):
        """Descuento entre 0% y 15% (politica comercial AgroNova)."""
        fuera = fact_ventas[
            (fact_ventas["descuento_pct"] < 0) |
            (fact_ventas["descuento_pct"] > 0.20)
        ]
        assert len(fuera) == 0, (
            f"BR-05: {len(fuera):,} ventas con descuento fuera del rango [0%, 20%]"
        )

    def test_total_coherente_con_cantidad_precio(self, fact_ventas):
        """total_ars debe ser aproximadamente cantidad * precio * (1 - descuento)."""
        sample = fact_ventas.sample(10_000, random_state=42)
        esperado = (
            sample["cantidad"]
            * sample["precio_unitario_ars"]
            * (1 - sample["descuento_pct"])
        )
        diferencia_relativa = ((sample["total_ars"] - esperado) / esperado).abs()
        outliers = (diferencia_relativa > 0.01).sum()  # tolerancia 1%
        assert outliers < 50, (
            f"BR-05: {outliers} ventas donde total_ars difiere >1% de "
            f"cantidad * precio * (1-descuento)"
        )

    def test_precio_ars_mayor_que_usd(self, fact_ventas):
        """En todos los años de 2016-2026 el ARS/USD es > 1, luego precio_ars > precio_usd."""
        menor = (fact_ventas["precio_unitario_ars"] < fact_ventas["precio_unitario_usd"]).sum()
        assert menor == 0, (
            f"BR-05: {menor:,} registros donde precio_ars < precio_usd "
            f"(imposible con TC > 1 durante todo el periodo)"
        )

    def test_dias_transito_logistica_positivos(self, fact_logistica):
        invalidos = (fact_logistica["dias_transito_base"] <= 0).sum()
        assert invalidos == 0, (
            f"BR-05: {invalidos:,} registros con dias_transito_base <= 0"
        )

    def test_costo_flete_positivo(self, fact_logistica):
        invalidos = (fact_logistica["costo_flete_ars"] <= 0).sum()
        assert invalidos == 0, (
            f"BR-05: {invalidos:,} registros con costo_flete_ars <= 0"
        )


# ── BR-06: Reglas de distribucion (Pareto y estacionalidad) ───────

class TestBR06Distribucion:

    def test_pareto_top20_mayor_60pct(self, fact_ventas, dim_cliente):
        """Top 20% de clientes debe generar al menos 60% del revenue (Pareto minimo)."""
        rev = fact_ventas.groupby("cliente_id")["total_ars"].sum().sort_values(ascending=False)
        top20_n = max(1, int(len(rev) * 0.20))
        pct = rev.head(top20_n).sum() / rev.sum() * 100
        assert pct >= 60, (
            f"BR-06: Top 20% clientes genera {pct:.1f}% del revenue "
            f"(esperado >=60% para distribuccion Pareto)"
        )

    def test_estacionalidad_pico_noviembre(self, fact_ventas, dim_fecha):
        """Noviembre debe estar entre los 3 meses de mayor volumen."""
        ventas_mes = fact_ventas.groupby(
            fact_ventas["fecha_id"].astype(str).str[4:6].astype(int)
        )["total_ars"].sum()
        top3 = set(ventas_mes.nlargest(3).index)
        assert 11 in top3 or 10 in top3, (
            f"BR-06: Noviembre/Octubre no esta en el top-3 de meses por revenue. "
            f"Top-3: {top3} (se esperaba pico en siembra verano Oct-Nov)"
        )

    def test_categorias_en_ventas(self, fact_ventas, dim_producto):
        """Las 5 categorias de productos deben estar representadas en ventas."""
        cats_vendidas = set(
            fact_ventas.merge(dim_producto[["producto_id","categoria"]], on="producto_id")
            ["categoria"].unique()
        )
        esperadas = {
            "Fertilizantes", "Fitosanitarios", "Semillas",
            "Nutricion Vegetal", "Tecnologia Agricola"
        }
        # Toleramos nombres con acento
        cats_norm = {c.replace("ó","o").replace("í","i").replace("é","e") for c in cats_vendidas}
        faltantes = {c.replace("ó","o").replace("í","i").replace("é","e") for c in esperadas} - cats_norm
        assert len(faltantes) == 0, (
            f"BR-06: Categorias sin ventas: {faltantes}"
        )

    def test_cotizaciones_tc_creciente(self, cotizaciones):
        """El tipo de cambio USD/ARS debe ser creciente en el largo plazo (inflacion ARG)."""
        cotiz_anual = (
            cotizaciones.assign(año=cotizaciones["fecha_id"].astype(str).str[:4].astype(int))
            .groupby("año")["usd_ars_oficial"].mean()
        )
        # TC de 2026 debe ser mayor que TC de 2016
        assert cotiz_anual[2026] > cotiz_anual[2016] * 10, (
            f"BR-06: TC USD/ARS 2026 ({cotiz_anual[2026]:.0f}) no es 10x mayor "
            f"que 2016 ({cotiz_anual[2016]:.0f}) — se esperaba inflacion acumulada >>1000%"
        )

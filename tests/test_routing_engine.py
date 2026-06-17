"""
test_routing_engine.py
Cobertura de Sprint GIS-06 (Routing & Logistics Optimization Engine):
gis/cost_model.py, gis/fleet_simulation.py, gis/routing_engine.py.

Misma filosofia que test_postgis_spatial.py: corre contra los datos reales
del Data Warehouse (CSV), sin mocks, validando rangos/consistencia en vez de
valores fijos (las salidas dependen de datos reales que ya estan calibrados,
no de fixtures sinteticas).
"""

import pytest

from gis.cost_model import (
    AVG_SPEED_KMH,
    avg_peso_kg_envio,
    cost_per_kg_ars,
    cost_per_km_ars,
    envios_promedio_cliente_anio,
    estimate_transport,
    route_risk,
    transport_costs_by_route,
)
from gis.fleet_simulation import (
    TRUCK_CAPACITY_KG,
    VIAJES_POR_CAMION_DIA,
    depot_load,
    simulate_fleet_by_deposito,
)
from gis.routing_engine import (
    EXPANSION_PROVINCES,
    cliente_routing_assignment,
    simulate_expansion,
)


class TestCostModel:

    def test_cost_per_kg_en_rango_realista(self):
        v = cost_per_kg_ars()
        assert 5.0 < v < 50.0

    def test_cost_per_km_en_rango_realista(self):
        v = cost_per_km_ars()
        assert 5.0 < v < 200.0

    def test_avg_peso_kg_envio_positivo(self):
        assert avg_peso_kg_envio() > 0

    def test_envios_promedio_cliente_anio_positivo(self):
        v = envios_promedio_cliente_anio()
        assert 0 < v < 50

    def test_estimate_transport_escala_con_distancia(self):
        cerca = estimate_transport(10.0)
        lejos = estimate_transport(1000.0)
        assert lejos["tiempo_estimado_horas"] > cerca["tiempo_estimado_horas"]
        assert lejos["tiempo_estimado_horas"] == pytest.approx(1000.0 / AVG_SPEED_KMH, abs=0.1)

    def test_estimate_transport_costo_escala_con_peso(self):
        liviano = estimate_transport(100.0, peso_kg=10.0)
        pesado = estimate_transport(100.0, peso_kg=1000.0)
        assert pesado["costo_estimado_ars"] > liviano["costo_estimado_ars"]


class TestTransportCostsByRoute:

    @pytest.fixture(scope="class")
    def data(self):
        return transport_costs_by_route()

    def test_estructura_top_level(self, data):
        assert {"cost_per_kg_ars", "avg_speed_kmh", "by_sucursal", "by_deposito"} <= data.keys()

    def test_by_sucursal_no_vacio(self, data):
        assert len(data["by_sucursal"]) == 5

    def test_by_deposito_no_vacio(self, data):
        assert len(data["by_deposito"]) == 3

    def test_costos_no_negativos(self, data):
        for row in data["by_sucursal"] + data["by_deposito"]:
            assert row["costo_estimado_ars"] >= 0
            assert row["tiempo_estimado_horas"] >= 0


class TestRouteRisk:

    @pytest.fixture(scope="class")
    def data(self):
        return route_risk()

    def test_by_deposito_tiene_3_depositos(self, data):
        assert len(data["by_deposito"]) == 3

    def test_by_tipo_envio_no_vacio(self, data):
        assert len(data["by_tipo_envio"]) > 0

    def test_porcentajes_suman_cerca_de_100(self, data):
        for row in data["by_deposito"]:
            total = (
                row["pct_demorado"] + row["pct_devuelto"]
                + row["pct_entregado"] + row["pct_en_transito"]
            )
            assert total == pytest.approx(100.0, abs=0.5)

    def test_risk_level_asignado_a_todos(self, data):
        for row in data["by_deposito"] + data["by_tipo_envio"]:
            assert row["risk_level"] in {"Alto", "Medio", "Bajo"}

    def test_incidencia_score_no_negativa(self, data):
        for row in data["by_deposito"] + data["by_tipo_envio"]:
            assert row["incidencia_score"] >= 0


class TestFleetSimulation:

    @pytest.fixture(scope="class")
    def fleet(self):
        return simulate_fleet_by_deposito()

    def test_un_registro_por_deposito(self, fleet):
        assert len(fleet) == 3

    def test_camiones_necesarios_positivo(self, fleet):
        for row in fleet:
            assert row["camiones_necesarios"] >= 1

    def test_utilizacion_no_excede_100_de_forma_grosera(self, fleet):
        # camiones_necesarios se redondea hacia arriba (ceil), asi que la
        # utilizacion real queda <= 100% salvo redondeo de centavos.
        for row in fleet:
            assert row["utilizacion_pct"] <= 100.01

    def test_constantes_documentadas_son_positivas(self):
        assert TRUCK_CAPACITY_KG > 0
        assert VIAJES_POR_CAMION_DIA > 0


class TestDepotLoad:

    @pytest.fixture(scope="class")
    def data(self):
        return depot_load()

    def test_3_depositos(self, data):
        assert len(data["by_deposito"]) == 3

    def test_estado_carga_asignado(self, data):
        for row in data["by_deposito"]:
            assert row["estado_carga"] in {
                "Saturado (relativo)", "Subutilizado (relativo)", "Equilibrado",
            }

    def test_exactamente_un_saturado_y_un_subutilizado(self, data):
        estados = [r["estado_carga"] for r in data["by_deposito"]]
        assert estados.count("Saturado (relativo)") == 1
        assert estados.count("Subutilizado (relativo)") == 1


class TestClienteRoutingAssignment:

    @pytest.fixture(scope="class")
    def data(self):
        return cliente_routing_assignment()

    def test_estructura_top_level(self, data):
        assert {"by_sucursal", "by_deposito", "by_provincia"} <= data.keys()

    def test_by_provincia_cubre_las_5_activas(self, data):
        assert len(data["by_provincia"]) == 5

    def test_tiempos_estimados_no_negativos(self, data):
        for row in data["by_provincia"]:
            assert row["tiempo_sucursal_horas"] >= 0
            assert row["tiempo_deposito_horas"] >= 0

    def test_by_sucursal_tiene_tiempo_estimado(self, data):
        for row in data["by_sucursal"]:
            assert "tiempo_estimado_horas" in row


class TestSimulateExpansion:

    @pytest.fixture(scope="class")
    def rows(self):
        return simulate_expansion()

    def test_cubre_las_4_provincias_del_sprint(self, rows):
        provincias = {r["provincia"] for r in rows}
        assert provincias == set(EXPANSION_PROVINCES)

    def test_ciudad_candidata_correcta_para_chaco(self, rows):
        chaco = next(r for r in rows if r["provincia"] == "Chaco")
        assert chaco["ciudad_candidata"] == "Resistencia"

    def test_ahorro_km_no_negativo(self, rows):
        for r in rows:
            assert r["ahorro_km"] >= 0

    def test_mejora_proximidad_pts_en_rango_0_25(self, rows):
        for r in rows:
            assert 0.0 <= r["mejora_proximidad_pts"] <= 25.0

    def test_nuevos_clientes_potenciales_no_negativo(self, rows):
        for r in rows:
            assert r["nuevos_clientes_potenciales"] >= 0

    def test_ordenado_por_reduccion_costos_descendente(self, rows):
        costos = [r["reduccion_costos_ars_anual"] for r in rows]
        assert costos == sorted(costos, reverse=True)

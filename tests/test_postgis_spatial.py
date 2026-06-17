"""
test_postgis_spatial.py
Verifica las GeoDataFrames que gis/postgis_loader.py sincronizaria contra
spatial_sucursales/spatial_depositos/spatial_clientes/spatial_provincias
(Sprint GIS-05). No requiere una instancia PostGIS real: corre contra las
mismas GeoDataFrames en proceso, validando lo que SE INSERTARIA antes de
que exista una base donde insertarlo.

Cobertura pedida: geometrias validas, SRID consistente, nulos, duplicados.
"""

import pytest

from gis.geodataframes import CRS_PROJECTED, CRS_WGS84
from gis.postgis_loader import (
    clientes_table_gdf,
    depositos_table_gdf,
    provincias_table_gdf,
    sucursales_table_gdf,
)

TABLES = {
    "spatial_sucursales": (sucursales_table_gdf, "sucursal_id"),
    "spatial_depositos":  (depositos_table_gdf, "deposito_id"),
    "spatial_clientes":   (clientes_table_gdf, "cliente_id"),
    "spatial_provincias": (provincias_table_gdf, "provincia_id"),
}


@pytest.fixture(scope="module", params=list(TABLES.items()), ids=list(TABLES.keys()))
def spatial_table(request):
    table_name, (builder, pk) = request.param
    return table_name, pk, builder()


class TestGeometriasValidas:

    def test_sin_geometrias_vacias_o_nulas(self, spatial_table):
        table_name, _, gdf = spatial_table
        vacias = gdf.geometry.is_empty.sum()
        nulas = gdf.geometry.isna().sum()
        assert vacias == 0, f"{table_name}: {vacias} geometrias vacias"
        assert nulas == 0, f"{table_name}: {nulas} geometrias nulas"

    def test_geometrias_validas_segun_shapely(self, spatial_table):
        table_name, _, gdf = spatial_table
        invalidas = (~gdf.geometry.is_valid).sum()
        assert invalidas == 0, f"{table_name}: {invalidas} geometrias invalidas (is_valid=False)"

    def test_tipo_de_geometria_esperado(self, spatial_table):
        """Points para sucursales/depositos/clientes, MultiPolygon para provincias."""
        table_name, _, gdf = spatial_table
        tipos = set(gdf.geometry.geom_type.unique())
        if table_name == "spatial_provincias":
            assert tipos == {"MultiPolygon"}, f"{table_name}: tipos inesperados {tipos}"
        else:
            assert tipos == {"Point"}, f"{table_name}: tipos inesperados {tipos}"

    def test_coordenadas_dentro_de_argentina_continental(self, spatial_table):
        """Bbox laxo: todas las geometrias deben caer dentro del continente (sin la Antartida)."""
        table_name, _, gdf = spatial_table
        minx, miny, maxx, maxy = gdf.total_bounds
        assert miny >= -56, f"{table_name}: latitud minima {miny} fuera de rango continental"
        assert maxy <= -20, f"{table_name}: latitud maxima {maxy} fuera de rango continental"
        assert minx >= -75, f"{table_name}: longitud minima {minx} fuera de rango continental"
        assert maxx <= -52, f"{table_name}: longitud maxima {maxx} fuera de rango continental"


class TestSRIDConsistente:

    def test_crs_es_wgs84(self, spatial_table):
        """Las 4 tablas se cargan en EPSG:4326 — coincide con geometry(..., 4326) en
        database/postgis/02_spatial_tables.sql."""
        table_name, _, gdf = spatial_table
        assert gdf.crs is not None, f"{table_name}: CRS no seteado"
        assert gdf.crs.to_string() == CRS_WGS84, (
            f"{table_name}: CRS {gdf.crs} != esperado {CRS_WGS84}"
        )

    def test_latitud_longitud_coherentes_con_geometry(self, spatial_table):
        """Las columnas latitud/longitud deben coincidir con la geometria (o su
        centroide, para poligonos) dentro de una tolerancia chica."""
        table_name, _, gdf = spatial_table
        if (gdf.geometry.geom_type == "Point").all():
            lon_geom = gdf.geometry.x
            lat_geom = gdf.geometry.y
        else:
            # postgis_loader computes centroids in CRS_PROJECTED (metric) and
            # reprojects back — must match that here, a centroid taken
            # directly in degrees skews with latitude and won't agree.
            centroids = gdf.geometry.to_crs(CRS_PROJECTED).centroid.to_crs(CRS_WGS84)
            lon_geom = centroids.x
            lat_geom = centroids.y
        assert (gdf["longitud"] - lon_geom).abs().max() < 1e-6, (
            f"{table_name}: columna longitud desincronizada de la geometria"
        )
        assert (gdf["latitud"] - lat_geom).abs().max() < 1e-6, (
            f"{table_name}: columna latitud desincronizada de la geometria"
        )


class TestRegistrosNulos:

    def test_sin_nulos_en_columnas_clave(self, spatial_table):
        table_name, pk, gdf = spatial_table
        columnas_clave = [c for c in gdf.columns if c != "geometry"]
        for col in columnas_clave:
            nulls = gdf[col].isna().sum()
            assert nulls == 0, f"{table_name}.{col}: {nulls} valores nulos"

    def test_latitud_longitud_en_rango_valido(self, spatial_table):
        table_name, _, gdf = spatial_table
        assert gdf["latitud"].between(-90, 90).all(), f"{table_name}: latitud fuera de [-90,90]"
        assert gdf["longitud"].between(-180, 180).all(), f"{table_name}: longitud fuera de [-180,180]"


class TestDuplicados:

    def test_sin_pk_duplicada(self, spatial_table):
        table_name, pk, gdf = spatial_table
        dups = gdf[pk].duplicated().sum()
        assert dups == 0, f"{table_name}.{pk}: {dups} valores duplicados"

    def test_sin_geometrias_duplicadas_punto(self, spatial_table):
        """Solo aplica a tablas Point — clientes APILA puntos a proposito (centroide
        de provincia, ver geodataframes.clientes_gdf), asi que se excluye."""
        table_name, _, gdf = spatial_table
        if table_name == "spatial_clientes":
            pytest.skip("spatial_clientes apila puntos por diseno (centroide de provincia)")
        if (gdf.geometry.geom_type != "Point").any():
            pytest.skip(f"{table_name}: no es una tabla de puntos")
        wkt_dups = gdf.geometry.apply(lambda g: g.wkt).duplicated().sum()
        assert wkt_dups == 0, f"{table_name}: {wkt_dups} geometrias Point duplicadas"


class TestEsquemaParaCarga:
    """Confirma que las columnas que postgis_loader.py va a escribir coinciden
    con las definidas en database/postgis/02_spatial_tables.sql."""

    EXPECTED_COLUMNS = {
        "spatial_sucursales": {"sucursal_id", "nombre", "provincia", "latitud", "longitud", "geometry"},
        "spatial_depositos":  {"deposito_id", "nombre", "sucursal_id", "latitud", "longitud", "geometry"},
        "spatial_clientes":   {"cliente_id", "provincia", "latitud", "longitud", "geometry"},
        "spatial_provincias": {"provincia_id", "nombre", "macro_region", "latitud", "longitud", "geometry"},
    }

    def test_columnas_coinciden_con_el_esquema_sql(self, spatial_table):
        table_name, _, gdf = spatial_table
        assert set(gdf.columns) == self.EXPECTED_COLUMNS[table_name], (
            f"{table_name}: columnas {set(gdf.columns)} != esperadas {self.EXPECTED_COLUMNS[table_name]}"
        )

    def test_conteo_de_filas_esperado(self, spatial_table):
        table_name, _, gdf = spatial_table
        esperado = {
            "spatial_sucursales": 5,
            "spatial_depositos": 3,
            "spatial_clientes": 4000,
            "spatial_provincias": 24,
        }[table_name]
        assert len(gdf) == esperado, f"{table_name}: {len(gdf)} filas, esperaba {esperado}"

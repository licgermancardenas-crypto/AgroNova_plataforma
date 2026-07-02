import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()
eng = create_engine(os.environ["DATABASE_URL"])

with eng.connect() as c:
    # v_clientes_rfm columns
    r = c.execute(text(
        "SELECT column_name, data_type FROM information_schema.columns "
        "WHERE table_schema='agronova' AND table_name='v_clientes_rfm' ORDER BY ordinal_position"
    ))
    print("=== v_clientes_rfm columns ===")
    cols = []
    for row in r:
        print(f"  {row[0]}: {row[1]}")
        cols.append(row[0])

    row1 = c.execute(text("SELECT * FROM agronova.v_clientes_rfm LIMIT 2")).all()
    for r in row1:
        print(" ", dict(zip(cols, r)))

    # v_kpi_ejecutivo
    r2 = c.execute(text(
        "SELECT column_name, data_type FROM information_schema.columns "
        "WHERE table_schema='agronova' AND table_name='v_kpi_ejecutivo' ORDER BY ordinal_position"
    ))
    print("\n=== v_kpi_ejecutivo columns ===")
    cols2 = []
    for row in r2:
        print(f"  {row[0]}: {row[1]}")
        cols2.append(row[0])

    # dim_cliente total count
    total = c.execute(text("SELECT COUNT(*) FROM agronova.dim_cliente")).scalar()
    active = c.execute(text("SELECT COUNT(*) FROM agronova.dim_cliente WHERE activo=true")).scalar()
    print(f"\n=== dim_cliente total: {total}, active: {active} ===")

    # Provinces in dim_cliente
    r3 = c.execute(text(
        "SELECT provincia, COUNT(*) as n FROM agronova.dim_cliente WHERE activo=true "
        "GROUP BY provincia ORDER BY n DESC LIMIT 10"
    ))
    print("\n=== top provinces ===")
    for row in r3:
        print(f"  {row[0]}: {row[1]}")

    # Segmentos
    r4 = c.execute(text(
        "SELECT segmento, COUNT(*) as n FROM agronova.dim_cliente WHERE activo=true "
        "GROUP BY segmento ORDER BY n DESC"
    ))
    print("\n=== segmentos ===")
    for row in r4:
        print(f"  {row[0]}: {row[1]}")

    # Revenue per client from fact_ventas
    r5 = c.execute(text(
        "SELECT c.cliente_id, c.razon_social, c.provincia, c.ciudad, "
        "SUM(v.total_ars) as revenue_ars, AVG(v.margen_bruto_ars/NULLIF(v.total_ars,0))*100 as margen_pct, "
        "COUNT(v.venta_id) as n_ventas, MAX(f.fecha) as ultima_compra "
        "FROM agronova.dim_cliente c "
        "LEFT JOIN agronova.fact_ventas v ON c.cliente_id = v.cliente_id "
        "LEFT JOIN agronova.dim_fecha f ON v.fecha_id = f.fecha_id "
        "WHERE c.activo=true "
        "GROUP BY c.cliente_id, c.razon_social, c.provincia, c.ciudad "
        "LIMIT 3"
    ))
    print("\n=== sample client with revenue ===")
    cols5 = [d[0] for d in r5.cursor.description]
    for row in r5:
        print(" ", dict(zip(cols5, row)))

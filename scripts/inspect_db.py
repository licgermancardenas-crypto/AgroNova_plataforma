import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()
eng = create_engine(os.environ["DATABASE_URL"])

with eng.connect() as c:
    # spatial_clientes columns
    r = c.execute(text(
        "SELECT column_name, data_type FROM information_schema.columns "
        "WHERE table_schema='agronova' AND table_name='spatial_clientes' ORDER BY ordinal_position"
    ))
    print("=== spatial_clientes columns ===")
    cols = []
    for row in r:
        print(f"  {row[0]}: {row[1]}")
        cols.append(row[0])

    cnt = c.execute(text("SELECT COUNT(*) FROM agronova.spatial_clientes")).scalar()
    print(f"  total rows: {cnt}")

    row1 = c.execute(text("SELECT * FROM agronova.spatial_clientes LIMIT 1")).one()
    print("  sample row:", dict(zip(cols, row1)))

    # dim_cliente columns
    r2 = c.execute(text(
        "SELECT column_name, data_type FROM information_schema.columns "
        "WHERE table_schema='agronova' AND table_name='dim_cliente' ORDER BY ordinal_position"
    ))
    print("\n=== dim_cliente columns ===")
    for row in r2:
        print(f"  {row[0]}: {row[1]}")

    # Check views
    r3 = c.execute(text(
        "SELECT table_name FROM information_schema.views WHERE table_schema='agronova'"
    ))
    print("\n=== views ===")
    for row in r3:
        print(f"  {row[0]}")

    # Check if fact_ventas has churn/otif
    r4 = c.execute(text(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_schema='agronova' AND table_name='fact_ventas' ORDER BY ordinal_position"
    ))
    print("\n=== fact_ventas columns ===")
    for row in r4:
        print(f"  {row[0]}")

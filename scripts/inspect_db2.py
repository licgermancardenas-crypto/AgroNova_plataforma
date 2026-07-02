import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()
eng = create_engine(os.environ["DATABASE_URL"])

with eng.connect() as c:
    # All tables in agronova schema
    r = c.execute(text(
        "SELECT table_name FROM information_schema.tables "
        "WHERE table_schema='agronova' ORDER BY table_name"
    ))
    print("=== tables in agronova ===")
    for row in r:
        print(f"  {row[0]}")

    # All views
    r2 = c.execute(text(
        "SELECT table_name FROM information_schema.views WHERE table_schema='agronova'"
    ))
    print("\n=== views ===")
    for row in r2:
        print(f"  {row[0]}")

    # dim_cliente sample + count
    cnt = c.execute(text("SELECT COUNT(*) FROM agronova.dim_cliente WHERE activo = true")).scalar()
    print(f"\n=== dim_cliente active rows: {cnt} ===")

    r3 = c.execute(text(
        "SELECT column_name, data_type FROM information_schema.columns "
        "WHERE table_schema='agronova' AND table_name='dim_cliente' ORDER BY ordinal_position"
    ))
    print("columns:")
    cols = []
    for row in r3:
        print(f"  {row[0]}: {row[1]}")
        cols.append(row[0])

    row1 = c.execute(text("SELECT * FROM agronova.dim_cliente LIMIT 1")).one()
    print("sample:", dict(zip(cols, row1)))

    # Check dim_sucursal
    r4 = c.execute(text("SELECT * FROM agronova.dim_sucursal LIMIT 3"))
    print("\n=== dim_sucursal sample ===")
    cols_s = [d[0] for d in r4.cursor.description]
    for row in r4:
        print(" ", dict(zip(cols_s, row)))

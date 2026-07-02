import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()
eng = create_engine(os.environ["DATABASE_URL"])

with eng.connect() as c:
    # Check ENUMs
    r = c.execute(text("""
        SELECT t.typname, e.enumlabel
        FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid
        JOIN pg_namespace n ON t.typnamespace = n.oid
        WHERE n.nspname = 'agronova'
        ORDER BY t.typname, e.enumsortorder
    """))
    print("=== ENUMs ===")
    for row in r:
        print(f"  {row[0]}: {row[1]}")

    # ciclo_vida distinct values
    r2 = c.execute(text("SELECT DISTINCT ciclo_vida FROM agronova.dim_cliente ORDER BY ciclo_vida"))
    print("\n=== ciclo_vida values ===")
    for row in r2:
        print(f"  {row[0]}")

    # Check if there's an otif metric per client in fact_logistica
    r3 = c.execute(text("""
        SELECT column_name FROM information_schema.columns
        WHERE table_schema='agronova' AND table_name='fact_logistica' ORDER BY ordinal_position
    """))
    print("\n=== fact_logistica columns ===")
    for row in r3:
        print(f"  {row[0]}")

    # OTIF per client
    r4 = c.execute(text("""
        SELECT c.cliente_id,
               COUNT(l.logistica_id) as n_envios,
               AVG(CASE WHEN l.dias_demora = 0 THEN 1.0 ELSE 0.0 END) * 100 as otif_pct
        FROM agronova.dim_cliente c
        LEFT JOIN agronova.fact_logistica l ON c.cliente_id = l.cliente_id
        WHERE c.activo = true
        GROUP BY c.cliente_id
        LIMIT 5
    """))
    print("\n=== OTIF per client sample ===")
    cols4 = [d[0] for d in r4.cursor.description]
    for row in r4:
        print(" ", dict(zip(cols4, row)))

    # Count dim_sucursal
    cnt_s = c.execute(text("SELECT COUNT(*) FROM agronova.dim_sucursal")).scalar()
    print(f"\n=== dim_sucursal rows: {cnt_s} ===")

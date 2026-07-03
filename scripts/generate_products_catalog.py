"""
Generate web/public/data/products/products.json
from real CSV data (Dim_Producto + Dim_Proveedor + Fact_Ventas + Fact_Inventario).

No DB dependency — reads straight from data/csv/, unlike the GIS generators.

Usage:
    python scripts/generate_products_catalog.py
"""
from __future__ import annotations

import json
import pathlib

import pandas as pd

ROOT    = pathlib.Path(__file__).parent.parent
CSV_DIR = ROOT / "data" / "csv"
OUT_DIR = ROOT / "web" / "public" / "data" / "products"
OUT_DIR.mkdir(parents=True, exist_ok=True)


def main():
    productos  = pd.read_csv(CSV_DIR / "Dim_Producto.csv", encoding="utf-8-sig")
    proveedores = pd.read_csv(CSV_DIR / "Dim_Proveedor.csv", encoding="utf-8-sig")
    ventas     = pd.read_csv(CSV_DIR / "Fact_Ventas.csv", encoding="utf-8-sig")
    inventario = pd.read_csv(CSV_DIR / "Fact_Inventario.csv", encoding="utf-8-sig")

    print(f"Productos: {len(productos)}  Ventas: {len(ventas)}  Inventario: {len(inventario)}")

    # Proveedor lookup
    prov_map = proveedores.set_index("proveedor_id")["nombre_proveedor"].to_dict()

    # Sales aggregates per product
    ventas_agg = (
        ventas.groupby("producto_id")
        .agg(
            revenue_ars=("total_ars", "sum"),
            revenue_usd=("total_usd", "sum"),
            margen_bruto_ars=("margen_bruto_ars", "sum"),
            unidades_vendidas=("cantidad", "sum"),
            n_ventas=("venta_id", "count"),
        )
        .reset_index()
    )

    # Latest stock snapshot per product (max fecha_id across depósitos, summed)
    inv_latest_id = inventario.groupby("producto_id")["fecha_id"].transform("max")
    inv_last = inventario[inventario["fecha_id"] == inv_latest_id]
    inv_agg = (
        inv_last.groupby("producto_id")
        .agg(
            stock_actual=("stock_actual", "sum"),
            stock_minimo=("stock_minimo", "sum"),
            valor_stock_ars=("valor_stock_ars", "sum"),
            bajo_minimo=("bajo_minimo", "max"),
        )
        .reset_index()
    )

    df = (
        productos
        .merge(ventas_agg, on="producto_id", how="left")
        .merge(inv_agg, on="producto_id", how="left")
    )

    for col in ["revenue_ars", "revenue_usd", "margen_bruto_ars", "unidades_vendidas",
                "n_ventas", "stock_actual", "stock_minimo", "valor_stock_ars"]:
        df[col] = df[col].fillna(0)
    df["bajo_minimo"] = df["bajo_minimo"].fillna(0).astype(int)

    df["nombre_proveedor"] = df["proveedor_id_principal"].map(prov_map).fillna("Sin proveedor")
    df["margen_pct_real"] = (df["margen_bruto_ars"] / df["revenue_ars"].replace(0, pd.NA) * 100).fillna(0).round(2)
    df["activo"] = df["activo"].astype(bool)
    df["requiere_frio"] = df["requiere_frio"].astype(bool)

    records = df[[
        "producto_id", "nombre_producto", "categoria", "subcategoria", "unidad_medida",
        "precio_usd_base_2016", "margen_bruto_pct", "rotacion", "requiere_frio",
        "estacionalidad_alta", "activo", "nombre_proveedor",
        "revenue_ars", "revenue_usd", "unidades_vendidas", "n_ventas",
        "stock_actual", "stock_minimo", "valor_stock_ars", "bajo_minimo", "margen_pct_real",
    ]].to_dict(orient="records")

    out_path = OUT_DIR / "products.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, separators=(",", ":"))
    print(f"Wrote {len(records)} products -> {out_path} ({out_path.stat().st_size / 1024:.0f} KB)")

    # Category summary for KPI cards
    cat_summary = (
        df.groupby("categoria")
        .agg(
            n_productos=("producto_id", "count"),
            revenue_ars=("revenue_ars", "sum"),
            margen_promedio=("margen_bruto_pct", "mean"),
            activos=("activo", "sum"),
        )
        .reset_index()
        .sort_values("revenue_ars", ascending=False)
    )
    cat_summary["margen_promedio"] = cat_summary["margen_promedio"].round(4)
    cat_path = OUT_DIR / "categories.json"
    with open(cat_path, "w", encoding="utf-8") as f:
        json.dump(cat_summary.to_dict(orient="records"), f, ensure_ascii=False, separators=(",", ":"))
    print(f"Wrote {len(cat_summary)} categories -> {cat_path}")


if __name__ == "__main__":
    main()

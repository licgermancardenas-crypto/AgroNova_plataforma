"""
Inventory Risk Prediction — AgroNova Argentina S.A.
Predicts stockout risk and replenishment priority per product × depot.

Risk levels:
  1 — Sin_Stock    (stock_actual = 0)
  2 — Critico_A    (clase A, dias_cobertura < 7)
  3 — Critico_B    (clase B, dias_cobertura < 7)
  4 — Bajo_Minimo  (stock < stock_minimo, pero > 0)
  5 — Alerta       (dias_cobertura < 15)

Also trains a binary ML classifier (ruptura_inminente) and outputs
units_to_order = max(0, stock_maximo - stock_actual).

Usage:
    python train_stock_risk.py
    python train_stock_risk.py --conn postgresql://user:pass@host/db
    python train_stock_risk.py --csv-dir ../../data/processed --ruptura-days 7
"""

import argparse
import json
import logging
import sys
from pathlib import Path
from typing import Dict, Optional, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import LabelEncoder, StandardScaler

ML_DIR = Path(__file__).resolve().parent.parent
ARTIFACTS_DIR = ML_DIR / "artifacts"
DATA_DIR = ML_DIR.parent / "data" / "processed"

# Seasonal demand multipliers for upcoming months (for coverage projection)
SEASONAL_MULTIPLIERS = {
    1: 1.30, 2: 1.25, 3: 0.95, 4: 0.85, 5: 0.90,
    6: 0.78, 7: 0.70, 8: 0.90, 9: 1.05, 10: 1.52,
    11: 1.65, 12: 1.35,
}


def setup_logging(verbose: bool = False) -> logging.Logger:
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level, format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    return logging.getLogger("stock_risk")


def load_from_db(conn_str: str, schema: str = "agronova") -> Dict[str, pd.DataFrame]:
    import sqlalchemy as sa
    engine = sa.create_engine(conn_str)
    with engine.connect() as conn:
        inventario = pd.read_sql(
            f"""
            SELECT i.fecha_id, f.fecha, i.producto_id, i.deposito_id,
                   i.stock_actual, i.stock_minimo, i.stock_maximo,
                   i.bajo_minimo, i.valor_stock_promedio_ars
            FROM {schema}.fact_inventario i
            JOIN {schema}.dim_fecha f ON f.fecha_id = i.fecha_id
            """,
            conn,
        )
        ventas = pd.read_sql(
            f"""
            SELECT v.producto_id, v.fecha_id, f.fecha, v.cantidad
            FROM {schema}.fact_ventas v
            JOIN {schema}.dim_fecha f ON f.fecha_id = v.fecha_id
            WHERE v.estado = 'Completada'
            """,
            conn,
        )
        productos = pd.read_sql(
            f"SELECT producto_id, categoria, rotacion_producto FROM {schema}.dim_producto",
            conn,
        )
        depositos = pd.read_sql(
            f"SELECT deposito_id, nombre_deposito, capacidad_ton FROM {schema}.dim_deposito",
            conn,
        )
    return {"inventario": inventario, "ventas": ventas, "productos": productos, "depositos": depositos}


def load_from_csv(csv_dir: Path) -> Dict[str, pd.DataFrame]:
    inventario = pd.read_csv(csv_dir / "fact_inventario.csv")
    ventas = pd.read_csv(csv_dir / "fact_ventas.csv")
    productos = pd.read_csv(csv_dir / "dim_producto.csv")
    fechas = pd.read_csv(csv_dir / "dim_fecha.csv")

    inventario = inventario.merge(fechas[["fecha_id", "fecha"]], on="fecha_id", how="left")
    inventario["fecha"] = pd.to_datetime(inventario["fecha"])
    ventas = ventas.merge(fechas[["fecha_id", "fecha"]], on="fecha_id", how="left")
    ventas["fecha"] = pd.to_datetime(ventas["fecha"])
    if "estado" in ventas.columns:
        ventas = ventas[ventas["estado"] == "Completada"]

    depositos = pd.DataFrame({"deposito_id": inventario["deposito_id"].unique()})
    if "dim_deposito.csv" in [f.name for f in csv_dir.iterdir()]:
        depositos = pd.read_csv(csv_dir / "dim_deposito.csv")

    return {"inventario": inventario, "ventas": ventas, "productos": productos, "depositos": depositos}


def compute_velocity(ventas: pd.DataFrame, window_days: int = 90) -> pd.DataFrame:
    """Compute average daily sales velocity per product over last N days."""
    ref_date = ventas["fecha"].max()
    cutoff = ref_date - pd.Timedelta(days=window_days)
    recent = ventas[ventas["fecha"] >= cutoff].copy()

    if "cantidad" in recent.columns:
        velocity = recent.groupby("producto_id")["cantidad"].sum() / window_days
    else:
        velocity = recent.groupby("producto_id").size() / window_days

    return velocity.reset_index().rename(columns={0: "ventas_diarias_promedio", "cantidad": "ventas_diarias_promedio"})


def get_latest_snapshot(inventario: pd.DataFrame) -> pd.DataFrame:
    """Get the most recent inventory snapshot per product × depot."""
    inventario = inventario.copy()
    inventario["fecha"] = pd.to_datetime(inventario["fecha"])
    latest = inventario.groupby(["producto_id", "deposito_id"])["fecha"].idxmax()
    return inventario.loc[latest].reset_index(drop=True)


def classify_abc_simple(ventas: pd.DataFrame) -> pd.DataFrame:
    """Simple ABC classification by revenue contribution."""
    if "total_ars" not in ventas.columns:
        return pd.DataFrame({"producto_id": ventas["producto_id"].unique(), "clasificacion_abc": "B"})
    revenue = ventas.groupby("producto_id")["total_ars"].sum().sort_values(ascending=False)
    cumulative = revenue.cumsum() / revenue.sum()
    abc = pd.cut(
        cumulative,
        bins=[-0.001, 0.70, 0.90, 1.001],
        labels=["A", "B", "C"],
    )
    return abc.reset_index().rename(columns={"total_ars": "clasificacion_abc"})


def build_features(
    snapshot: pd.DataFrame,
    velocity: pd.DataFrame,
    productos: pd.DataFrame,
    ruptura_days: int = 7,
    logger: logging.Logger = None,
) -> pd.DataFrame:
    df = snapshot.merge(velocity, on="producto_id", how="left")
    df["ventas_diarias_promedio"] = df["ventas_diarias_promedio"].fillna(0)

    # Coverage: how many days of stock at current velocity
    df["dias_cobertura"] = np.where(
        df["ventas_diarias_promedio"] > 0,
        df["stock_actual"] / df["ventas_diarias_promedio"],
        999,  # no sales → infinite coverage
    )

    # ABC from products table
    abc_col = None
    for col in ["clasificacion_abc", "abc", "rotacion_producto"]:
        if col in productos.columns:
            abc_col = col
            break

    if abc_col:
        df = df.merge(productos[["producto_id", abc_col] +
                                (["categoria"] if "categoria" in productos.columns else [])],
                      on="producto_id", how="left")
        df.rename(columns={abc_col: "clasificacion_abc"}, inplace=True)
    else:
        df["clasificacion_abc"] = "B"

    if "categoria" not in df.columns:
        df["categoria"] = "Desconocida"

    # Encode ABC
    le_abc = LabelEncoder()
    df["abc_encoded"] = le_abc.fit_transform(df["clasificacion_abc"].fillna("C").astype(str))

    # Encode categoria
    le_cat = LabelEncoder()
    df["cat_encoded"] = le_cat.fit_transform(df["categoria"].fillna("Desconocida").astype(str))

    # Stock ratios
    df["stock_minimo"] = df.get("stock_minimo", pd.Series(0, index=df.index)).fillna(0)
    df["stock_maximo"] = df.get("stock_maximo", pd.Series(df["stock_actual"] * 3, index=df.index)).fillna(df["stock_actual"] * 3)
    df["ratio_stock_minimo"] = df["stock_actual"] / (df["stock_minimo"] + 1)
    df["ratio_stock_maximo"] = df["stock_actual"] / (df["stock_maximo"] + 1)
    df["bajo_minimo"] = (df["stock_actual"] < df["stock_minimo"]).astype(int)

    # Current month seasonality
    ref_month = snapshot["fecha"].max().month if "fecha" in snapshot.columns else 1
    df["seasonal_factor"] = SEASONAL_MULTIPLIERS.get(ref_month, 1.0)
    df["dias_cobertura_adj"] = df["dias_cobertura"] / df["seasonal_factor"]

    # Binary target: ruptura inminente
    df["ruptura_inminente"] = (df["dias_cobertura"] < ruptura_days).astype(int)

    # Units to order to reach maximum stock
    df["unidades_a_reponer"] = np.maximum(0, df["stock_maximo"] - df["stock_actual"])

    if logger:
        logger.info(
            f"Snapshot: {len(df):,} product×depot combinations | "
            f"Ruptura inminente: {df['ruptura_inminente'].sum():,} "
            f"({df['ruptura_inminente'].mean():.1%})"
        )
    return df, le_abc, le_cat


def assign_priority(df: pd.DataFrame) -> pd.DataFrame:
    """Rule-based priority: 1 (most critical) → 5 (alert only)."""
    df = df.copy()
    conditions = [
        df["stock_actual"] == 0,
        (df["clasificacion_abc"] == "A") & (df["dias_cobertura"] < 7),
        (df["clasificacion_abc"].isin(["B", "C"])) & (df["dias_cobertura"] < 7),
        df["bajo_minimo"] == 1,
        df["dias_cobertura"] < 15,
    ]
    choices = [
        "1_Sin_Stock", "2_Critico_A", "3_Critico_B", "4_Bajo_Minimo", "5_Alerta"
    ]
    df["prioridad"] = np.select(conditions, choices, default="6_Normal")
    return df


FEATURE_COLS = [
    "stock_actual", "ventas_diarias_promedio", "dias_cobertura",
    "ratio_stock_minimo", "ratio_stock_maximo", "bajo_minimo",
    "seasonal_factor", "dias_cobertura_adj",
    "abc_encoded", "cat_encoded",
]


def train_classifier(df: pd.DataFrame, logger: logging.Logger) -> Tuple[Pipeline, Dict]:
    """Train RandomForest classifier for ruptura_inminente prediction."""
    feature_cols = [c for c in FEATURE_COLS if c in df.columns]
    X = df[feature_cols].fillna(0)
    y = df["ruptura_inminente"]

    if y.sum() < 10:
        logger.warning("Very few positive examples — classifier may be unreliable")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, stratify=y if y.sum() > 20 else None, random_state=42
    )

    pipe = Pipeline([
        ("scaler", StandardScaler()),
        ("clf", RandomForestClassifier(
            n_estimators=200,
            max_depth=6,
            min_samples_leaf=5,
            class_weight="balanced",
            random_state=42,
            n_jobs=-1,
        )),
    ])

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    try:
        cv_f1 = cross_val_score(pipe, X_train, y_train, cv=cv, scoring="f1")
        logger.info(f"CV F1: {cv_f1.mean():.4f} ± {cv_f1.std():.4f}")
    except Exception:
        cv_f1 = np.array([0.0])
        logger.warning("CV failed — training on full dataset")

    pipe.fit(X_train, y_train)
    y_pred = pipe.predict(X_test)
    y_proba = pipe.predict_proba(X_test)[:, 1]

    metrics = {
        "model": "RandomForestClassifier",
        "target": "ruptura_inminente",
        "ruptura_days_threshold": 7,
        "n_samples": len(X),
        "ruptura_rate": float(y.mean()),
        "cv_f1_mean": float(cv_f1.mean()),
        "cv_f1_std": float(cv_f1.std()),
        "test_accuracy": float(accuracy_score(y_test, y_pred)),
        "test_precision": float(precision_score(y_test, y_pred, zero_division=0)),
        "test_recall": float(recall_score(y_test, y_pred, zero_division=0)),
        "test_f1": float(f1_score(y_test, y_pred, zero_division=0)),
        "test_roc_auc": float(roc_auc_score(y_test, y_proba)) if y_test.nunique() > 1 else 0.0,
    }

    logger.info(
        f"Test — AUC: {metrics['test_roc_auc']:.4f} | "
        f"F1: {metrics['test_f1']:.4f} | "
        f"Recall: {metrics['test_recall']:.4f}"
    )
    logger.info("\n" + classification_report(y_test, y_pred, target_names=["Normal", "Ruptura"], zero_division=0))

    # Feature importance
    clf = pipe.named_steps["clf"]
    importances = pd.DataFrame({
        "feature": feature_cols,
        "importance": clf.feature_importances_,
    }).sort_values("importance", ascending=False)
    logger.info("Top features:\n" + importances.head(5).to_string(index=False))

    return pipe, metrics, importances


def run(
    conn_str: Optional[str] = None,
    schema: str = "agronova",
    csv_dir: Optional[Path] = None,
    output_dir: Path = ARTIFACTS_DIR,
    ruptura_days: int = 7,
    verbose: bool = False,
) -> Dict:
    logger = setup_logging(verbose)
    logger.info("=== AgroNova Inventory Risk ===")

    if conn_str:
        data = load_from_db(conn_str, schema)
    else:
        data = load_from_csv(csv_dir or DATA_DIR)

    snapshot = get_latest_snapshot(data["inventario"])
    velocity = compute_velocity(data["ventas"])
    logger.info(f"Latest snapshot: {len(snapshot):,} product×depot rows")

    df, le_abc, le_cat = build_features(
        snapshot, velocity, data["productos"],
        ruptura_days=ruptura_days, logger=logger,
    )
    df = assign_priority(df)

    # ML classifier
    pipe, metrics, importances = train_classifier(df, logger)
    df["ruptura_probability"] = pipe.predict_proba(
        df[[c for c in FEATURE_COLS if c in df.columns]].fillna(0)
    )[:, 1]

    # Risk output table
    risk_cols = [
        "producto_id", "deposito_id",
        "stock_actual", "stock_minimo", "stock_maximo",
        "ventas_diarias_promedio", "dias_cobertura", "dias_cobertura_adj",
        "clasificacion_abc", "categoria",
        "bajo_minimo", "ruptura_inminente", "ruptura_probability",
        "prioridad", "unidades_a_reponer", "seasonal_factor",
    ]
    risk_df = df[[c for c in risk_cols if c in df.columns]].copy()
    risk_df = risk_df.sort_values(["prioridad", "ruptura_probability"], ascending=[True, False])

    # Summary by priority
    priority_summary = risk_df["prioridad"].value_counts().sort_index().to_dict()
    logger.info("Risk distribution:")
    for p, cnt in priority_summary.items():
        logger.info(f"  {p}: {cnt:,} SKU×depot")

    # Save
    output_dir.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipe, output_dir / "stock_risk_model.pkl")
    joblib.dump({"abc": le_abc, "categoria": le_cat}, output_dir / "stock_risk_encoders.pkl")
    risk_df.to_csv(output_dir / "stock_risk_predictions.csv", index=False)
    importances.to_csv(output_dir / "stock_risk_feature_importance.csv", index=False)

    metrics["priority_distribution"] = {k: int(v) for k, v in priority_summary.items()}
    with open(output_dir / "stock_risk_metrics.json", "w") as f:
        json.dump(metrics, f, indent=2)

    logger.info(f"Artifacts saved to {output_dir}")
    return metrics


def main():
    parser = argparse.ArgumentParser(description="AgroNova Inventory Risk")
    parser.add_argument("--conn", help="PostgreSQL connection string")
    parser.add_argument("--schema", default="agronova")
    parser.add_argument("--csv-dir", type=Path)
    parser.add_argument("--output-dir", type=Path, default=ARTIFACTS_DIR)
    parser.add_argument("--ruptura-days", type=int, default=7,
                        help="Coverage days threshold to flag as ruptura inminente")
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args()

    try:
        metrics = run(
            conn_str=args.conn,
            schema=args.schema,
            csv_dir=args.csv_dir,
            output_dir=args.output_dir,
            ruptura_days=args.ruptura_days,
            verbose=args.verbose,
        )
        print(json.dumps(metrics, indent=2))
    except Exception as e:
        logging.error(str(e))
        sys.exit(1)


if __name__ == "__main__":
    main()

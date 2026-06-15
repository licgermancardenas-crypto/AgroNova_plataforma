"""
Churn Prediction — AgroNova Argentina S.A.
Binary classifier: will a client become inactive in the next N days?

Usage:
    python train_churn.py
    python train_churn.py --conn postgresql://user:pass@host/db --schema agronova
    python train_churn.py --csv-dir ../../data/processed --output-dir ../artifacts
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
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
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
REPORTS_DIR = ML_DIR / "reports"
DATA_DIR = ML_DIR.parent / "data" / "processed"

CHURN_THRESHOLD_DAYS = 365  # client inactive > 365 days → churned
RISK_LOW = 0.30
RISK_HIGH = 0.60


def setup_logging(verbose: bool = False) -> logging.Logger:
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    return logging.getLogger("churn")


def load_from_db(conn_str: str, schema: str = "agronova") -> Dict[str, pd.DataFrame]:
    try:
        import sqlalchemy as sa
        engine = sa.create_engine(conn_str)
        with engine.connect() as conn:
            clientes = pd.read_sql(f"SELECT * FROM {schema}.dim_clientes", conn)
            ventas = pd.read_sql(
                f"""
                SELECT cliente_id, fecha_id, total_ars, total_usd, margen_bruto_ars,
                       descuento_pct, producto_id, sucursal_id
                FROM {schema}.fact_ventas
                WHERE estado = 'Completada'
                """,
                conn,
            )
            productos = pd.read_sql(f"SELECT producto_id, categoria FROM {schema}.dim_producto", conn)
            fechas = pd.read_sql(f"SELECT fecha_id, fecha FROM {schema}.dim_fecha", conn)
        return {"clientes": clientes, "ventas": ventas, "productos": productos, "fechas": fechas}
    except Exception as e:
        raise RuntimeError(f"DB load failed: {e}") from e


def load_from_csv(csv_dir: Path) -> Dict[str, pd.DataFrame]:
    clientes = pd.read_csv(csv_dir / "dim_clientes.csv")
    ventas = pd.read_csv(csv_dir / "fact_ventas.csv")
    productos = pd.read_csv(csv_dir / "dim_producto.csv")
    fechas = pd.read_csv(csv_dir / "dim_fecha.csv")
    return {"clientes": clientes, "ventas": ventas, "productos": productos, "fechas": fechas}


def build_features(data: Dict[str, pd.DataFrame], logger: logging.Logger) -> pd.DataFrame:
    clientes = data["clientes"].copy()
    ventas = data["ventas"].copy()
    productos = data["productos"].copy()
    fechas = data["fechas"].copy()

    logger.info(f"Clientes: {len(clientes):,} | Ventas: {len(ventas):,}")

    # Parse fecha
    if "fecha" in fechas.columns:
        fechas["fecha"] = pd.to_datetime(fechas["fecha"])
    ventas = ventas.merge(fechas[["fecha_id", "fecha"]], on="fecha_id", how="left")
    ventas = ventas.merge(productos[["producto_id", "categoria"]], on="producto_id", how="left")

    ref_date = ventas["fecha"].max()
    logger.info(f"Reference date: {ref_date.date()}")

    # Per-client aggregation
    agg = ventas.groupby("cliente_id").agg(
        ultima_compra=("fecha", "max"),
        primera_compra=("fecha", "min"),
        frequency=("fecha_id", "count"),
        monetary=("total_ars", "sum"),
        monetary_usd=("total_usd", "sum"),
        margen_historico=("margen_bruto_ars", lambda x: x.sum() / ventas.loc[x.index, "total_ars"].sum()
                          if ventas.loc[x.index, "total_ars"].sum() > 0 else 0),
        ticket_promedio=("total_ars", "mean"),
        descuento_promedio=("descuento_pct", "mean"),
        n_categorias=("categoria", "nunique"),
    ).reset_index()

    # Categoria principal
    cat_principal = (
        ventas.groupby(["cliente_id", "categoria"])["total_ars"]
        .sum()
        .reset_index()
        .sort_values("total_ars", ascending=False)
        .groupby("cliente_id")
        .first()
        .reset_index()
        .rename(columns={"categoria": "categoria_principal"})
    )
    agg = agg.merge(cat_principal[["cliente_id", "categoria_principal"]], on="cliente_id", how="left")

    # Time features
    agg["recency"] = (ref_date - agg["ultima_compra"]).dt.days
    agg["antiguedad_cliente"] = (agg["ultima_compra"] - agg["primera_compra"]).dt.days / 365.25
    agg["dias_desde_ultima_compra"] = agg["recency"]

    # Merge client attributes
    cols_cliente = ["cliente_id", "anio_baja", "tier_cliente", "region_id"]
    cols_disponibles = [c for c in cols_cliente if c in clientes.columns]
    agg = agg.merge(clientes[cols_disponibles], on="cliente_id", how="left")

    # Add region name if available
    if "nombre_region" in clientes.columns:
        agg = agg.merge(clientes[["cliente_id", "nombre_region"]], on="cliente_id", how="left")
        agg["region"] = agg["nombre_region"].fillna("Desconocida")
    elif "region_id" in agg.columns:
        agg["region"] = agg["region_id"].astype(str)
    else:
        agg["region"] = "Desconocida"

    # Target: churned = has exit year registered OR inactive > threshold
    if "anio_baja" in agg.columns:
        agg["churn"] = (
            agg["anio_baja"].notna() | (agg["recency"] > CHURN_THRESHOLD_DAYS)
        ).astype(int)
    else:
        agg["churn"] = (agg["recency"] > CHURN_THRESHOLD_DAYS).astype(int)

    logger.info(f"Churn rate: {agg['churn'].mean():.1%} ({agg['churn'].sum():,} / {len(agg):,} clients)")
    return agg


def encode_features(df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict]:
    encoders = {}
    cat_cols = ["categoria_principal", "region", "tier_cliente"]
    df = df.copy()
    for col in cat_cols:
        if col in df.columns:
            le = LabelEncoder()
            df[col] = le.fit_transform(df[col].fillna("UNKNOWN").astype(str))
            encoders[col] = le
    return df, encoders


FEATURE_COLS = [
    "recency",
    "frequency",
    "monetary",
    "antiguedad_cliente",
    "ticket_promedio",
    "descuento_promedio",
    "n_categorias",
    "dias_desde_ultima_compra",
    "categoria_principal",
    "region",
    "tier_cliente",
]


def train(
    df: pd.DataFrame,
    logger: logging.Logger,
) -> Tuple[Pipeline, Dict, Dict]:
    df_enc, encoders = encode_features(df)

    feature_cols = [c for c in FEATURE_COLS if c in df_enc.columns]
    X = df_enc[feature_cols].fillna(0)
    y = df_enc["churn"]

    logger.info(f"Features: {feature_cols}")
    logger.info(f"Dataset: {len(X):,} samples | Class balance: {y.mean():.1%} positive")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, stratify=y, random_state=42
    )

    pipe = Pipeline([
        ("scaler", StandardScaler()),
        ("clf", GradientBoostingClassifier(
            n_estimators=200,
            max_depth=4,
            learning_rate=0.05,
            subsample=0.8,
            min_samples_leaf=10,
            random_state=42,
        )),
    ])

    # Cross-validation
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    cv_auc = cross_val_score(pipe, X_train, y_train, cv=cv, scoring="roc_auc")
    logger.info(f"CV ROC-AUC: {cv_auc.mean():.4f} ± {cv_auc.std():.4f}")

    pipe.fit(X_train, y_train)
    y_pred = pipe.predict(X_test)
    y_proba = pipe.predict_proba(X_test)[:, 1]

    metrics = {
        "model": "GradientBoostingClassifier",
        "n_samples_train": len(X_train),
        "n_samples_test": len(X_test),
        "features": feature_cols,
        "churn_rate": float(y.mean()),
        "cv_roc_auc_mean": float(cv_auc.mean()),
        "cv_roc_auc_std": float(cv_auc.std()),
        "test_accuracy": float(accuracy_score(y_test, y_pred)),
        "test_precision": float(precision_score(y_test, y_pred, zero_division=0)),
        "test_recall": float(recall_score(y_test, y_pred, zero_division=0)),
        "test_f1": float(f1_score(y_test, y_pred, zero_division=0)),
        "test_roc_auc": float(roc_auc_score(y_test, y_proba)),
    }

    logger.info(
        f"Test — AUC: {metrics['test_roc_auc']:.4f} | "
        f"F1: {metrics['test_f1']:.4f} | "
        f"Precision: {metrics['test_precision']:.4f} | "
        f"Recall: {metrics['test_recall']:.4f}"
    )
    logger.info("\n" + classification_report(y_test, y_pred, target_names=["Active", "Churned"]))

    # Feature importance
    clf = pipe.named_steps["clf"]
    importances = pd.DataFrame(
        {"feature": feature_cols, "importance": clf.feature_importances_}
    ).sort_values("importance", ascending=False)

    return pipe, metrics, {"feature_importance": importances, "encoders": encoders,
                           "X": X, "y": y, "X_test": X_test, "y_test": y_test}


def generate_predictions(df: pd.DataFrame, pipe: Pipeline, artifacts: Dict) -> pd.DataFrame:
    df_enc, _ = encode_features(df)
    feature_cols = [c for c in FEATURE_COLS if c in df_enc.columns]
    X = df_enc[feature_cols].fillna(0)
    proba = pipe.predict_proba(X)[:, 1]

    result = df[["cliente_id"]].copy()
    result["churn_probability"] = proba
    result["risk_level"] = pd.cut(
        proba,
        bins=[-0.001, RISK_LOW, RISK_HIGH, 1.001],
        labels=["Low", "Medium", "High"],
    )
    result["churn_actual"] = df["churn"].values

    return result.sort_values("churn_probability", ascending=False)


def run(
    conn_str: Optional[str] = None,
    schema: str = "agronova",
    csv_dir: Optional[Path] = None,
    output_dir: Path = ARTIFACTS_DIR,
    verbose: bool = False,
) -> Dict:
    logger = setup_logging(verbose)
    logger.info("=== AgroNova Churn Prediction ===")

    # Load data
    if conn_str:
        logger.info("Loading from database...")
        data = load_from_db(conn_str, schema)
    else:
        dir_ = csv_dir or DATA_DIR
        logger.info(f"Loading from CSV: {dir_}")
        data = load_from_csv(dir_)

    # Feature engineering
    df = build_features(data, logger)

    # Train
    pipe, metrics, artifacts = train(df, logger)

    # Predictions
    predictions = generate_predictions(df, pipe, artifacts)

    # Save
    output_dir.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipe, output_dir / "churn_model.pkl")
    joblib.dump(artifacts["encoders"], output_dir / "churn_encoders.pkl")
    artifacts["feature_importance"].to_csv(output_dir / "churn_feature_importance.csv", index=False)
    predictions.to_csv(output_dir / "churn_predictions.csv", index=False)
    with open(output_dir / "churn_metrics.json", "w") as f:
        json.dump(metrics, f, indent=2)

    logger.info(f"Artifacts saved to {output_dir}")
    logger.info(
        f"Risk distribution:\n"
        + predictions["risk_level"].value_counts().to_string()
    )

    return metrics


def main():
    parser = argparse.ArgumentParser(description="AgroNova Churn Prediction")
    parser.add_argument("--conn", help="PostgreSQL connection string")
    parser.add_argument("--schema", default="agronova")
    parser.add_argument("--csv-dir", type=Path, help="Directory with CSV files")
    parser.add_argument("--output-dir", type=Path, default=ARTIFACTS_DIR)
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args()

    try:
        metrics = run(
            conn_str=args.conn,
            schema=args.schema,
            csv_dir=args.csv_dir,
            output_dir=args.output_dir,
            verbose=args.verbose,
        )
        print(json.dumps(metrics, indent=2))
    except Exception as e:
        logging.error(str(e))
        sys.exit(1)


if __name__ == "__main__":
    main()

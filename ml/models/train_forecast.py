"""
Demand Forecast — AgroNova Argentina S.A.
Predicts sales volume (units and ARS) at 3 levels of granularity:
  - By product category (more data, more reliable)
  - By sucursal
  - By individual product (sparse, higher uncertainty)

Horizons: 30, 90 and 180 days (1, 3, 6 months)

Usage:
    python train_forecast.py
    python train_forecast.py --conn postgresql://user:pass@host/db
    python train_forecast.py --csv-dir ../../data/processed --level categoria
"""

import argparse
import json
import logging
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import TimeSeriesSplit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

ML_DIR = Path(__file__).resolve().parent.parent
ARTIFACTS_DIR = ML_DIR / "artifacts"
DATA_DIR = ML_DIR.parent / "data" / "processed"

# Argentine agricultural seasonality weights (month 1-12)
SEASONAL_WEIGHTS = {
    1: 1.30, 2: 1.25, 3: 0.95, 4: 0.85, 5: 0.90,
    6: 0.78, 7: 0.70, 8: 0.90, 9: 1.05, 10: 1.52,
    11: 1.65, 12: 1.35,
}

HORIZONS_DAYS = [30, 90, 180]  # 1, 3, 6 months


def setup_logging(verbose: bool = False) -> logging.Logger:
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level, format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    return logging.getLogger("forecast")


def load_from_db(conn_str: str, schema: str = "agronova") -> Dict[str, pd.DataFrame]:
    import sqlalchemy as sa
    engine = sa.create_engine(conn_str)
    with engine.connect() as conn:
        ventas = pd.read_sql(
            f"""
            SELECT v.fecha_id, f.fecha, f.anio, f.mes, f.trimestre,
                   v.producto_id, p.categoria, p.subcategoria,
                   v.sucursal_id, s.nombre_sucursal, s.region_id,
                   v.cantidad, v.total_ars, v.total_usd
            FROM {schema}.fact_ventas v
            JOIN {schema}.dim_fecha f ON f.fecha_id = v.fecha_id
            JOIN {schema}.dim_producto p ON p.producto_id = v.producto_id
            JOIN {schema}.dim_sucursal s ON s.sucursal_id = v.sucursal_id
            WHERE v.estado = 'Completada'
            """,
            conn,
        )
    return {"ventas": ventas}


def load_from_csv(csv_dir: Path) -> Dict[str, pd.DataFrame]:
    ventas = pd.read_csv(csv_dir / "fact_ventas.csv")
    productos = pd.read_csv(csv_dir / "dim_producto.csv")
    sucursales = pd.read_csv(csv_dir / "dim_sucursal.csv")
    fechas = pd.read_csv(csv_dir / "dim_fecha.csv")

    ventas = ventas[ventas.get("estado", "Completada") == "Completada"].copy() \
        if "estado" in ventas.columns else ventas.copy()

    ventas = ventas.merge(fechas, on="fecha_id", how="left")
    ventas = ventas.merge(
        productos[["producto_id", "categoria"] + (["subcategoria"] if "subcategoria" in productos.columns else [])],
        on="producto_id", how="left",
    )
    ventas = ventas.merge(
        sucursales[["sucursal_id", "nombre_sucursal"] + (["region_id"] if "region_id" in sucursales.columns else [])],
        on="sucursal_id", how="left",
    )
    if "fecha" in ventas.columns:
        ventas["fecha"] = pd.to_datetime(ventas["fecha"])
    return {"ventas": ventas}


def build_monthly_series(ventas: pd.DataFrame, group_col: str, target_col: str = "total_ars") -> pd.DataFrame:
    """Aggregate sales to monthly series per group."""
    ventas = ventas.copy()
    ventas["year_month"] = pd.to_datetime(ventas["fecha"]).dt.to_period("M")

    monthly = (
        ventas.groupby([group_col, "year_month"])
        .agg(revenue=("total_ars", "sum"), units=("cantidad", "sum") if "cantidad" in ventas.columns else ("total_ars", "count"))
        .reset_index()
    )
    monthly["year_month"] = monthly["year_month"].dt.to_timestamp()
    monthly = monthly.sort_values([group_col, "year_month"])
    return monthly


def build_time_features(df: pd.DataFrame, date_col: str = "year_month") -> pd.DataFrame:
    """Engineer temporal features including seasonality and lags."""
    df = df.copy().sort_values(date_col)
    dt = pd.to_datetime(df[date_col])
    df["month"] = dt.dt.month
    df["year"] = dt.dt.year
    df["quarter"] = dt.dt.quarter
    df["month_sin"] = np.sin(2 * np.pi * dt.dt.month / 12)
    df["month_cos"] = np.cos(2 * np.pi * dt.dt.month / 12)
    df["seasonal_weight"] = dt.dt.month.map(SEASONAL_WEIGHTS)
    df["t"] = (dt - dt.min()).dt.days / 30  # linear time trend in months
    return df


def add_lag_features(df: pd.DataFrame, group_col: str, target: str = "revenue",
                     lags: List[int] = [1, 2, 3, 6, 12]) -> pd.DataFrame:
    df = df.copy().sort_values([group_col, "year_month"])
    for lag in lags:
        df[f"lag_{lag}"] = df.groupby(group_col)[target].shift(lag)
    df[f"rolling_3m"] = df.groupby(group_col)[target].shift(1).rolling(3).mean().values
    df[f"rolling_6m"] = df.groupby(group_col)[target].shift(1).rolling(6).mean().values
    df[f"yoy_ratio"] = df.groupby(group_col)[target].shift(1) / df.groupby(group_col)[target].shift(13).replace(0, np.nan)
    return df


def train_group_model(
    series: pd.DataFrame,
    group_col: str,
    group_val: str,
    logger: logging.Logger,
) -> Tuple[Optional[Pipeline], Dict, pd.DataFrame]:
    """Train a forecast model for a single group (category, sucursal, product)."""
    grp = series[series[group_col] == group_val].copy()
    if len(grp) < 18:  # Need at least 18 months of history
        return None, {}, pd.DataFrame()

    grp = build_time_features(grp)
    grp = add_lag_features(grp, group_col)
    grp = grp.dropna()

    if len(grp) < 12:
        return None, {}, pd.DataFrame()

    feature_cols = [
        "month_sin", "month_cos", "seasonal_weight", "t",
        "lag_1", "lag_2", "lag_3", "lag_6", "lag_12",
        "rolling_3m", "rolling_6m",
    ]
    feature_cols = [c for c in feature_cols if c in grp.columns]

    X = grp[feature_cols]
    y = grp["revenue"]

    # Time-series cross-validation
    tscv = TimeSeriesSplit(n_splits=3)
    model = Pipeline([
        ("scaler", StandardScaler()),
        ("gbr", GradientBoostingRegressor(
            n_estimators=150, max_depth=3, learning_rate=0.05,
            subsample=0.8, random_state=42,
        )),
    ])

    cv_rmse = []
    for train_idx, test_idx in tscv.split(X):
        model.fit(X.iloc[train_idx], y.iloc[train_idx])
        preds = model.predict(X.iloc[test_idx])
        cv_rmse.append(np.sqrt(mean_squared_error(y.iloc[test_idx], preds)))

    model.fit(X, y)
    metrics = {
        "group": group_val,
        "n_months": len(grp),
        "cv_rmse_mean": float(np.mean(cv_rmse)),
        "cv_rmse_std": float(np.std(cv_rmse)),
        "revenue_mean": float(y.mean()),
        "cv_rmse_pct": float(np.mean(cv_rmse) / y.mean()) if y.mean() > 0 else 0,
    }
    return model, metrics, grp[["year_month", "revenue"] + feature_cols]


def generate_future_features(
    history: pd.DataFrame,
    last_date: pd.Timestamp,
    horizons: List[int],
) -> pd.DataFrame:
    """Build feature rows for future months."""
    max_months = max(h // 30 for h in horizons)
    future_dates = pd.date_range(
        start=last_date + pd.offsets.MonthBegin(1),
        periods=max_months,
        freq="MS",
    )
    future = pd.DataFrame({"year_month": future_dates})
    future = build_time_features(future)

    # Use last known lags from history
    rev = history["revenue"].values
    for lag in [1, 2, 3, 6, 12]:
        col = f"lag_{lag}"
        if len(rev) >= lag:
            future[col] = np.nan
            future.at[0, col] = rev[-lag]
        else:
            future[col] = np.nan
    future["rolling_3m"] = rev[-3:].mean() if len(rev) >= 3 else rev.mean()
    future["rolling_6m"] = rev[-6:].mean() if len(rev) >= 6 else rev.mean()
    return future


def run(
    conn_str: Optional[str] = None,
    schema: str = "agronova",
    csv_dir: Optional[Path] = None,
    output_dir: Path = ARTIFACTS_DIR,
    level: str = "categoria",  # categoria | sucursal | producto
    verbose: bool = False,
) -> Dict:
    logger = setup_logging(verbose)
    logger.info(f"=== AgroNova Demand Forecast | Level: {level} ===")

    if conn_str:
        data = load_from_db(conn_str, schema)
    else:
        data = load_from_csv(csv_dir or DATA_DIR)

    ventas = data["ventas"].copy()
    ventas["fecha"] = pd.to_datetime(ventas["fecha"])

    # Map level to column
    group_map = {"categoria": "categoria", "sucursal": "nombre_sucursal", "producto": "producto_id"}
    group_col = group_map.get(level, "categoria")
    if group_col not in ventas.columns:
        raise ValueError(f"Column '{group_col}' not found in data. Available: {ventas.columns.tolist()}")

    monthly = build_monthly_series(ventas, group_col)
    groups = monthly[group_col].unique()
    logger.info(f"Groups to forecast: {len(groups)}")

    models, all_metrics, all_forecasts = {}, [], []

    for grp_val in sorted(groups):
        model, metrics, history = train_group_model(monthly, group_col, grp_val, logger)
        if model is None:
            logger.debug(f"Skipped {grp_val} — insufficient history")
            continue

        models[str(grp_val)] = model
        all_metrics.append(metrics)
        logger.info(f"  {grp_val}: RMSE {metrics['cv_rmse_mean']:,.0f} ARS ({metrics['cv_rmse_pct']:.1%} of mean)")

        # Generate future forecast
        last_date = history["year_month"].max()
        feature_cols = [c for c in history.columns if c not in ["year_month", "revenue"]]
        future = generate_future_features(history, last_date, HORIZONS_DAYS)

        X_future = future[[c for c in feature_cols if c in future.columns]].fillna(method="ffill")
        preds = model.predict(X_future)

        for i, (h_days, pred) in enumerate(zip([30 * i for i in range(1, len(preds) + 1)], preds)):
            if h_days in HORIZONS_DAYS:
                all_forecasts.append({
                    group_col: grp_val,
                    "forecast_date": future["year_month"].iloc[i],
                    "horizon_days": h_days,
                    "revenue_forecast_ars": max(0, pred),
                })

    # Save
    output_dir.mkdir(parents=True, exist_ok=True)
    joblib.dump(models, output_dir / f"forecast_models_{level}.pkl")

    forecasts_df = pd.DataFrame(all_forecasts)
    forecasts_df.to_csv(output_dir / f"forecasts_{level}.csv", index=False)

    metrics_df = pd.DataFrame(all_metrics)
    metrics_df.to_csv(output_dir / f"forecast_metrics_{level}.csv", index=False)

    summary = {
        "level": level,
        "n_groups_trained": len(models),
        "n_groups_total": len(groups),
        "avg_rmse_pct": float(metrics_df["cv_rmse_pct"].mean()) if len(metrics_df) > 0 else 0,
        "avg_cv_rmse": float(metrics_df["cv_rmse_mean"].mean()) if len(metrics_df) > 0 else 0,
        "horizons_days": HORIZONS_DAYS,
    }
    with open(output_dir / f"forecast_summary_{level}.json", "w") as f:
        json.dump(summary, f, indent=2)

    logger.info(
        f"Trained {len(models)}/{len(groups)} models | "
        f"Avg RMSE: {summary['avg_rmse_pct']:.1%} of mean revenue"
    )
    logger.info(f"Forecasts saved to {output_dir}")
    return summary


def main():
    parser = argparse.ArgumentParser(description="AgroNova Demand Forecast")
    parser.add_argument("--conn", help="PostgreSQL connection string")
    parser.add_argument("--schema", default="agronova")
    parser.add_argument("--csv-dir", type=Path)
    parser.add_argument("--output-dir", type=Path, default=ARTIFACTS_DIR)
    parser.add_argument(
        "--level",
        choices=["categoria", "sucursal", "producto"],
        default="categoria",
        help="Granularity level for forecast",
    )
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args()

    try:
        summary = run(
            conn_str=args.conn,
            schema=args.schema,
            csv_dir=args.csv_dir,
            output_dir=args.output_dir,
            level=args.level,
            verbose=args.verbose,
        )
        print(json.dumps(summary, indent=2))
    except Exception as e:
        logging.error(str(e))
        sys.exit(1)


if __name__ == "__main__":
    main()

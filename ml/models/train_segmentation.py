"""
Customer Segmentation — AgroNova Argentina S.A.
KMeans clustering on RFM features → 5 business segments:
  Campeones | Leales | En Riesgo | Dormidos | Alto Valor

Also outputs cluster profiles and recommended actions per segment.

Usage:
    python train_segmentation.py
    python train_segmentation.py --conn postgresql://user:pass@host/db
    python train_segmentation.py --csv-dir ../../data/processed --n-clusters 5
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
from sklearn.cluster import KMeans
from sklearn.metrics import davies_bouldin_score, silhouette_score
from sklearn.preprocessing import RobustScaler

ML_DIR = Path(__file__).resolve().parent.parent
ARTIFACTS_DIR = ML_DIR / "artifacts"
DATA_DIR = ML_DIR.parent / "data" / "processed"

CHURN_DAYS = 365

# Segment mapping: assigned after inspecting cluster centroids
SEGMENT_PROFILES = {
    "Campeones":  {"color": "#2ECC71", "accion": "Fidelización VIP. Acceso anticipado a temporada."},
    "Leales":     {"color": "#3498DB", "accion": "Cross-selling categorías nuevas. Programa de puntos."},
    "Alto_Valor": {"color": "#9B59B6", "accion": "Aumentar frecuencia. Visita personalizada de KAM."},
    "En_Riesgo":  {"color": "#E67E22", "accion": "Reactivación urgente. Descuento recuperación."},
    "Dormidos":   {"color": "#E74C3C", "accion": "Campaña win-back. Diagnóstico de causa de abandono."},
}


def setup_logging(verbose: bool = False) -> logging.Logger:
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level, format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    return logging.getLogger("segmentation")


def load_from_db(conn_str: str, schema: str = "agronova") -> pd.DataFrame:
    import sqlalchemy as sa
    engine = sa.create_engine(conn_str)
    with engine.connect() as conn:
        ventas = pd.read_sql(
            f"""
            SELECT v.cliente_id, f.fecha, v.total_ars, v.total_usd
            FROM {schema}.fact_ventas v
            JOIN {schema}.dim_fecha f ON f.fecha_id = v.fecha_id
            WHERE v.estado = 'Completada'
            """,
            conn,
        )
    return ventas


def load_from_csv(csv_dir: Path) -> pd.DataFrame:
    ventas = pd.read_csv(csv_dir / "fact_ventas.csv")
    fechas = pd.read_csv(csv_dir / "dim_fecha.csv")
    if "estado" in ventas.columns:
        ventas = ventas[ventas["estado"] == "Completada"]
    ventas = ventas.merge(fechas[["fecha_id", "fecha"]], on="fecha_id", how="left")
    ventas["fecha"] = pd.to_datetime(ventas["fecha"])
    return ventas


def compute_rfm(ventas: pd.DataFrame) -> pd.DataFrame:
    """Compute Recency, Frequency, Monetary per client."""
    ref_date = ventas["fecha"].max()
    rfm = ventas.groupby("cliente_id").agg(
        ultima_compra=("fecha", "max"),
        frequency=("fecha", "count"),
        monetary=("total_ars", "sum"),
        monetary_usd=("total_usd", "sum") if "total_usd" in ventas.columns else ("total_ars", "sum"),
        primera_compra=("fecha", "min"),
        ticket_promedio=("total_ars", "mean"),
    ).reset_index()
    rfm["recency"] = (ref_date - rfm["ultima_compra"]).dt.days
    rfm["antiguedad_dias"] = (rfm["ultima_compra"] - rfm["primera_compra"]).dt.days
    return rfm


def find_optimal_k(X_scaled: np.ndarray, k_range: range, logger: logging.Logger) -> int:
    """Elbow method + Silhouette to find best k."""
    inertias, silhouettes = [], []
    for k in k_range:
        km = KMeans(n_clusters=k, n_init=20, random_state=42, max_iter=300)
        labels = km.fit_predict(X_scaled)
        inertias.append(km.inertia_)
        if k > 1:
            silhouettes.append(silhouette_score(X_scaled, labels, sample_size=min(5000, len(X_scaled))))
        else:
            silhouettes.append(0)

    # Elbow: largest second derivative
    if len(inertias) >= 3:
        deltas = np.diff(inertias)
        deltas2 = np.diff(deltas)
        elbow_k = list(k_range)[np.argmin(deltas2) + 2]
    else:
        elbow_k = k_range[0]

    sil_k = list(k_range)[np.argmax(silhouettes)]
    chosen_k = sil_k  # prefer silhouette

    logger.info(f"Optimal k by elbow: {elbow_k} | Silhouette: {sil_k} → using k={chosen_k}")
    return chosen_k


def assign_segment_labels(rfm: pd.DataFrame, centroids_df: pd.DataFrame) -> pd.Series:
    """
    Map cluster IDs to business segment names based on centroid characteristics.
    Logic:
      - Campeones:  lowest recency, highest frequency, highest monetary
      - Leales:     low recency, high frequency, medium monetary
      - Alto_Valor: medium recency, medium frequency, highest monetary
      - En_Riesgo:  high recency (went quiet recently), was high value
      - Dormidos:   highest recency, low frequency
    """
    c = centroids_df.copy()
    # Normalize for ranking
    for col in ["recency", "frequency", "monetary"]:
        c[f"{col}_rank"] = c[col].rank()

    assigned = {}
    remaining = set(c.index)

    # Dormidos: highest recency, low frequency
    dormidos_score = c["recency_rank"] - c["frequency_rank"]
    dormidos_id = dormidos_score.idxmax()
    assigned[dormidos_id] = "Dormidos"
    remaining.discard(dormidos_id)

    c_r = c.loc[list(remaining)]
    # Campeones: lowest recency + highest frequency + highest monetary
    champions_score = -c_r["recency_rank"] + c_r["frequency_rank"] + c_r["monetary_rank"]
    champions_id = champions_score.idxmax()
    assigned[champions_id] = "Campeones"
    remaining.discard(champions_id)

    c_r = c.loc[list(remaining)]
    # Alto_Valor: highest monetary among remaining
    alto_valor_id = c_r["monetary_rank"].idxmax()
    assigned[alto_valor_id] = "Alto_Valor"
    remaining.discard(alto_valor_id)

    c_r = c.loc[list(remaining)]
    # En_Riesgo: higher recency among remaining
    en_riesgo_id = c_r["recency_rank"].idxmax()
    assigned[en_riesgo_id] = "En_Riesgo"
    remaining.discard(en_riesgo_id)

    for r in remaining:
        assigned[r] = "Leales"

    return rfm["cluster"].map(assigned)


def train(
    rfm: pd.DataFrame,
    n_clusters: int,
    logger: logging.Logger,
) -> Tuple[KMeans, RobustScaler, pd.DataFrame, Dict]:
    features = ["recency", "frequency", "monetary"]
    X = rfm[features].copy()

    # Log-transform monetary and frequency (heavy right skew)
    X["frequency"] = np.log1p(X["frequency"])
    X["monetary"] = np.log1p(X["monetary"])

    scaler = RobustScaler()
    X_scaled = scaler.fit_transform(X)

    if n_clusters == 0:
        n_clusters = find_optimal_k(X_scaled, range(3, 8), logger)

    km = KMeans(n_clusters=n_clusters, n_init=30, max_iter=500, random_state=42)
    labels = km.fit_predict(X_scaled)
    rfm = rfm.copy()
    rfm["cluster"] = labels

    sil = silhouette_score(X_scaled, labels, sample_size=min(5000, len(labels)))
    db = davies_bouldin_score(X_scaled, labels)
    logger.info(f"KMeans k={n_clusters} | Silhouette: {sil:.4f} | Davies-Bouldin: {db:.4f}")

    # Centroid profiles in original scale
    centroids_scaled = pd.DataFrame(km.cluster_centers_, columns=features)
    centroids_original = pd.DataFrame(
        scaler.inverse_transform(centroids_scaled), columns=features
    )
    centroids_original.index = range(n_clusters)
    centroids_original["frequency"] = np.expm1(centroids_original["frequency"])
    centroids_original["monetary"] = np.expm1(centroids_original["monetary"])
    centroids_original["cluster_size"] = rfm["cluster"].value_counts().sort_index().values
    centroids_original["cluster_pct"] = centroids_original["cluster_size"] / len(rfm)

    rfm["segment"] = assign_segment_labels(rfm, centroids_original)
    centroids_original["segment"] = centroids_original.index.map(
        rfm.groupby("cluster")["segment"].first()
    )

    metrics = {
        "n_clusters": n_clusters,
        "silhouette_score": float(sil),
        "davies_bouldin_score": float(db),
        "n_clients": len(rfm),
        "cluster_distribution": rfm["segment"].value_counts().to_dict(),
    }

    logger.info("Cluster profiles:")
    for _, row in centroids_original.iterrows():
        seg = row.get("segment", "?")
        logger.info(
            f"  {seg}: recency={row['recency']:.0f}d | "
            f"freq={row['frequency']:.0f} | "
            f"monetary=ARS {row['monetary']:,.0f} | "
            f"n={row['cluster_size']:,} ({row['cluster_pct']:.1%})"
        )

    return km, scaler, rfm, centroids_original, metrics


def enrich_segments(rfm: pd.DataFrame) -> pd.DataFrame:
    """Add segment metadata and recommended actions."""
    rfm = rfm.copy()
    rfm["accion_recomendada"] = rfm["segment"].map(
        {k: v["accion"] for k, v in SEGMENT_PROFILES.items()}
    )
    rfm["color"] = rfm["segment"].map(
        {k: v["color"] for k, v in SEGMENT_PROFILES.items()}
    )
    # RFM scores (quintile-based) for display
    rfm["r_score"] = pd.qcut(rfm["recency"], 5, labels=[5, 4, 3, 2, 1]).astype(int)
    rfm["f_score"] = pd.qcut(rfm["frequency"].rank(method="first"), 5, labels=[1, 2, 3, 4, 5]).astype(int)
    rfm["m_score"] = pd.qcut(rfm["monetary"].rank(method="first"), 5, labels=[1, 2, 3, 4, 5]).astype(int)
    rfm["rfm_score"] = rfm["r_score"] + rfm["f_score"] + rfm["m_score"]
    return rfm


def run(
    conn_str: Optional[str] = None,
    schema: str = "agronova",
    csv_dir: Optional[Path] = None,
    output_dir: Path = ARTIFACTS_DIR,
    n_clusters: int = 5,
    verbose: bool = False,
) -> Dict:
    logger = setup_logging(verbose)
    logger.info("=== AgroNova Customer Segmentation ===")

    if conn_str:
        ventas = load_from_db(conn_str, schema)
    else:
        ventas = load_from_csv(csv_dir or DATA_DIR)

    rfm = compute_rfm(ventas)
    logger.info(f"RFM computed for {len(rfm):,} clients")

    km, scaler, rfm_clustered, centroids, metrics = train(rfm, n_clusters, logger)
    rfm_enriched = enrich_segments(rfm_clustered)

    # Save
    output_dir.mkdir(parents=True, exist_ok=True)
    joblib.dump(km, output_dir / "segmentation_kmeans.pkl")
    joblib.dump(scaler, output_dir / "segmentation_scaler.pkl")
    rfm_enriched.to_csv(output_dir / "client_segments.csv", index=False)
    centroids.to_csv(output_dir / "segment_centroids.csv", index=False)
    with open(output_dir / "segmentation_metrics.json", "w") as f:
        json.dump(metrics, f, indent=2, default=str)

    logger.info(f"Segment distribution:")
    for seg, cnt in rfm_enriched["segment"].value_counts().items():
        pct = cnt / len(rfm_enriched)
        logger.info(f"  {seg}: {cnt:,} ({pct:.1%})")

    logger.info(f"Artifacts saved to {output_dir}")
    return metrics


def main():
    parser = argparse.ArgumentParser(description="AgroNova Customer Segmentation")
    parser.add_argument("--conn", help="PostgreSQL connection string")
    parser.add_argument("--schema", default="agronova")
    parser.add_argument("--csv-dir", type=Path)
    parser.add_argument("--output-dir", type=Path, default=ARTIFACTS_DIR)
    parser.add_argument("--n-clusters", type=int, default=5,
                        help="Number of clusters (0=auto-detect)")
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args()

    try:
        metrics = run(
            conn_str=args.conn,
            schema=args.schema,
            csv_dir=args.csv_dir,
            output_dir=args.output_dir,
            n_clusters=args.n_clusters,
            verbose=args.verbose,
        )
        print(json.dumps(metrics, indent=2, default=str))
    except Exception as e:
        logging.error(str(e))
        sys.exit(1)


if __name__ == "__main__":
    main()

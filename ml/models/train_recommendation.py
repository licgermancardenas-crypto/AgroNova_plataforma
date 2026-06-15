"""
Product Recommendation — AgroNova Argentina S.A.
Two complementary approaches:

1. Collaborative Filtering (SVD via TruncatedSVD)
   - User-item matrix: client × product, weighted by purchase frequency
   - Generates top-N product recommendations per client

2. Association Rules (co-occurrence)
   - Products frequently bought together in the same transaction basket
   - Cross-selling rules: if client buys A, recommend B
   - Output: support, confidence, lift for each rule

Usage:
    python train_recommendation.py
    python train_recommendation.py --conn postgresql://user:pass@host/db
    python train_recommendation.py --csv-dir ../../data/processed --top-n 5
"""

import argparse
import json
import logging
import sys
from itertools import combinations
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import joblib
import numpy as np
import pandas as pd
from scipy.sparse import csr_matrix
from sklearn.decomposition import TruncatedSVD
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.preprocessing import normalize

ML_DIR = Path(__file__).resolve().parent.parent
ARTIFACTS_DIR = ML_DIR / "artifacts"
DATA_DIR = ML_DIR.parent / "data" / "processed"


def setup_logging(verbose: bool = False) -> logging.Logger:
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level, format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    return logging.getLogger("recommendation")


def load_from_db(conn_str: str, schema: str = "agronova") -> pd.DataFrame:
    import sqlalchemy as sa
    engine = sa.create_engine(conn_str)
    with engine.connect() as conn:
        ventas = pd.read_sql(
            f"""
            SELECT v.cliente_id, v.producto_id, p.nombre_producto, p.categoria,
                   v.cantidad, v.total_ars, v.fecha_id
            FROM {schema}.fact_ventas v
            JOIN {schema}.dim_producto p ON p.producto_id = v.producto_id
            WHERE v.estado = 'Completada'
            """,
            conn,
        )
    return ventas


def load_from_csv(csv_dir: Path) -> pd.DataFrame:
    ventas = pd.read_csv(csv_dir / "fact_ventas.csv")
    productos = pd.read_csv(csv_dir / "dim_producto.csv")
    if "estado" in ventas.columns:
        ventas = ventas[ventas["estado"] == "Completada"]
    producto_cols = ["producto_id"] + [c for c in ["nombre_producto", "categoria"] if c in productos.columns]
    ventas = ventas.merge(productos[producto_cols], on="producto_id", how="left")
    return ventas


# ── Collaborative Filtering ──────────────────────────────────────────────────

def build_user_item_matrix(
    ventas: pd.DataFrame,
    logger: logging.Logger,
) -> Tuple[csr_matrix, pd.Index, pd.Index]:
    """Build sparse client × product matrix weighted by purchase frequency."""
    pivot = ventas.groupby(["cliente_id", "producto_id"])["total_ars"].sum().unstack(fill_value=0)
    logger.info(f"User-item matrix: {pivot.shape[0]:,} clients × {pivot.shape[1]:,} products")

    # Log-scale weights to reduce dominance of large purchases
    matrix = np.log1p(pivot.values)
    sparse = csr_matrix(matrix)
    return sparse, pivot.index, pivot.columns


def train_svd(
    sparse_matrix: csr_matrix,
    n_components: int = 50,
    logger: logging.Logger = None,
) -> Tuple[TruncatedSVD, np.ndarray, np.ndarray]:
    """Factorize user-item matrix into latent factors."""
    n_components = min(n_components, min(sparse_matrix.shape) - 1)
    svd = TruncatedSVD(n_components=n_components, random_state=42, n_iter=10)
    user_factors = svd.fit_transform(sparse_matrix)
    item_factors = svd.components_.T

    explained = svd.explained_variance_ratio_.sum()
    if logger:
        logger.info(f"SVD components: {n_components} | Explained variance: {explained:.1%}")

    # Normalize for cosine similarity
    user_factors_norm = normalize(user_factors)
    item_factors_norm = normalize(item_factors)

    return svd, user_factors_norm, item_factors_norm


def generate_cf_recommendations(
    user_factors: np.ndarray,
    item_factors: np.ndarray,
    client_index: pd.Index,
    product_index: pd.Index,
    sparse_matrix: csr_matrix,
    top_n: int = 5,
    logger: logging.Logger = None,
) -> pd.DataFrame:
    """For each client, recommend top-N products not yet purchased."""
    # Score matrix: clients × products
    scores = user_factors @ item_factors.T

    # Set already-purchased items to -inf
    purchased = sparse_matrix.toarray() > 0
    scores[purchased] = -np.inf

    rows = []
    for i, client_id in enumerate(client_index):
        top_items = np.argsort(scores[i])[::-1][:top_n]
        for rank, item_idx in enumerate(top_items, 1):
            if scores[i, item_idx] == -np.inf:
                continue
            rows.append({
                "cliente_id": client_id,
                "producto_id": product_index[item_idx],
                "rank": rank,
                "cf_score": float(scores[i, item_idx]),
                "type": "collaborative_filtering",
            })

    if logger:
        logger.info(f"CF recommendations generated for {len(client_index):,} clients")
    return pd.DataFrame(rows)


# ── Association Rules ────────────────────────────────────────────────────────

def build_baskets(ventas: pd.DataFrame) -> Dict[str, List[str]]:
    """Group products by transaction (fecha_id × cliente_id = basket)."""
    baskets = (
        ventas.groupby(["cliente_id", "fecha_id"])["producto_id"]
        .apply(list)
        .reset_index()
    )
    return baskets


def compute_co_occurrence(
    baskets: pd.DataFrame,
    min_support: float = 0.005,
    logger: logging.Logger = None,
) -> pd.DataFrame:
    """Compute support, confidence, and lift for product pairs."""
    n_baskets = len(baskets)
    product_counts: Dict[str, int] = {}
    pair_counts: Dict[Tuple, int] = {}

    for products in baskets["producto_id"]:
        prods = list(set(str(p) for p in products))
        for p in prods:
            product_counts[p] = product_counts.get(p, 0) + 1
        for pair in combinations(sorted(prods), 2):
            pair_counts[pair] = pair_counts.get(pair, 0) + 1

    min_count = int(min_support * n_baskets)
    rules = []
    for (p1, p2), count in pair_counts.items():
        if count < min_count:
            continue
        support = count / n_baskets
        conf_12 = count / product_counts.get(p1, 1)
        conf_21 = count / product_counts.get(p2, 1)
        lift = support / (
            (product_counts.get(p1, 1) / n_baskets) *
            (product_counts.get(p2, 1) / n_baskets)
        )
        rules.append({
            "antecedente": p1, "consecuente": p2,
            "support": round(support, 5),
            "confidence": round(conf_12, 4),
            "lift": round(lift, 3),
            "co_occurrences": count,
        })
        rules.append({
            "antecedente": p2, "consecuente": p1,
            "support": round(support, 5),
            "confidence": round(conf_21, 4),
            "lift": round(lift, 3),
            "co_occurrences": count,
        })

    rules_df = pd.DataFrame(rules).sort_values("lift", ascending=False)
    if logger:
        logger.info(
            f"Association rules: {len(rules_df):,} rules "
            f"(min_support={min_support}, min_count={min_count})"
        )
    return rules_df


def generate_cross_sell_recommendations(
    ventas: pd.DataFrame,
    rules_df: pd.DataFrame,
    top_n: int = 5,
) -> pd.DataFrame:
    """For each client's purchased products, find high-confidence cross-sell targets."""
    purchased = ventas.groupby("cliente_id")["producto_id"].apply(
        lambda x: set(x.astype(str))
    ).to_dict()

    rows = []
    rules_idx = rules_df.set_index("antecedente")
    for client_id, client_products in purchased.items():
        candidates: Dict[str, float] = {}
        for prod in client_products:
            if prod not in rules_idx.index:
                continue
            related = rules_idx.loc[[prod]].nlargest(top_n * 2, "lift")
            for _, row in related.iterrows():
                target = row["consecuente"]
                if target not in client_products:
                    score = candidates.get(target, 0)
                    candidates[target] = max(score, row["confidence"] * row["lift"])
        for rank, (target, score) in enumerate(
            sorted(candidates.items(), key=lambda x: -x[1])[:top_n], 1
        ):
            rows.append({
                "cliente_id": client_id,
                "producto_id": target,
                "rank": rank,
                "cross_sell_score": round(score, 4),
                "type": "association_rules",
            })

    return pd.DataFrame(rows)


def evaluate_cf(
    sparse_matrix: csr_matrix,
    user_factors: np.ndarray,
    item_factors: np.ndarray,
    test_ratio: float = 0.10,
    logger: logging.Logger = None,
) -> Dict:
    """Hold-out evaluation: mask random 10% of purchases and check recall@N."""
    dense = sparse_matrix.toarray().astype(float)
    n_users, n_items = dense.shape

    # Random mask
    rng = np.random.default_rng(42)
    mask = rng.random(dense.shape) < test_ratio
    mask = mask & (dense > 0)

    scores = user_factors @ item_factors.T
    scores_masked = scores.copy()
    scores_masked[~mask] = -np.inf  # only evaluate masked items

    recall_at = {}
    for k in [5, 10, 20]:
        hits = 0
        total = 0
        for u in range(n_users):
            true_items = np.where(mask[u])[0]
            if len(true_items) == 0:
                continue
            top_k = np.argsort(scores[u])[::-1][:k]
            hits += len(set(true_items) & set(top_k))
            total += len(true_items)
        recall_at[f"recall@{k}"] = hits / total if total > 0 else 0

    if logger:
        for k_name, val in recall_at.items():
            logger.info(f"  CF {k_name}: {val:.4f}")
    return recall_at


def run(
    conn_str: Optional[str] = None,
    schema: str = "agronova",
    csv_dir: Optional[Path] = None,
    output_dir: Path = ARTIFACTS_DIR,
    top_n: int = 5,
    min_support: float = 0.005,
    n_components: int = 50,
    verbose: bool = False,
) -> Dict:
    logger = setup_logging(verbose)
    logger.info("=== AgroNova Product Recommendation ===")

    if conn_str:
        ventas = load_from_db(conn_str, schema)
    else:
        ventas = load_from_csv(csv_dir or DATA_DIR)

    logger.info(f"Transactions: {len(ventas):,} | Clients: {ventas['cliente_id'].nunique():,} | "
                f"Products: {ventas['producto_id'].nunique():,}")

    # ── Collaborative Filtering ──
    logger.info("Training collaborative filtering model...")
    sparse_matrix, client_index, product_index = build_user_item_matrix(ventas, logger)
    svd, user_factors, item_factors = train_svd(sparse_matrix, n_components, logger)
    cf_eval = evaluate_cf(sparse_matrix, user_factors, item_factors, logger=logger)

    cf_recs = generate_cf_recommendations(
        user_factors, item_factors, client_index, product_index,
        sparse_matrix, top_n=top_n, logger=logger,
    )

    # ── Association Rules ──
    logger.info("Computing association rules...")
    baskets = build_baskets(ventas)
    rules_df = compute_co_occurrence(baskets, min_support=min_support, logger=logger)
    xsell_recs = generate_cross_sell_recommendations(ventas, rules_df, top_n=top_n)
    logger.info(f"Cross-sell recommendations: {len(xsell_recs):,} rows")

    # Merge product names if available
    if "nombre_producto" in ventas.columns or "categoria" in ventas.columns:
        prod_meta = ventas[["producto_id"] + [c for c in ["nombre_producto", "categoria"] if c in ventas.columns]]
        prod_meta = prod_meta.drop_duplicates("producto_id")
        cf_recs = cf_recs.merge(prod_meta, on="producto_id", how="left")
        xsell_recs["producto_id"] = xsell_recs["producto_id"].astype(ventas["producto_id"].dtype)
        xsell_recs = xsell_recs.merge(prod_meta, on="producto_id", how="left")

    # Save
    output_dir.mkdir(parents=True, exist_ok=True)
    joblib.dump(svd, output_dir / "recommendation_svd.pkl")
    joblib.dump((client_index, product_index), output_dir / "recommendation_indexes.pkl")
    np.save(output_dir / "recommendation_user_factors.npy", user_factors)
    np.save(output_dir / "recommendation_item_factors.npy", item_factors)

    cf_recs.to_csv(output_dir / "recommendations_cf.csv", index=False)
    xsell_recs.to_csv(output_dir / "recommendations_crosssell.csv", index=False)
    rules_df.head(5000).to_csv(output_dir / "association_rules.csv", index=False)

    metrics = {
        "cf_n_components": int(n_components),
        "cf_n_clients": int(len(client_index)),
        "cf_n_products": int(len(product_index)),
        **{k: round(v, 4) for k, v in cf_eval.items()},
        "association_rules_total": int(len(rules_df)),
        "association_rules_min_support": min_support,
        "top_n": top_n,
    }

    with open(output_dir / "recommendation_metrics.json", "w") as f:
        json.dump(metrics, f, indent=2)

    logger.info(f"Artifacts saved to {output_dir}")
    return metrics


def main():
    parser = argparse.ArgumentParser(description="AgroNova Product Recommendation")
    parser.add_argument("--conn", help="PostgreSQL connection string")
    parser.add_argument("--schema", default="agronova")
    parser.add_argument("--csv-dir", type=Path)
    parser.add_argument("--output-dir", type=Path, default=ARTIFACTS_DIR)
    parser.add_argument("--top-n", type=int, default=5)
    parser.add_argument("--min-support", type=float, default=0.005)
    parser.add_argument("--n-components", type=int, default=50)
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args()

    try:
        metrics = run(
            conn_str=args.conn,
            schema=args.schema,
            csv_dir=args.csv_dir,
            output_dir=args.output_dir,
            top_n=args.top_n,
            min_support=args.min_support,
            n_components=args.n_components,
            verbose=args.verbose,
        )
        print(json.dumps(metrics, indent=2))
    except Exception as e:
        logging.error(str(e))
        sys.exit(1)


if __name__ == "__main__":
    main()

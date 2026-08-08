import datetime
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import silhouette_score
from sklearn.metrics.pairwise import cosine_similarity

from core.db import fetch_df

HOLDOUT_DAYS = 14
TOP_K = 8

def validate_inventory_forecast():
    cutoff = (pd.Timestamp.today().normalize() - pd.Timedelta(days=HOLDOUT_DAYS))
    sales = fetch_df(
        """
        SELECT oi.product_id, oi.quantity, o.created_at::date AS sale_date
        FROM order_items oi JOIN orders o ON o.id = oi.order_id
        WHERE o.status != 'cancelled' AND oi.product_id IS NOT NULL
        """
    )
    if sales.empty:
        return {"note": "No sales history to validate against.", "products_validated": 0}

    sales["sale_date"] = pd.to_datetime(sales["sale_date"])
    train = sales[sales["sale_date"] < cutoff]
    test = sales[sales["sale_date"] >= cutoff]

    train_daily = train.groupby(["product_id", "sale_date"])["quantity"].sum().reset_index()
    train_start = train["sale_date"].min()
    errors = []

    for pid, grp in train_daily.groupby("product_id"):
        train_span_days = max((cutoff - train_start).days, 1) if pd.notna(train_start) else 1
        avg_daily = grp["quantity"].sum() / train_span_days
        predicted = avg_daily * HOLDOUT_DAYS
        actual = test.loc[test["product_id"] == pid, "quantity"].sum()
        errors.append({"product_id": pid, "predicted": predicted, "actual": float(actual)})

    if not errors:
        return {"note": "Not enough products with pre-holdout history.", "products_validated": 0}

    err_df = pd.DataFrame(errors)
    mae = float(np.mean(np.abs(err_df["predicted"] - err_df["actual"])))
    rmse = float(np.sqrt(np.mean((err_df["predicted"] - err_df["actual"]) ** 2)))
    nonzero = err_df[err_df["actual"] > 0]
    mape = float(np.mean(np.abs((nonzero["predicted"] - nonzero["actual"]) / nonzero["actual"])) * 100) if len(nonzero) else None

    return {
        "holdout_window_days": HOLDOUT_DAYS,
        "products_validated": int(len(err_df)),
        "mae": round(mae, 2),
        "rmse": round(rmse, 2),
        "mape_pct": round(mape, 1) if mape is not None else None,
        "interpretation": "MAE/RMSE are in units sold over the holdout window (lower is better).",
    }

def validate_recommendations():
    cutoff = (pd.Timestamp.today().normalize() - pd.Timedelta(days=HOLDOUT_DAYS))
    orders = fetch_df(
        """
        SELECT o.customer_id, oi.product_id, oi.quantity, o.created_at::date AS order_date
        FROM order_items oi JOIN orders o ON o.id = oi.order_id
        WHERE o.status != 'cancelled' AND o.customer_id IS NOT NULL AND oi.product_id IS NOT NULL
        """
    )
    if orders.empty:
        return {"note": "No order history to validate against.", "customers_validated": 0}

    orders["order_date"] = pd.to_datetime(orders["order_date"])
    train = orders[orders["order_date"] < cutoff]
    test = orders[orders["order_date"] >= cutoff]

    if train.empty or test.empty:
        return {"note": "Not enough data on both sides of the holdout window yet.", "customers_validated": 0}

    matrix = train.pivot_table(index="customer_id", columns="product_id", values="quantity", aggfunc="sum", fill_value=0)
    if matrix.shape[1] < 2:
        return {"note": "Not enough distinct products purchased pre-holdout to build similarity.", "customers_validated": 0}

    item_sim = pd.DataFrame(cosine_similarity(matrix.T), index=matrix.columns, columns=matrix.columns)

    precisions, recalls = [], []
    for cid in test["customer_id"].unique():
        bought_train = train.loc[train["customer_id"] == cid, "product_id"].unique().tolist()
        bought_test = set(test.loc[test["customer_id"] == cid, "product_id"].unique().tolist())
        if not bought_train or not bought_test:
            continue

        candidates = [p for p in matrix.columns if p not in bought_train]
        if not candidates:
            continue
        scores = pd.Series(0.0, index=candidates)
        for pid in bought_train:
            if pid in item_sim.index:
                scores = scores.add(item_sim.loc[pid, candidates], fill_value=0)

        top_k = set(scores.sort_values(ascending=False).head(TOP_K).index)
        hits = len(top_k & bought_test)
        precisions.append(hits / TOP_K)
        recalls.append(hits / len(bought_test))

    if not precisions:
        return {"note": "No customers had both pre- and post-holdout purchases to score.", "customers_validated": 0}

    return {
        "holdout_window_days": HOLDOUT_DAYS,
        "top_k": TOP_K,
        "customers_validated": len(precisions),
        "precision_at_k": round(float(np.mean(precisions)), 3),
        "recall_at_k": round(float(np.mean(recalls)), 3),
        "interpretation": "Precision@K/Recall@K computed by training on orders before the holdout "
                           "window and checking whether real post-holdout purchases appear in the "
                           "resulting top-K recommendations.",
    }

def validate_segmentation():
    orders = fetch_df(
        "SELECT customer_id, total_amount, created_at::date AS order_date FROM orders WHERE status != 'cancelled' AND customer_id IS NOT NULL"
    )
    if orders.empty or orders["customer_id"].nunique() < 4:
        return {"note": "Not enough customers with order history to validate segmentation.", "silhouette_score": None}

    today = pd.Timestamp.today().normalize()
    rfm = orders.groupby("customer_id").agg(
        recency_days=("order_date", lambda s: (today - pd.to_datetime(s).max()).days),
        frequency=("order_date", "count"),
        monetary=("total_amount", "sum"),
    ).reset_index()

    X = StandardScaler().fit_transform(rfm[["recency_days", "frequency", "monetary"]])
    n_clusters = min(4, max(2, len(rfm) // 2))
    km = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
    labels = km.fit_predict(X)
    score = float(silhouette_score(X, labels))

    return {
        "n_clusters": n_clusters,
        "silhouette_score": round(score, 3),
        "interpretation": "Silhouette score ranges -1..1; above ~0.25 indicates reasonably "
                           "separated segments for behavioral (non-geometric) customer data.",
    }

def run() -> dict:
    inv = validate_inventory_forecast()
    rec = validate_recommendations()
    seg = validate_segmentation()
    payload = {
        "generated_at": datetime.datetime.now().isoformat(),
        "inventory_forecast": inv,
        "recommendations": rec,
        "segmentation": seg,
    }
    metrics = {
        "inventory_mae": inv.get("mae"),
        "inventory_rmse": inv.get("rmse"),
        "recommendation_precision_at_k": rec.get("precision_at_k"),
        "recommendation_recall_at_k": rec.get("recall_at_k"),
        "segmentation_silhouette": seg.get("silhouette_score"),
    }
    return {"payload": payload, "metrics": metrics}

if __name__ == "__main__":
    import json
    print(json.dumps(run(), default=str, indent=2)[:800])

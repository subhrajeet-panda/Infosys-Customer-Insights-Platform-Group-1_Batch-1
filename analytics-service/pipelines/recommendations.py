import datetime
import numpy as np
import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.preprocessing import MinMaxScaler

from core.db import fetch_df

TOP_N = 8

def build_content_similarity(products: pd.DataFrame):
    cats = pd.get_dummies(products["category"].fillna("Uncategorized"), prefix="cat")
    price_scaled = MinMaxScaler().fit_transform(products[["price"]].fillna(0))
    features = np.hstack([cats.values, price_scaled])
    sim = cosine_similarity(features)
    return pd.DataFrame(sim, index=products["product_id"], columns=products["product_id"])

def run() -> dict:
    products = fetch_df(
        """
        SELECT p.id AS product_id, p.name, p.category, p.price, p.vendor_id, v.business_name AS vendor_name
        FROM products p JOIN vendors v ON v.id = p.vendor_id
        WHERE p.status = 'active' AND v.status = 'approved'
        """
    )
    orders = fetch_df(
        """
        SELECT o.customer_id, oi.product_id, oi.quantity
        FROM order_items oi JOIN orders o ON o.id = oi.order_id
        WHERE o.status != 'cancelled' AND o.customer_id IS NOT NULL AND oi.product_id IS NOT NULL
        """
    )
    customers = fetch_df("SELECT id AS customer_id, name FROM users WHERE role = 'customer'")

    if products.empty:
        return {"payload": {
            "generated_at": datetime.datetime.now().isoformat(),
            "note": "No active products to recommend yet.",
            "customer_recommendations": [], "similar_products": [],
        }, "metrics": {"customers_with_recommendations": 0}}

    content_sim = build_content_similarity(products)

    collab_sim = None
    if not orders.empty and orders["customer_id"].nunique() >= 2:
        matrix = orders.pivot_table(index="customer_id", columns="product_id", values="quantity", aggfunc="sum", fill_value=0)
        matrix = matrix.reindex(columns=products["product_id"], fill_value=0)
        if matrix.shape[1] > 1:
            item_sim = cosine_similarity(matrix.T)
            collab_sim = pd.DataFrame(item_sim, index=matrix.columns, columns=matrix.columns)

    def hybrid_score_for_customer(customer_id):
        bought = orders.loc[orders["customer_id"] == customer_id, "product_id"].unique().tolist()
        candidates = products[~products["product_id"].isin(bought)].copy()
        if candidates.empty:
            return []

        collab_weight = 0.7 if (collab_sim is not None and len(bought) > 0) else 0.0
        content_weight = 1.0 - collab_weight

        scores = pd.Series(0.0, index=candidates["product_id"])
        if collab_weight > 0:
            for pid in bought:
                if pid in collab_sim.index:
                    scores = scores.add(collab_sim.loc[pid, candidates["product_id"]] * collab_weight, fill_value=0)
        if content_weight > 0 and bought:
            for pid in bought:
                if pid in content_sim.index:
                    scores = scores.add(content_sim.loc[pid, candidates["product_id"]] * content_weight, fill_value=0)
        elif not bought:
            pop = orders["product_id"].value_counts()
            scores = candidates["product_id"].map(pop).fillna(0).astype(float)
            scores.index = candidates["product_id"]

        top = scores.sort_values(ascending=False).head(TOP_N)
        result = []
        for pid, score in top.items():
            row = products.loc[products["product_id"] == pid].iloc[0]
            result.append({
                "product_id": pid, "name": row["name"], "category": row["category"],
                "price": float(row["price"]), "vendor_name": row["vendor_name"],
                "score": round(float(score), 4),
            })
        return result

    customer_recs = []
    for _, c in customers.iterrows():
        recs = hybrid_score_for_customer(c["customer_id"])
        if recs:
            customer_recs.append({"customer_id": c["customer_id"], "customer_name": c["name"], "recommendations": recs})

    similar_products = []
    for _, p in products.iterrows():
        pid = p["product_id"]
        if collab_sim is not None and pid in collab_sim.index and collab_sim.loc[pid].sum() > 1:
            sims = collab_sim.loc[pid].drop(pid, errors="ignore").sort_values(ascending=False).head(5)
            method = "collaborative"
        else:
            sims = content_sim.loc[pid].drop(pid, errors="ignore").sort_values(ascending=False).head(5)
            method = "content_based"
        related = []
        for rpid, score in sims.items():
            if score <= 0:
                continue
            row = products.loc[products["product_id"] == rpid]
            if row.empty:
                continue
            row = row.iloc[0]
            related.append({"product_id": rpid, "name": row["name"], "score": round(float(score), 4)})
        similar_products.append({"product_id": pid, "product_name": p["name"], "method": method, "related": related})

    payload = {
        "generated_at": datetime.datetime.now().isoformat(),
        "method": "Hybrid: item-item collaborative filtering (co-purchase cosine similarity) "
                  "blended with content-based filtering (category + price cosine similarity); "
                  "popularity fallback for cold-start customers.",
        "customers_with_recommendations": len(customer_recs),
        "customer_recommendations": customer_recs,
        "similar_products": similar_products,
    }
    return {"payload": payload, "metrics": {"customers_with_recommendations": len(customer_recs)}}

if __name__ == "__main__":
    import json
    print(json.dumps(run(), default=str, indent=2)[:500])

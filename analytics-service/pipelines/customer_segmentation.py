import datetime
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import silhouette_score

from core.db import fetch_df

N_CLUSTERS = 4

def label_cluster(row):
    if row["monetary"] >= row["monetary_p75"] and row["recency_days"] <= row["recency_p50"]:
        return "Champions"
    if row["frequency"] >= row["frequency_p50"] and row["recency_days"] <= row["recency_p75"]:
        return "Loyal Customers"
    if row["recency_days"] > row["recency_p75"]:
        return "At Risk"
    return "New / Low Engagement"

def run() -> dict:
    orders = fetch_df(
        """
        SELECT o.customer_id, o.total_amount, o.created_at::date AS order_date
        FROM orders o WHERE o.status != 'cancelled' AND o.customer_id IS NOT NULL
        """
    )
    events = fetch_df(
        """
        SELECT customer_id, event_type, COUNT(*) AS cnt
        FROM customer_events WHERE customer_id IS NOT NULL
        GROUP BY customer_id, event_type
        """
    )
    customers = fetch_df("SELECT id AS customer_id, name, email FROM users WHERE role = 'customer'")

    if orders.empty or customers.empty:
        return {"payload": {
            "generated_at": datetime.datetime.now().isoformat(),
            "note": "Not enough order history yet to segment customers.",
            "customers": [], "segment_summary": [], "silhouette_score": None,
        }, "metrics": {"silhouette_score": None}}

    today = pd.Timestamp.today().normalize()
    rfm = orders.groupby("customer_id").agg(
        recency_days=("order_date", lambda s: (today - pd.to_datetime(s).max()).days),
        frequency=("order_date", "count"),
        monetary=("total_amount", "sum"),
    ).reset_index()

    rfm = customers.merge(rfm, on="customer_id", how="left")
    rfm = rfm.fillna({"recency_days": 9999, "frequency": 0, "monetary": 0})

    engagement = events.pivot_table(index="customer_id", columns="event_type", values="cnt", fill_value=0).reset_index()
    rfm = rfm.merge(engagement, on="customer_id", how="left").fillna(0)

    feature_cols = ["recency_days", "frequency", "monetary"]
    X = rfm[feature_cols].values
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    n_clusters = min(N_CLUSTERS, max(2, len(rfm) // 2)) if len(rfm) >= 4 else min(2, len(rfm))
    if len(rfm) < 2:
        rfm["cluster"] = 0
        sil_score = None
    else:
        km = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        rfm["cluster"] = km.fit_predict(X_scaled)
        try:
            sil_score = float(silhouette_score(X_scaled, rfm["cluster"])) if n_clusters > 1 else None
        except ValueError:
            sil_score = None

    rfm["recency_p50"] = rfm["recency_days"].median()
    rfm["recency_p75"] = rfm["recency_days"].quantile(0.75)
    rfm["frequency_p50"] = rfm["frequency"].median()
    rfm["monetary_p75"] = rfm["monetary"].quantile(0.75)
    rfm["segment_label"] = rfm.apply(label_cluster, axis=1)

    segment_summary = (
        rfm.groupby("segment_label")
        .agg(customers=("customer_id", "count"),
             avg_recency_days=("recency_days", "mean"),
             avg_frequency=("frequency", "mean"),
             avg_monetary=("monetary", "mean"))
        .reset_index()
        .to_dict(orient="records")
    )

    customer_rows = rfm[[
        "customer_id", "name", "email", "recency_days", "frequency", "monetary",
        "cluster", "segment_label",
    ]].to_dict(orient="records")

    payload = {
        "generated_at": datetime.datetime.now().isoformat(),
        "method": "RFM features + KMeans clustering (StandardScaler-normalized)",
        "n_clusters": int(n_clusters),
        "silhouette_score": sil_score,
        "segment_summary": segment_summary,
        "customers": customer_rows,
    }
    return {"payload": payload, "metrics": {"silhouette_score": sil_score, "n_clusters": int(n_clusters)}}

if __name__ == "__main__":
    import json
    print(json.dumps(run(), default=str, indent=2)[:500])

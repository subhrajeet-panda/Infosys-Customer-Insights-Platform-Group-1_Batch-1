import datetime
import numpy as np
import pandas as pd

from core.db import fetch_df

WINDOW_DAYS = 30
TREND_MONTHS = 6
TOP_N_CATEGORIES = 5
TOP_N_VENDORS = 5

def monthly_trend(orders_df: pd.DataFrame, today: pd.Timestamp) -> list:
                                                  
    buckets = []
    for m in range(TREND_MONTHS - 1, -1, -1):
        month_start = (today - pd.DateOffset(months=m)).replace(day=1)
        month_end = (month_start + pd.DateOffset(months=1)) - pd.Timedelta(days=1)
        mask = (orders_df["order_date"] >= month_start.date()) & (orders_df["order_date"] <= month_end.date())
        spend = float(orders_df.loc[mask, "total_amount"].sum())
        buckets.append({"month_label": month_start.strftime("%Y-%m"), "spend": round(spend, 2)})
    return buckets

def run() -> dict:
    today = pd.Timestamp.today().normalize()
    cur_start = (today - pd.Timedelta(days=WINDOW_DAYS)).date().isoformat()
    prior_start = (today - pd.Timedelta(days=2 * WINDOW_DAYS)).date().isoformat()
    history_start = (today - pd.DateOffset(months=TREND_MONTHS)).date().isoformat()

    customers = fetch_df("SELECT id AS customer_id, name, email FROM users WHERE role = 'customer'")
    orders = fetch_df(
        """
        SELECT o.customer_id, o.vendor_id, o.total_amount, o.created_at::date AS order_date
        FROM orders o WHERE o.status != 'cancelled' AND o.customer_id IS NOT NULL
        """
    )
    items = fetch_df(
        """
        SELECT o.customer_id, oi.category, oi.subtotal, o.created_at::date AS order_date
        FROM order_items oi JOIN orders o ON o.id = oi.order_id
        WHERE o.status != 'cancelled' AND o.customer_id IS NOT NULL
        """
    )
    vendors = fetch_df("SELECT id AS vendor_id, business_name AS vendor_name FROM vendors")

    if customers.empty:
        return {"payload": {
            "generated_at": datetime.datetime.now().isoformat(),
            "note": "No customers yet to analyze.",
            "customers": [], "marketplace_context": {},
        }, "metrics": {}}

    cur_orders = orders[orders["order_date"] >= pd.Timestamp(cur_start).date()]
    prior_orders = orders[
        (orders["order_date"] >= pd.Timestamp(prior_start).date())
        & (orders["order_date"] < pd.Timestamp(cur_start).date())
    ]

    all_agg = orders.groupby("customer_id").agg(
        total_spent=("total_amount", "sum"), total_orders=("total_amount", "count"),
        first_order_date=("order_date", "min"), last_order_date=("order_date", "max"),
    ).reset_index()
    cur_agg = cur_orders.groupby("customer_id").agg(current_period_spend=("total_amount", "sum")).reset_index()
    prior_agg = prior_orders.groupby("customer_id").agg(prior_period_spend=("total_amount", "sum")).reset_index()

    df = customers.merge(all_agg, on="customer_id", how="left") \
        .merge(cur_agg, on="customer_id", how="left") \
        .merge(prior_agg, on="customer_id", how="left")
    df[["total_spent", "total_orders", "current_period_spend", "prior_period_spend"]] = df[
        ["total_spent", "total_orders", "current_period_spend", "prior_period_spend"]
    ].fillna(0)

    df["avg_order_value"] = np.where(df["total_orders"] > 0, df["total_spent"] / df["total_orders"], 0)
    df["growth_pct"] = np.where(
        df["prior_period_spend"] > 0,
        ((df["current_period_spend"] - df["prior_period_spend"]) / df["prior_period_spend"]) * 100,
        np.where(df["current_period_spend"] > 0, 100.0, 0.0),
    )
    df["spending_percentile"] = df["total_spent"].rank(pct=True) * 100

    trend_orders = orders[orders["order_date"] >= pd.Timestamp(history_start).date()]

    customer_rows = []
    for _, row in df.iterrows():
        cid = row["customer_id"]
        cust_orders = trend_orders[trend_orders["customer_id"] == cid]
        cust_items = items[items["customer_id"] == cid]

        category_breakdown = []
        if not cust_items.empty:
            cat_agg = cust_items.groupby("category")["subtotal"].sum().sort_values(ascending=False).head(TOP_N_CATEGORIES)
            total_item_spend = float(cust_items["subtotal"].sum())
            for cat, amount in cat_agg.items():
                category_breakdown.append({
                    "category": cat or "Uncategorized",
                    "amount": round(float(amount), 2),
                    "pct": round(float(amount) / total_item_spend * 100, 1) if total_item_spend > 0 else 0.0,
                })

        vendor_breakdown = []
        cust_all_orders = orders[orders["customer_id"] == cid]
        if not cust_all_orders.empty:
            vend_agg = cust_all_orders.groupby("vendor_id")["total_amount"].sum().sort_values(ascending=False).head(TOP_N_VENDORS)
            for vid, amount in vend_agg.items():
                vname_row = vendors.loc[vendors["vendor_id"] == vid, "vendor_name"]
                vendor_breakdown.append({
                    "vendor_id": vid,
                    "vendor_name": vname_row.iloc[0] if len(vname_row) else "Unknown vendor",
                    "amount": round(float(amount), 2),
                })

        customer_rows.append({
            "customer_id": cid,
            "name": row["name"],
            "total_spent": round(float(row["total_spent"]), 2),
            "total_orders": int(row["total_orders"]),
            "avg_order_value": round(float(row["avg_order_value"]), 2),
            "current_period_spend": round(float(row["current_period_spend"]), 2),
            "prior_period_spend": round(float(row["prior_period_spend"]), 2),
            "growth_pct": round(float(row["growth_pct"]), 2),
            "spending_percentile": round(float(row["spending_percentile"]), 1),
            "first_order_date": row["first_order_date"].isoformat() if pd.notna(row["first_order_date"]) else None,
            "last_order_date": row["last_order_date"].isoformat() if pd.notna(row["last_order_date"]) else None,
            "monthly_trend": monthly_trend(cust_orders, today),
            "category_breakdown": category_breakdown,
            "vendor_breakdown": vendor_breakdown,
            "top_category": category_breakdown[0]["category"] if category_breakdown else None,
        })

    marketplace_context = {
        "customer_count": int(len(df)),
        "avg_total_spent": round(float(df["total_spent"].mean()), 2) if len(df) else 0.0,
        "median_total_spent": round(float(df["total_spent"].median()), 2) if len(df) else 0.0,
    }

    payload = {
        "generated_at": datetime.datetime.now().isoformat(),
        "method": "Period-over-period (last 30d vs prior 30d) spend growth, percentile rank "
                  "among all customers, a 6-month monthly spending trend, and category/vendor "
                  "breakdowns of where each customer's money goes.",
        "marketplace_context": marketplace_context,
        "customers": customer_rows,
    }
    return {"payload": payload, "metrics": {
        "customer_count": int(len(df)),
        "avg_total_spent": marketplace_context["avg_total_spent"],
    }}

def flatten_for_export(record: dict) -> list:
\
\
                                                                             
    rows = [
        {"section": "summary", "metric": "total_spent", "value": record["total_spent"]},
        {"section": "summary", "metric": "total_orders", "value": record["total_orders"]},
        {"section": "summary", "metric": "avg_order_value", "value": record["avg_order_value"]},
        {"section": "summary", "metric": "growth_pct_last_30d", "value": record["growth_pct"]},
        {"section": "summary", "metric": "spending_percentile", "value": record["spending_percentile"]},
        {"section": "summary", "metric": "top_category", "value": record["top_category"]},
        {"section": "summary", "metric": "first_order_date", "value": record["first_order_date"]},
        {"section": "summary", "metric": "last_order_date", "value": record["last_order_date"]},
    ]
    for m in record["monthly_trend"]:
        rows.append({"section": "monthly_trend", "metric": m["month_label"], "value": m["spend"]})
    for c in record["category_breakdown"]:
        rows.append({"section": "category_breakdown", "metric": c["category"], "value": c["amount"]})
    for v in record["vendor_breakdown"]:
        rows.append({"section": "vendor_breakdown", "metric": v["vendor_name"], "value": v["amount"]})
    return rows

if __name__ == "__main__":
    import json
    print(json.dumps(run(), default=str, indent=2)[:800])

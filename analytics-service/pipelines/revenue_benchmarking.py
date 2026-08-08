import datetime
import numpy as np
import pandas as pd

from core.db import fetch_df

WINDOW_DAYS = 30
TREND_WEEKS = 12
HISTORY_DAYS = max(2 * WINDOW_DAYS, TREND_WEEKS * 7)

def weekly_trend(orders_df: pd.DataFrame, today: pd.Timestamp) -> list:
                
    buckets = []
    for w in range(TREND_WEEKS - 1, -1, -1):
        start = (today - pd.Timedelta(days=(w + 1) * 7 - 1)).date()
        end = (today - pd.Timedelta(days=w * 7)).date()
        mask = (orders_df["order_date"] >= start) & (orders_df["order_date"] <= end)
        revenue = float(orders_df.loc[mask, "total_amount"].sum())
        buckets.append({"week_label": start.isoformat(), "revenue": round(revenue, 2)})
    return buckets

def project_next_30d(trend: list) -> dict:
                                                                       
    values = np.array([b["revenue"] for b in trend], dtype=float)
    n = len(values)
    if n < 2 or not np.any(values):
        return {"projected_revenue": 0.0, "trend_direction": "insufficient_data"}

    x = np.arange(n)
    slope, intercept = np.polyfit(x, values, 1)
                                                                          
    future_weeks = np.arange(n, n + 5)
    projected_weekly = np.clip(slope * future_weeks + intercept, 0, None)
                                                                
    projected_total = float(np.sum(projected_weekly[:4]) + projected_weekly[4] * (2 / 7))

    direction = "rising" if slope > (np.mean(values) * 0.02 if np.mean(values) else 0.02) else (
        "falling" if slope < -(np.mean(values) * 0.02 if np.mean(values) else 0.02) else "stable"
    )
    return {"projected_revenue": round(projected_total, 2), "trend_direction": direction}

def category_summary(df: pd.DataFrame) -> list:
                                                                        
    agg = df.groupby("category").agg(
        vendor_count=("vendor_id", "count"),
        total_revenue_current=("revenue_current", "sum"),
        total_revenue_prior=("revenue_prior", "sum"),
        avg_aov=("aov_current", "mean"),
    ).reset_index()
    agg["growth_pct"] = np.where(
        agg["total_revenue_prior"] > 0,
        ((agg["total_revenue_current"] - agg["total_revenue_prior"]) / agg["total_revenue_prior"]) * 100,
        np.where(agg["total_revenue_current"] > 0, 100.0, 0.0),
    )
    return agg.round(2).sort_values("total_revenue_current", ascending=False).to_dict(orient="records")

def run() -> dict:
    today = pd.Timestamp.today().normalize()
    cur_start = (today - pd.Timedelta(days=WINDOW_DAYS)).date().isoformat()
    prior_start = (today - pd.Timedelta(days=2 * WINDOW_DAYS)).date().isoformat()
    history_start = (today - pd.Timedelta(days=HISTORY_DAYS)).date().isoformat()

    vendors = fetch_df(
        """
        SELECT id AS vendor_id, business_name AS vendor_name, categories
        FROM vendors WHERE status = 'approved'
        """
    )
    orders = fetch_df(
        """
        SELECT vendor_id, total_amount, created_at::date AS order_date
        FROM orders
        WHERE status != 'cancelled' AND created_at::date >= %(history_start)s
        """,
        params={"history_start": history_start},
    )

    if vendors.empty:
        return {"payload": {
            "generated_at": datetime.datetime.now().isoformat(),
            "note": "No approved vendors yet to benchmark.",
            "vendors": [], "marketplace_summary": {},
        }, "metrics": {}}

    def first_category(cats):
        if isinstance(cats, (list, np.ndarray)) and len(cats):
            return cats[0]
        return "Uncategorized"
    vendors["category"] = vendors["categories"].apply(first_category)

    cur_orders = orders[orders["order_date"] >= pd.Timestamp(cur_start).date()]
    prior_orders = orders[
        (orders["order_date"] >= pd.Timestamp(prior_start).date())
        & (orders["order_date"] < pd.Timestamp(cur_start).date())
    ]

    cur_agg = cur_orders.groupby("vendor_id").agg(
        revenue_current=("total_amount", "sum"), orders_current=("total_amount", "count"),
    ).reset_index()
    prior_agg = prior_orders.groupby("vendor_id").agg(
        revenue_prior=("total_amount", "sum"),
    ).reset_index()

    df = vendors.merge(cur_agg, on="vendor_id", how="left").merge(prior_agg, on="vendor_id", how="left")
    df[["revenue_current", "orders_current", "revenue_prior"]] = df[
        ["revenue_current", "orders_current", "revenue_prior"]
    ].fillna(0)

    df["aov_current"] = np.where(df["orders_current"] > 0, df["revenue_current"] / df["orders_current"], 0)
    df["growth_pct"] = np.where(
        df["revenue_prior"] > 0,
        ((df["revenue_current"] - df["revenue_prior"]) / df["revenue_prior"]) * 100,
        np.where(df["revenue_current"] > 0, 100.0, 0.0),
    )
    df["revenue_percentile"] = df["revenue_current"].rank(pct=True) * 100

    category_avg_aov = df.groupby("category")["aov_current"].transform(
        lambda s: (s.sum() - s) / max(len(s) - 1, 1) if len(s) > 1 else s
    )
    df["category_avg_aov"] = category_avg_aov
    df["aov_vs_category_pct"] = np.where(
        df["category_avg_aov"] > 0,
        ((df["aov_current"] - df["category_avg_aov"]) / df["category_avg_aov"]) * 100,
        0.0,
    )

    vendor_trends = {}
    vendor_projections = {}
    for vid in df["vendor_id"]:
        vendor_orders = orders[orders["vendor_id"] == vid]
        trend = weekly_trend(vendor_orders, today)
        vendor_trends[vid] = trend
        vendor_projections[vid] = project_next_30d(trend)

    vendor_rows = df[[
        "vendor_id", "vendor_name", "category", "revenue_current", "revenue_prior",
        "growth_pct", "orders_current", "aov_current", "revenue_percentile",
        "category_avg_aov", "aov_vs_category_pct",
    ]].round(2).to_dict(orient="records")
    for row in vendor_rows:
        row["revenue_trend"] = vendor_trends[row["vendor_id"]]
        row["projected_next_30d"] = vendor_projections[row["vendor_id"]]
    vendor_rows.sort(key=lambda r: r["revenue_current"], reverse=True)

    total_current = float(df["revenue_current"].sum())
    total_prior = float(df["revenue_prior"].sum())
    marketplace_growth_pct = round(
        ((total_current - total_prior) / total_prior) * 100 if total_prior > 0 else (100.0 if total_current > 0 else 0.0), 2
    )

    q75 = df["revenue_current"].quantile(0.75)
    q25 = df["revenue_current"].quantile(0.25)
    top_quartile = df[df["revenue_current"] >= q75]["vendor_name"].tolist()
    bottom_quartile = df[df["revenue_current"] <= q25]["vendor_name"].tolist()

    category_leaders = (
        df.sort_values("revenue_current", ascending=False)
        .groupby("category")
        .first()[["vendor_name", "revenue_current"]]
        .reset_index()
        .round(2)
        .to_dict(orient="records")
    )

    marketplace_trend = weekly_trend(orders, today)

    marketplace_summary = {
        "window_days": WINDOW_DAYS,
        "trend_weeks": TREND_WEEKS,
        "total_revenue_current": round(total_current, 2),
        "total_revenue_prior": round(total_prior, 2),
        "marketplace_growth_pct": marketplace_growth_pct,
        "vendor_count": int(len(df)),
        "top_quartile_vendors": top_quartile,
        "bottom_quartile_vendors": bottom_quartile,
        "category_leaders": category_leaders,
        "category_summary": category_summary(df),
        "revenue_trend": marketplace_trend,
    }

    payload = {
        "generated_at": datetime.datetime.now().isoformat(),
        "method": "Period-over-period (last 30d vs prior 30d) revenue growth, percentile "
                  "ranking among approved vendors, AOV benchmarked against category peers, "
                  "a rolling 12-week revenue trend, a linear-trend 30-day revenue projection, "
                  "and category-level revenue/growth rollups.",
        "marketplace_summary": marketplace_summary,
        "vendors": vendor_rows,
    }
    return {"payload": payload, "metrics": {
        "marketplace_growth_pct": marketplace_growth_pct,
        "vendor_count": int(len(df)),
    }}

if __name__ == "__main__":
    import json
    print(json.dumps(run(), default=str, indent=2)[:800])

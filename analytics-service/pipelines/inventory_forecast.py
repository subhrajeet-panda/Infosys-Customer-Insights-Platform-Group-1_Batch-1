import datetime
import numpy as np
import pandas as pd

from core.db import fetch_df

LEAD_TIME_DAYS = 5
FORECAST_HORIZON_DAYS = 14
SERVICE_LEVEL_Z = 1.65
HISTORY_WINDOW_DAYS = 90

def forecast_product(daily_series: pd.Series):
    y = daily_series.values.astype(float)
    n = len(y)
    avg_daily_demand = float(np.mean(y)) if n else 0.0
    std_daily_demand = float(np.std(y)) if n else 0.0

    if n >= 2 and np.any(y):
        x = np.arange(n)
        slope, intercept = np.polyfit(x, y, 1)
    else:
        slope, intercept = 0.0, avg_daily_demand

    future_x = np.arange(n, n + FORECAST_HORIZON_DAYS)
    forecast_vals = np.clip(slope * future_x + intercept, 0, None)
    forecast_total = float(np.sum(forecast_vals))
    trend_daily = float(np.mean(forecast_vals)) if len(forecast_vals) else avg_daily_demand

    return {
        "avg_daily_demand": round(avg_daily_demand, 2),
        "trend_daily_demand": round(trend_daily, 2),
        "forecast_next_14_days": round(forecast_total, 1),
        "demand_std": round(std_daily_demand, 2),
        "trend_direction": "rising" if slope > 0.02 else ("falling" if slope < -0.02 else "stable"),
    }

def run() -> dict:
    cutoff = (datetime.date.today() - datetime.timedelta(days=HISTORY_WINDOW_DAYS)).isoformat()

    sales = fetch_df(
        """
        SELECT oi.product_id, oi.quantity, o.created_at::date AS sale_date
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE o.status != 'cancelled' AND o.created_at::date >= %(cutoff)s AND oi.product_id IS NOT NULL
        """,
        params={"cutoff": cutoff},
    )

    products = fetch_df(
        """
        SELECT p.id AS product_id, p.name, p.category, p.stock_quantity, p.vendor_id,
               v.business_name AS vendor_name
        FROM products p JOIN vendors v ON v.id = p.vendor_id
        WHERE p.status != 'inactive'
        """
    )

    date_range = pd.date_range(end=pd.Timestamp.today().normalize(), periods=HISTORY_WINDOW_DAYS, freq="D")

    results = []
    for _, prod in products.iterrows():
        prod_sales = sales[sales["product_id"] == prod["product_id"]]
        daily = prod_sales.groupby("sale_date")["quantity"].sum()
        daily.index = pd.to_datetime(daily.index)
        daily = daily.reindex(date_range, fill_value=0)

        stats = forecast_product(daily)
        current_stock = int(prod["stock_quantity"])

        safety_stock = SERVICE_LEVEL_Z * stats["demand_std"] * np.sqrt(LEAD_TIME_DAYS)
        reorder_point = stats["avg_daily_demand"] * LEAD_TIME_DAYS + safety_stock
        days_until_stockout = (
            round(current_stock / stats["avg_daily_demand"], 1)
            if stats["avg_daily_demand"] > 0 else None
        )
        needs_replenishment = current_stock <= reorder_point

        recommended_qty = 0
        if needs_replenishment:
            target_stock = stats["avg_daily_demand"] * (LEAD_TIME_DAYS + FORECAST_HORIZON_DAYS) + safety_stock
            recommended_qty = max(0, round(target_stock - current_stock))

        results.append({
            "product_id": prod["product_id"],
            "product_name": prod["name"],
            "category": prod["category"],
            "vendor_id": prod["vendor_id"],
            "vendor_name": prod["vendor_name"],
            "current_stock": current_stock,
            **stats,
            "safety_stock": round(safety_stock, 1),
            "reorder_point": round(reorder_point, 1),
            "days_until_stockout": days_until_stockout,
            "needs_replenishment": bool(needs_replenishment),
            "recommended_reorder_qty": int(recommended_qty),
        })

    results.sort(key=lambda r: (not r["needs_replenishment"], r["days_until_stockout"] or 9999))

    payload = {
        "generated_at": datetime.datetime.now().isoformat(),
        "assumptions": {
            "lead_time_days": LEAD_TIME_DAYS,
            "service_level_z": SERVICE_LEVEL_Z,
            "forecast_horizon_days": FORECAST_HORIZON_DAYS,
            "history_window_days": HISTORY_WINDOW_DAYS,
        },
        "summary": {
            "products_analyzed": len(results),
            "products_needing_replenishment": sum(1 for r in results if r["needs_replenishment"]),
        },
        "products": results,
    }

    return {"payload": payload}

if __name__ == "__main__":
    import json
    print(json.dumps(run(), default=str, indent=2)[:500])

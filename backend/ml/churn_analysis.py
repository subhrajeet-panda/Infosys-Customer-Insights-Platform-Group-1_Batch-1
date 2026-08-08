import datetime
import numpy as np
import pandas as pd

from db import fetch_df, save_result

HIGH_RISK_THRESHOLD = 65
MEDIUM_RISK_THRESHOLD = 35

def main():
    orders = fetch_df(
        """
        SELECT o.customer_id, o.total_amount, o.created_at::date AS order_date
        FROM orders o WHERE o.status != 'cancelled' AND o.customer_id IS NOT NULL
        """
    )
    customers = fetch_df("SELECT id AS customer_id, name, email FROM users WHERE role = 'customer'")
    events = fetch_df(
        """
        SELECT customer_id, event_type, created_at::date AS event_date
        FROM customer_events WHERE customer_id IS NOT NULL
        """
    )

    if customers.empty:
        save_result("churn_analysis", {
            "generated_at": datetime.datetime.now().isoformat(),
            "at_risk_customers": [], "summary": {},
        })
        return

    today = pd.Timestamp.today().normalize()
    rows = []

    for _, cust in customers.iterrows():
        cid = cust["customer_id"]
        cust_orders = orders[orders["customer_id"] == cid].sort_values("order_date")

        if cust_orders.empty:
            rows.append({
                "customer_id": cid, "name": cust["name"], "email": cust["email"],
                "orders": 0, "recency_days": None, "risk_score": 50,
                "risk_level": "medium", "still_browsing": False, "reason": "No purchases yet",
            })
            continue

        recency_days = (today - pd.to_datetime(cust_orders["order_date"].max())).days
        order_dates = pd.to_datetime(cust_orders["order_date"])
        span_days = max((order_dates.max() - order_dates.min()).days, 1)
        typical_gap = span_days / max(len(cust_orders), 1)

        recency_score = min(100, (recency_days / max(typical_gap * 2, 14)) * 100)

        mid = len(cust_orders) // 2
        first_half, second_half = cust_orders.iloc[:mid], cust_orders.iloc[mid:]
        if len(first_half) and len(second_half):
            slowdown = max(0, len(first_half) - len(second_half)) / max(len(first_half), 1)
        else:
            slowdown = 0
        frequency_score = slowdown * 100

        recent_events = events[(events["customer_id"] == cid) & (events["event_date"] >= (today - pd.Timedelta(days=30)).date())]
        still_browsing = len(recent_events) > 0

        risk_score = round(0.65 * recency_score + 0.35 * frequency_score, 1)
        risk_score = min(100, max(0, risk_score))

        if risk_score >= HIGH_RISK_THRESHOLD:
            risk_level = "high"
        elif risk_score >= MEDIUM_RISK_THRESHOLD:
            risk_level = "medium"
        else:
            risk_level = "low"

        if risk_level != "low" and still_browsing:
            reason = "Still browsing but hasn't purchased recently — re-engagement opportunity"
        elif risk_level == "high":
            reason = f"No orders in {recency_days} days; ordering pace has slowed"
        elif risk_level == "medium":
            reason = "Ordering cadence slowing relative to their own history"
        else:
            reason = "Active, recent purchaser"

        rows.append({
            "customer_id": cid, "name": cust["name"], "email": cust["email"],
            "orders": int(len(cust_orders)), "recency_days": int(recency_days),
            "risk_score": risk_score, "risk_level": risk_level,
            "still_browsing": bool(still_browsing), "reason": reason,
        })

    df = pd.DataFrame(rows).sort_values("risk_score", ascending=False)
    at_risk = df[df["risk_level"].isin(["high", "medium"])].to_dict(orient="records")

    summary = {
        "total_customers": len(df),
        "high_risk": int((df["risk_level"] == "high").sum()),
        "medium_risk": int((df["risk_level"] == "medium").sum()),
        "low_risk": int((df["risk_level"] == "low").sum()),
        "browsing_not_converting": int(df["still_browsing"].fillna(False).astype(bool).sum()),
    }

    payload = {
        "generated_at": datetime.datetime.now().isoformat(),
        "method": "Rule-based churn scoring: recency vs. personal ordering cadence (65%) "
                  "+ order-frequency slowdown (35%), cross-referenced with recent browsing events.",
        "summary": summary,
        "at_risk_customers": at_risk,
        "all_customers": df.to_dict(orient="records"),
    }
    save_result("churn_analysis", payload)

if __name__ == "__main__":
    main()

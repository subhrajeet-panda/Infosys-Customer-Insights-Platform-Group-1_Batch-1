import time
import uuid
import numpy as np
import pandas as pd
import pytest

N_VENDORS = 20
N_PRODUCTS_PER_VENDOR = 8
N_CUSTOMERS = 100
N_ORDERS = 2000
PERF_BUDGET_SECONDS = 8.0

@pytest.fixture
def large_synthetic_marketplace():
    rng = np.random.default_rng(7)
    today = pd.Timestamp.today().normalize()

    vendors = [{"vendor_id": uuid.uuid4(), "vendor_name": f"Vendor {i}", "categories": [rng.choice(["Fashion", "Electronics", "Beauty", "Home & Kitchen"])]}
               for i in range(N_VENDORS)]
    vendors_df = pd.DataFrame(vendors)

    products = []
    for v in vendors:
        for j in range(N_PRODUCTS_PER_VENDOR):
            products.append({
                "product_id": uuid.uuid4(), "name": f"Product {j}", "category": v["categories"][0],
                "price": float(rng.integers(100, 5000)), "stock_quantity": int(rng.integers(0, 200)),
                "vendor_id": v["vendor_id"], "vendor_name": v["vendor_name"],
            })
    products_df = pd.DataFrame(products)

    customers = [{"customer_id": uuid.uuid4(), "name": f"Customer {i}", "email": f"c{i}@x.com"} for i in range(N_CUSTOMERS)]
    customers_df = pd.DataFrame(customers)

    order_rows = []
    for _ in range(N_ORDERS):
        cust = customers[rng.integers(0, N_CUSTOMERS)]
        prod = products[rng.integers(0, len(products))]
        order_rows.append({
            "customer_id": cust["customer_id"], "vendor_id": prod["vendor_id"], "product_id": prod["product_id"],
            "quantity": int(rng.integers(1, 4)),
            "order_date": (today - pd.Timedelta(days=int(rng.integers(0, 90)))).date(),
            "total_amount": float(prod["price"] * rng.integers(1, 4)),
        })
    orders_df = pd.DataFrame(order_rows)

    return {"vendors_df": vendors_df, "products_df": products_df, "customers_df": customers_df, "orders_df": orders_df}

@pytest.fixture
def patched_db_large(monkeypatch, large_synthetic_marketplace):
    import sys
    import core.db as db
    market = large_synthetic_marketplace

    def fetch_df(query, params=None):
        q = query
        if "role = 'customer'" in q:
            return market["customers_df"].copy()
        if "GROUP BY customer_id, event_type" in q:
            return pd.DataFrame(columns=["customer_id", "event_type", "cnt"])
        if "customer_events" in q:
            return pd.DataFrame(columns=["customer_id", "product_id", "event_type", "event_date"])
        if "sale_date" in q:
            return market["orders_df"].rename(columns={"order_date": "sale_date"})[["product_id", "quantity", "sale_date"]].copy()
        if "FROM vendors WHERE status = 'approved'" in q:
            return market["vendors_df"][["vendor_id", "vendor_name", "categories"]].copy()
        if "id AS vendor_id, business_name AS vendor_name FROM vendors" in q:
            return market["vendors_df"][["vendor_id", "vendor_name"]].copy()
        if "oi.category, oi.subtotal" in q:
            merged = market["orders_df"].merge(
                market["products_df"][["product_id", "category"]], on="product_id", how="left"
            )
            return merged.rename(columns={"total_amount": "subtotal"})[
                ["customer_id", "category", "subtotal", "order_date"]].copy()
        if "o.vendor_id, o.total_amount" in q:
            return market["orders_df"][["customer_id", "vendor_id", "total_amount", "order_date"]].copy()
        if "oi.product_id" in q or ("product_id" in q and "quantity" in q and "customer_id" in q):
            return market["orders_df"][["customer_id", "product_id", "quantity", "order_date"]].copy()
        if "vendor_id, total_amount, created_at::date AS order_date" in q:
            return market["orders_df"][["vendor_id", "total_amount", "order_date"]].copy()
        if "order_date" in q and "total_amount" in q and "customer_id" in q:
            return market["orders_df"][["customer_id", "total_amount", "order_date"]].copy()
        if "FROM products p JOIN vendors v" in q:
            return market["products_df"].copy()
        return pd.DataFrame()

    monkeypatch.setattr(db, "fetch_df", fetch_df)
    from tests.conftest import _purge_pipeline_imports
    _purge_pipeline_imports()
    return market

@pytest.mark.parametrize("pipeline_name", [
    "inventory_forecast", "customer_segmentation", "recommendations",
    "churn_analysis", "revenue_benchmarking", "spending_analysis",
])
def test_pipeline_completes_within_budget(patched_db_large, pipeline_name):
                                                                          
    import importlib
    module = importlib.import_module(f"pipelines.{pipeline_name}")

    start = time.time()
    result = module.run()
    elapsed = time.time() - start

    assert "payload" in result
    assert elapsed < PERF_BUDGET_SECONDS, (
        f"{pipeline_name} took {elapsed:.2f}s against {N_ORDERS} orders / "
        f"{N_VENDORS} vendors — budget is {PERF_BUDGET_SECONDS}s. "
        f"Check for an accidental O(n^2) pattern (e.g. a per-row DB-style "
        f"loop instead of a vectorized groupby)."
    )

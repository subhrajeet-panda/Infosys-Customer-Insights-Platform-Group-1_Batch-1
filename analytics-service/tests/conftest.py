import uuid
import datetime
import json

import numpy as np
import pandas as pd
import pytest

@pytest.fixture
def synthetic_ids():
                                                                              
    return {
        "vendor_1": uuid.uuid4(),
        "vendor_2": uuid.uuid4(),
        "product_1": uuid.uuid4(),
        "product_2": uuid.uuid4(),
        "product_3": uuid.uuid4(),
        "customer_1": uuid.uuid4(),
        "customer_2": uuid.uuid4(),
        "customer_3": uuid.uuid4(),
        "vendor_1_user": uuid.uuid4(),
    }

@pytest.fixture
def synthetic_marketplace(synthetic_ids):
                                     
    ids = synthetic_ids
    today = pd.Timestamp.today().normalize()
    rng = np.random.default_rng(42)

    vendors_df = pd.DataFrame([
        {"vendor_id": ids["vendor_1"], "vendor_name": "UrbanThread Apparel", "categories": ["Fashion"]},
        {"vendor_id": ids["vendor_2"], "vendor_name": "GadgetHive Electronics", "categories": ["Electronics"]},
    ])
    products_df = pd.DataFrame([
        {"product_id": ids["product_1"], "name": "Denim Jacket", "category": "Fashion", "price": 1500.0,
         "stock_quantity": 5, "vendor_id": ids["vendor_1"], "vendor_name": "UrbanThread Apparel"},
        {"product_id": ids["product_2"], "name": "Cotton T-Shirt", "category": "Fashion", "price": 500.0,
         "stock_quantity": 40, "vendor_id": ids["vendor_1"], "vendor_name": "UrbanThread Apparel"},
        {"product_id": ids["product_3"], "name": "Wireless Earbuds", "category": "Electronics", "price": 2500.0,
         "stock_quantity": 20, "vendor_id": ids["vendor_2"], "vendor_name": "GadgetHive Electronics"},
    ])
    customers_df = pd.DataFrame([
        {"customer_id": ids["customer_1"], "name": "Loyal Lakshmi", "email": "a@x.com"},
        {"customer_id": ids["customer_2"], "name": "Churned Chetan", "email": "b@x.com"},
        {"customer_id": ids["customer_3"], "name": "Browser Bhavna", "email": "c@x.com"},
    ])

    order_rows = []
    def add_order(cust, prod, qty, days_ago):
        vendor_id = products_df.loc[products_df["product_id"] == prod, "vendor_id"].iloc[0]
        price = products_df.loc[products_df["product_id"] == prod, "price"].iloc[0]
        order_rows.append({
            "customer_id": cust, "vendor_id": vendor_id, "product_id": prod,
            "quantity": qty, "order_date": (today - pd.Timedelta(days=days_ago)).date(),
            "total_amount": float(price * qty), "unit_price": float(price),
        })

    for d in [2, 8, 15, 22, 30, 40]:
        add_order(ids["customer_1"], ids["product_1"], int(rng.integers(1, 3)), d)
                                  
    for d in [90, 105]:
        add_order(ids["customer_2"], ids["product_3"], 1, d)
                                                          
    orders_df = pd.DataFrame(order_rows)

    events_rows = [
        {"customer_id": ids["customer_3"], "product_id": ids["product_1"], "event_type": "view",
         "event_date": (today - pd.Timedelta(days=int(rng.integers(0, 30)))).date()}
        for _ in range(10)
    ]

    return {
        "ids": ids, "today": today,
        "vendors_df": vendors_df, "products_df": products_df,
        "customers_df": customers_df, "orders_df": orders_df, "events_rows": events_rows,
    }

def make_fetch_df(market):
                                                    
    def fetch_df(query, params=None):
        q = query
        if "role = 'customer'" in q:
            return market["customers_df"].copy()
        if "GROUP BY customer_id, event_type" in q:
            ev = pd.DataFrame(market["events_rows"])
            if ev.empty:
                return pd.DataFrame(columns=["customer_id", "event_type", "cnt"])
            return ev.groupby(["customer_id", "event_type"]).size().reset_index(name="cnt")
        if "customer_events" in q:
            return pd.DataFrame(market["events_rows"])
        if "sale_date" in q:
            df = market["orders_df"].rename(columns={"order_date": "sale_date"})[["product_id", "quantity", "sale_date"]]
            return df.copy()
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
            if "units_sold" in q:
                return market["products_df"].assign(units_sold=[3, 1, 2])[
                    ["product_id", "name", "category", "price", "vendor_name", "units_sold"]]
            return market["products_df"].copy()
        return pd.DataFrame()
    return fetch_df

@pytest.fixture
def patched_db(monkeypatch, synthetic_marketplace):
                                                           
    import sys
    import core.db as db
    fake_fetch_df = make_fetch_df(synthetic_marketplace)
    monkeypatch.setattr(db, "fetch_df", fake_fetch_df)
    _purge_pipeline_imports()
    return synthetic_marketplace

def _purge_pipeline_imports():
    import sys
    pipelines_pkg = sys.modules.get("pipelines")
    for mod_name in list(sys.modules):
        if mod_name.startswith("pipelines."):
            submodule_name = mod_name.split(".", 1)[1]
            if pipelines_pkg is not None and hasattr(pipelines_pkg, submodule_name):
                delattr(pipelines_pkg, submodule_name)
            del sys.modules[mod_name]

def sanitize_roundtrip(payload):
                            
    import core.db as db
    return json.loads(json.dumps(db.sanitize(payload)))

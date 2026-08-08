import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response

import registry
from core.export import export_df
from core.security import require_roles, get_current_vendor
from executive_summary import build_executive_summary, flatten_for_export
from pipelines.spending_analysis import flatten_for_export as flatten_spending_for_export

router = APIRouter(prefix="/reports", tags=["reports"])

REPORT_TITLES = {
    "revenue_benchmarking": "Revenue & Marketplace Benchmarking",
    "inventory_forecast": "Inventory Forecast",
    "customer_segmentation": "Customer Segmentation",
    "churn_analysis": "Customer Churn Risk",
    "executive_summary": "Executive Summary",
    "spending_analysis": "My Spending Analysis",
}

@router.get("/executive-summary")
def get_executive_summary(user: dict = Depends(require_roles("admin"))):
                                                              
    return build_executive_summary()

def _rows_for_report(report_type: str, user: dict) -> list[dict]:
    if report_type == "revenue_benchmarking":
        active = registry.get_active("revenue_benchmarking")
        if not active:
            raise HTTPException(status_code=404, detail="Benchmarking hasn't been run yet.")
        vendors = active["payload"].get("vendors", [])
        if user["role"] == "vendor":
            vendor = get_current_vendor(user)                          
            vendors = [v for v in vendors if v["vendor_id"] == vendor["id"]]
                                                                                     
        flat_rows = []
        for row in vendors:
            flat = {k: v for k, v in row.items() if k not in ("revenue_trend", "projected_next_30d")}
            projection = row.get("projected_next_30d") or {}
            flat["projected_revenue_30d"] = projection.get("projected_revenue")
            flat["projected_trend_direction"] = projection.get("trend_direction")
            flat_rows.append(flat)
        return flat_rows

    if report_type == "inventory_forecast":
        active = registry.get_active("inventory_forecast")
        if not active:
            raise HTTPException(status_code=404, detail="Forecast hasn't been run yet.")
        products = active["payload"].get("products", [])
        if user["role"] == "vendor":
            vendor = get_current_vendor(user)                          
            products = [p for p in products if p.get("vendor_id") == vendor["id"]]
        return products

    if report_type == "customer_segmentation":
        if user["role"] != "admin":
            raise HTTPException(status_code=403, detail="Admin only")
        active = registry.get_active("customer_segmentation")
        if not active:
            raise HTTPException(status_code=404, detail="Segmentation hasn't been run yet.")
        return active["payload"].get("customers", [])

    if report_type == "churn_analysis":
        if user["role"] != "admin":
            raise HTTPException(status_code=403, detail="Admin only")
        active = registry.get_active("churn_analysis")
        if not active:
            raise HTTPException(status_code=404, detail="Churn analysis hasn't been run yet.")
        return active["payload"].get("all_customers", [])

    if report_type == "executive_summary":
        if user["role"] != "admin":
            raise HTTPException(status_code=403, detail="Admin only")
        summary = build_executive_summary()
        return flatten_for_export(summary)

    if report_type == "spending_analysis":
        if user["role"] != "customer":
            raise HTTPException(status_code=403, detail="Customers only — this is personal spending data.")
        active = registry.get_active("spending_analysis")
        if not active:
            raise HTTPException(status_code=404, detail="Spending analysis hasn't been run yet.")
        mine = next((c for c in active["payload"].get("customers", []) if c["customer_id"] == user["id"]), None)
        if not mine:
            raise HTTPException(status_code=404, detail="No spending data for your account yet.")
        return flatten_spending_for_export(mine)

    raise HTTPException(status_code=400, detail=f"Unknown report type. Expected one of: {list(REPORT_TITLES.keys())}")

@router.get("/export")
def export_report(
    report_type: str = Query(..., alias="type"),
    fmt: str = Query("csv", alias="format", pattern="^(csv|xlsx|pdf)$"),
    user: dict = Depends(require_roles("admin", "vendor", "customer")),
):
    rows = _rows_for_report(report_type, user)
    if not rows:
        raise HTTPException(status_code=404, detail="No data available for this report yet.")

    df = pd.DataFrame(rows)
    title = REPORT_TITLES.get(report_type, "ShopSense Report")
    data, content_type = export_df(df, fmt, title=title)

    filename = f"{report_type}.{fmt}"
    return Response(
        content=data,
        media_type=content_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

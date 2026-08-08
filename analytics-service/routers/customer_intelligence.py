from fastapi import APIRouter, Depends, HTTPException

import registry
from core.db import fetch_df
from core.security import require_roles, get_current_user
from pipelines import customer_segmentation, churn_analysis, recommendations

router = APIRouter(prefix="/customer-intelligence", tags=["customer-intelligence"])

@router.get("/segmentation")
def get_segmentation(user: dict = Depends(require_roles("admin"))):
    active = registry.get_active("customer_segmentation")
    if not active:
        raise HTTPException(status_code=404, detail="Segmentation hasn't been run yet.")
    return {"version": active["version"], "trained_at": active["trained_at"], "payload": active["payload"]}

@router.get("/churn")
def get_churn(user: dict = Depends(require_roles("admin"))):
    active = registry.get_active("churn_analysis")
    if not active:
        raise HTTPException(status_code=404, detail="Churn analysis hasn't been run yet.")
    return {"version": active["version"], "trained_at": active["trained_at"], "payload": active["payload"]}

@router.get("/recommendations/mine")
def get_my_recommendations(user: dict = Depends(require_roles("customer"))):
                                                            
    active = registry.get_active("recommendations")
    if active and active["payload"]:
        for entry in active["payload"].get("customer_recommendations", []):
            if entry["customer_id"] == user["id"] and entry.get("recommendations"):
                return {
                    "source": "model",
                    "generated_at": active["trained_at"],
                    "method": active["payload"].get("method"),
                    "recommendations": entry["recommendations"],
                }

    fallback = fetch_df(
        """
        SELECT p.id AS product_id, p.name, p.category, p.price, v.business_name AS vendor_name,
               COALESCE(SUM(oi.quantity), 0)::int AS units_sold
        FROM products p
        JOIN vendors v ON v.id = p.vendor_id
        LEFT JOIN order_items oi ON oi.product_id = p.id
        LEFT JOIN orders o ON o.id = oi.order_id AND o.status != 'cancelled'
        WHERE p.status = 'active' AND v.status = 'approved'
        GROUP BY p.id, p.name, p.category, p.price, v.business_name
        ORDER BY units_sold DESC, p.created_at DESC
        LIMIT 8
        """
    )
    return {
        "source": "trending_fallback",
        "generated_at": None,
        "method": "Trending products (bestsellers) — shown until enough of your own activity exists.",
        "recommendations": fallback.assign(score=None).to_dict(orient="records"),
    }

@router.get("/recommendations")
def get_all_recommendations(user: dict = Depends(require_roles("admin"))):
    active = registry.get_active("recommendations")
    if not active:
        raise HTTPException(status_code=404, detail="Recommendations haven't been run yet.")
    return {"version": active["version"], "trained_at": active["trained_at"], "payload": active["payload"]}

@router.get("/recommendations/versions")
def recommendation_versions(user: dict = Depends(require_roles("admin"))):
    return {"versions": registry.list_versions("recommendations")}

@router.post("/run-all")
def run_customer_intelligence(user: dict = Depends(require_roles("admin"))):
    results = {}
    for model_type, fn in [
        ("customer_segmentation", customer_segmentation.run),
        ("churn_analysis", churn_analysis.run),
        ("recommendations", recommendations.run),
    ]:
        try:
            row = registry.run_pipeline_and_register(model_type, fn, triggered_by="manual")
            results[model_type] = {"status": "ok", "version": row["version"]}
        except Exception as e:
            results[model_type] = {"status": "failed", "error": str(e)}
    return {"results": results}

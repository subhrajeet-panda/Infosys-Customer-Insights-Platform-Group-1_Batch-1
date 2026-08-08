from fastapi import APIRouter, Depends, HTTPException

import registry
from core.security import require_roles
from pipelines import spending_analysis

router = APIRouter(prefix="/spending-analysis", tags=["spending-analysis"])

@router.get("/mine")
def get_my_spending_analysis(user: dict = Depends(require_roles("customer"))):
                                                                
    active = registry.get_active("spending_analysis")
    if not active:
        raise HTTPException(status_code=404, detail="Spending analysis hasn't been run yet. POST /spending-analysis/run first.")

    payload = active["payload"] or {}
    mine = next((c for c in payload.get("customers", []) if c["customer_id"] == user["id"]), None)
    if not mine:
        raise HTTPException(status_code=404, detail="No spending data for your account yet.")

    return {
        "version": active["version"],
        "trained_at": active["trained_at"],
        "spending": mine,
        "marketplace_context": payload.get("marketplace_context"),
    }

@router.post("/run")
def run_spending_analysis(user: dict = Depends(require_roles("admin", "customer"))):
                                                                          
    try:
        row = registry.run_pipeline_and_register("spending_analysis", spending_analysis.run, triggered_by="manual")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Spending analysis run failed: {e}")
    return {"version": row["version"], "trained_at": row["trained_at"]}

@router.get("/versions")
def spending_analysis_versions(user: dict = Depends(require_roles("admin"))):
    return {"versions": registry.list_versions("spending_analysis")}

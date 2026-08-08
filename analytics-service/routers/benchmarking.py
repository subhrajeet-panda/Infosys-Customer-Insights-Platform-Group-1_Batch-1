from fastapi import APIRouter, Depends, HTTPException

import registry
from core.security import require_roles, get_current_vendor
from pipelines import revenue_benchmarking

router = APIRouter(prefix="/benchmarking", tags=["benchmarking"])

@router.get("/vendor")
def get_vendor_benchmark(user: dict = Depends(require_roles("vendor"))):
                                                  
    active = registry.get_active("revenue_benchmarking")
    if not active:
        raise HTTPException(status_code=404, detail="Benchmarking hasn't been run yet.")

    vendor = get_current_vendor(user)                          
    payload = active["payload"] or {}
    my_row = next((v for v in payload.get("vendors", []) if v["vendor_id"] == vendor["id"]), None)
    if not my_row:
        raise HTTPException(status_code=404, detail="No benchmark data for your vendor account yet.")

    return {
        "version": active["version"],
        "trained_at": active["trained_at"],
        "vendor_benchmark": my_row,
        "marketplace_summary": payload.get("marketplace_summary"),
    }

@router.get("/marketplace")
def get_marketplace_benchmark(user: dict = Depends(require_roles("admin"))):
    active = registry.get_active("revenue_benchmarking")
    if not active:
        raise HTTPException(status_code=404, detail="Benchmarking hasn't been run yet.")
    return {"version": active["version"], "trained_at": active["trained_at"], "payload": active["payload"]}

@router.post("/run")
def run_benchmarking(user: dict = Depends(require_roles("admin", "vendor"))):
                                
    try:
        row = registry.run_pipeline_and_register("revenue_benchmarking", revenue_benchmarking.run, triggered_by="manual")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Benchmarking run failed: {e}")
    return {"version": row["version"], "trained_at": row["trained_at"]}

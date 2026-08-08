from fastapi import APIRouter, Depends, HTTPException

import registry
from core.security import require_roles, get_current_vendor
from pipelines import inventory_forecast

router = APIRouter(prefix="/forecast", tags=["forecasting"])

@router.get("/inventory")
def get_inventory_forecast(user: dict = Depends(require_roles("admin", "vendor"))):
                                                                                    
    active = registry.get_active("inventory_forecast")
    if not active:
        raise HTTPException(status_code=404, detail="No forecast has been run yet. POST /forecast/inventory/run first.")

    payload = active["payload"] or {}
    if user["role"] == "vendor":
        vendor = get_current_vendor(user)                          
        products = [p for p in payload.get("products", []) if p.get("vendor_id") == vendor["id"]]
        payload = {**payload, "products": products}

    return {"version": active["version"], "trained_at": active["trained_at"], "payload": payload}

@router.post("/inventory/run")
def run_inventory_forecast(user: dict = Depends(require_roles("admin", "vendor"))):
    try:
        row = registry.run_pipeline_and_register("inventory_forecast", inventory_forecast.run, triggered_by="manual")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Forecast run failed: {e}")
    return {"version": row["version"], "trained_at": row["trained_at"]}

@router.get("/inventory/versions")
def inventory_forecast_versions(user: dict = Depends(require_roles("admin"))):
    return {"versions": registry.list_versions("inventory_forecast")}

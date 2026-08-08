from fastapi import APIRouter, Depends, HTTPException

import registry
from core.security import require_roles
from scheduler import run_all_pipelines, PIPELINES
from pipelines import validate_models

router = APIRouter(prefix="/registry", tags=["registry"])

ALL_MODEL_TYPES = list(PIPELINES.keys()) + ["validation"]

@router.get("/models")
def list_models(user: dict = Depends(require_roles("admin"))):
                                                           
    return {"models": registry.list_all_latest()}

@router.get("/models/{model_type}/versions")
def model_versions(model_type: str, user: dict = Depends(require_roles("admin"))):
    if model_type not in ALL_MODEL_TYPES:
        raise HTTPException(status_code=400, detail=f"Unknown model_type. Expected one of: {ALL_MODEL_TYPES}")
    return {"versions": registry.list_versions(model_type, limit=50)}

@router.post("/models/{model_type}/promote/{version}")
def promote(model_type: str, version: int, user: dict = Depends(require_roles("admin"))):
    if model_type not in ALL_MODEL_TYPES:
        raise HTTPException(status_code=400, detail=f"Unknown model_type. Expected one of: {ALL_MODEL_TYPES}")
    registry.promote_version(model_type, version)
    return {"message": f"{model_type} v{version} promoted to active"}

@router.post("/run-all")
def run_all(user: dict = Depends(require_roles("admin"))):
    results = run_all_pipelines(triggered_by="manual")
    return {"results": results}

@router.post("/validate")
def run_validation(user: dict = Depends(require_roles("admin"))):
    try:
        row = registry.run_pipeline_and_register("validation", validate_models.run, triggered_by="manual")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Validation run failed: {e}")
    return {"version": row["version"], "trained_at": row["trained_at"]}

@router.get("/validation")
def get_validation(user: dict = Depends(require_roles("admin"))):
    active = registry.get_active("validation")
    if not active:
        raise HTTPException(status_code=404, detail="Validation hasn't been run yet.")
    return {"version": active["version"], "trained_at": active["trained_at"], "payload": active["payload"]}

import json
import time
from core.db import execute, sanitize

def save_run(model_type: str, payload: dict = None, metrics: dict = None,
             triggered_by: str = "manual", duration_ms: int = None,
             error: str = None, status: str = "active") -> dict:
    next_version_row = execute(
        "SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM model_registry WHERE model_type = %s",
        (model_type,), fetch=True,
    )
    next_version = next_version_row[0]["next_version"]

    clean_payload = sanitize(payload) if payload is not None else None
    clean_metrics = sanitize(metrics) if metrics is not None else None

    rows = execute(
        """
        INSERT INTO model_registry (model_type, version, status, payload, metrics, triggered_by, duration_ms, error)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id, model_type, version, status, metrics, triggered_by, duration_ms, error, trained_at
        """,
        (
            model_type, next_version, status,
            json.dumps(clean_payload) if clean_payload is not None else None,
            json.dumps(clean_metrics) if clean_metrics is not None else None,
            triggered_by, duration_ms, error,
        ),
        fetch=True,
    )

    if status == "active":
        execute(
            "UPDATE model_registry SET status = 'archived' "
            "WHERE model_type = %s AND version != %s AND status = 'active'",
            (model_type, next_version),
        )

    return rows[0]

def run_pipeline_and_register(model_type: str, fn, triggered_by: str = "manual") -> dict:
                                                                     
    start = time.time()
    try:
        result = fn()
        payload = result.get("payload", result)
        metrics = result.get("metrics")
        duration_ms = int((time.time() - start) * 1000)
        return save_run(model_type, payload=payload, metrics=metrics,
                         triggered_by=triggered_by, duration_ms=duration_ms, status="active")
    except Exception as e:
        duration_ms = int((time.time() - start) * 1000)
        save_run(model_type, payload=None, metrics=None, triggered_by=triggered_by,
                  duration_ms=duration_ms, error=str(e), status="failed")
        raise

def get_active(model_type: str):
    rows = execute(
        "SELECT * FROM model_registry WHERE model_type = %s AND status = 'active' "
        "ORDER BY version DESC LIMIT 1",
        (model_type,), fetch=True,
    )
    return rows[0] if rows else None

def list_versions(model_type: str, limit: int = 20):
    return execute(
        "SELECT id, model_type, version, status, metrics, triggered_by, duration_ms, error, trained_at "
        "FROM model_registry WHERE model_type = %s ORDER BY version DESC LIMIT %s",
        (model_type, limit), fetch=True,
    )

def list_all_latest():
                                                                                                    
    return execute(
        """
        SELECT DISTINCT ON (model_type) id, model_type, version, status, metrics,
               triggered_by, duration_ms, error, trained_at
        FROM model_registry
        ORDER BY model_type, (status = 'active') DESC, version DESC
        """,
        fetch=True,
    )

def archive_version(model_type: str, version: int):
    execute(
        "UPDATE model_registry SET status = 'archived' WHERE model_type = %s AND version = %s",
        (model_type, version),
    )

def promote_version(model_type: str, version: int):
                                                                          
    execute(
        "UPDATE model_registry SET status = 'archived' WHERE model_type = %s AND status = 'active'",
        (model_type,),
    )
    execute(
        "UPDATE model_registry SET status = 'active' WHERE model_type = %s AND version = %s",
        (model_type, version),
    )

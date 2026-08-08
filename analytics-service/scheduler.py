import logging
from apscheduler.schedulers.background import BackgroundScheduler

from core.config import settings
import registry
from pipelines import (
    inventory_forecast, customer_segmentation, recommendations,
    churn_analysis, validate_models, revenue_benchmarking, spending_analysis,
)

logger = logging.getLogger("shopsense.scheduler")

PIPELINES = {
    "inventory_forecast": inventory_forecast.run,
    "customer_segmentation": customer_segmentation.run,
    "recommendations": recommendations.run,
    "churn_analysis": churn_analysis.run,
    "revenue_benchmarking": revenue_benchmarking.run,
    "spending_analysis": spending_analysis.run,
                                                                            
}

_scheduler: BackgroundScheduler | None = None

def run_all_pipelines(triggered_by: str = "scheduled"):
                                                       
    results = {}
    for model_type, fn in PIPELINES.items():
        try:
            registry.run_pipeline_and_register(model_type, fn, triggered_by=triggered_by)
            results[model_type] = "ok"
        except Exception as e:
            logger.error(f"Scheduled run failed for {model_type}: {e}")
            results[model_type] = f"failed: {e}"

    try:
        registry.run_pipeline_and_register("validation", validate_models.run, triggered_by=triggered_by)
        results["validation"] = "ok"
    except Exception as e:
        logger.error(f"Scheduled validation run failed: {e}")
        results["validation"] = f"failed: {e}"

    return results

def start_scheduler():
    global _scheduler
    if settings.PIPELINE_INTERVAL_HOURS <= 0:
        logger.info("PIPELINE_INTERVAL_HOURS <= 0 — automatic scheduling disabled (manual runs only).")
        return None

    _scheduler = BackgroundScheduler()
    _scheduler.add_job(
        run_all_pipelines,
        "interval",
        hours=settings.PIPELINE_INTERVAL_HOURS,
        id="run_all_pipelines",
        kwargs={"triggered_by": "scheduled"},
        next_run_time=None,                                                                     
    )
    _scheduler.start()
    logger.info(f"Scheduler started: all pipelines will re-run every {settings.PIPELINE_INTERVAL_HOURS}h.")
    return _scheduler

def stop_scheduler():
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)

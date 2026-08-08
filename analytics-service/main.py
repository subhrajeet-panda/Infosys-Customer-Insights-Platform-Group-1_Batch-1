from contextlib import asynccontextmanager
import time
import datetime
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import settings
from core.db import execute
from scheduler import start_scheduler, stop_scheduler
from routers import forecasting, customer_intelligence, benchmarking, registry_router, reports, spending_analysis

@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()
    yield
    stop_scheduler()

app = FastAPI(
    title="ShopSense Analytics Service",
    description="FastAPI service for vendor analytics, forecasting, customer intelligence, "
                 "revenue benchmarking, model registry, and BI report exports.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.CORS_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
                                                                            
    start = time.time()
    try:
        execute("SELECT 1", fetch=True)
        db_status = "connected"
        db_error = None
    except Exception as e:
        db_status = "unreachable"
        db_error = str(e)
    latency_ms = round((time.time() - start) * 1000, 1)

    return {
        "status": "ok" if db_status == "connected" else "degraded",
        "service": "ShopSense Analytics Service",
        "db": db_status,
        "db_error": db_error,
        "db_latency_ms": latency_ms,
        "scheduler_enabled": settings.PIPELINE_INTERVAL_HOURS > 0,
        "pipeline_interval_hours": settings.PIPELINE_INTERVAL_HOURS,
        "timestamp": datetime.datetime.now().isoformat(),
    }

app.include_router(forecasting.router)
app.include_router(customer_intelligence.router)
app.include_router(benchmarking.router)
app.include_router(registry_router.router)
app.include_router(reports.router)
app.include_router(spending_analysis.router)

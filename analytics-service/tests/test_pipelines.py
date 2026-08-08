import json
import pytest

from tests.conftest import sanitize_roundtrip

def test_inventory_forecast_produces_a_row_per_product(patched_db):
    from pipelines import inventory_forecast
    result = inventory_forecast.run()
    payload = sanitize_roundtrip(result["payload"])

    assert "products" in payload
    assert len(payload["products"]) == 3                          
    for p in payload["products"]:
        assert p["current_stock"] >= 0
        assert p["avg_daily_demand"] >= 0
        assert p["trend_direction"] in ("rising", "falling", "stable")
                                                                         
        assert isinstance(p["vendor_id"], str)

def test_inventory_forecast_flags_replenishment_correctly(patched_db):
    from pipelines import inventory_forecast
    result = inventory_forecast.run()
    payload = sanitize_roundtrip(result["payload"])

    for p in payload["products"]:
        if p["needs_replenishment"]:
            assert p["recommended_reorder_qty"] > 0
        else:
            assert p["current_stock"] > p["reorder_point"] or p["avg_daily_demand"] == 0

def test_customer_segmentation_covers_every_customer(patched_db):
    from pipelines import customer_segmentation
    result = customer_segmentation.run()
    payload = sanitize_roundtrip(result["payload"])

    assert len(payload["customers"]) == 3                           
    labels = {c["segment_label"] for c in payload["customers"]}
    assert labels                                       
                                                                 
    assert any(c["frequency"] == 0 for c in payload["customers"])

def test_segmentation_silhouette_score_is_a_valid_range(patched_db):
    from pipelines import customer_segmentation
    result = customer_segmentation.run()
    score = result["metrics"].get("silhouette_score")
    if score is not None:
        assert -1.0 <= score <= 1.0

def test_churn_analysis_flags_the_dormant_customer(patched_db):
    from pipelines import churn_analysis
    result = churn_analysis.run()
    payload = sanitize_roundtrip(result["payload"])

    at_risk_names = {c["name"] for c in payload["at_risk_customers"]}
                                                                           
    assert "Churned Chetan" in at_risk_names

def test_recommendations_has_no_self_recommendations(patched_db):
    from pipelines import recommendations
    result = recommendations.run()
    payload = sanitize_roundtrip(result["payload"])

    for entry in payload.get("customer_recommendations", []):
        recommended_ids = {r["product_id"] for r in entry["recommendations"]}
                                                                              
        assert len(recommended_ids) == len(entry["recommendations"])

def test_revenue_benchmarking_every_vendor_has_a_row(patched_db):
    from pipelines import revenue_benchmarking
    result = revenue_benchmarking.run()
    payload = sanitize_roundtrip(result["payload"])

    assert len(payload["vendors"]) == 2                                  
    for v in payload["vendors"]:
        assert 0 <= v["revenue_percentile"] <= 100
        assert isinstance(v["vendor_id"], str)
        assert len(v["revenue_trend"]) == 12               
        assert "projected_next_30d" in v

def test_revenue_benchmarking_percentiles_are_consistent(patched_db):
                                                                                 
    from pipelines import revenue_benchmarking
    result = revenue_benchmarking.run()
    payload = sanitize_roundtrip(result["payload"])

    vendors = sorted(payload["vendors"], key=lambda v: v["revenue_current"])
    for i in range(len(vendors) - 1):
        assert vendors[i]["revenue_percentile"] <= vendors[i + 1]["revenue_percentile"]

def test_spending_analysis_covers_every_customer(patched_db):
    from pipelines import spending_analysis
    result = spending_analysis.run()
    payload = sanitize_roundtrip(result["payload"])

    assert len(payload["customers"]) == 3                           
    for c in payload["customers"]:
        assert isinstance(c["customer_id"], str)
        assert 0 <= c["spending_percentile"] <= 100
        assert len(c["monthly_trend"]) == 6                

    assert any(c["total_orders"] == 0 for c in payload["customers"])

def test_spending_analysis_percentiles_are_consistent(patched_db):
    from pipelines import spending_analysis
    result = spending_analysis.run()
    payload = sanitize_roundtrip(result["payload"])

    customers = sorted(payload["customers"], key=lambda c: c["total_spent"])
    for i in range(len(customers) - 1):
        assert customers[i]["spending_percentile"] <= customers[i + 1]["spending_percentile"]

def test_spending_analysis_category_breakdown_sums_to_total(patched_db):
                                                         
    from pipelines import spending_analysis
    result = spending_analysis.run()
    payload = sanitize_roundtrip(result["payload"])

    for c in payload["customers"]:
        if c["category_breakdown"]:
            total_pct = sum(cat["pct"] for cat in c["category_breakdown"])
            assert 99.0 <= total_pct <= 101.0                              

def test_spending_analysis_zero_orders_customer_has_empty_breakdowns(patched_db):
    from pipelines import spending_analysis
    result = spending_analysis.run()
    payload = sanitize_roundtrip(result["payload"])

    for c in payload["customers"]:
        if c["total_orders"] == 0:
            assert c["category_breakdown"] == []
            assert c["vendor_breakdown"] == []
            assert c["top_category"] is None
            assert c["total_spent"] == 0

def test_validate_models_runs_without_a_live_database(patched_db):
    from pipelines import validate_models
    result = validate_models.run()
    payload = sanitize_roundtrip(result["payload"])
    assert "inventory_forecast" in payload
    assert "recommendations" in payload
    assert "segmentation" in payload

@pytest.mark.parametrize("pipeline_name", [
    "inventory_forecast", "customer_segmentation", "recommendations",
    "churn_analysis", "revenue_benchmarking", "spending_analysis", "validate_models",
])
def test_every_pipeline_survives_storage_roundtrip(patched_db, pipeline_name):
                                                                  
    import importlib
    module = importlib.import_module(f"pipelines.{pipeline_name}")
    result = module.run()
    dumped = json.dumps(sanitize_roundtrip(result["payload"]))
    assert "NaN" not in dumped
    assert "Infinity" not in dumped

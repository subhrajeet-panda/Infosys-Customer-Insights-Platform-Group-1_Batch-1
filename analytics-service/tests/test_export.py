import io
import pandas as pd
import pytest

def test_export_handles_none_values_without_crashing():
                           
    from core.export import export_df

    df = pd.DataFrame([
        {"product_name": "Widget", "days_until_stockout": None, "price": 100.5},
        {"product_name": "Gadget", "days_until_stockout": 12.3, "price": None},
    ])
    for fmt in ["csv", "xlsx", "pdf"]:
        data, content_type = export_df(df, fmt, title="Test Report")
        assert len(data) > 0

def test_csv_export_round_trips_correctly():
    from core.export import export_df

    df = pd.DataFrame([
        {"vendor_name": "UrbanThread Apparel", "revenue_current": 12500.5, "growth_pct": 23.4},
        {"vendor_name": "GadgetHive Electronics", "revenue_current": 8900.0, "growth_pct": -5.1},
    ])
    data, _ = export_df(df, "csv", title="Test")
    reparsed = pd.read_csv(io.BytesIO(data))
    assert len(reparsed) == 2
    assert reparsed.iloc[0]["vendor_name"] == "UrbanThread Apparel"

def test_pdf_export_produces_valid_pdf_bytes():
    from core.export import export_df

    df = pd.DataFrame([{"a": 1, "b": 2}])
    data, content_type = export_df(df, "pdf", title="Test")
    assert data[:5] == b"%PDF-"
    assert content_type == "application/pdf"

def test_unsupported_format_raises_clear_error():
    from core.export import export_df

    df = pd.DataFrame([{"a": 1}])
    with pytest.raises(ValueError):
        export_df(df, "docx", title="Test")

def test_spending_analysis_export_handles_nested_breakdowns():
                                                         
    from core.export import export_df
    from pipelines.spending_analysis import flatten_for_export

    record = {
        "total_spent": 15400.0, "total_orders": 6, "avg_order_value": 2566.67,
        "growth_pct": 22.5, "spending_percentile": 78.5, "top_category": "Fashion",
        "first_order_date": "2026-01-01", "last_order_date": "2026-07-01",
        "monthly_trend": [{"month_label": "2026-06", "spend": 2900.0}, {"month_label": "2026-07", "spend": 3900.0}],
        "category_breakdown": [{"category": "Fashion", "amount": 8000.0, "pct": 51.9}],
        "vendor_breakdown": [{"vendor_id": "v1", "vendor_name": "UrbanThread Apparel", "amount": 8000.0}],
    }
    rows = flatten_for_export(record)
    assert len(rows) > 0
    df = pd.DataFrame(rows)
    for fmt in ["csv", "xlsx", "pdf"]:
        data, _ = export_df(df, fmt, title="My Spending Analysis")
        assert len(data) > 0

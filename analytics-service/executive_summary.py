import datetime
import registry

def build_executive_summary() -> dict:
    sections = {}
    missing = []

    bench = registry.get_active("revenue_benchmarking")
    if bench and bench["payload"]:
        ms = bench["payload"].get("marketplace_summary", {})
        sections["revenue"] = {
            "total_revenue_30d": ms.get("total_revenue_current"),
            "growth_pct": ms.get("marketplace_growth_pct"),
            "vendor_count": ms.get("vendor_count"),
            "top_category": (ms.get("category_leaders") or [{}])[0].get("category")
                if ms.get("category_leaders") else None,
            "as_of": bench["trained_at"],
        }
    else:
        missing.append("revenue_benchmarking")

    inv = registry.get_active("inventory_forecast")
    if inv and inv["payload"]:
        summary = inv["payload"].get("summary", {})
        sections["inventory"] = {
            "products_analyzed": summary.get("products_analyzed"),
            "products_needing_replenishment": summary.get("products_needing_replenishment"),
            "as_of": inv["trained_at"],
        }
    else:
        missing.append("inventory_forecast")

    seg = registry.get_active("customer_segmentation")
    if seg and seg["payload"]:
        seg_summary = seg["payload"].get("segment_summary", [])
        sections["customer_segments"] = {
            "segments": [{"label": s.get("segment_label"), "customers": s.get("customers")} for s in seg_summary],
            "total_customers": sum(s.get("customers", 0) for s in seg_summary),
            "as_of": seg["trained_at"],
        }
    else:
        missing.append("customer_segmentation")

    churn = registry.get_active("churn_analysis")
    if churn and churn["payload"]:
        churn_summary = churn["payload"].get("summary", {})
        sections["churn_risk"] = {
            "high_risk": churn_summary.get("high_risk"),
            "medium_risk": churn_summary.get("medium_risk"),
            "browsing_not_converting": churn_summary.get("browsing_not_converting"),
            "as_of": churn["trained_at"],
        }
    else:
        missing.append("churn_analysis")

    val = registry.get_active("validation")
    if val and val["payload"]:
        sections["model_confidence"] = {
            "inventory_forecast_mae": val["payload"].get("inventory_forecast", {}).get("mae"),
            "recommendation_precision_at_k": val["payload"].get("recommendations", {}).get("precision_at_k"),
            "segmentation_silhouette": val["payload"].get("segmentation", {}).get("silhouette_score"),
            "as_of": val["trained_at"],
        }
    else:
        missing.append("validation")

    return {
        "generated_at": datetime.datetime.now().isoformat(),
        "sections": sections,
        "missing_models": missing,
        "note": (
            f"{len(missing)} model(s) haven't been run yet and are omitted: {', '.join(missing)}."
            if missing else None
        ),
    }

def flatten_for_export(summary: dict) -> list[dict]:
                                                      
    rows = []
    for section_name, section in summary["sections"].items():
        for key, value in section.items():
            if key == "as_of":
                continue
            if key == "segments" and isinstance(value, list):
                for seg in value:
                    rows.append({"section": section_name, "metric": f"segment: {seg.get('label')}", "value": seg.get("customers")})
                continue
            rows.append({"section": section_name, "metric": key, "value": value})
    return rows

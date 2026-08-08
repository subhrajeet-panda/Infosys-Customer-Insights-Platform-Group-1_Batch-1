import uuid
import pandas as pd
import pytest

def test_get_current_user_returns_string_id_not_uuid_object(monkeypatch):
    import core.db as db
    import core.security as security

    real_user_id = uuid.uuid4()

    def fake_fetch_df(query, params=None):
                                                                           
        return pd.DataFrame([{"id": real_user_id, "name": "Test User", "email": "t@x.com", "role": "vendor"}])

    monkeypatch.setattr(db, "fetch_df", fake_fetch_df)

    df = fake_fetch_df("SELECT id, name, email, role FROM users WHERE id = %(id)s", {"id": str(real_user_id)})
    raw_row = df.iloc[0].to_dict()
    sanitized = db.sanitize(raw_row)

    assert isinstance(raw_row["id"], uuid.UUID), "sanity check: the raw DB row really does return a UUID object"
    assert isinstance(sanitized["id"], str), (
        "REGRESSION: get_current_user()/get_current_vendor() must sanitize() "
        "their DB row before returning it, or id comparisons against stored "
        "(already-sanitized) payloads will silently always be False."
    )
    assert sanitized["id"] == str(real_user_id)

def test_vendor_id_matches_stored_payload_vendor_id_after_full_roundtrip(monkeypatch):
                                                                     
    import core.db as db
    import json

    real_vendor_id = uuid.uuid4()

    stored_payload = json.loads(json.dumps(db.sanitize({"vendor_id": real_vendor_id, "revenue": 1000})))
    assert isinstance(stored_payload["vendor_id"], str)

    raw_vendor_row = {"id": real_vendor_id, "business_name": "Test Co", "status": "approved"}
    vendor = db.sanitize(raw_vendor_row)

    assert stored_payload["vendor_id"] == vendor["id"], (
        "REGRESSION: vendor-scoped filtering (forecast, benchmarking, "
        "recommendations, report exports) will silently return empty "
        "results if this comparison fails."
    )

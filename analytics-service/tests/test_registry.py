import uuid
import datetime
import pytest

class FakeRegistryTable:
                                                         
    def __init__(self):
        self.rows = []

    def execute(self, query, params=None, fetch=False):
        q = " ".join(query.split())
        if "COALESCE(MAX(version), 0) + 1" in q:
            model_type = params[0]
            existing = [r for r in self.rows if r["model_type"] == model_type]
            next_v = (max(r["version"] for r in existing) + 1) if existing else 1
            return [{"next_version": next_v}]

        if q.startswith("INSERT INTO model_registry"):
            model_type, version, status, payload, metrics, triggered_by, duration_ms, error = params
            row = {
                "id": str(uuid.uuid4()), "model_type": model_type, "version": version, "status": status,
                "payload": payload, "metrics": metrics, "triggered_by": triggered_by,
                "duration_ms": duration_ms, "error": error, "trained_at": datetime.datetime.now().isoformat(),
            }
            self.rows.append(row)
            return [row]

        if "status = 'archived' WHERE model_type = %s AND version != %s AND status = 'active'" in q:
            model_type, version = params
            for r in self.rows:
                if r["model_type"] == model_type and r["version"] != version and r["status"] == "active":
                    r["status"] = "archived"
            return None

        if "status = 'archived' WHERE model_type = %s AND status = 'active'" in q:
            (model_type,) = params
            for r in self.rows:
                if r["model_type"] == model_type and r["status"] == "active":
                    r["status"] = "archived"
            return None

        if "status = 'active' WHERE model_type = %s AND version = %s" in q:
            model_type, version = params
            for r in self.rows:
                if r["model_type"] == model_type and r["version"] == version:
                    r["status"] = "active"
            return None

        if "status = 'active' ORDER BY version DESC LIMIT 1" in q:
            model_type = params[0]
            rows = sorted([r for r in self.rows if r["model_type"] == model_type and r["status"] == "active"],
                          key=lambda r: -r["version"])
            return rows[:1]

        if "ORDER BY version DESC LIMIT %s" in q:
            model_type, limit = params
            rows = sorted([r for r in self.rows if r["model_type"] == model_type], key=lambda r: -r["version"])
            return rows[:limit]

        raise AssertionError(f"Unmatched query in FakeRegistryTable: {q[:150]}")

@pytest.fixture
def fake_registry(monkeypatch):
    import registry as registry_mod
    table = FakeRegistryTable()
    monkeypatch.setattr(registry_mod, "execute", table.execute)
    return registry_mod

def test_successive_runs_increment_version_and_archive_previous(fake_registry):
    v1 = fake_registry.save_run("inventory_forecast", payload={"n": 1}, triggered_by="manual")
    v2 = fake_registry.save_run("inventory_forecast", payload={"n": 2}, triggered_by="scheduled")
    v3 = fake_registry.save_run("inventory_forecast", payload={"n": 3}, triggered_by="manual")

    assert (v1["version"], v2["version"], v3["version"]) == (1, 2, 3)

    active = fake_registry.get_active("inventory_forecast")
    assert active["version"] == 3

    versions = fake_registry.list_versions("inventory_forecast")
    statuses = {v["version"]: v["status"] for v in versions}
    assert statuses == {1: "archived", 2: "archived", 3: "active"}

def test_failed_run_is_recorded_but_does_not_disturb_active_version(fake_registry):
    fake_registry.save_run("churn_analysis", payload={"ok": True}, triggered_by="manual")

    def boom():
        raise RuntimeError("ModuleNotFoundError: pandas")

    with pytest.raises(RuntimeError):
        fake_registry.run_pipeline_and_register("churn_analysis", boom, triggered_by="manual")

    active = fake_registry.get_active("churn_analysis")
    assert active["version"] == 1                                    

    versions = fake_registry.list_versions("churn_analysis")
    failed = [v for v in versions if v["status"] == "failed"]
    assert len(failed) == 1
    assert "pandas" in failed[0]["error"]

def test_promote_rolls_back_to_an_older_version(fake_registry):
    fake_registry.save_run("recommendations", payload={"n": 1}, triggered_by="manual")
    fake_registry.save_run("recommendations", payload={"n": 2}, triggered_by="manual")
    fake_registry.save_run("recommendations", payload={"n": 3}, triggered_by="manual")

    fake_registry.promote_version("recommendations", 1)
    active = fake_registry.get_active("recommendations")
    assert active["version"] == 1

    versions = fake_registry.list_versions("recommendations")
    statuses = {v["version"]: v["status"] for v in versions}
    assert statuses[1] == "active"
    assert statuses[2] == "archived"
    assert statuses[3] == "archived"

def test_get_active_returns_none_when_nothing_has_run(fake_registry):
    assert fake_registry.get_active("never_run_model") is None

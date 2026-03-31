from __future__ import annotations

import json
import sys
from importlib import import_module, reload

from fastapi.testclient import TestClient

MODULE_ORDER = [
    "worldmodel_server.config",
    "worldmodel_server.db",
    "worldmodel_server.models",
    "worldmodel_server.storage",
    "worldmodel_server.auth",
    "worldmodel_server.rate_limit",
    "worldmodel_server.request_logging",
    "worldmodel_server.seed",
    "worldmodel_server.migrations",
    "worldmodel_server.main",
]


def load_test_modules(monkeypatch, tmp_path, *, seed_demo: bool = False, public_limit: int = 240):
    monkeypatch.setenv("WMG_DB_URL", f"sqlite:///{tmp_path / 'test.db'}")
    monkeypatch.setenv("WMG_STORAGE_DIR", str(tmp_path / "storage"))
    monkeypatch.setenv("WMG_UPLOAD_TOKEN", "test-token")
    monkeypatch.setenv("WMG_AUTO_MIGRATE", "true")
    monkeypatch.setenv("WMG_ENABLE_METRICS", "false")
    monkeypatch.setenv("WMG_SEED_DEMO_DATA", "true" if seed_demo else "false")
    monkeypatch.setenv("WMG_PUBLIC_READ_RATE_LIMIT_PER_MINUTE", str(public_limit))
    monkeypatch.setenv("WMG_AUTH_WRITE_RATE_LIMIT_PER_MINUTE", "120")

    modules = {}
    for name in MODULE_ORDER:
        if name in sys.modules:
            modules[name] = reload(sys.modules[name])
        else:
            modules[name] = import_module(name)
    return modules


def test_seed_demo_data_populates_leaderboard(tmp_path, monkeypatch):
    modules = load_test_modules(monkeypatch, tmp_path, seed_demo=True)
    app = modules["worldmodel_server.main"].app

    with TestClient(app) as client:
        response = client.get("/api/leaderboard?track=test&include_demo=true")

    assert response.status_code == 200
    rows = response.json()
    assert len(rows) >= 2
    assert any(row["agent"] == "demo-mpc" for row in rows)


def test_public_leaderboard_hides_seeded_demo_rows_by_default(tmp_path, monkeypatch):
    modules = load_test_modules(monkeypatch, tmp_path, seed_demo=True)
    app = modules["worldmodel_server.main"].app

    with TestClient(app) as client:
        response = client.get("/api/leaderboard?track=test")

    assert response.status_code == 200
    rows = response.json()
    assert rows == []


def test_api_key_can_create_and_upload_run(tmp_path, monkeypatch):
    modules = load_test_modules(monkeypatch, tmp_path)
    app = modules["worldmodel_server.main"].app
    create_api_key = modules["worldmodel_server.auth"].create_api_key
    session_local = modules["worldmodel_server.db"].SessionLocal

    with TestClient(app) as client:
        with session_local() as session:
            _, secret = create_api_key(session, name="ci-writer", scopes=["runs:write"])

        run_id = "smoke_run_123"
        create = client.post(
            "/api/runs",
            json={"id": run_id, "env": "memory_maze", "agent": "random", "track": "test"},
            headers={"x-api-key": secret},
        )
        assert create.status_code == 200

        upload = client.post(
            f"/api/runs/{run_id}/upload",
            headers={"x-api-key": secret},
            files={
                "metrics_file": (
                    "metrics.json",
                    json.dumps(
                        {
                            "success_rate": 0.5,
                            "mean_return": 4.2,
                            "planning_cost": {"wall_clock_ms_per_step": 11.0},
                        }
                    ),
                    "application/json",
                )
            },
        )
        assert upload.status_code == 200

        leaderboard = client.get("/api/leaderboard?track=test")

    assert any(row["run_id"] == run_id for row in leaderboard.json())


def test_public_rate_limit_returns_429(tmp_path, monkeypatch):
    modules = load_test_modules(monkeypatch, tmp_path, public_limit=1)
    app = modules["worldmodel_server.main"].app

    with TestClient(app) as client:
        first = client.get("/api/tasks")
        second = client.get("/api/tasks")

    assert first.status_code == 200
    assert second.status_code == 429


def test_readyz_reports_component_checks(tmp_path, monkeypatch):
    modules = load_test_modules(monkeypatch, tmp_path)
    app = modules["worldmodel_server.main"].app

    with TestClient(app) as client:
        response = client.get("/readyz")

    assert response.status_code == 200
    payload = response.json()
    assert payload["ok"] is True
    assert payload["checks"]["database"]["ok"] is True
    assert payload["checks"]["storage"]["ok"] is True
    assert payload["checks"]["auth"]["legacy_upload_token_enabled"] is True


def test_bootstrap_api_key_is_created_once(tmp_path, monkeypatch):
    monkeypatch.setenv("WMG_BOOTSTRAP_API_KEY", "bootstrap_key_for_tests_123456")
    modules = load_test_modules(monkeypatch, tmp_path)
    app = modules["worldmodel_server.main"].app
    session_local = modules["worldmodel_server.db"].SessionLocal
    api_key_model = modules["worldmodel_server.models"].ApiKey

    with TestClient(app):
        with session_local() as session:
            keys = session.query(api_key_model).all()
            assert len(keys) == 1
            assert keys[0].name == "prod-writer"

    with TestClient(app):
        with session_local() as session:
            keys = session.query(api_key_model).all()
            assert len(keys) == 1

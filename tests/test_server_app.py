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


def test_leaderboard_is_ranked_by_success_rate(tmp_path, monkeypatch):
    modules = load_test_modules(monkeypatch, tmp_path)
    app = modules["worldmodel_server.main"].app
    create_api_key = modules["worldmodel_server.auth"].create_api_key
    session_local = modules["worldmodel_server.db"].SessionLocal

    def upload(client, secret, run_id, success_rate, mean_return):
        client.post(
            "/api/runs",
            json={"id": run_id, "env": "memory_maze", "agent": run_id, "track": "test"},
            headers={"x-api-key": secret},
        )
        client.post(
            f"/api/runs/{run_id}/upload",
            headers={"x-api-key": secret},
            files={
                "metrics_file": (
                    "metrics.json",
                    json.dumps({"success_rate": success_rate, "mean_return": mean_return}),
                    "application/json",
                )
            },
        )

    with TestClient(app) as client:
        with session_local() as session:
            _, secret = create_api_key(session, name="ranker", scopes=["runs:write"])

        # Upload the lower-scoring run first so recency ordering would put it on top.
        upload(client, secret, "low_run", 0.20, 0.18)
        upload(client, secret, "high_run", 0.90, 0.85)

        rows = client.get("/api/leaderboard?track=test").json()

    assert [row["run_id"] for row in rows] == ["high_run", "low_run"]


def test_public_rate_limit_returns_429(tmp_path, monkeypatch):
    modules = load_test_modules(monkeypatch, tmp_path, public_limit=1)
    app = modules["worldmodel_server.main"].app

    with TestClient(app) as client:
        first = client.get("/api/tasks")
        second = client.get("/api/tasks")

    assert first.status_code == 200
    assert second.status_code == 429


def test_legacy_upload_token_rejected_when_disabled(tmp_path, monkeypatch):
    modules = load_test_modules(monkeypatch, tmp_path)
    app = modules["worldmodel_server.main"].app

    with TestClient(app) as client:
        response = client.post(
            "/api/runs",
            json={"id": "legacy_run", "env": "memory_maze", "agent": "random", "track": "test"},
            headers={"x-upload-token": "test-token"},
        )

    assert response.status_code == 401


def test_trigger_endpoint_reports_not_implemented(tmp_path, monkeypatch):
    modules = load_test_modules(monkeypatch, tmp_path)
    app = modules["worldmodel_server.main"].app
    create_api_key = modules["worldmodel_server.auth"].create_api_key
    session_local = modules["worldmodel_server.db"].SessionLocal

    with TestClient(app) as client:
        with session_local() as session:
            _, secret = create_api_key(session, name="admin", scopes=["admin"])

        response = client.post(
            "/api/runs/some_run/trigger",
            headers={"x-api-key": secret},
        )

    assert response.status_code == 501


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
    # Legacy upload token is opt-in and off by default.
    assert payload["checks"]["auth"]["legacy_upload_token_enabled"] is False


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


def _make_writer_client(modules):
    app = modules["worldmodel_server.main"].app
    create_api_key = modules["worldmodel_server.auth"].create_api_key
    session_local = modules["worldmodel_server.db"].SessionLocal
    client = TestClient(app)
    client.__enter__()
    with session_local() as session:
        _, secret = create_api_key(session, name="writer", scopes=["runs:write"])
    return client, secret


def _upload_run(client, secret, run_id, success_rate, mean_return):
    client.post(
        "/api/runs",
        json={"id": run_id, "env": "memory_maze", "agent": run_id, "track": "test"},
        headers={"x-api-key": secret},
    )
    return client.post(
        f"/api/runs/{run_id}/upload",
        headers={"x-api-key": secret},
        files={
            "metrics_file": (
                "metrics.json",
                json.dumps({"success_rate": success_rate, "mean_return": mean_return}),
                "application/json",
            )
        },
    )


def test_leaderboard_pagination_limit_and_offset(tmp_path, monkeypatch):
    modules = load_test_modules(monkeypatch, tmp_path)
    client, secret = _make_writer_client(modules)
    try:
        _upload_run(client, secret, "run_a", 0.90, 0.9)
        _upload_run(client, secret, "run_b", 0.80, 0.8)
        _upload_run(client, secret, "run_c", 0.70, 0.7)

        page1 = client.get("/api/leaderboard?track=test&limit=2&offset=0").json()
        page2 = client.get("/api/leaderboard?track=test&limit=2&offset=2").json()
    finally:
        client.__exit__(None, None, None)

    assert [r["run_id"] for r in page1] == ["run_a", "run_b"]
    assert [r["run_id"] for r in page2] == ["run_c"]


def test_leaderboard_limit_bounds_enforced(tmp_path, monkeypatch):
    modules = load_test_modules(monkeypatch, tmp_path)
    client, secret = _make_writer_client(modules)
    try:
        too_small = client.get("/api/leaderboard?track=test&limit=0")
        too_large = client.get("/api/leaderboard?track=test&limit=99999")
        negative_offset = client.get("/api/leaderboard?track=test&offset=-1")
        ok = client.get("/api/leaderboard?track=test&limit=500")
    finally:
        client.__exit__(None, None, None)

    assert too_small.status_code == 422
    assert too_large.status_code == 422
    assert negative_offset.status_code == 422
    assert ok.status_code == 200


def test_leaderboard_ranked_by_sql_columns(tmp_path, monkeypatch):
    modules = load_test_modules(monkeypatch, tmp_path)
    client, secret = _make_writer_client(modules)
    try:
        _upload_run(client, secret, "low_run", 0.20, 0.18)
        _upload_run(client, secret, "high_run", 0.90, 0.85)
        _upload_run(client, secret, "mid_run", 0.50, 0.50)

        rows = client.get("/api/leaderboard?track=test").json()

        run_model = modules["worldmodel_server.models"].RunEntry
        session_local = modules["worldmodel_server.db"].SessionLocal
        with session_local() as session:
            high = session.get(run_model, "high_run")
            assert high.success_rate == 0.90
            assert high.mean_return == 0.85
    finally:
        client.__exit__(None, None, None)

    assert [r["run_id"] for r in rows] == ["high_run", "mid_run", "low_run"]


def test_oversized_upload_rejected_with_413(tmp_path, monkeypatch):
    monkeypatch.setenv("WMG_MAX_UPLOAD_BYTES", "1024")
    modules = load_test_modules(monkeypatch, tmp_path)
    client, secret = _make_writer_client(modules)
    try:
        client.post(
            "/api/runs",
            json={"id": "big_run", "env": "memory_maze", "agent": "x", "track": "test"},
            headers={"x-api-key": secret},
        )
        oversized = client.post(
            "/api/runs/big_run/upload",
            headers={"x-api-key": secret},
            files={"metrics_file": ("metrics.json", b"a" * 4096, "application/json")},
        )
    finally:
        client.__exit__(None, None, None)

    assert oversized.status_code == 413


def test_oversized_upload_leaves_no_artifact(tmp_path, monkeypatch):
    monkeypatch.setenv("WMG_MAX_UPLOAD_BYTES", "1024")
    modules = load_test_modules(monkeypatch, tmp_path)
    client, secret = _make_writer_client(modules)
    storage_dir = tmp_path / "storage"
    try:
        client.post(
            "/api/runs",
            json={"id": "big_run", "env": "memory_maze", "agent": "x", "track": "test"},
            headers={"x-api-key": secret},
        )
        client.post(
            "/api/runs/big_run/upload",
            headers={"x-api-key": secret},
            files={"metrics_file": ("metrics.json", b"a" * 4096, "application/json")},
        )
    finally:
        client.__exit__(None, None, None)

    assert not (storage_dir / "big_run").exists()


def test_readyz_uses_write_probe(tmp_path, monkeypatch):
    modules = load_test_modules(monkeypatch, tmp_path)
    app = modules["worldmodel_server.main"].app
    main_mod = modules["worldmodel_server.main"]

    calls = {"n": 0}
    original = main_mod.storage_write_probe

    def spy():
        calls["n"] += 1
        return original()

    monkeypatch.setattr(main_mod, "storage_write_probe", spy)

    with TestClient(app) as client:
        response = client.get("/readyz")

    assert response.status_code == 200
    assert calls["n"] >= 1
    assert response.json()["checks"]["storage"]["ok"] is True


def test_upload_commit_failure_leaves_no_orphan_artifact(tmp_path, monkeypatch):
    modules = load_test_modules(monkeypatch, tmp_path)
    client, secret = _make_writer_client(modules)
    storage_dir = tmp_path / "storage"
    run_id = "commit_fail_run"
    try:
        client.post(
            "/api/runs",
            json={"id": run_id, "env": "memory_maze", "agent": "x", "track": "test"},
            headers={"x-api-key": secret},
        )

        from sqlalchemy.orm import Session as SASession

        original_commit = SASession.commit

        def boom(self):
            raise RuntimeError("simulated commit failure")

        monkeypatch.setattr(SASession, "commit", boom)

        resp = client.post(
            f"/api/runs/{run_id}/upload",
            headers={"x-api-key": secret},
            files={
                "metrics_file": (
                    "metrics.json",
                    json.dumps({"success_rate": 0.5, "mean_return": 0.5}),
                    "application/json",
                )
            },
        )

        monkeypatch.setattr(SASession, "commit", original_commit)
    finally:
        client.__exit__(None, None, None)

    assert resp.status_code == 500
    assert not (storage_dir / run_id / "metrics.json").exists()


def test_reupload_is_idempotent(tmp_path, monkeypatch):
    modules = load_test_modules(monkeypatch, tmp_path)
    client, secret = _make_writer_client(modules)
    try:
        first = _upload_run(client, secret, "redo_run", 0.3, 0.3)
        second = _upload_run(client, secret, "redo_run", 0.7, 0.7)
        rows = client.get("/api/leaderboard?track=test").json()
    finally:
        client.__exit__(None, None, None)

    assert first.status_code == 200
    assert second.status_code == 200
    matching = [r for r in rows if r["run_id"] == "redo_run"]
    assert len(matching) == 1
    assert matching[0]["success_rate"] == 0.7

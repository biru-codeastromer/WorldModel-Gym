from __future__ import annotations

import sys
from importlib import import_module, reload

import fakeredis
import pytest
from fastapi.testclient import TestClient

MODULE_ORDER = [
    "worldmodel_server.config",
    "worldmodel_server.db",
    "worldmodel_server.models",
    "worldmodel_server.storage",
    "worldmodel_server.auth",
    "worldmodel_server.request_logging",
    "worldmodel_server.seed",
    "worldmodel_server.runner",
    "worldmodel_server.migrations",
    "worldmodel_server.main",
]


def load_modules(monkeypatch, tmp_path, *, queue_enabled=False, redis_url="", cache_ttl=10):
    monkeypatch.setenv("WMG_DB_URL", f"sqlite:///{tmp_path / 'test.db'}")
    monkeypatch.setenv("WMG_STORAGE_DIR", str(tmp_path / "storage"))
    monkeypatch.setenv("WMG_UPLOAD_TOKEN", "test-token")
    monkeypatch.setenv("WMG_AUTO_MIGRATE", "true")
    monkeypatch.setenv("WMG_ENABLE_METRICS", "false")
    monkeypatch.setenv("WMG_SEED_DEMO_DATA", "false")
    monkeypatch.setenv("WMG_QUEUE_ENABLED", "true" if queue_enabled else "false")
    monkeypatch.setenv("WMG_REDIS_URL", redis_url)
    monkeypatch.setenv("WMG_RESPONSE_CACHE_TTL_SECONDS", str(cache_ttl))

    modules = {}
    for name in MODULE_ORDER:
        if name in sys.modules:
            modules[name] = reload(sys.modules[name])
        else:
            modules[name] = import_module(name)
    return modules


def _admin_client(modules):
    app = modules["worldmodel_server.main"].app
    create_api_key = modules["worldmodel_server.auth"].create_api_key
    session_local = modules["worldmodel_server.db"].SessionLocal
    client = TestClient(app)
    client.__enter__()
    with session_local() as session:
        _, secret = create_api_key(session, name="admin", scopes=["admin"])
    return client, secret


def _create_run(client, secret, run_id="job_run", env="memory_maze", agent="random", track="test"):
    return client.post(
        "/api/runs",
        json={"id": run_id, "env": env, "agent": agent, "track": track},
        headers={"x-api-key": secret},
    )


# --------------------------------------------------------------------------- #
# Config
# --------------------------------------------------------------------------- #


def test_config_defaults(monkeypatch, tmp_path):
    modules = load_modules(monkeypatch, tmp_path)
    settings = modules["worldmodel_server.config"].settings
    assert settings.redis_url == ""
    assert settings.queue_enabled is False
    assert settings.response_cache_ttl_seconds == 10
    assert settings.queue_active is False


# --------------------------------------------------------------------------- #
# Enqueue: status + idempotency
# --------------------------------------------------------------------------- #


def test_enqueue_sets_status_queued_and_is_idempotent(monkeypatch, tmp_path):
    modules = load_modules(monkeypatch, tmp_path, queue_enabled=True, redis_url="redis://fake")
    runner = modules["worldmodel_server.runner"]

    server = fakeredis.FakeServer()
    queue = _build_queue(server)

    client, secret = _admin_client(modules)
    try:
        _create_run(client, secret, run_id="idem_run")

        first = runner.enqueue_run("idem_run", "random", "memory_maze", "test", queue=queue)
        second = runner.enqueue_run("idem_run", "random", "memory_maze", "test", queue=queue)
    finally:
        client.__exit__(None, None, None)

    assert first is True
    assert second is False  # already queued -> no double enqueue
    assert len(queue.jobs) == 1


def _build_queue(server):
    from rq import Queue

    conn = fakeredis.FakeStrictRedis(server=server)
    return Queue("worldmodel-runs", connection=conn)


# --------------------------------------------------------------------------- #
# Job function transitions status + records a result
# --------------------------------------------------------------------------- #


def test_job_function_transitions_status_and_records_result(monkeypatch, tmp_path):
    modules = load_modules(monkeypatch, tmp_path)
    runner = modules["worldmodel_server.runner"]
    session_local = modules["worldmodel_server.db"].SessionLocal
    run_model = modules["worldmodel_server.models"].RunEntry
    migrations = modules["worldmodel_server.migrations"]
    migrations.run_migrations()

    with session_local() as session:
        session.add(
            run_model(
                id="exec_run", env="memory_maze", agent="random", track="test", status="queued"
            )
        )
        session.commit()

    result = runner.run_benchmark_job(
        "exec_run", "random", "memory_maze", "test", max_episodes=2, max_steps=60
    )

    assert result["status"] == "completed"
    with session_local() as session:
        item = session.get(run_model, "exec_run")
        assert item.status == "completed"
        assert item.trace_path == "exec_run/trace.jsonl"
        assert item.config_path == "exec_run/config.yaml"
        assert item.metrics_json != "{}"


def test_job_marks_failed_on_error(monkeypatch, tmp_path):
    modules = load_modules(monkeypatch, tmp_path)
    runner = modules["worldmodel_server.runner"]
    session_local = modules["worldmodel_server.db"].SessionLocal
    run_model = modules["worldmodel_server.models"].RunEntry
    modules["worldmodel_server.migrations"].run_migrations()

    with session_local() as session:
        session.add(
            run_model(
                id="fail_run", env="memory_maze", agent="random", track="test", status="queued"
            )
        )
        session.commit()

    # An unknown env makes the harness raise; the job must mark the run failed.
    with pytest.raises(Exception):
        runner.run_benchmark_job("fail_run", "random", "no_such_env", "test")

    with session_local() as session:
        assert session.get(run_model, "fail_run").status == "failed"


def test_simple_worker_burst_executes_enqueued_job(monkeypatch, tmp_path):
    """End-to-end: enqueue on fakeredis, drain with an in-process SimpleWorker."""
    modules = load_modules(monkeypatch, tmp_path, queue_enabled=True, redis_url="redis://fake")
    runner = modules["worldmodel_server.runner"]
    session_local = modules["worldmodel_server.db"].SessionLocal
    run_model = modules["worldmodel_server.models"].RunEntry

    from rq import SimpleWorker

    server = fakeredis.FakeServer()
    queue = _build_queue(server)

    client, secret = _admin_client(modules)
    try:
        _create_run(client, secret, run_id="worker_run")
    finally:
        client.__exit__(None, None, None)

    enqueued = runner.enqueue_run(
        "worker_run", "random", "memory_maze", "test", max_episodes=2, queue=queue
    )
    assert enqueued is True

    worker = SimpleWorker([queue], connection=queue.connection)
    worker.work(burst=True)

    with session_local() as session:
        assert session.get(run_model, "worker_run").status == "completed"


# --------------------------------------------------------------------------- #
# /trigger endpoint
# --------------------------------------------------------------------------- #


def test_trigger_returns_501_when_queue_disabled(monkeypatch, tmp_path):
    modules = load_modules(monkeypatch, tmp_path, queue_enabled=False)
    client, secret = _admin_client(modules)
    try:
        _create_run(client, secret, run_id="trig_off")
        resp = client.post("/api/runs/trig_off/trigger", headers={"x-api-key": secret})
    finally:
        client.__exit__(None, None, None)

    assert resp.status_code == 501


def test_trigger_returns_202_and_queues_when_enabled(monkeypatch, tmp_path):
    modules = load_modules(monkeypatch, tmp_path, queue_enabled=True, redis_url="redis://fake")
    runner = modules["worldmodel_server.runner"]
    run_model = modules["worldmodel_server.models"].RunEntry
    session_local = modules["worldmodel_server.db"].SessionLocal

    server = fakeredis.FakeServer()
    queue = _build_queue(server)

    # Route the app's enqueue through our fakeredis-backed queue.
    monkeypatch.setattr(runner, "get_queue", lambda connection=None: queue)
    monkeypatch.setattr(modules["worldmodel_server.main"], "enqueue_run", runner.enqueue_run)

    client, secret = _admin_client(modules)
    try:
        _create_run(client, secret, run_id="trig_on")
        resp = client.post("/api/runs/trig_on/trigger", headers={"x-api-key": secret})
    finally:
        client.__exit__(None, None, None)

    assert resp.status_code == 202
    body = resp.json()
    assert body["status"] == "queued"
    assert len(queue.jobs) == 1
    with session_local() as session:
        assert session.get(run_model, "trig_on").status == "queued"


def test_trigger_404_for_unknown_run_when_enabled(monkeypatch, tmp_path):
    modules = load_modules(monkeypatch, tmp_path, queue_enabled=True, redis_url="redis://fake")
    client, secret = _admin_client(modules)
    try:
        resp = client.post("/api/runs/missing_run/trigger", headers={"x-api-key": secret})
    finally:
        client.__exit__(None, None, None)
    assert resp.status_code == 404


# --------------------------------------------------------------------------- #
# Response caching + Cache-Control header
# --------------------------------------------------------------------------- #


def test_leaderboard_cache_control_header_present(monkeypatch, tmp_path):
    modules = load_modules(monkeypatch, tmp_path, cache_ttl=30)
    app = modules["worldmodel_server.main"].app
    with TestClient(app) as client:
        resp = client.get("/api/leaderboard?track=test")
    assert resp.status_code == 200
    assert resp.headers["cache-control"] == "public, max-age=30"


def test_tasks_cache_control_no_store_when_ttl_zero(monkeypatch, tmp_path):
    modules = load_modules(monkeypatch, tmp_path, cache_ttl=0)
    app = modules["worldmodel_server.main"].app
    with TestClient(app) as client:
        resp = client.get("/api/tasks")
    assert resp.status_code == 200
    assert resp.headers["cache-control"] == "no-store"


def test_leaderboard_cache_serves_within_ttl_and_busts_on_upload(monkeypatch, tmp_path):
    import json

    modules = load_modules(monkeypatch, tmp_path, cache_ttl=60)
    app = modules["worldmodel_server.main"].app
    create_api_key = modules["worldmodel_server.auth"].create_api_key
    session_local = modules["worldmodel_server.db"].SessionLocal

    client = TestClient(app)
    client.__enter__()
    try:
        with session_local() as session:
            _, secret = create_api_key(session, name="writer", scopes=["runs:write"])

        # Prime the cache with an empty leaderboard.
        assert client.get("/api/leaderboard?track=test").json() == []

        # Insert a run directly in the DB (bypasses the cache-busting upload path)
        # to prove the cached empty result is served while the cache is warm.
        run_model = modules["worldmodel_server.models"].RunEntry
        with session_local() as session:
            session.add(
                run_model(
                    id="cached_hidden",
                    env="memory_maze",
                    agent="random",
                    track="test",
                    status="uploaded",
                    success_rate=0.9,
                    mean_return=0.9,
                    created_by="writer",
                )
            )
            session.commit()
        assert client.get("/api/leaderboard?track=test").json() == []  # still cached

        # A real upload busts the cache, so the new run appears immediately.
        client.post(
            "/api/runs",
            json={"id": "buster_run", "env": "memory_maze", "agent": "random", "track": "test"},
            headers={"x-api-key": secret},
        )
        client.post(
            "/api/runs/buster_run/upload",
            headers={"x-api-key": secret},
            files={
                "metrics_file": (
                    "metrics.json",
                    json.dumps({"success_rate": 0.5, "mean_return": 0.5}),
                    "application/json",
                )
            },
        )
        rows = client.get("/api/leaderboard?track=test").json()
    finally:
        client.__exit__(None, None, None)

    run_ids = {r["run_id"] for r in rows}
    assert "buster_run" in run_ids
    assert "cached_hidden" in run_ids  # bust revealed the previously-hidden row too

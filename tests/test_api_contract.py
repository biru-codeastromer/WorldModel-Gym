"""Contract tests for the production API surface wired into ``main.py``.

Covers the additive, production-grade behaviors layered onto the existing API:
RFC 9457 ``application/problem+json`` errors (with the legacy ``detail`` field
preserved), the ``/api/v1`` versioned mount mirroring ``/api`` exactly,
Idempotency-Key replay/conflict on writes, ``X-RateLimit-*`` headers, conditional
``ETag``/304 on the leaderboard, and metrics validation rejecting physically
impossible submissions.
"""

from __future__ import annotations

import json

from fastapi.testclient import TestClient

PROBLEM_CONTENT_TYPE = "application/problem+json"


def _writer_client(modules):
    app = modules["worldmodel_server.main"].app
    create_api_key = modules["worldmodel_server.auth"].create_api_key
    session_local = modules["worldmodel_server.db"].SessionLocal
    client = TestClient(app)
    client.__enter__()
    with session_local() as session:
        _, secret = create_api_key(session, name="contract-writer", scopes=["runs:write"])
    return client, secret


def _metrics_files(success_rate=0.5, mean_return=0.4):
    return {
        "metrics_file": (
            "metrics.json",
            json.dumps({"success_rate": success_rate, "mean_return": mean_return}),
            "application/json",
        )
    }


# --------------------------------------------------------------------------- #
# RFC 9457 problem+json
# --------------------------------------------------------------------------- #


def test_404_is_problem_json_with_detail(server_modules):
    modules = server_modules()
    app = modules.app

    with TestClient(app) as client:
        resp = client.get("/api/runs/does_not_exist")

    assert resp.status_code == 404
    assert resp.headers["content-type"].startswith(PROBLEM_CONTENT_TYPE)
    body = resp.json()
    # Legacy contract: a top-level "detail" string is always present.
    assert body["detail"] == "run not found"
    # New RFC 9457 fields.
    assert body["status"] == 404
    assert body["title"]
    assert body["type"] == "about:blank"
    assert body["instance"] == "/api/runs/does_not_exist"


def test_422_validation_error_is_problem_json(server_modules):
    modules = server_modules()
    client, secret = _writer_client(modules)
    try:
        # limit=0 violates the ge=1 query constraint -> RequestValidationError.
        resp = client.get("/api/leaderboard?track=test&limit=0")
    finally:
        client.__exit__(None, None, None)

    assert resp.status_code == 422
    assert resp.headers["content-type"].startswith(PROBLEM_CONTENT_TYPE)
    body = resp.json()
    assert isinstance(body["detail"], str) and body["detail"]
    # Per-field errors are attached under the "errors" extension member.
    assert isinstance(body["errors"], list) and body["errors"]


def test_429_is_problem_json_with_detail(server_modules):
    modules = server_modules(public_limit=1)
    app = modules.app

    with TestClient(app) as client:
        first = client.get("/api/tasks")
        second = client.get("/api/tasks")

    assert first.status_code == 200
    assert second.status_code == 429
    assert second.headers["content-type"].startswith(PROBLEM_CONTENT_TYPE)
    body = second.json()
    assert body["detail"] == "public API rate limit exceeded"
    assert body["status"] == 429


# --------------------------------------------------------------------------- #
# /api/v1 versioning mirrors /api
# --------------------------------------------------------------------------- #


def test_v1_leaderboard_matches_legacy(server_modules):
    modules = server_modules()
    client, secret = _writer_client(modules)
    try:
        client.post(
            "/api/runs",
            json={"id": "v1_run", "env": "memory_maze", "agent": "a", "track": "test"},
            headers={"x-api-key": secret},
        )
        client.post(
            "/api/runs/v1_run/upload",
            headers={"x-api-key": secret},
            files=_metrics_files(0.7, 0.6),
        )

        legacy = client.get("/api/leaderboard?track=test")
        versioned = client.get("/api/v1/leaderboard?track=test")
    finally:
        client.__exit__(None, None, None)

    assert legacy.status_code == 200
    assert versioned.status_code == 200
    # Same JSON list shape and contents on both surfaces.
    assert isinstance(versioned.json(), list)
    assert legacy.json() == versioned.json()
    assert any(r["run_id"] == "v1_run" for r in versioned.json())


def test_v1_create_and_read_run(server_modules):
    modules = server_modules()
    client, secret = _writer_client(modules)
    try:
        created = client.post(
            "/api/v1/runs",
            json={"id": "v1_create", "env": "memory_maze", "agent": "a", "track": "test"},
            headers={"x-api-key": secret},
        )
        # The run created via /api/v1 is visible via the legacy /api surface.
        fetched = client.get("/api/runs/v1_create")
    finally:
        client.__exit__(None, None, None)

    assert created.status_code == 200
    assert fetched.status_code == 200
    assert fetched.json()["id"] == "v1_create"


# --------------------------------------------------------------------------- #
# Idempotency-Key
# --------------------------------------------------------------------------- #


def test_idempotent_create_replays_response(server_modules):
    modules = server_modules()
    run_model = modules["worldmodel_server.models"].RunEntry
    session_local = modules["worldmodel_server.db"].SessionLocal
    client, secret = _writer_client(modules)
    payload = {"id": "idem_run", "env": "memory_maze", "agent": "a", "track": "test"}
    headers = {"x-api-key": secret, "Idempotency-Key": "key-123"}
    try:
        first = client.post("/api/runs", json=payload, headers=headers)
        second = client.post("/api/runs", json=payload, headers=headers)

        with session_local() as session:
            # Exactly one run row despite two POSTs (the side effect ran once).
            runs = session.query(run_model).filter(run_model.id == "idem_run").all()
            assert len(runs) == 1
    finally:
        client.__exit__(None, None, None)

    assert first.status_code == 200
    assert second.status_code == 200
    # The replayed response is byte-for-byte the stored one.
    assert first.json() == second.json()


def test_idempotent_key_conflict_on_different_body(server_modules):
    modules = server_modules()
    client, secret = _writer_client(modules)
    headers = {"x-api-key": secret, "Idempotency-Key": "key-conflict"}
    try:
        first = client.post(
            "/api/runs",
            json={"id": "conflict_a", "env": "memory_maze", "agent": "a", "track": "test"},
            headers=headers,
        )
        # Same key, different body -> conflict, no second side effect.
        second = client.post(
            "/api/runs",
            json={"id": "conflict_b", "env": "memory_maze", "agent": "a", "track": "test"},
            headers=headers,
        )
    finally:
        client.__exit__(None, None, None)

    assert first.status_code == 200
    assert second.status_code == 409
    assert second.headers["content-type"].startswith(PROBLEM_CONTENT_TYPE)
    assert "detail" in second.json()


def test_idempotent_upload_replays(server_modules):
    modules = server_modules()
    client, secret = _writer_client(modules)
    headers = {"x-api-key": secret, "Idempotency-Key": "upload-key-1"}
    try:
        client.post(
            "/api/runs",
            json={"id": "idem_upload", "env": "memory_maze", "agent": "a", "track": "test"},
            headers={"x-api-key": secret},
        )
        first = client.post(
            "/api/runs/idem_upload/upload",
            headers=headers,
            files=_metrics_files(0.42, 0.3),
        )
        second = client.post(
            "/api/runs/idem_upload/upload",
            headers=headers,
            files=_metrics_files(0.42, 0.3),
        )
    finally:
        client.__exit__(None, None, None)

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json() == second.json()


# --------------------------------------------------------------------------- #
# X-RateLimit headers
# --------------------------------------------------------------------------- #


def test_rate_limit_headers_on_authenticated_write(server_modules):
    modules = server_modules(write_limit=5)
    client, secret = _writer_client(modules)
    try:
        resp = client.post(
            "/api/runs",
            json={"id": "rl_run", "env": "memory_maze", "agent": "a", "track": "test"},
            headers={"x-api-key": secret},
        )
    finally:
        client.__exit__(None, None, None)

    assert resp.status_code == 200
    assert resp.headers["X-RateLimit-Limit"] == "5"
    assert int(resp.headers["X-RateLimit-Remaining"]) >= 0
    assert "X-RateLimit-Reset" in resp.headers


def test_rate_limit_headers_on_write_429(server_modules):
    modules = server_modules(write_limit=1)
    client, secret = _writer_client(modules)
    try:
        first = client.post(
            "/api/runs",
            json={"id": "rl_a", "env": "memory_maze", "agent": "a", "track": "test"},
            headers={"x-api-key": secret},
        )
        second = client.post(
            "/api/runs",
            json={"id": "rl_b", "env": "memory_maze", "agent": "a", "track": "test"},
            headers={"x-api-key": secret},
        )
    finally:
        client.__exit__(None, None, None)

    assert first.status_code == 200
    assert second.status_code == 429
    assert second.headers["X-RateLimit-Limit"] == "1"
    assert second.headers["X-RateLimit-Remaining"] == "0"
    assert "Retry-After" in second.headers
    assert "X-RateLimit-Reset" in second.headers


def test_rate_limit_headers_on_public_read_success(server_modules):
    modules = server_modules(public_limit=5)
    app = modules.app
    with TestClient(app) as client:
        ok = client.get("/api/leaderboard?track=test")

    # Quota headers must appear on an allowed public read too, so clients can
    # pace themselves rather than discovering the limit only on a 429.
    assert ok.status_code == 200
    assert ok.headers["X-RateLimit-Limit"] == "5"
    assert int(ok.headers["X-RateLimit-Remaining"]) >= 0
    assert "X-RateLimit-Reset" in ok.headers


def test_rate_limit_headers_on_public_read_429(server_modules):
    modules = server_modules(public_limit=1)
    app = modules.app
    with TestClient(app) as client:
        client.get("/api/tasks")
        blocked = client.get("/api/tasks")

    assert blocked.status_code == 429
    assert blocked.headers["X-RateLimit-Limit"] == "1"
    assert blocked.headers["X-RateLimit-Remaining"] == "0"
    assert "X-RateLimit-Reset" in blocked.headers


# --------------------------------------------------------------------------- #
# ETag / 304 on the leaderboard
# --------------------------------------------------------------------------- #


def test_leaderboard_etag_then_304(server_modules):
    modules = server_modules()
    client, secret = _writer_client(modules)
    try:
        client.post(
            "/api/runs",
            json={"id": "etag_run", "env": "memory_maze", "agent": "a", "track": "test"},
            headers={"x-api-key": secret},
        )
        client.post(
            "/api/runs/etag_run/upload",
            headers={"x-api-key": secret},
            files=_metrics_files(0.6, 0.5),
        )

        first = client.get("/api/leaderboard?track=test")
        etag = first.headers["ETag"]
        conditional = client.get(
            "/api/leaderboard?track=test",
            headers={"If-None-Match": etag},
        )
    finally:
        client.__exit__(None, None, None)

    assert first.status_code == 200
    assert etag
    assert conditional.status_code == 304
    assert conditional.headers["ETag"] == etag
    assert conditional.content == b""


def test_leaderboard_no_conditional_returns_200_list(server_modules):
    modules = server_modules()
    app = modules.app
    with TestClient(app) as client:
        resp = client.get("/api/leaderboard?track=test")

    # Additive: no If-None-Match => unchanged 200 JSON list contract.
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
    assert "ETag" in resp.headers


def test_leaderboard_surfaces_ci_and_model_fidelity(server_modules):
    """The leaderboard row lifts success_rate_ci + model_fidelity out of the
    uploaded metrics blob; a run that omits them keeps them null (the optional,
    back-compatible contract)."""
    modules = server_modules()
    client, secret = _writer_client(modules)
    try:
        # A run whose metrics carry the ranking extras.
        client.post(
            "/api/runs",
            json={"id": "ci_run", "env": "memory_maze", "agent": "a", "track": "test"},
            headers={"x-api-key": secret},
        )
        client.post(
            "/api/runs/ci_run/upload",
            headers={"x-api-key": secret},
            files={
                "metrics_file": (
                    "metrics.json",
                    json.dumps(
                        {
                            "success_rate": 0.8,
                            "mean_return": 0.7,
                            "success_rate_ci": [0.72, 0.88],
                            "model_fidelity": {"k1": 0.95, "k5": 0.81, "k20": 0.6},
                        }
                    ),
                    "application/json",
                )
            },
        )
        # A run that omits them entirely (lower success_rate so it ranks below).
        client.post(
            "/api/runs",
            json={"id": "plain_run", "env": "memory_maze", "agent": "a", "track": "test"},
            headers={"x-api-key": secret},
        )
        client.post(
            "/api/runs/plain_run/upload",
            headers={"x-api-key": secret},
            files=_metrics_files(0.5, 0.4),
        )

        resp = client.get("/api/leaderboard?track=test")
    finally:
        client.__exit__(None, None, None)

    assert resp.status_code == 200
    by_id = {r["run_id"]: r for r in resp.json()}

    enriched = by_id["ci_run"]
    assert enriched["success_rate_ci"] == [0.72, 0.88]
    assert enriched["model_fidelity"] == {"k1": 0.95, "k5": 0.81, "k20": 0.6}

    plain = by_id["plain_run"]
    assert plain["success_rate_ci"] is None
    assert plain["model_fidelity"] is None


# --------------------------------------------------------------------------- #
# Metrics validation on upload
# --------------------------------------------------------------------------- #


def test_upload_rejects_impossible_success_rate(server_modules):
    modules = server_modules()
    client, secret = _writer_client(modules)
    try:
        client.post(
            "/api/runs",
            json={"id": "bad_metrics", "env": "memory_maze", "agent": "a", "track": "test"},
            headers={"x-api-key": secret},
        )
        resp = client.post(
            "/api/runs/bad_metrics/upload",
            headers={"x-api-key": secret},
            files=_metrics_files(success_rate=1.5),
        )
    finally:
        client.__exit__(None, None, None)

    assert resp.status_code == 422
    assert resp.headers["content-type"].startswith(PROBLEM_CONTENT_TYPE)
    body = resp.json()
    assert "success_rate" in body["detail"]
    assert "detail" in body


def test_upload_stamps_metrics_schema_version_and_provenance(server_modules):
    from worldmodel_server.validation import METRICS_SCHEMA_VERSION

    modules = server_modules()
    run_model = modules["worldmodel_server.models"].RunEntry
    session_local = modules["worldmodel_server.db"].SessionLocal
    client, secret = _writer_client(modules)
    try:
        client.post(
            "/api/runs",
            json={
                "id": "prov_run",
                "env": "memory_maze",
                "agent": "a",
                "track": "test",
                "code_version": "abc123",
                "seed_protocol": "fixed-seeds-v2",
            },
            headers={"x-api-key": secret},
        )
        upload = client.post(
            "/api/runs/prov_run/upload",
            headers={"x-api-key": secret},
            files=_metrics_files(0.5, 0.4),
        )
    finally:
        client.__exit__(None, None, None)

    assert upload.status_code == 200
    body = upload.json()
    assert body["code_version"] == "abc123"
    assert body["seed_protocol"] == "fixed-seeds-v2"
    assert body["metrics_schema_version"] == METRICS_SCHEMA_VERSION

    with session_local() as session:
        row = session.get(run_model, "prov_run")
        assert row.metrics_schema_version == METRICS_SCHEMA_VERSION
        assert row.code_version == "abc123"
        assert row.seed_protocol == "fixed-seeds-v2"

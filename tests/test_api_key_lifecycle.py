from __future__ import annotations

from contextlib import contextmanager
from datetime import timedelta

from fastapi.testclient import TestClient


@contextmanager
def _capture_audit_events(modules):
    """Spy on the server's structured event emitter and collect ``(event, action)``
    tuples. We patch ``request_logging.log_system_event`` directly because that is
    the single sink every admin-audit call routes through, which is more robust
    than scraping log handlers across the app-startup logging reconfiguration."""
    request_logging = modules["worldmodel_server.request_logging"]
    main = modules["worldmodel_server.main"]
    original = request_logging.log_system_event
    events: list[tuple[str, object]] = []

    def _spy(event, **payload):
        events.append((event, payload.get("action")))
        return original(event, **payload)

    # ``main`` binds ``log_system_event`` by name at import, so patch both the
    # source module (used by the lazy key-lifecycle audit) and the ``main``
    # namespace (used by the /trigger endpoint).
    request_logging.log_system_event = _spy
    main.log_system_event = _spy
    try:
        yield events
    finally:
        request_logging.log_system_event = original
        main.log_system_event = original


def _create_run(client, secret, run_id="lc_run"):
    return client.post(
        "/api/runs",
        json={"id": run_id, "env": "memory_maze", "agent": "random", "track": "test"},
        headers={"x-api-key": secret},
    )


def test_expired_api_key_is_rejected(server_modules):
    modules = server_modules()
    app = modules.app
    create_api_key = modules.create_api_key
    session_local = modules.SessionLocal
    utcnow = modules.models.utcnow

    with TestClient(app) as client:
        with session_local() as session:
            _, secret = create_api_key(
                session,
                name="expired",
                scopes=["runs:write"],
                expires_at=utcnow() - timedelta(minutes=1),
            )

        response = _create_run(client, secret)

    assert response.status_code == 401


def test_unexpired_api_key_is_accepted(server_modules):
    modules = server_modules()
    app = modules.app
    create_api_key = modules.create_api_key
    session_local = modules.SessionLocal
    utcnow = modules.models.utcnow

    with TestClient(app) as client:
        with session_local() as session:
            _, secret = create_api_key(
                session,
                name="future",
                scopes=["runs:write"],
                expires_at=utcnow() + timedelta(days=1),
            )

        response = _create_run(client, secret)

    assert response.status_code == 200


def test_expires_in_days_sets_expiry(server_modules):
    modules = server_modules()
    app = modules.app
    create_api_key = modules.create_api_key
    session_local = modules.SessionLocal

    with TestClient(app):
        with session_local() as session:
            item, _ = create_api_key(
                session,
                name="ttl",
                scopes=["runs:write"],
                expires_in_days=7,
            )
            assert item.expires_at is not None


def test_rotate_deactivates_old_and_new_key_works(server_modules):
    modules = server_modules()
    app = modules.app
    create_api_key = modules.create_api_key
    rotate_api_key = modules["worldmodel_server.auth"].rotate_api_key
    session_local = modules.SessionLocal

    with TestClient(app) as client:
        with session_local() as session:
            old_key, old_secret = create_api_key(session, name="rotate-me", scopes=["runs:write"])
            new_key, new_secret = rotate_api_key(session, old_key)
            assert old_key.is_active is False
            assert new_key.is_active is True
            assert new_key.name == "rotate-me"

        # Old secret is now rejected; the new secret authenticates.
        old_resp = _create_run(client, old_secret, run_id="old_run")
        new_resp = _create_run(client, new_secret, run_id="new_run")

    assert old_resp.status_code == 401
    assert new_resp.status_code == 200


def test_revoke_deactivates_key(server_modules):
    modules = server_modules()
    app = modules.app
    create_api_key = modules.create_api_key
    revoke_api_key = modules["worldmodel_server.auth"].revoke_api_key
    session_local = modules.SessionLocal

    with TestClient(app) as client:
        with session_local() as session:
            item, secret = create_api_key(session, name="revoke-me", scopes=["runs:write"])
            revoke_api_key(session, item)
            assert item.is_active is False

        response = _create_run(client, secret)

    assert response.status_code == 401


def test_security_headers_present_on_responses(server_modules):
    modules = server_modules()
    app = modules.app

    with TestClient(app) as client:
        response = client.get("/healthz")

    assert response.status_code == 200
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["referrer-policy"] == "no-referrer"
    assert "max-age" in response.headers["strict-transport-security"]


def test_security_headers_do_not_clobber_cache_control(server_modules):
    modules = server_modules()
    app = modules.app

    with TestClient(app) as client:
        response = client.get("/api/tasks")

    # Cache-Control set by the route handler must survive the security middleware.
    assert "cache-control" in response.headers
    assert response.headers["x-frame-options"] == "DENY"


def test_audit_event_emitted_on_key_creation(server_modules):
    modules = server_modules()
    create_api_key = modules.create_api_key
    session_local = modules.SessionLocal

    app = modules.app
    with TestClient(app):
        with _capture_audit_events(modules) as events:
            with session_local() as session:
                create_api_key(session, name="audited", scopes=["runs:write"])

    assert ("admin_audit", "api_key.create") in events


def test_audit_event_emitted_on_trigger(server_modules):
    modules = server_modules()
    app = modules.app
    create_api_key = modules.create_api_key
    session_local = modules.SessionLocal

    with TestClient(app) as client:
        with session_local() as session:
            _, secret = create_api_key(session, name="admin", scopes=["admin"])

        with _capture_audit_events(modules) as events:
            client.post("/api/runs/some_run/trigger", headers={"x-api-key": secret})

    assert ("admin_audit", "run.trigger") in events


def test_bootstrap_key_retires_after_durable_writer(server_modules, monkeypatch):
    monkeypatch.setenv("WMG_BOOTSTRAP_API_KEY", "bootstrap_key_for_tests_123456")
    modules = server_modules()
    app = modules.app
    create_api_key = modules.create_api_key
    session_local = modules.SessionLocal
    api_key_model = modules.models.ApiKey
    ensure_bootstrap = modules["worldmodel_server.auth"].ensure_bootstrap_api_key

    with TestClient(app):
        # Bootstrap key was created on startup and is active.
        with session_local() as session:
            bootstrap = session.query(api_key_model).filter_by(name="prod-writer").one()
            assert bootstrap.is_active is True

        # Operator mints a durable, non-bootstrap writer key.
        with session_local() as session:
            create_api_key(session, name="durable-writer", scopes=["admin", "runs:write"])

        # Re-running the bootstrap routine now retires the bootstrap key.
        with session_local() as session:
            result = ensure_bootstrap(session)
            assert result.status == "retired"

        with session_local() as session:
            bootstrap = session.query(api_key_model).filter_by(name="prod-writer").one()
            assert bootstrap.is_active is False

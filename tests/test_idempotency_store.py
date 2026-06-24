from __future__ import annotations

from datetime import timedelta
from importlib import import_module, reload

import pytest


@pytest.fixture
def store(server_modules):
    """A freshly-migrated server with the idempotency module + a session maker."""
    modules = server_modules()
    # idempotency is not in the conftest reload list; (re)import it against the
    # freshly-reloaded config/models/db so it binds to this test's sqlite db.
    import sys

    name = "worldmodel_server.idempotency"
    if name in sys.modules:
        modules.modules[name] = reload(sys.modules[name])
    else:
        modules.modules[name] = import_module(name)
    # Schema is applied at app startup (lifespan); apply it explicitly here since
    # this fixture exercises the store directly without a running app.
    modules["worldmodel_server.migrations"].run_migrations()
    return modules


def _session(modules):
    return modules.SessionLocal()


def test_fingerprint_is_order_independent(store):
    idem = store["worldmodel_server.idempotency"]
    a = idem.fingerprint_request({"x": 1, "y": 2})
    b = idem.fingerprint_request({"y": 2, "x": 1})
    assert a == b
    # Different payloads differ.
    assert a != idem.fingerprint_request({"x": 1, "y": 3})


def test_fingerprint_handles_bytes_and_str(store):
    idem = store["worldmodel_server.idempotency"]
    assert idem.fingerprint_request(b"abc") == idem.fingerprint_request("abc")


def test_miss_then_save_then_hit(store):
    idem = store["worldmodel_server.idempotency"]
    fp = idem.fingerprint_request({"id": "run1"})

    with _session(store) as session:
        record, conflict = idem.find_idempotent_response(
            session, "key-1", "p1", "POST", "/api/runs", fp
        )
        assert record is None and conflict is False

        idem.save_idempotent_response(
            session,
            "key-1",
            "p1",
            "POST",
            "/api/runs",
            fp,
            201,
            '{"id": "run1"}',
        )
        session.commit()

    # A separate session sees the persisted record on retry.
    with _session(store) as session:
        record, conflict = idem.find_idempotent_response(
            session, "key-1", "p1", "POST", "/api/runs", fp
        )
        assert conflict is False
        assert record is not None
        assert record.response_status == 201
        assert record.response_body == '{"id": "run1"}'


def test_same_key_different_fingerprint_is_conflict(store):
    idem = store["worldmodel_server.idempotency"]
    fp1 = idem.fingerprint_request({"id": "run1"})
    fp2 = idem.fingerprint_request({"id": "DIFFERENT"})

    with _session(store) as session:
        idem.save_idempotent_response(session, "key-2", "p1", "POST", "/api/runs", fp1, 201, "{}")
        session.commit()

    with _session(store) as session:
        record, conflict = idem.find_idempotent_response(
            session, "key-2", "p1", "POST", "/api/runs", fp2
        )
        assert record is None
        assert conflict is True


def test_scope_is_per_principal(store):
    idem = store["worldmodel_server.idempotency"]
    fp = idem.fingerprint_request({"id": "run1"})

    with _session(store) as session:
        idem.save_idempotent_response(
            session, "shared-key", "alice", "POST", "/api/runs", fp, 201, "{}"
        )
        session.commit()

    # A different principal reusing the same key is a clean miss, not a hit.
    with _session(store) as session:
        record, conflict = idem.find_idempotent_response(
            session, "shared-key", "bob", "POST", "/api/runs", fp
        )
        assert record is None and conflict is False


def test_scope_is_per_path(store):
    idem = store["worldmodel_server.idempotency"]
    fp = idem.fingerprint_request({"id": "run1"})

    with _session(store) as session:
        idem.save_idempotent_response(session, "k", "p1", "POST", "/api/runs", fp, 201, "{}")
        session.commit()

    with _session(store) as session:
        record, conflict = idem.find_idempotent_response(
            session, "k", "p1", "POST", "/api/other", fp
        )
        assert record is None and conflict is False


def test_expired_record_treated_as_absent_and_purged(store):
    idem = store["worldmodel_server.idempotency"]
    models = store.models
    config = store["worldmodel_server.config"]
    fp = idem.fingerprint_request({"id": "run1"})

    with _session(store) as session:
        rec = idem.save_idempotent_response(
            session, "old-key", "p1", "POST", "/api/runs", fp, 201, "{}"
        )
        # Backdate well past the TTL.
        rec.created_at = models.utcnow() - timedelta(
            hours=config.settings.idempotency_ttl_hours + 1
        )
        session.commit()

    with _session(store) as session:
        record, conflict = idem.find_idempotent_response(
            session, "old-key", "p1", "POST", "/api/runs", fp
        )
        assert record is None and conflict is False
        session.commit()

    # The stale record was dropped by the read path.
    with _session(store) as session:
        from sqlalchemy import select

        remaining = (
            session.execute(
                select(models.IdempotencyRecord).where(models.IdempotencyRecord.key == "old-key")
            )
            .scalars()
            .all()
        )
        assert remaining == []


def test_purge_expired_counts_and_removes(store):
    idem = store["worldmodel_server.idempotency"]
    models = store.models
    config = store["worldmodel_server.config"]

    with _session(store) as session:
        idem.save_idempotent_response(session, "fresh", "p1", "POST", "/api/runs", "fp1", 201, "{}")
        stale = idem.save_idempotent_response(
            session, "stale", "p1", "POST", "/api/runs", "fp2", 201, "{}"
        )
        stale.created_at = models.utcnow() - timedelta(
            hours=config.settings.idempotency_ttl_hours + 5
        )
        session.commit()

    with _session(store) as session:
        removed = idem.purge_expired(session)
        session.commit()
        assert removed == 1

    with _session(store) as session:
        from sqlalchemy import select

        keys = set(session.execute(select(models.IdempotencyRecord.key)).scalars().all())
        assert keys == {"fresh"}

from __future__ import annotations

import pytest
from worldmodel_server import db, storage


def test_retry_read_succeeds_after_transient_failure(monkeypatch):
    monkeypatch.setattr(storage.time, "sleep", lambda _seconds: None)
    calls = {"n": 0}

    def flaky():
        calls["n"] += 1
        if calls["n"] < 3:
            raise OSError("transient")
        return "value"

    result = storage._retry_read(flaky, description="flaky")

    assert result == "value"
    assert calls["n"] == 3


def test_retry_read_gives_up_after_max_attempts(monkeypatch):
    monkeypatch.setattr(storage.time, "sleep", lambda _seconds: None)
    calls = {"n": 0}

    def always_fails():
        calls["n"] += 1
        raise OSError("still broken")

    with pytest.raises(OSError, match="still broken"):
        storage._retry_read(always_fails, description="always")

    assert calls["n"] == storage.READ_RETRY_ATTEMPTS


def test_build_engine_kwargs_sqlite_has_no_postgres_connect_args():
    kwargs = db.build_engine_kwargs("sqlite:///./test.db")

    assert kwargs["connect_args"] == {"check_same_thread": False}
    assert "pool_timeout" not in kwargs
    assert "pool_pre_ping" not in kwargs


def test_build_engine_kwargs_postgres_sets_statement_timeout():
    kwargs = db.build_engine_kwargs("postgresql+psycopg://user:pass@host:5432/wmg")

    assert kwargs["pool_pre_ping"] is True
    assert kwargs["pool_timeout"] == db.DB_POOL_TIMEOUT_SECONDS
    assert kwargs["connect_args"] == {
        "options": f"-c statement_timeout={db.DB_STATEMENT_TIMEOUT_MS}",
    }


def test_storage_write_probe_local_ok_path(tmp_path, monkeypatch):
    monkeypatch.setattr(storage.settings, "storage_backend", "local")
    monkeypatch.setattr(storage.settings, "storage_dir", tmp_path / "storage")
    storage.reset_store()
    try:
        result = storage.storage_write_probe()
    finally:
        storage.reset_store()

    assert result["ok"] is True
    assert result["backend"] == "local"
    # No probe files should be left behind.
    leftovers = list((tmp_path / "storage").glob(f"{storage.HEALTH_PROBE_FILENAME}*"))
    assert leftovers == []


def test_storage_load_run_artifact_retries_transient(monkeypatch):
    monkeypatch.setattr(storage.time, "sleep", lambda _seconds: None)
    calls = {"n": 0}

    class FlakyStore:
        def read_artifact(self, key):
            calls["n"] += 1
            if calls["n"] < 2:
                raise OSError("transient disk error")
            return b"payload"

    monkeypatch.setattr(storage, "get_store", lambda: FlakyStore())

    assert storage.load_run_artifact("some-key") == b"payload"
    assert calls["n"] == 2

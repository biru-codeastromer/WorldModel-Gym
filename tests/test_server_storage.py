from __future__ import annotations

from pathlib import Path

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


def _local_store(tmp_path, monkeypatch) -> storage.LocalArtifactStore:
    root = tmp_path / "storage"
    monkeypatch.setattr(storage.settings, "storage_backend", "local")
    monkeypatch.setattr(storage.settings, "storage_dir", root)
    storage.reset_store()
    store = storage.get_store()
    assert isinstance(store, storage.LocalArtifactStore)
    return store


def test_make_artifact_key_is_backend_agnostic():
    assert storage.make_artifact_key("run_123", "trace.jsonl") == "run_123/trace.jsonl"
    # Basename only: a hostile or path-bearing filename cannot inject directories.
    assert storage.make_artifact_key("run_123", "../../etc/passwd") == "run_123/passwd"


def test_make_artifact_key_rejects_bad_run_id():
    with pytest.raises(ValueError):
        storage.make_artifact_key("../escape", "trace.jsonl")


def test_local_save_returns_relative_key_not_absolute(tmp_path, monkeypatch):
    store = _local_store(tmp_path, monkeypatch)
    try:
        key = store.save_artifact("run_abc", "trace.jsonl", b"line\n")
    finally:
        storage.reset_store()

    # The persisted key must be backend-agnostic, never an absolute host path.
    assert key == "run_abc/trace.jsonl"
    assert not Path(key).is_absolute()
    # But the bytes really landed under the storage root and read back via the key.
    assert (tmp_path / "storage" / "run_abc" / "trace.jsonl").read_bytes() == b"line\n"


def test_local_read_resolves_relative_key(tmp_path, monkeypatch):
    store = _local_store(tmp_path, monkeypatch)
    try:
        key = store.save_artifact("run_abc", "config.yaml", b"env: x\n")
        assert store.read_artifact(key) == b"env: x\n"
    finally:
        storage.reset_store()


def test_local_read_tolerates_legacy_absolute_path(tmp_path, monkeypatch):
    store = _local_store(tmp_path, monkeypatch)
    try:
        # Simulate a legacy row that persisted the full absolute host path.
        store.save_artifact("run_abc", "trace.jsonl", b"legacy\n")
        legacy_abs = str((tmp_path / "storage" / "run_abc" / "trace.jsonl").resolve())
        assert store.read_artifact(legacy_abs) == b"legacy\n"
    finally:
        storage.reset_store()


def test_local_read_rejects_key_outside_root(tmp_path, monkeypatch):
    store = _local_store(tmp_path, monkeypatch)
    try:
        with pytest.raises(ValueError):
            store.read_artifact("/etc/passwd")
    finally:
        storage.reset_store()


def test_save_run_artifact_module_helper_returns_agnostic_key(tmp_path, monkeypatch):
    _local_store(tmp_path, monkeypatch)
    try:
        key = storage.save_run_artifact("run_xyz", "metrics.json", b"{}")
        assert key == "run_xyz/metrics.json"
        assert storage.load_run_artifact(key) == b"{}"
    finally:
        storage.reset_store()


def test_s3_persisted_key_excludes_prefix(monkeypatch):
    monkeypatch.setattr(storage.settings, "storage_backend", "s3")
    monkeypatch.setattr(storage.settings, "s3_bucket", "test-bucket")
    monkeypatch.setattr(storage.settings, "s3_prefix", "artifacts")
    monkeypatch.setattr(storage.settings, "s3_endpoint_url", "http://localhost:9000")
    monkeypatch.setattr(storage.settings, "s3_region", "us-east-1")
    monkeypatch.setattr(storage.settings, "s3_access_key_id", "x")
    monkeypatch.setattr(storage.settings, "s3_secret_access_key", "y")
    storage.reset_store()
    try:
        store = storage.get_store()
        assert isinstance(store, storage.S3ArtifactStore)
        # Persisted key is agnostic (no bucket prefix); prefix is applied at I/O.
        key = store.artifact_key("run_abc", "trace.jsonl")
        assert key == "run_abc/trace.jsonl"
        assert store._object_key(key) == "artifacts/run_abc/trace.jsonl"
        # A legacy key that already carries the prefix is not double-prefixed.
        assert store._object_key("artifacts/run_abc/trace.jsonl") == (
            "artifacts/run_abc/trace.jsonl"
        )
    finally:
        storage.reset_store()

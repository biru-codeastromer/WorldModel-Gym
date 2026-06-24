from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from worldmodel_server.config import Settings
from worldmodel_server.storage import run_dir, validate_run_id


def test_validate_run_id_rejects_path_traversal():
    with pytest.raises(ValueError):
        validate_run_id("../secrets")


def test_run_dir_stays_within_storage_root(tmp_path, monkeypatch):
    monkeypatch.setattr("worldmodel_server.storage.settings.storage_dir", tmp_path / "storage")

    resolved = run_dir("safe_run_123")

    assert resolved == (tmp_path / "storage" / "safe_run_123").resolve()
    assert resolved.is_dir()
    assert Path(tmp_path / "storage").resolve() in resolved.parents


def test_production_requires_non_default_upload_token(monkeypatch):
    monkeypatch.setenv("WMG_ENV", "production")
    # Satisfy the durable-storage guard so this test isolates the token check.
    monkeypatch.setenv("WMG_STORAGE_BACKEND", "s3")
    monkeypatch.setenv("WMG_S3_BUCKET", "test-bucket")
    monkeypatch.setenv("WMG_LEGACY_UPLOAD_TOKEN_ENABLED", "true")
    monkeypatch.delenv("WMG_UPLOAD_TOKEN", raising=False)

    settings = Settings()

    with pytest.raises(RuntimeError):
        settings.validate()


def test_production_rejects_local_storage_backend(monkeypatch):
    monkeypatch.setenv("WMG_ENV", "production")
    monkeypatch.setenv("WMG_STORAGE_BACKEND", "local")

    settings = Settings()

    with pytest.raises(RuntimeError):
        settings.validate()


def test_legacy_upload_token_disabled_by_default(monkeypatch):
    monkeypatch.delenv("WMG_LEGACY_UPLOAD_TOKEN_ENABLED", raising=False)

    settings = Settings()

    assert settings.legacy_upload_token_enabled is False


def test_default_dev_token_allowed_in_development(monkeypatch):
    # The default token is only rejected when the legacy path is enabled outside
    # development/test; a plain development server must still validate cleanly.
    monkeypatch.setenv("WMG_ENV", "development")
    monkeypatch.delenv("WMG_UPLOAD_TOKEN", raising=False)
    monkeypatch.delenv("WMG_LEGACY_UPLOAD_TOKEN_ENABLED", raising=False)

    settings = Settings()
    settings.validate()  # should not raise


def test_upload_persists_backend_agnostic_keys_and_reads_back(server_modules, tmp_path):
    modules = server_modules()
    app = modules.app
    create_api_key = modules.create_api_key
    session_local = modules.SessionLocal
    run_model = modules.models.RunEntry

    run_id = "keytest_run"
    storage_dir = tmp_path / "storage"

    with TestClient(app) as client:
        with session_local() as session:
            _, secret = create_api_key(session, name="writer", scopes=["runs:write"])

        client.post(
            "/api/runs",
            json={"id": run_id, "env": "memory_maze", "agent": "random", "track": "test"},
            headers={"x-api-key": secret},
        )
        upload = client.post(
            f"/api/runs/{run_id}/upload",
            headers={"x-api-key": secret},
            files={
                "metrics_file": (
                    "metrics.json",
                    json.dumps({"success_rate": 0.5, "mean_return": 0.5}),
                    "application/json",
                ),
                "trace_file": ("trace.jsonl", b'{"step": 0}\n', "application/x-ndjson"),
                "config_file": ("config.yaml", b"env: memory_maze\n", "text/yaml"),
            },
        )
        assert upload.status_code == 200

        # The persisted columns must be relative, backend-agnostic keys -- never
        # absolute host paths -- so the row is portable across hosts and to S3.
        with session_local() as session:
            row = session.get(run_model, run_id)
            assert row.trace_path == f"{run_id}/trace.jsonl"
            assert row.config_path == f"{run_id}/config.yaml"
            assert not Path(row.trace_path).is_absolute()
            assert not Path(row.config_path).is_absolute()
            assert str(storage_dir) not in row.trace_path
            assert str(storage_dir) not in row.config_path

        # Read paths still resolve the agnostic key through the store.
        trace = client.get(f"/api/runs/{run_id}/trace")
        config = client.get(f"/api/runs/{run_id}/config")
        metrics = client.get(f"/api/runs/{run_id}/metrics")

    assert trace.status_code == 200
    assert trace.content == b'{"step": 0}\n'
    assert config.status_code == 200
    assert config.content == b"env: memory_maze\n"
    assert metrics.status_code == 200
    assert metrics.json()["success_rate"] == 0.5

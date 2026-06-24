from __future__ import annotations

from pathlib import Path

import pytest
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

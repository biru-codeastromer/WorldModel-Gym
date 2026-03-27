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
    monkeypatch.delenv("WMG_UPLOAD_TOKEN", raising=False)

    settings = Settings()

    with pytest.raises(RuntimeError):
        settings.validate()

from __future__ import annotations

import json
from pathlib import Path

from worldmodel_server.config import settings


def ensure_storage_dirs() -> None:
    settings.storage_dir.mkdir(parents=True, exist_ok=True)


def run_dir(run_id: str) -> Path:
    d = settings.storage_dir / run_id
    d.mkdir(parents=True, exist_ok=True)
    return d


def save_upload_file(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


def load_json(path: str | Path) -> dict:
    p = Path(path)
    if not p.exists():
        return {}
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}

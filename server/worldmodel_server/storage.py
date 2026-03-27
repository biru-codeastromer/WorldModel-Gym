from __future__ import annotations

import json
import re
from pathlib import Path

from worldmodel_server.config import settings

RUN_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{2,63}$")


def ensure_storage_dirs() -> None:
    settings.storage_dir.mkdir(parents=True, exist_ok=True)


def validate_run_id(run_id: str) -> str:
    if not RUN_ID_PATTERN.fullmatch(run_id):
        raise ValueError(
            "run_id must be 3-64 chars and contain only letters, numbers, hyphens, or underscores"
        )
    return run_id


def run_dir(run_id: str, create: bool = True) -> Path:
    safe_run_id = validate_run_id(run_id)
    root = settings.storage_dir.resolve()
    if create:
        root.mkdir(parents=True, exist_ok=True)
    d = (root / safe_run_id).resolve()
    if root not in d.parents:
        raise ValueError("run_id resolved outside storage root")
    if create:
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

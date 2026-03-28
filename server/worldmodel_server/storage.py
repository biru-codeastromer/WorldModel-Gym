from __future__ import annotations

import json
import mimetypes
import re
from pathlib import Path

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from worldmodel_server.config import settings

RUN_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{2,63}$")
_STORE = None


class ArtifactStore:
    backend_name = "local"

    def ensure_ready(self) -> None:
        raise NotImplementedError

    def describe(self) -> dict[str, str]:
        raise NotImplementedError

    def artifact_key(self, run_id: str, filename: str) -> str:
        raise NotImplementedError

    def save_artifact(self, run_id: str, filename: str, data: bytes) -> str:
        raise NotImplementedError

    def read_artifact(self, key: str) -> bytes:
        raise NotImplementedError


class LocalArtifactStore(ArtifactStore):
    backend_name = "local"

    def __init__(self, root: Path) -> None:
        self.root = root

    def ensure_ready(self) -> None:
        self.root.mkdir(parents=True, exist_ok=True)

    def describe(self) -> dict[str, str]:
        return {"backend": self.backend_name, "location": str(self.root.resolve())}

    def artifact_key(self, run_id: str, filename: str) -> str:
        return str(run_dir(run_id) / filename)

    def save_artifact(self, run_id: str, filename: str, data: bytes) -> str:
        path = run_dir(run_id) / filename
        path.write_bytes(data)
        return str(path)

    def read_artifact(self, key: str) -> bytes:
        return Path(key).read_bytes()


class S3ArtifactStore(ArtifactStore):
    backend_name = "s3"

    def __init__(self) -> None:
        self.bucket = settings.s3_bucket
        self.prefix = settings.s3_prefix.strip("/")
        self.client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint_url,
            region_name=settings.s3_region or None,
            aws_access_key_id=settings.s3_access_key_id or None,
            aws_secret_access_key=settings.s3_secret_access_key or None,
        )

    def ensure_ready(self) -> None:
        self.client.head_bucket(Bucket=self.bucket)

    def describe(self) -> dict[str, str]:
        prefix = f"/{self.prefix}" if self.prefix else ""
        return {"backend": self.backend_name, "location": f"s3://{self.bucket}{prefix}"}

    def artifact_key(self, run_id: str, filename: str) -> str:
        safe_run_id = validate_run_id(run_id)
        parts = [self.prefix, safe_run_id, filename]
        return "/".join(part for part in parts if part)

    def save_artifact(self, run_id: str, filename: str, data: bytes) -> str:
        key = self.artifact_key(run_id, filename)
        content_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"
        self.client.put_object(
            Bucket=self.bucket,
            Key=key,
            Body=data,
            ContentType=content_type,
        )
        return key

    def read_artifact(self, key: str) -> bytes:
        try:
            obj = self.client.get_object(Bucket=self.bucket, Key=key)
        except (BotoCoreError, ClientError) as exc:
            raise FileNotFoundError(key) from exc
        return obj["Body"].read()


def ensure_storage_dirs() -> None:
    get_store().ensure_ready()


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


def get_store() -> ArtifactStore:
    global _STORE
    if _STORE is None:
        _STORE = (
            LocalArtifactStore(settings.storage_dir)
            if settings.storage_backend == "local"
            else S3ArtifactStore()
        )
    return _STORE


def reset_store() -> None:
    global _STORE
    _STORE = None


def artifact_key(run_id: str, filename: str) -> str:
    return get_store().artifact_key(run_id, filename)


def save_run_artifact(run_id: str, filename: str, data: bytes) -> str:
    return get_store().save_artifact(run_id, filename, data)


def load_run_artifact(key: str) -> bytes:
    return get_store().read_artifact(key)


def storage_status() -> dict[str, str]:
    return get_store().describe()


def load_json(path: str | Path) -> dict:
    p = Path(path)
    if not p.exists():
        return {}
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}

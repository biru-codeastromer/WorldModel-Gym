from __future__ import annotations

import json
import logging
import mimetypes
import re
import time
import uuid
from collections.abc import Callable
from pathlib import Path
from typing import TypeVar

import boto3
from botocore.config import Config as BotoConfig
from botocore.exceptions import BotoCoreError, ClientError

from worldmodel_server.config import settings

logger = logging.getLogger(__name__)

RUN_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{2,63}$")
_STORE = None

# S3 / botocore client resilience tuning. These govern how long the boto3
# client waits to establish/read a connection and how many times it retries
# transient failures before surfacing an error.
S3_CONNECT_TIMEOUT_SECONDS = 5.0
S3_READ_TIMEOUT_SECONDS = 15.0
S3_MAX_ATTEMPTS = 3
S3_RETRY_MODE = "standard"

# Bounded retry-with-backoff tuning for idempotent artifact READ operations.
# Writes are intentionally excluded from this because they are not idempotent
# in this storage layer.
READ_RETRY_ATTEMPTS = 3
READ_RETRY_BASE_DELAY_SECONDS = 0.05
READ_RETRY_MAX_DELAY_SECONDS = 1.0

# Key/filename used by the storage write-probe health check.
HEALTH_PROBE_FILENAME = ".worldmodel-write-probe"

_T = TypeVar("_T")


def _retry_read(operation: Callable[[], _T], *, description: str) -> _T:
    """Run an idempotent read ``operation`` with bounded exponential backoff.

    Retries transient OSError / boto errors a few times before giving up and
    re-raising the last exception. Intended only for idempotent reads -- never
    wrap non-idempotent writes with this helper.
    """
    last_exc: Exception | None = None
    for attempt in range(1, READ_RETRY_ATTEMPTS + 1):
        try:
            return operation()
        except (OSError, BotoCoreError, ClientError) as exc:
            last_exc = exc
            if attempt >= READ_RETRY_ATTEMPTS:
                break
            delay = min(
                READ_RETRY_BASE_DELAY_SECONDS * (2 ** (attempt - 1)),
                READ_RETRY_MAX_DELAY_SECONDS,
            )
            logger.warning(
                "transient storage read error on %s (attempt %d/%d): %s; retrying in %.3fs",
                description,
                attempt,
                READ_RETRY_ATTEMPTS,
                exc,
                delay,
            )
            time.sleep(delay)
    assert last_exc is not None
    raise last_exc


def make_artifact_key(run_id: str, filename: str) -> str:
    """Build the backend-agnostic artifact key persisted in the DB.

    The key is always ``"<run_id>/<filename>"`` -- a relative, portable
    identifier with no host path or storage backend specifics baked in, so a
    ``RunEntry`` row stays valid if the storage root moves or the deployment
    switches between the local and S3 backends. Concrete locations (absolute
    filesystem paths, S3 object keys with a prefix) are only ever resolved from
    this key at read/write time inside the store implementations.
    """
    safe_run_id = validate_run_id(run_id)
    safe_filename = Path(filename).name
    if not safe_filename or safe_filename in {".", ".."}:
        raise ValueError("filename must be a plain, non-empty name")
    return f"{safe_run_id}/{safe_filename}"


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

    def write_probe(self) -> dict[str, object]:
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
        return make_artifact_key(run_id, filename)

    def resolve_path(self, key: str) -> Path:
        """Resolve a persisted key to a concrete filesystem path.

        New-style keys are backend-agnostic ("run_id/filename") and are resolved
        under the current storage root. Legacy rows stored an absolute host path
        directly; those are tolerated by passing an absolute key straight
        through. Either way the resolved path is confined to the storage root.
        """
        candidate = Path(key)
        if candidate.is_absolute():
            # Legacy absolute path written by an older build. Honor it as-is so
            # existing rows keep reading, but still confine it to the storage
            # root to avoid path traversal via a hostile DB value.
            resolved = candidate.resolve()
        else:
            resolved = (self.root / key).resolve()
        root = self.root.resolve()
        if root != resolved and root not in resolved.parents:
            raise ValueError("artifact key resolved outside storage root")
        return resolved

    def save_artifact(self, run_id: str, filename: str, data: bytes) -> str:
        key = self.artifact_key(run_id, filename)
        path = run_dir(run_id) / Path(filename).name
        path.write_bytes(data)
        return key

    def read_artifact(self, key: str) -> bytes:
        return self.resolve_path(key).read_bytes()

    def write_probe(self) -> dict[str, object]:
        self.ensure_ready()
        probe_path = (self.root / f"{HEALTH_PROBE_FILENAME}-{uuid.uuid4().hex}").resolve()
        payload = b"ok"
        try:
            probe_path.write_bytes(payload)
            read_back = probe_path.read_bytes()
        except OSError as exc:
            return {"ok": False, "backend": self.backend_name, "error": str(exc)}
        finally:
            try:
                probe_path.unlink(missing_ok=True)
            except OSError as exc:
                logger.warning("failed to clean up local write-probe %s: %s", probe_path, exc)
        if read_back != payload:
            return {
                "ok": False,
                "backend": self.backend_name,
                "error": "write-probe read-back mismatch",
            }
        return {"ok": True, "backend": self.backend_name}


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
            config=BotoConfig(
                connect_timeout=S3_CONNECT_TIMEOUT_SECONDS,
                read_timeout=S3_READ_TIMEOUT_SECONDS,
                retries={"max_attempts": S3_MAX_ATTEMPTS, "mode": S3_RETRY_MODE},
            ),
        )

    def ensure_ready(self) -> None:
        self.client.head_bucket(Bucket=self.bucket)

    def describe(self) -> dict[str, str]:
        prefix = f"/{self.prefix}" if self.prefix else ""
        return {"backend": self.backend_name, "location": f"s3://{self.bucket}{prefix}"}

    def artifact_key(self, run_id: str, filename: str) -> str:
        # Persist a backend-agnostic key ("run_id/filename"); the bucket prefix
        # is a deployment detail applied only when talking to S3.
        return make_artifact_key(run_id, filename)

    def _object_key(self, key: str) -> str:
        """Map a persisted agnostic key to the concrete S3 object key.

        Prepends the configured bucket prefix at I/O time. Legacy rows that
        already include the prefix are tolerated by not double-prefixing.
        """
        normalized = key.lstrip("/")
        if self.prefix and not normalized.startswith(f"{self.prefix}/"):
            return f"{self.prefix}/{normalized}"
        return normalized

    def save_artifact(self, run_id: str, filename: str, data: bytes) -> str:
        key = self.artifact_key(run_id, filename)
        content_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"
        self.client.put_object(
            Bucket=self.bucket,
            Key=self._object_key(key),
            Body=data,
            ContentType=content_type,
        )
        return key

    def read_artifact(self, key: str) -> bytes:
        try:
            obj = self.client.get_object(Bucket=self.bucket, Key=self._object_key(key))
        except (BotoCoreError, ClientError) as exc:
            raise FileNotFoundError(key) from exc
        return obj["Body"].read()

    def write_probe(self) -> dict[str, object]:
        parts = [self.prefix, HEALTH_PROBE_FILENAME, uuid.uuid4().hex]
        key = "/".join(part for part in parts if part)
        try:
            self.client.put_object(
                Bucket=self.bucket,
                Key=key,
                Body=b"ok",
                ContentType="text/plain",
            )
        except (BotoCoreError, ClientError) as exc:
            return {"ok": False, "backend": self.backend_name, "error": str(exc)}
        try:
            self.client.delete_object(Bucket=self.bucket, Key=key)
        except (BotoCoreError, ClientError) as exc:
            logger.warning("failed to clean up s3 write-probe %s: %s", key, exc)
        return {"ok": True, "backend": self.backend_name}


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
    return _retry_read(
        lambda: get_store().read_artifact(key),
        description=f"load_run_artifact({key!r})",
    )


def storage_status() -> dict[str, str]:
    return get_store().describe()


def storage_write_probe() -> dict[str, object]:
    """Verify storage is actually writable end to end.

    For the local backend this writes and deletes a temp file under the storage
    root; for S3 it puts and deletes a tiny health key. Returns a structured
    ``{"ok": bool, "backend": str, ...}`` dict so a readiness check can surface
    the result without raising.
    """
    try:
        return get_store().write_probe()
    except (OSError, BotoCoreError, ClientError) as exc:
        return {"ok": False, "error": str(exc)}


def load_json(path: str | Path) -> dict:
    p = Path(path)
    if not p.exists():
        return {}

    def _read() -> str:
        return p.read_text(encoding="utf-8")

    try:
        raw = _retry_read(_read, description=f"load_json({str(path)!r})")
    except FileNotFoundError:
        return {}
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {}

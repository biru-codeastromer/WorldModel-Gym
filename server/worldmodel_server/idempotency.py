"""Idempotency-key store for safely retryable write requests.

A client that retries a write (because it never saw the response) can send the
same ``Idempotency-Key``; the server replays the original response instead of
performing the side effect twice. A record is scoped to ``(key, principal,
method, path)`` and carries a fingerprint of the request so reusing one key for a
*different* request is detected as a conflict rather than silently replayed.

Records older than ``WMG_IDEMPOTENCY_TTL_HOURS`` are treated as absent, letting
the same key be reused after the window and letting the table self-prune.
"""

from __future__ import annotations

import hashlib
import json
from datetime import timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from worldmodel_server.config import settings
from worldmodel_server.models import IdempotencyRecord, utcnow


def fingerprint_request(payload: Any) -> str:
    """Return a stable SHA-256 hex digest for a request payload.

    Dicts/lists are serialized with sorted keys so logically-equal payloads
    produce the same fingerprint regardless of key ordering. Bytes and strings
    are hashed directly.
    """

    if isinstance(payload, bytes):
        data = payload
    elif isinstance(payload, str):
        data = payload.encode("utf-8")
    else:
        data = json.dumps(payload, sort_keys=True, default=str).encode("utf-8")
    return hashlib.sha256(data).hexdigest()


def _ttl_cutoff():
    hours = max(0, settings.idempotency_ttl_hours)
    return utcnow() - timedelta(hours=hours)


def find_idempotent_response(
    session: Session,
    key: str,
    principal: str,
    method: str,
    path: str,
    fingerprint: str,
) -> tuple[IdempotencyRecord | None, bool]:
    """Look up a previously-stored response for an idempotency key.

    Returns ``(record, conflict)``:

    * ``(None, False)``  -- no live record: the caller should proceed and then
      persist the result via :func:`save_idempotent_response`.
    * ``(record, False)`` -- a matching record (same fingerprint): replay it.
    * ``(None, True)``   -- a live record exists for this key/scope but with a
      *different* fingerprint: the key is being reused for a different request
      and the caller should reject with 409 Conflict.

    Expired records (older than the TTL) are ignored, so a key may be reused
    after its window elapses.
    """

    stmt = select(IdempotencyRecord).where(
        IdempotencyRecord.key == key,
        IdempotencyRecord.principal_id == principal,
        IdempotencyRecord.method == method,
        IdempotencyRecord.path == path,
    )
    record = session.execute(stmt).scalar_one_or_none()
    if record is None:
        return None, False

    if record.created_at < _ttl_cutoff():
        # Stale: drop it so the unique scope is free for a fresh request.
        session.delete(record)
        session.flush()
        return None, False

    if record.request_fingerprint != fingerprint:
        return None, True

    return record, False


def save_idempotent_response(
    session: Session,
    key: str,
    principal: str,
    method: str,
    path: str,
    fingerprint: str,
    response_status: int,
    response_body: str,
) -> IdempotencyRecord:
    """Persist the outcome of a write so future retries can replay it.

    The record is added to ``session`` (and flushed) but not committed: the
    caller owns the surrounding transaction so the side effect and its
    idempotency record commit atomically.
    """

    record = IdempotencyRecord(
        key=key,
        principal_id=principal,
        method=method,
        path=path,
        request_fingerprint=fingerprint,
        response_status=response_status,
        response_body=response_body,
    )
    session.add(record)
    session.flush()
    return record


def purge_expired(session: Session) -> int:
    """Delete records past the TTL. Returns the number removed.

    Intended for a periodic sweep; the read path also drops stale records it
    encounters, so this is an optimization rather than a correctness requirement.
    """

    cutoff = _ttl_cutoff()
    stmt = select(IdempotencyRecord).where(IdempotencyRecord.created_at < cutoff)
    stale = session.execute(stmt).scalars().all()
    for record in stale:
        session.delete(record)
    session.flush()
    return len(stale)

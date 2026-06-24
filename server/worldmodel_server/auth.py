from __future__ import annotations

import hashlib
import hmac
import json
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Iterable

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from worldmodel_server.config import settings
from worldmodel_server.db import get_session
from worldmodel_server.models import ApiKey, utcnow

# Minimum interval between `last_used_at` writes for a given key. Authenticated
# requests are on the write hot path, so we avoid issuing an UPDATE + COMMIT on
# every call and instead refresh this column at most once per window. The value
# only needs to be coarse enough to track recent activity, not exact.
LAST_USED_REFRESH_INTERVAL = timedelta(seconds=60)


@dataclass(frozen=True)
class AuthenticatedPrincipal:
    kind: str
    identifier: str
    scopes: frozenset[str]
    rate_limit_per_minute: int
    display_name: str

    def has_scope(self, scope: str) -> bool:
        return "admin" in self.scopes or scope in self.scopes


@dataclass(frozen=True)
class BootstrapApiKeyResult:
    status: str
    key_prefix: str | None = None
    name: str | None = None


def generate_api_key() -> str:
    return f"wmg_{secrets.token_urlsafe(24)}"


def hash_api_key(secret: str) -> str:
    return hashlib.sha256(secret.encode("utf-8")).hexdigest()


def normalize_scopes(scopes: Iterable[str]) -> list[str]:
    return sorted({scope.strip() for scope in scopes if scope.strip()})


def serialize_scopes(scopes: Iterable[str]) -> str:
    return json.dumps(normalize_scopes(scopes))


def deserialize_scopes(raw: str) -> list[str]:
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return []
    if not isinstance(parsed, list):
        return []
    return normalize_scopes(str(item) for item in parsed)


def create_api_key(
    session: Session,
    *,
    name: str,
    scopes: Iterable[str],
    rate_limit_per_minute: int | None = None,
    raw_key: str | None = None,
    expires_in_days: int | None = None,
    expires_at: datetime | None = None,
) -> tuple[ApiKey, str]:
    secret = raw_key or generate_api_key()
    if expires_at is None and expires_in_days is not None:
        expires_at = utcnow() + timedelta(days=expires_in_days)
    item = ApiKey(
        name=name,
        key_prefix=secret[:12],
        key_hash=hash_api_key(secret),
        scopes_json=serialize_scopes(scopes),
        rate_limit_per_minute=rate_limit_per_minute
        or settings.authenticated_write_rate_limit_per_minute,
        expires_at=expires_at,
    )
    session.add(item)
    session.commit()
    session.refresh(item)
    _audit_key_event("api_key.create", item)
    return item, secret


def _audit_key_event(action: str, api_key: ApiKey, **extra: object) -> None:
    """Emit a structured audit record for an API-key lifecycle change.

    Imported lazily so that ``auth`` does not take a module-load dependency on
    ``request_logging`` (the test harness reloads these modules in a fixed order
    and a top-level import would bind a stale logger). Never logs secrets -- only
    the key prefix, action, name, and scopes.
    """
    from worldmodel_server.request_logging import log_system_event

    log_system_event(
        "admin_audit",
        action=action,
        principal="cli",
        principal_kind="cli",
        target=api_key.key_prefix,
        name=api_key.name,
        **extra,
    )


def is_key_expired(api_key: ApiKey, now: datetime | None = None) -> bool:
    if api_key.expires_at is None:
        return False
    reference = now if now is not None else utcnow()
    return api_key.expires_at <= reference


def rotate_api_key(
    session: Session,
    api_key: ApiKey,
    *,
    rate_limit_per_minute: int | None = None,
    expires_in_days: int | None = None,
) -> tuple[ApiKey, str]:
    """Mint a fresh secret with the same name/scopes and retire the old key.

    The previous key is deactivated in the same transaction so a rotation never
    leaves two live secrets for the same logical credential.
    """
    new_key, secret = create_api_key(
        session,
        name=api_key.name,
        scopes=deserialize_scopes(api_key.scopes_json),
        rate_limit_per_minute=(
            rate_limit_per_minute
            if rate_limit_per_minute is not None
            else api_key.rate_limit_per_minute
        ),
        expires_in_days=expires_in_days,
    )
    api_key.is_active = False
    session.add(api_key)
    session.commit()
    session.refresh(api_key)
    _audit_key_event("api_key.rotate", new_key, rotated_from=api_key.key_prefix)
    return new_key, secret


def revoke_api_key(session: Session, api_key: ApiKey) -> ApiKey:
    """Deactivate a key so it can no longer authenticate."""
    api_key.is_active = False
    session.add(api_key)
    session.commit()
    session.refresh(api_key)
    _audit_key_event("api_key.revoke", api_key)
    return api_key


def find_api_key_by_prefix(session: Session, key_prefix: str) -> ApiKey | None:
    return session.scalar(select(ApiKey).where(ApiKey.key_prefix == key_prefix))


BOOTSTRAP_KEY_NAME = "prod-writer"


def ensure_bootstrap_api_key(session: Session) -> BootstrapApiKeyResult:
    """Materialize the env-provided bootstrap key, idempotently and self-retiring.

    Per the README intent ("Remove ``WMG_BOOTSTRAP_API_KEY`` after the first
    durable writer key is created"), this never re-creates the bootstrap key once
    a durable, operator-managed writer key exists. If such a key is present, any
    lingering active bootstrap key is deactivated so the env secret stops being a
    live credential.
    """
    if not settings.bootstrap_api_key:
        return BootstrapApiKeyResult(status="disabled")

    bootstrap_hash = hash_api_key(settings.bootstrap_api_key)
    bootstrap_existing = session.scalar(select(ApiKey).where(ApiKey.key_hash == bootstrap_hash))

    # A "durable writer" is any key that can write and is NOT the bootstrap key
    # itself. Once one exists, the bootstrap secret has served its purpose.
    durable_writer = session.scalar(
        select(ApiKey).where(
            ApiKey.key_hash != bootstrap_hash,
            ApiKey.is_active.is_(True),
        )
    )
    if durable_writer is not None:
        if bootstrap_existing is not None and bootstrap_existing.is_active:
            bootstrap_existing.is_active = False
            session.add(bootstrap_existing)
            session.commit()
            return BootstrapApiKeyResult(
                status="retired",
                key_prefix=bootstrap_existing.key_prefix,
                name=bootstrap_existing.name,
            )
        return BootstrapApiKeyResult(
            status="already_present",
            key_prefix=durable_writer.key_prefix,
            name=durable_writer.name,
        )

    if bootstrap_existing is not None:
        return BootstrapApiKeyResult(
            status="already_present",
            key_prefix=bootstrap_existing.key_prefix,
            name=bootstrap_existing.name,
        )

    item, _ = create_api_key(
        session,
        name=BOOTSTRAP_KEY_NAME,
        scopes=["admin", "runs:write"],
        raw_key=settings.bootstrap_api_key,
    )
    return BootstrapApiKeyResult(status="created", key_prefix=item.key_prefix, name=item.name)


def _extract_bearer_token(authorization: str | None) -> str | None:
    if not authorization:
        return None
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        return None
    return token.strip()


def _find_api_key(session: Session, token: str) -> ApiKey | None:
    hashed = hash_api_key(token)
    return session.scalar(
        select(ApiKey).where(ApiKey.key_hash == hashed, ApiKey.is_active.is_(True))
    )


def _touch_last_used(session: Session, api_key: ApiKey, now: datetime) -> None:
    """Refresh ``last_used_at`` at most once per ``LAST_USED_REFRESH_INTERVAL``.

    Keeps authentication off the write hot path: most requests skip the
    UPDATE + COMMIT entirely. The write is best-effort, so a failure here must
    never block an otherwise-valid authenticated request.
    """
    last_used = api_key.last_used_at
    if last_used is not None and (now - last_used) < LAST_USED_REFRESH_INTERVAL:
        return

    api_key.last_used_at = now
    session.add(api_key)
    try:
        session.commit()
    except Exception:
        session.rollback()


def get_authenticated_principal(
    authorization: str | None = Header(default=None),
    x_api_key: str | None = Header(default=None),
    x_upload_token: str | None = Header(default=None),
    session: Session = Depends(get_session),
) -> AuthenticatedPrincipal:
    token = x_api_key or _extract_bearer_token(authorization)
    if token:
        api_key = _find_api_key(session, token)
        now = datetime.now(UTC).replace(tzinfo=None)
        if api_key and not is_key_expired(api_key, now):
            _touch_last_used(session, api_key, now)
            return AuthenticatedPrincipal(
                kind="api_key",
                identifier=api_key.key_prefix,
                scopes=frozenset(deserialize_scopes(api_key.scopes_json)),
                rate_limit_per_minute=api_key.rate_limit_per_minute,
                display_name=api_key.name,
            )

    if (
        settings.legacy_upload_token_enabled
        and x_upload_token
        and hmac.compare_digest(x_upload_token, settings.upload_token)
    ):
        return AuthenticatedPrincipal(
            kind="legacy_token",
            identifier="legacy-upload-token",
            scopes=frozenset({"admin", "runs:write"}),
            rate_limit_per_minute=settings.legacy_token_rate_limit_per_minute,
            display_name="Legacy upload token",
        )

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="missing or invalid API credentials",
    )


def require_scope(scope: str):
    def _dependency(
        principal: AuthenticatedPrincipal = Depends(get_authenticated_principal),
    ) -> AuthenticatedPrincipal:
        if not principal.has_scope(scope):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"missing required scope: {scope}",
            )
        return principal

    return _dependency

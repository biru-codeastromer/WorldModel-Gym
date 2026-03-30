from __future__ import annotations

import hashlib
import json
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Iterable

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from worldmodel_server.config import settings
from worldmodel_server.db import get_session
from worldmodel_server.models import ApiKey


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
) -> tuple[ApiKey, str]:
    secret = raw_key or generate_api_key()
    item = ApiKey(
        name=name,
        key_prefix=secret[:12],
        key_hash=hash_api_key(secret),
        scopes_json=serialize_scopes(scopes),
        rate_limit_per_minute=rate_limit_per_minute
        or settings.authenticated_write_rate_limit_per_minute,
    )
    session.add(item)
    session.commit()
    session.refresh(item)
    return item, secret


def ensure_bootstrap_api_key(session: Session) -> BootstrapApiKeyResult:
    if not settings.bootstrap_api_key:
        return BootstrapApiKeyResult(status="disabled")

    existing = session.scalar(select(ApiKey).limit(1))
    if existing is not None:
        return BootstrapApiKeyResult(
            status="already_present",
            key_prefix=existing.key_prefix,
            name=existing.name,
        )

    item, _ = create_api_key(
        session,
        name="prod-writer",
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


def get_authenticated_principal(
    authorization: str | None = Header(default=None),
    x_api_key: str | None = Header(default=None),
    x_upload_token: str | None = Header(default=None),
    session: Session = Depends(get_session),
) -> AuthenticatedPrincipal:
    token = x_api_key or _extract_bearer_token(authorization)
    if token:
        api_key = _find_api_key(session, token)
        if api_key:
            api_key.last_used_at = datetime.now(UTC).replace(tzinfo=None)
            session.add(api_key)
            session.commit()
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
        and x_upload_token == settings.upload_token
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

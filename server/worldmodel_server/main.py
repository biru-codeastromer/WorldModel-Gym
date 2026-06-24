from __future__ import annotations

import base64
import binascii
import hashlib
import json
import logging
import threading
import time
import uuid
from contextlib import asynccontextmanager
from datetime import datetime

from botocore.exceptions import BotoCoreError, ClientError
from fastapi import (
    APIRouter,
    Depends,
    FastAPI,
    File,
    Header,
    HTTPException,
    Query,
    Request,
    Response,
    UploadFile,
)
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import and_, desc, or_, select
from sqlalchemy.orm import Session
from starlette.exceptions import HTTPException as StarletteHTTPException

from worldmodel_server.auth import AuthenticatedPrincipal, ensure_bootstrap_api_key, require_scope
from worldmodel_server.config import settings
from worldmodel_server.db import SessionLocal, describe_database, engine, get_session
from worldmodel_server.errors import (
    problem_from_http_exception,
    problem_from_validation_error,
    problem_response,
)
from worldmodel_server.idempotency import (
    find_idempotent_response,
    fingerprint_request,
    save_idempotent_response,
)
from worldmodel_server.migrations import run_migrations
from worldmodel_server.models import RunEntry
from worldmodel_server.otel import setup_tracing
from worldmodel_server.rate_limit import WINDOW_SECONDS, RateLimitResult, rate_limiter
from worldmodel_server.request_logging import configure_logging, log_request_event, log_system_event
from worldmodel_server.runner import enqueue_run
from worldmodel_server.schemas import LeaderboardRow, RunCreate, RunResponse
from worldmodel_server.seed import seed_demo_runs
from worldmodel_server.storage import (
    LocalArtifactStore,
    S3ArtifactStore,
    artifact_key,
    ensure_storage_dirs,
    get_store,
    load_json,
    load_run_artifact,
    save_run_artifact,
    storage_status,
    storage_write_probe,
    validate_run_id,
)
from worldmodel_server.validation import ValidationProblem, validate_metrics

# Hard ceiling on leaderboard page size, regardless of the requested ``limit``,
# so a single request can never force the database to materialize an unbounded
# result set.
LEADERBOARD_MAX_LIMIT = 500
LEADERBOARD_DEFAULT_LIMIT = 100

# Chunk size for the streaming, size-bounded upload reader.
UPLOAD_READ_CHUNK_BYTES = 1024 * 1024


class CursorError(ValueError):
    """Raised when a client-supplied leaderboard cursor cannot be decoded.

    The opaque token is base64url(JSON([success_rate, mean_return, created_at,
    id])). Any structural problem -- bad base64, bad JSON, wrong shape, wrong
    types -- surfaces as this single error so the endpoint can return one
    consistent 400 problem+json regardless of how the token was corrupted.
    """


def _encode_leaderboard_cursor(row: LeaderboardRow) -> str:
    """Encode a row's keyset position as an opaque, URL-safe cursor token.

    The token captures exactly the ORDER BY tuple -- (success_rate, mean_return,
    created_at, run_id) -- so the next page can be fetched with a keyset WHERE
    clause that is stable even as rows are inserted concurrently. Padding is
    stripped so the token is clean to drop into a query string.
    """
    payload = [
        row.success_rate,
        row.mean_return,
        row.created_at.isoformat(),
        row.run_id,
    ]
    raw = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _decode_leaderboard_cursor(token: str) -> tuple[float, float, datetime, str]:
    """Decode an opaque cursor back into its keyset tuple.

    Raises :class:`CursorError` on any malformed input so the caller can map it
    to a single 400 problem+json. Re-adds the base64 padding that
    :func:`_encode_leaderboard_cursor` stripped before decoding.
    """
    if not token:
        raise CursorError("empty cursor")
    padding = "=" * (-len(token) % 4)
    try:
        raw = base64.urlsafe_b64decode(token + padding)
        payload = json.loads(raw.decode("utf-8"))
    except (binascii.Error, ValueError, UnicodeDecodeError) as exc:
        raise CursorError("cursor is not valid base64url-encoded JSON") from exc

    if not isinstance(payload, list) or len(payload) != 4:
        raise CursorError("cursor has an unexpected shape")
    success_rate, mean_return, created_at_raw, run_id = payload
    if (
        not isinstance(success_rate, (int, float))
        or isinstance(success_rate, bool)
        or not isinstance(mean_return, (int, float))
        or isinstance(mean_return, bool)
        or not isinstance(created_at_raw, str)
        or not isinstance(run_id, str)
    ):
        raise CursorError("cursor fields have unexpected types")
    try:
        created_at = datetime.fromisoformat(created_at_raw)
    except ValueError as exc:
        raise CursorError("cursor created_at is not a valid timestamp") from exc
    return float(success_rate), float(mean_return), created_at, run_id


try:
    from prometheus_fastapi_instrumentator import Instrumentator
except ImportError:  # pragma: no cover
    Instrumentator = None


class _TTLCache:
    """Tiny thread-safe TTL cache for public GET responses.

    Entries are keyed by an opaque string and carry a monotonic data-version
    stamp. ``bump_version`` invalidates every cached entry at once (used when an
    upload/seed mutates runs) without needing to enumerate keys. A per-entry TTL
    bounds staleness even without an explicit bump. TTL=0 disables caching.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._store: dict[str, tuple[float, int, object]] = {}
        self._version = 0

    def bump_version(self) -> None:
        with self._lock:
            self._version += 1
            self._store.clear()

    @property
    def version(self) -> int:
        # Read the monotonic data-version stamp; callers fold it into ETags so a
        # mutation that bumps the version necessarily changes downstream hashes.
        with self._lock:
            return self._version

    def get(self, key: str, ttl_seconds: int):
        if ttl_seconds <= 0:
            return None
        now = time.monotonic()
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None
            expires_at, version, value = entry
            if version != self._version or now >= expires_at:
                self._store.pop(key, None)
                return None
            return value

    def set(self, key: str, value: object, ttl_seconds: int) -> None:
        if ttl_seconds <= 0:
            return
        with self._lock:
            self._store[key] = (time.monotonic() + ttl_seconds, self._version, value)


_response_cache = _TTLCache()


def _cache_control_header(ttl_seconds: int) -> str:
    if ttl_seconds <= 0:
        return "no-store"
    return f"public, max-age={ttl_seconds}"


@asynccontextmanager
async def lifespan(_app: FastAPI):
    configure_logging()
    # Optional, env-gated distributed tracing. A no-op unless an OTLP endpoint is
    # configured; never breaks startup if the optional deps are missing.
    setup_tracing(_app, engine)
    startup_context = {
        "environment": settings.environment,
        "database": describe_database(),
        "auto_migrate": settings.auto_migrate,
        "seed_demo_data": settings.seed_demo_data,
        "bootstrap_api_key_configured": bool(settings.bootstrap_api_key),
    }
    try:
        settings.validate()
        if settings.auto_migrate:
            run_migrations()
        ensure_storage_dirs()
        bootstrap_result = None
        seeded_runs = 0
        with SessionLocal() as session:
            bootstrap_result = ensure_bootstrap_api_key(session)
            if settings.seed_demo_data and settings.is_production:
                log_system_event(
                    "demo_seed_skipped_in_production",
                    level=logging.WARNING,
                    reason="WMG_SEED_DEMO_DATA is ignored in production to keep the "
                    "leaderboard free of synthetic data.",
                )
            elif settings.seed_demo_data:
                seeded_runs = seed_demo_runs(session)
                if seeded_runs:
                    _response_cache.bump_version()
        log_system_event(
            "startup_complete",
            **startup_context,
            storage=storage_status(),
            bootstrap_api_key_status=bootstrap_result.status if bootstrap_result else "disabled",
            seeded_runs=seeded_runs,
        )
    except Exception as exc:
        log_system_event(
            "startup_failed",
            level=logging.ERROR,
            exc_info=True,
            **startup_context,
            error=str(exc),
        )
        raise
    try:
        yield
    finally:
        # Graceful shutdown: close pooled DB connections so they are not left
        # dangling (important for postgres in production).
        try:
            engine.dispose()
            log_system_event("shutdown_complete", environment=settings.environment)
        except Exception as exc:  # pragma: no cover - best-effort cleanup
            log_system_event(
                "shutdown_engine_dispose_failed",
                level=logging.WARNING,
                error=str(exc),
            )


app = FastAPI(title=settings.app_name, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


if settings.enable_metrics and Instrumentator is not None:
    Instrumentator(excluded_handlers=["/healthz", "/readyz"]).instrument(app).expose(
        app,
        include_in_schema=False,
    )


# --------------------------------------------------------------------------- #
# RFC 9457 problem+json exception handlers
# --------------------------------------------------------------------------- #
# Every error body still carries a top-level ``detail`` string (so the Next.js
# web + Expo mobile clients keep working) while gaining the structured
# ``type``/``title``/``status``/``instance`` fields and an ``application/
# problem+json`` media type. Status codes are preserved exactly.


@app.exception_handler(StarletteHTTPException)
async def _http_exception_handler(request: Request, exc: StarletteHTTPException):
    return problem_from_http_exception(exc, instance=request.url.path)


@app.exception_handler(RequestValidationError)
async def _validation_exception_handler(request: Request, exc: RequestValidationError):
    return problem_from_validation_error(exc, instance=request.url.path)


def _client_host(request: Request) -> str:
    # X-Forwarded-For is client-spoofable unless we are actually behind a trusted
    # reverse proxy. Only honor it when explicitly configured (WMG_TRUST_PROXY_HEADERS),
    # and then take the right-most hop — the address observed by the trusted proxy,
    # which the client cannot forge (it can only prepend left-most entries).
    if settings.trust_proxy_headers:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            hops = [hop.strip() for hop in forwarded.split(",") if hop.strip()]
            if hops:
                return hops[-1]
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def _should_rate_limit_public_request(request: Request) -> bool:
    if request.method not in {"GET", "HEAD"}:
        return False
    if not request.url.path.startswith("/api/"):
        return False
    if request.headers.get("authorization") or request.headers.get("x-api-key"):
        return False
    return True


def _rate_limit_headers(limit: int, result: RateLimitResult) -> dict[str, str]:
    """Standard ``X-RateLimit-*`` headers for a limiter decision.

    ``X-RateLimit-Reset`` is expressed as the number of seconds until the
    window frees up. On a rejection that is ``retry_after``; on an allowed call
    the window is not pinned to any one entry, so we report the full window.
    """
    reset = result.retry_after if not result.allowed else WINDOW_SECONDS
    return {
        "X-RateLimit-Limit": str(limit),
        "X-RateLimit-Remaining": str(result.remaining),
        "X-RateLimit-Reset": str(reset),
    }


def _enforce_principal_rate_limit(
    principal: AuthenticatedPrincipal,
    response: Response | None = None,
) -> None:
    # Key authenticated writes on the principal identity alone. Including the client
    # IP would let a single credential multiply its quota by rotating source/XFF IPs.
    limit = principal.rate_limit_per_minute
    result = rate_limiter.hit(f"write:{principal.identifier}", limit)
    headers = _rate_limit_headers(limit, result)
    if not result.allowed:
        raise HTTPException(
            status_code=429,
            detail="authenticated write rate limit exceeded",
            headers={"Retry-After": str(result.retry_after), **headers},
        )
    # Surface the quota on the success path so clients can pace themselves.
    if response is not None:
        for header, value in headers.items():
            response.headers[header] = value


def _require_write_access(
    response: Response,
    principal: AuthenticatedPrincipal = Depends(require_scope("runs:write")),
) -> AuthenticatedPrincipal:
    _enforce_principal_rate_limit(principal, response)
    return principal


def _require_admin_access(
    response: Response,
    principal: AuthenticatedPrincipal = Depends(require_scope("admin")),
) -> AuthenticatedPrincipal:
    _enforce_principal_rate_limit(principal, response)
    return principal


# Conservative defaults applied to every response. These are cheap, static, and
# do not interfere with the CORS or Cache-Control headers set elsewhere (we only
# add headers, never overwrite). HSTS is safe to always emit; browsers ignore it
# on plain HTTP and honor it once the API is served over TLS.
_SECURITY_HEADERS = {
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
}


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    for header, value in _SECURITY_HEADERS.items():
        response.headers.setdefault(header, value)
    return response


@app.middleware("http")
async def access_log_and_public_rate_limit(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or uuid.uuid4().hex[:12]
    request.state.request_id = request_id
    started_at = time.perf_counter()

    public_rate_headers: dict[str, str] | None = None
    if _should_rate_limit_public_request(request):
        client_host = _client_host(request)
        limit = settings.public_read_rate_limit_per_minute
        result = rate_limiter.hit(f"public-read:{client_host}", limit)
        public_rate_headers = _rate_limit_headers(limit, result)
        if not result.allowed:
            response = problem_response(
                429,
                "public API rate limit exceeded",
                instance=request.url.path,
                headers={
                    "Retry-After": str(result.retry_after),
                    **public_rate_headers,
                },
            )
            response.headers["x-request-id"] = request_id
            return response

    response = None
    try:
        response = await call_next(request)
        return response
    finally:
        duration_ms = round((time.perf_counter() - started_at) * 1000, 2)
        log_request_event(
            {
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code if response else 500,
                "duration_ms": duration_ms,
                "client": _client_host(request),
            }
        )
        if response is not None:
            response.headers.setdefault("x-request-id", request_id)
            # Surface the quota on allowed public reads too, so clients can pace
            # themselves rather than discovering the limit only on a 429.
            if public_rate_headers is not None:
                for header, value in public_rate_headers.items():
                    response.headers.setdefault(header, value)


# --------------------------------------------------------------------------- #
# Business routes
# --------------------------------------------------------------------------- #
# All ``/api/...`` business endpoints live on a single router mounted under BOTH
# ``/api`` (unchanged, back-compat for the web proxy + mobile) and ``/api/v1``
# (the canonical, versioned path). Health/metrics endpoints stay on ``app`` and
# remain unversioned.
api = APIRouter()

# An idempotency record is scoped to ``(key, principal, method, path)``. The
# stored ``path`` is the concrete request path, so ``/api/runs`` and
# ``/api/v1/runs`` are scoped independently -- correct, since they are distinct
# public surfaces.


def _begin_idempotent(
    session: Session,
    request: Request,
    key: str | None,
    principal: AuthenticatedPrincipal,
    fingerprint: str,
):
    """Resolve an ``Idempotency-Key`` before performing a write.

    Returns:

    * ``None`` -- no key, or a fresh key: the caller proceeds and must later call
      :func:`_store_idempotent`.
    * a :class:`JSONResponse` -- a stored response to replay verbatim (same key +
      same request fingerprint).

    Raises ``HTTPException(409)`` when the key was reused for a *different*
    request body.
    """
    if not key:
        return None
    record, conflict = find_idempotent_response(
        session,
        key,
        principal.identifier,
        request.method,
        request.url.path,
        fingerprint,
    )
    if conflict:
        raise HTTPException(
            status_code=409,
            detail="Idempotency-Key reused with a different request body",
        )
    if record is not None:
        return JSONResponse(
            status_code=record.response_status,
            content=json.loads(record.response_body) if record.response_body else None,
        )
    return None


def _store_idempotent(
    session: Session,
    request: Request,
    key: str | None,
    principal: AuthenticatedPrincipal,
    fingerprint: str,
    status_code: int,
    body: RunResponse,
) -> None:
    """Persist a write's response so a later retry with the same key replays it.

    No-op when no key was sent. The record is added+flushed within the caller's
    transaction (which commits the side effect and the record atomically).
    """
    if not key:
        return
    save_idempotent_response(
        session,
        key,
        principal.identifier,
        request.method,
        request.url.path,
        fingerprint,
        status_code,
        body.model_dump_json(),
    )


@api.post("/runs", response_model=RunResponse)
def create_run(
    payload: RunCreate,
    request: Request,
    session: Session = Depends(get_session),
    principal: AuthenticatedPrincipal = Depends(_require_write_access),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
):
    fingerprint = fingerprint_request(payload.model_dump(mode="json"))
    replay = _begin_idempotent(session, request, idempotency_key, principal, fingerprint)
    if replay is not None:
        return replay

    run_id = validate_run_id(payload.id) if payload.id else uuid.uuid4().hex[:12]
    existing = session.get(RunEntry, run_id)
    if existing:
        raise HTTPException(status_code=409, detail="run id already exists")

    item = RunEntry(
        id=run_id,
        env=payload.env,
        agent=payload.agent,
        track=payload.track,
        status="created",
        max_episodes=payload.max_episodes,
        max_steps=payload.max_steps,
        created_by=principal.identifier,
        code_version=payload.code_version,
        seed_protocol=payload.seed_protocol,
    )
    session.add(item)
    # Flush so column defaults (e.g. metrics_json="{}", timestamps) are populated
    # before we serialize the response for the idempotency record.
    session.flush()

    body = _to_response(item)
    _store_idempotent(session, request, idempotency_key, principal, fingerprint, 200, body)
    session.commit()
    session.refresh(item)

    return _to_response(item)


@api.post("/runs/{run_id}/upload", response_model=RunResponse)
async def upload_run_artifacts(
    request: Request,
    run_id: str,
    metrics_file: UploadFile | None = File(default=None),
    trace_file: UploadFile | None = File(default=None),
    config_file: UploadFile | None = File(default=None),
    session: Session = Depends(get_session),
    principal: AuthenticatedPrincipal = Depends(_require_write_access),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
):
    item = _get_run_or_404(session, run_id)

    # Read every upload body up front (streaming + size-bounded) before touching
    # storage. A 413 here must not leave any artifacts behind.
    metrics_bytes = await _read_upload_bytes(metrics_file) if metrics_file else None
    trace_bytes = await _read_upload_bytes(trace_file) if trace_file else None
    config_bytes = await _read_upload_bytes(config_file) if config_file else None

    # Honor an optional Idempotency-Key BEFORE any storage write or DB mutation so
    # a replayed retry never re-runs the side effect. The fingerprint covers the
    # uploaded bodies so reusing the key for a different upload conflicts.
    fingerprint = fingerprint_request(
        b"".join(part for part in (metrics_bytes, trace_bytes, config_bytes) if part)
        + run_id.encode("utf-8")
    )
    replay = _begin_idempotent(session, request, idempotency_key, principal, fingerprint)
    if replay is not None:
        return replay

    # Validate the uploaded metrics up front and stamp the schema version it
    # passed. A physically-impossible document (e.g. success_rate=1.5) is rejected
    # with a 422 problem+json before anything is persisted.
    validated_metrics: dict | None = None
    metrics_schema_version: str | None = None
    if metrics_bytes is not None:
        raw_metrics = _parse_metrics_from_bytes(metrics_bytes)
        try:
            validated_metrics, metrics_schema_version = validate_metrics(raw_metrics)
        except ValidationProblem as exc:
            # Surface the readable summary as ``detail`` (legacy contract) and the
            # per-field failures under the ``errors`` extension of the problem doc.
            return problem_response(
                422,
                str(exc),
                title="Unprocessable Entity",
                instance=request.url.path,
                errors=exc.errors,
            )

    # Track keys written in THIS request so we can best-effort delete them if the
    # DB commit fails (avoids orphaned artifacts) or if a later storage write
    # raises (avoids partial state). Re-upload overwrites by key, so writing the
    # same run_id twice is idempotent.
    written_keys: list[str] = []
    try:
        if metrics_bytes is not None:
            written_keys.append(save_run_artifact(run_id, "metrics.json", metrics_bytes))
        if trace_bytes is not None:
            item.trace_path = save_run_artifact(run_id, "trace.jsonl", trace_bytes)
            written_keys.append(item.trace_path)
        if config_bytes is not None:
            item.config_path = save_run_artifact(run_id, "config.yaml", config_bytes)
            written_keys.append(item.config_path)
    except (OSError, BotoCoreError, ClientError) as exc:
        session.rollback()
        _best_effort_delete(written_keys, request_id=_request_id(request))
        log_system_event(
            "upload_storage_write_failed",
            level=logging.ERROR,
            request_id=_request_id(request),
            run_id=run_id,
            error=str(exc),
        )
        raise HTTPException(status_code=502, detail="failed to persist run artifacts") from exc

    if validated_metrics is not None:
        item.metrics_json = json.dumps(validated_metrics)
        item.success_rate = _coerce_float(validated_metrics.get("success_rate"))
        item.mean_return = _coerce_float(validated_metrics.get("mean_return"))
        item.metrics_schema_version = metrics_schema_version
    item.status = "uploaded"
    item.storage_backend = storage_status()["backend"]
    item.created_by = principal.identifier

    session.add(item)
    session.flush()
    body = _to_response(item)
    _store_idempotent(session, request, idempotency_key, principal, fingerprint, 200, body)
    try:
        session.commit()
    except Exception as exc:
        session.rollback()
        _best_effort_delete(written_keys, request_id=_request_id(request))
        log_system_event(
            "upload_commit_failed",
            level=logging.ERROR,
            request_id=_request_id(request),
            run_id=run_id,
            error=str(exc),
        )
        raise HTTPException(status_code=500, detail="failed to record run metadata") from exc
    session.refresh(item)

    # An upload mutates leaderboard data; invalidate cached public GETs so the
    # new run shows up immediately rather than after the TTL elapses.
    _response_cache.bump_version()

    return _to_response(item)


def _leaderboard_keyset_clause(cursor: tuple[float, float, datetime, str]):
    """Keyset WHERE clause selecting rows strictly *after* ``cursor``.

    Mirrors the ORDER BY (success_rate DESC, mean_return DESC, created_at DESC,
    id DESC) as a lexicographic "less than" over the tuple, expanded into an
    OR-of-AND form so every database (sqlite + postgres) can use it and the
    leading columns still line up with ``ix_runs_leaderboard``.
    """
    s, m, c, i = cursor
    return or_(
        RunEntry.success_rate < s,
        and_(RunEntry.success_rate == s, RunEntry.mean_return < m),
        and_(
            RunEntry.success_rate == s,
            RunEntry.mean_return == m,
            RunEntry.created_at < c,
        ),
        and_(
            RunEntry.success_rate == s,
            RunEntry.mean_return == m,
            RunEntry.created_at == c,
            RunEntry.id < i,
        ),
    )


@api.get("/leaderboard", response_model=list[LeaderboardRow])
def leaderboard(
    request: Request,
    response: Response,
    track: str = Query(default="test"),
    env: str | None = Query(default=None),
    agent: str | None = Query(default=None),
    include_demo: bool = Query(default=False),
    limit: int = Query(default=LEADERBOARD_DEFAULT_LIMIT, ge=1, le=LEADERBOARD_MAX_LIMIT),
    offset: int = Query(default=0, ge=0),
    cursor: str | None = Query(default=None),
    session: Session = Depends(get_session),
):
    # Decode any client cursor up front so a malformed token fails fast with a
    # 400 problem+json (before touching the cache or database).
    keyset: tuple[float, float, datetime, str] | None = None
    if cursor is not None:
        try:
            keyset = _decode_leaderboard_cursor(cursor)
        except CursorError as exc:
            return problem_response(
                400,
                f"invalid cursor: {exc}",
                title="Bad Request",
                instance=request.url.path,
            )

    ttl = settings.response_cache_ttl_seconds
    response.headers["Cache-Control"] = _cache_control_header(ttl)
    cache_key = f"leaderboard:{track}:{env}:{agent}:{include_demo}:{limit}:{offset}:{cursor}"
    cached = _response_cache.get(cache_key, ttl)
    if cached is not None:
        out, next_cursor = cached
        if next_cursor:
            response.headers["X-Next-Cursor"] = next_cursor
        return _leaderboard_payload(request, response, out)

    q = select(RunEntry).where(RunEntry.status == "uploaded", RunEntry.track == track)
    if env:
        q = q.where(RunEntry.env == env)
    if agent:
        q = q.where(RunEntry.agent == agent)
    if not include_demo:
        q = q.where(RunEntry.created_by != "demo-seed")

    # Rank entirely in SQL using the denormalized columns (backed by
    # ix_runs_leaderboard): best success_rate first, ties broken on mean_return
    # then most-recent submission, with run id as a final deterministic tiebreak.
    q = q.order_by(
        desc(RunEntry.success_rate),
        desc(RunEntry.mean_return),
        desc(RunEntry.created_at),
        desc(RunEntry.id),
    )

    # Keyset (cursor) pagination is a scalable alternative to OFFSET: the WHERE
    # clause seeks straight to the next page using the same index, so paging is
    # stable even as rows are inserted/removed. When no cursor is supplied we
    # keep the original OFFSET path so existing callers are unaffected. Fetch one
    # extra row to detect (and emit a cursor for) the next page without a count.
    #
    # A cursor is advertised for keyset walks: an explicit cursor request, or a
    # cursorless first page (offset==0) which is the natural place to *start* a
    # keyset walk. Pure OFFSET paging (offset>0) stays exactly as before and gets
    # no cursor header, so existing offset clients see unchanged behavior.
    advertise_cursor = keyset is not None or offset == 0
    if keyset is not None:
        q = q.where(_leaderboard_keyset_clause(keyset))
    else:
        q = q.offset(offset)
    q = q.limit(limit + 1)

    rows = session.scalars(q).all()
    has_next = len(rows) > limit
    rows = rows[:limit]
    out: list[LeaderboardRow] = []
    for row in rows:
        metrics = _parse_metrics(row.metrics_json)
        out.append(
            LeaderboardRow(
                run_id=row.id,
                env=row.env,
                agent=row.agent,
                track=row.track,
                success_rate=row.success_rate,
                mean_return=row.mean_return,
                planning_cost_ms_per_step=float(
                    metrics.get("planning_cost", {}).get("wall_clock_ms_per_step", 0.0)
                ),
                created_at=row.created_at,
            )
        )

    # The next cursor points at the last row of this page; absent (empty) on the
    # final page so clients know to stop. We only advertise it as a response
    # header -- the body stays a plain JSON list so web/mobile are unaffected.
    next_cursor = (
        _encode_leaderboard_cursor(out[-1]) if (advertise_cursor and has_next and out) else ""
    )
    if next_cursor:
        response.headers["X-Next-Cursor"] = next_cursor

    _response_cache.set(cache_key, (out, next_cursor), ttl)
    return _leaderboard_payload(request, response, out)


def _leaderboard_etag(rows: list[LeaderboardRow]) -> str:
    """A stable, strong ETag over the serialized leaderboard rows.

    The hash is tied to the cache version so a mutation (upload/seed) that bumps
    the version necessarily changes the ETag even if the serialized rows happen
    to collide. Returned already quoted per RFC 9110.
    """
    serialized = json.dumps(
        [row.model_dump(mode="json") for row in rows],
        sort_keys=True,
        separators=(",", ":"),
    )
    seed = f"{_response_cache.version}:{serialized}"
    digest = hashlib.sha256(seed.encode("utf-8")).hexdigest()[:32]
    return f'"{digest}"'


def _leaderboard_payload(request: Request, response: Response, rows: list[LeaderboardRow]):
    """Attach an ETag and honor ``If-None-Match`` with a 304.

    Additive: a request without ``If-None-Match`` gets the usual 200 JSON list
    (the existing contract). A matching conditional request gets a bodyless 304
    carrying the same ETag and ``Cache-Control``.
    """
    etag = _leaderboard_etag(rows)
    response.headers["ETag"] = etag
    if_none_match = request.headers.get("if-none-match")
    if if_none_match and _etag_matches(if_none_match, etag):
        not_modified = Response(status_code=304)
        not_modified.headers["ETag"] = etag
        not_modified.headers["Cache-Control"] = response.headers.get(
            "Cache-Control", _cache_control_header(settings.response_cache_ttl_seconds)
        )
        # Carry the keyset cursor onto the 304 too, so a conditional poller can
        # still advance to the next page without re-fetching the body.
        next_cursor = response.headers.get("X-Next-Cursor")
        if next_cursor:
            not_modified.headers["X-Next-Cursor"] = next_cursor
        return not_modified
    return rows


def _etag_matches(if_none_match: str, etag: str) -> bool:
    # ``If-None-Match`` may be ``*`` or a comma-separated list of (weak) tags.
    candidates = {tag.strip() for tag in if_none_match.split(",")}
    if "*" in candidates:
        return True
    normalized = {tag[2:] if tag.startswith("W/") else tag for tag in candidates}
    return etag in normalized


@api.get("/tasks")
def tasks(request: Request, response: Response):
    ttl = settings.response_cache_ttl_seconds
    response.headers["Cache-Control"] = _cache_control_header(ttl)
    cached = _response_cache.get("tasks", ttl)
    if cached is not None:
        return cached

    try:
        from worldmodel_gym.envs.registry import list_tasks

        payload = {"tasks": list_tasks()}
    except Exception as exc:
        log_system_event(
            "tasks_registry_unavailable",
            level=logging.WARNING,
            request_id=_request_id(request),
            error=str(exc),
        )
        payload = {
            "tasks": [
                {"id": "memory_maze", "description": "Grid POMDP with key-door dependency"},
                {"id": "switch_quest", "description": "Subgoal chaining with hidden sequence"},
                {"id": "craft_lite", "description": "Lightweight crafting and sparse objectives"},
            ]
        }
    _response_cache.set("tasks", payload, ttl)
    return payload


@api.get("/runs/{run_id}", response_model=RunResponse)
def get_run(run_id: str, session: Session = Depends(get_session)):
    return _to_response(_get_run_or_404(session, run_id))


@api.get("/runs/{run_id}/trace")
def get_trace(run_id: str, session: Session = Depends(get_session)):
    item = _get_run_or_404(session, run_id)
    key = item.trace_path or artifact_key(item.id, "trace.jsonl")
    return _artifact_response(key, "application/x-ndjson", "trace not found")


@api.get("/runs/{run_id}/metrics")
def get_metrics(request: Request, run_id: str, session: Session = Depends(get_session)):
    item = _get_run_or_404(session, run_id)
    key = artifact_key(item.id, "metrics.json")
    try:
        return _artifact_response(key, "application/json", "metrics not found")
    except HTTPException:
        # The stored artifact is missing; fall back to the metrics snapshot we
        # persisted on the row. (A genuine 404 here is expected, not an error.)
        return JSONResponse(_parse_metrics(item.metrics_json))
    except (OSError, BotoCoreError, ClientError) as exc:
        # A transient storage failure (not a missing key) -- log it with the
        # request id instead of silently masking it, then serve the DB snapshot.
        log_system_event(
            "metrics_artifact_read_failed",
            level=logging.WARNING,
            request_id=_request_id(request),
            run_id=run_id,
            error=str(exc),
        )
        return JSONResponse(_parse_metrics(item.metrics_json))


@api.get("/runs/{run_id}/config")
def get_config(run_id: str, session: Session = Depends(get_session)):
    item = _get_run_or_404(session, run_id)
    key = item.config_path or artifact_key(item.id, "config.yaml")
    return _artifact_response(key, "text/yaml; charset=utf-8", "config not found")


@app.get("/healthz")
def healthz():
    return {"ok": True, "environment": settings.environment}


@app.get("/readyz")
def readyz(session: Session = Depends(get_session)):
    checks = {
        "database": _database_check(session),
        "storage": _storage_check(),
        "auth": {
            "legacy_upload_token_enabled": settings.legacy_upload_token_enabled,
            "bootstrap_api_key_configured": bool(settings.bootstrap_api_key),
        },
    }
    ok = all(component.get("ok", True) for name, component in checks.items() if name != "auth")
    payload = {"ok": ok, "environment": settings.environment, "checks": checks}
    if ok:
        return payload

    log_system_event("readiness_failed", level=logging.WARNING, checks=checks)
    return JSONResponse(status_code=503, content=payload)


def _log_admin_audit_event(
    action: str,
    *,
    principal: AuthenticatedPrincipal,
    target: str,
    request_id: str | None,
    **extra: object,
) -> None:
    """Emit a structured audit record for an admin-scoped action.

    Never includes secrets -- only the principal identifier (key prefix / token
    label), the action, its target, and the request id for correlation.
    """
    log_system_event(
        "admin_audit",
        action=action,
        principal=principal.identifier,
        principal_kind=principal.kind,
        target=target,
        request_id=request_id,
        **extra,
    )


@api.post("/runs/{run_id}/trigger", status_code=202, response_model=RunResponse)
def trigger_demo_run(
    request: Request,
    response: Response,
    run_id: str,
    session: Session = Depends(get_session),
    principal: AuthenticatedPrincipal = Depends(_require_admin_access),
):
    _log_admin_audit_event(
        "run.trigger",
        principal=principal,
        target=run_id,
        request_id=_request_id(request),
    )
    # The async job tier is OPTIONAL. Without Redis + WMG_QUEUE_ENABLED there is
    # no runner to execute the job, so we fail honestly with 501 (unchanged from
    # the prior behavior) rather than implying the platform ran anything.
    if not settings.queue_active:
        raise HTTPException(
            status_code=501,
            detail=(
                "Server-side run execution is not enabled. Set WMG_REDIS_URL and "
                "WMG_QUEUE_ENABLED to run evaluations on the queue, or run them "
                "locally with scripts/demo_run.py and upload the artifacts."
            ),
        )

    item = _get_run_or_404(session, run_id)

    enqueued = enqueue_run(
        run_id=item.id,
        agent=item.agent,
        env=item.env,
        track=item.track,
        max_episodes=item.max_episodes,
        max_steps=item.max_steps,
    )
    if enqueued:
        item.status = "queued"
        session.add(item)
        session.commit()
        session.refresh(item)

    response.status_code = 202
    return _to_response(item)


def _parse_metrics(raw: str) -> dict:
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        if raw:
            return load_json(raw)
        return {}


def _parse_metrics_from_bytes(data: bytes) -> dict:
    try:
        return json.loads(data.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return {}


def _coerce_float(value: object) -> float:
    try:
        return float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return 0.0


def _request_id(request: Request) -> str | None:
    return getattr(request.state, "request_id", None)


def _best_effort_delete(keys: list[str], *, request_id: str | None = None) -> None:
    """Best-effort removal of artifacts written during a failed upload.

    Never raises: a cleanup failure is logged but must not mask the original
    error that triggered the rollback.
    """
    if not keys:
        return
    store = get_store()
    for key in keys:
        try:
            if isinstance(store, LocalArtifactStore):
                store.resolve_path(key).unlink(missing_ok=True)
            elif isinstance(store, S3ArtifactStore):
                store.client.delete_object(Bucket=store.bucket, Key=store._object_key(key))
        except (OSError, ValueError, BotoCoreError, ClientError) as exc:
            log_system_event(
                "upload_artifact_cleanup_failed",
                level=logging.WARNING,
                request_id=request_id,
                artifact_key=key,
                error=str(exc),
            )


def _get_run_or_404(session: Session, run_id: str) -> RunEntry:
    try:
        safe_run_id = validate_run_id(run_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    item = session.get(RunEntry, safe_run_id)
    if not item:
        raise HTTPException(status_code=404, detail="run not found")
    return item


async def _read_upload_bytes(upload: UploadFile) -> bytes:
    # Read in bounded chunks and abort as soon as the cumulative size exceeds the
    # limit, so an over-limit body is never fully materialized in memory.
    max_bytes = settings.max_upload_bytes
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await upload.read(UPLOAD_READ_CHUNK_BYTES)
        if not chunk:
            break
        total += len(chunk)
        if total > max_bytes:
            raise HTTPException(
                status_code=413,
                detail=f"{upload.filename or 'upload'} exceeds {max_bytes} bytes",
            )
        chunks.append(chunk)
    return b"".join(chunks)


def _to_response(item: RunEntry) -> RunResponse:
    metrics = _parse_metrics(item.metrics_json)
    trace_url = f"/api/runs/{item.id}/trace" if item.trace_path else None
    config_url = f"/api/runs/{item.id}/config" if item.config_path else None
    return RunResponse(
        id=item.id,
        env=item.env,
        agent=item.agent,
        track=item.track,
        status=item.status,
        max_episodes=item.max_episodes,
        max_steps=item.max_steps,
        created_by=item.created_by,
        storage_backend=item.storage_backend,
        created_at=item.created_at,
        updated_at=item.updated_at,
        metrics=metrics,
        trace_url=trace_url,
        config_url=config_url,
        code_version=item.code_version,
        seed_protocol=item.seed_protocol,
        metrics_schema_version=item.metrics_schema_version,
    )


def _artifact_response(key: str, media_type: str, not_found_detail: str) -> Response:
    try:
        payload = load_run_artifact(key)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=not_found_detail) from exc
    return Response(content=payload, media_type=media_type)


def _database_check(session: Session) -> dict[str, object]:
    details: dict[str, object] = {"ok": True, **describe_database()}
    try:
        session.execute(select(1))
    except Exception as exc:
        details["ok"] = False
        details["error"] = str(exc)
    return details


def _storage_check() -> dict[str, object]:
    # Actually verify writability end to end (write + read-back + delete for
    # local; put + delete for S3) rather than only ensuring directories exist.
    try:
        ensure_storage_dirs()
        probe = storage_write_probe()
    except Exception as exc:
        return {
            "ok": False,
            "backend": settings.storage_backend,
            "error": str(exc),
        }
    details: dict[str, object] = {**storage_status(), **probe}
    details.setdefault("ok", False)
    return details


# --------------------------------------------------------------------------- #
# Router mounting
# --------------------------------------------------------------------------- #
# Mount the business router under BOTH the legacy ``/api`` prefix (so the Next.js
# web proxy + Expo mobile keep working unchanged) and the canonical, versioned
# ``/api/v1`` prefix. Done after every ``@api`` route is registered so both
# inclusions copy the complete route set. Health/metrics stay on ``app`` and
# remain unversioned.
app.include_router(api, prefix="/api")
app.include_router(api, prefix="/api/v1")

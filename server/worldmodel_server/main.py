from __future__ import annotations

import json
import logging
import threading
import time
import uuid
from contextlib import asynccontextmanager

from botocore.exceptions import BotoCoreError, ClientError
from fastapi import Depends, FastAPI, File, HTTPException, Query, Request, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from worldmodel_server.auth import AuthenticatedPrincipal, ensure_bootstrap_api_key, require_scope
from worldmodel_server.config import settings
from worldmodel_server.db import SessionLocal, describe_database, engine, get_session
from worldmodel_server.migrations import run_migrations
from worldmodel_server.models import RunEntry
from worldmodel_server.rate_limit import rate_limiter
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

# Hard ceiling on leaderboard page size, regardless of the requested ``limit``,
# so a single request can never force the database to materialize an unbounded
# result set.
LEADERBOARD_MAX_LIMIT = 500
LEADERBOARD_DEFAULT_LIMIT = 100

# Chunk size for the streaming, size-bounded upload reader.
UPLOAD_READ_CHUNK_BYTES = 1024 * 1024

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


def _enforce_principal_rate_limit(principal: AuthenticatedPrincipal) -> None:
    # Key authenticated writes on the principal identity alone. Including the client
    # IP would let a single credential multiply its quota by rotating source/XFF IPs.
    result = rate_limiter.hit(
        f"write:{principal.identifier}",
        principal.rate_limit_per_minute,
    )
    if not result.allowed:
        raise HTTPException(
            status_code=429,
            detail="authenticated write rate limit exceeded",
            headers={"Retry-After": str(result.retry_after)},
        )


def _require_write_access(
    principal: AuthenticatedPrincipal = Depends(require_scope("runs:write")),
) -> AuthenticatedPrincipal:
    _enforce_principal_rate_limit(principal)
    return principal


def _require_admin_access(
    principal: AuthenticatedPrincipal = Depends(require_scope("admin")),
) -> AuthenticatedPrincipal:
    _enforce_principal_rate_limit(principal)
    return principal


@app.middleware("http")
async def access_log_and_public_rate_limit(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or uuid.uuid4().hex[:12]
    request.state.request_id = request_id
    started_at = time.perf_counter()

    if _should_rate_limit_public_request(request):
        client_host = _client_host(request)
        result = rate_limiter.hit(
            f"public-read:{client_host}",
            settings.public_read_rate_limit_per_minute,
        )
        if not result.allowed:
            response = JSONResponse(
                {"detail": "public API rate limit exceeded"},
                status_code=429,
                headers={"Retry-After": str(result.retry_after)},
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


@app.post("/api/runs", response_model=RunResponse)
def create_run(
    payload: RunCreate,
    session: Session = Depends(get_session),
    principal: AuthenticatedPrincipal = Depends(_require_write_access),
):
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
        created_by=principal.identifier,
    )
    session.add(item)
    session.commit()
    session.refresh(item)

    return RunResponse(
        id=item.id,
        env=item.env,
        agent=item.agent,
        track=item.track,
        status=item.status,
        created_by=item.created_by,
        storage_backend=item.storage_backend,
        created_at=item.created_at,
        updated_at=item.updated_at,
        metrics={},
    )


@app.post("/api/runs/{run_id}/upload", response_model=RunResponse)
async def upload_run_artifacts(
    request: Request,
    run_id: str,
    metrics_file: UploadFile | None = File(default=None),
    trace_file: UploadFile | None = File(default=None),
    config_file: UploadFile | None = File(default=None),
    session: Session = Depends(get_session),
    principal: AuthenticatedPrincipal = Depends(_require_write_access),
):
    item = _get_run_or_404(session, run_id)

    # Read every upload body up front (streaming + size-bounded) before touching
    # storage. A 413 here must not leave any artifacts behind.
    metrics_bytes = await _read_upload_bytes(metrics_file) if metrics_file else None
    trace_bytes = await _read_upload_bytes(trace_file) if trace_file else None
    config_bytes = await _read_upload_bytes(config_file) if config_file else None

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

    if metrics_bytes is not None:
        metrics = _parse_metrics_from_bytes(metrics_bytes)
        item.metrics_json = json.dumps(metrics)
        item.success_rate = _coerce_float(metrics.get("success_rate"))
        item.mean_return = _coerce_float(metrics.get("mean_return"))
    item.status = "uploaded"
    item.storage_backend = storage_status()["backend"]
    item.created_by = principal.identifier

    session.add(item)
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


@app.get("/api/leaderboard", response_model=list[LeaderboardRow])
def leaderboard(
    response: Response,
    track: str = Query(default="test"),
    env: str | None = Query(default=None),
    agent: str | None = Query(default=None),
    include_demo: bool = Query(default=False),
    limit: int = Query(default=LEADERBOARD_DEFAULT_LIMIT, ge=1, le=LEADERBOARD_MAX_LIMIT),
    offset: int = Query(default=0, ge=0),
    session: Session = Depends(get_session),
):
    ttl = settings.response_cache_ttl_seconds
    response.headers["Cache-Control"] = _cache_control_header(ttl)
    cache_key = f"leaderboard:{track}:{env}:{agent}:{include_demo}:{limit}:{offset}"
    cached = _response_cache.get(cache_key, ttl)
    if cached is not None:
        return cached

    q = select(RunEntry).where(RunEntry.status == "uploaded", RunEntry.track == track)
    if env:
        q = q.where(RunEntry.env == env)
    if agent:
        q = q.where(RunEntry.agent == agent)
    if not include_demo:
        q = q.where(RunEntry.created_by != "demo-seed")

    # Rank entirely in SQL using the denormalized columns (backed by
    # ix_runs_leaderboard): best success_rate first, ties broken on mean_return
    # then most-recent submission. LIMIT/OFFSET paginate at the database so we
    # never materialize the full table.
    q = (
        q.order_by(
            desc(RunEntry.success_rate),
            desc(RunEntry.mean_return),
            desc(RunEntry.created_at),
        )
        .limit(limit)
        .offset(offset)
    )

    rows = session.scalars(q).all()
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
    _response_cache.set(cache_key, out, ttl)
    return out


@app.get("/api/tasks")
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


@app.get("/api/runs/{run_id}", response_model=RunResponse)
def get_run(run_id: str, session: Session = Depends(get_session)):
    return _to_response(_get_run_or_404(session, run_id))


@app.get("/api/runs/{run_id}/trace")
def get_trace(run_id: str, session: Session = Depends(get_session)):
    item = _get_run_or_404(session, run_id)
    key = item.trace_path or artifact_key(item.id, "trace.jsonl")
    return _artifact_response(key, "application/x-ndjson", "trace not found")


@app.get("/api/runs/{run_id}/metrics")
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


@app.get("/api/runs/{run_id}/config")
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


@app.post("/api/runs/{run_id}/trigger", status_code=202, response_model=RunResponse)
def trigger_demo_run(
    response: Response,
    run_id: str,
    session: Session = Depends(get_session),
    _principal: AuthenticatedPrincipal = Depends(_require_admin_access),
):
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
        created_by=item.created_by,
        storage_backend=item.storage_backend,
        created_at=item.created_at,
        updated_at=item.updated_at,
        metrics=metrics,
        trace_url=trace_url,
        config_url=config_url,
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

from __future__ import annotations

import json
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, File, HTTPException, Query, Request, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from worldmodel_server.auth import AuthenticatedPrincipal, require_scope
from worldmodel_server.config import settings
from worldmodel_server.db import SessionLocal, get_session
from worldmodel_server.migrations import run_migrations
from worldmodel_server.models import RunEntry
from worldmodel_server.rate_limit import rate_limiter
from worldmodel_server.request_logging import configure_logging, log_request_event
from worldmodel_server.schemas import LeaderboardRow, RunCreate, RunResponse
from worldmodel_server.seed import bootstrap_api_key, seed_demo_runs
from worldmodel_server.storage import (
    artifact_key,
    ensure_storage_dirs,
    load_json,
    load_run_artifact,
    save_run_artifact,
    storage_status,
    validate_run_id,
)

try:
    from prometheus_fastapi_instrumentator import Instrumentator
except ImportError:  # pragma: no cover
    Instrumentator = None


@asynccontextmanager
async def lifespan(_app: FastAPI):
    import sys
    import traceback

    try:
        print(f"[lifespan] Starting up, db_url backend: {settings.db_url.split('@')[0].split('://')[0] if '@' in settings.db_url else settings.db_url[:30]}", flush=True)
        configure_logging()
        print("[lifespan] Logging configured", flush=True)
        settings.validate()
        print("[lifespan] Settings validated", flush=True)
        if settings.auto_migrate:
            print("[lifespan] Running migrations...", flush=True)
            run_migrations()
            print("[lifespan] Migrations complete", flush=True)
        ensure_storage_dirs()
        print("[lifespan] Storage dirs ensured", flush=True)
        with SessionLocal() as session:
            if bootstrap_api_key(session):
                print("[lifespan] Bootstrap API key created", flush=True)
        if settings.seed_demo_data:
            print("[lifespan] Seeding demo data...", flush=True)
            with SessionLocal() as session:
                count = seed_demo_runs(session)
                print(f"[lifespan] Seeded {count} demo runs", flush=True)
        print("[lifespan] Startup complete", flush=True)
    except Exception as exc:
        print(f"[lifespan] FATAL startup error: {exc}", file=sys.stderr, flush=True)
        print(f"[lifespan] FATAL startup error: {exc}", flush=True)
        traceback.print_exc()
        raise
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins or ["*"],
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
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
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


def _enforce_principal_rate_limit(request: Request, principal: AuthenticatedPrincipal) -> None:
    client_host = _client_host(request)
    result = rate_limiter.hit(
        f"write:{principal.identifier}:{client_host}",
        principal.rate_limit_per_minute,
    )
    if not result.allowed:
        raise HTTPException(
            status_code=429,
            detail="authenticated write rate limit exceeded",
            headers={"Retry-After": str(result.retry_after)},
        )


def _require_write_access(
    request: Request,
    principal: AuthenticatedPrincipal = Depends(require_scope("runs:write")),
) -> AuthenticatedPrincipal:
    _enforce_principal_rate_limit(request, principal)
    return principal


def _require_admin_access(
    request: Request,
    principal: AuthenticatedPrincipal = Depends(require_scope("admin")),
) -> AuthenticatedPrincipal:
    _enforce_principal_rate_limit(request, principal)
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
    run_id: str,
    metrics_file: UploadFile | None = File(default=None),
    trace_file: UploadFile | None = File(default=None),
    config_file: UploadFile | None = File(default=None),
    session: Session = Depends(get_session),
    principal: AuthenticatedPrincipal = Depends(_require_write_access),
):
    item = _get_run_or_404(session, run_id)
    metrics_bytes: bytes | None = None

    if metrics_file is not None:
        metrics_bytes = await _read_upload_bytes(metrics_file)
        save_run_artifact(run_id, "metrics.json", metrics_bytes)
    if trace_file is not None:
        item.trace_path = save_run_artifact(
            run_id, "trace.jsonl", await _read_upload_bytes(trace_file)
        )
    if config_file is not None:
        item.config_path = save_run_artifact(
            run_id, "config.yaml", await _read_upload_bytes(config_file)
        )

    if metrics_bytes is not None:
        item.metrics_json = json.dumps(_parse_metrics_from_bytes(metrics_bytes))
    item.status = "uploaded"
    item.storage_backend = storage_status()["backend"]
    item.created_by = principal.identifier

    session.add(item)
    session.commit()
    session.refresh(item)

    return _to_response(item)


@app.get("/api/leaderboard", response_model=list[LeaderboardRow])
def leaderboard(
    track: str = Query(default="test"),
    env: str | None = Query(default=None),
    agent: str | None = Query(default=None),
    session: Session = Depends(get_session),
):
    q = select(RunEntry).where(RunEntry.status == "uploaded", RunEntry.track == track)
    if env:
        q = q.where(RunEntry.env == env)
    if agent:
        q = q.where(RunEntry.agent == agent)

    rows = session.scalars(q.order_by(desc(RunEntry.created_at))).all()
    out: list[LeaderboardRow] = []

    for row in rows:
        metrics = _parse_metrics(row.metrics_json)
        out.append(
            LeaderboardRow(
                run_id=row.id,
                env=row.env,
                agent=row.agent,
                track=row.track,
                success_rate=float(metrics.get("success_rate", 0.0)),
                mean_return=float(metrics.get("mean_return", 0.0)),
                planning_cost_ms_per_step=float(
                    metrics.get("planning_cost", {}).get("wall_clock_ms_per_step", 0.0)
                ),
                created_at=row.created_at,
            )
        )

    return out


@app.get("/api/tasks")
def tasks():
    try:
        from worldmodel_gym.envs.registry import list_tasks

        return {"tasks": list_tasks()}
    except Exception:
        return {
            "tasks": [
                {"id": "memory_maze", "description": "Grid POMDP with key-door dependency"},
                {"id": "switch_quest", "description": "Subgoal chaining with hidden sequence"},
                {"id": "craft_lite", "description": "Lightweight crafting and sparse objectives"},
            ]
        }


@app.get("/api/runs/{run_id}", response_model=RunResponse)
def get_run(run_id: str, session: Session = Depends(get_session)):
    return _to_response(_get_run_or_404(session, run_id))


@app.get("/api/runs/{run_id}/trace")
def get_trace(run_id: str, session: Session = Depends(get_session)):
    item = _get_run_or_404(session, run_id)
    key = item.trace_path or artifact_key(item.id, "trace.jsonl")
    return _artifact_response(key, "application/x-ndjson", "trace not found")


@app.get("/api/runs/{run_id}/metrics")
def get_metrics(run_id: str, session: Session = Depends(get_session)):
    item = _get_run_or_404(session, run_id)
    key = artifact_key(item.id, "metrics.json")
    try:
        return _artifact_response(key, "application/json", "metrics not found")
    except HTTPException:
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
    session.execute(select(1))
    ensure_storage_dirs()
    return {"ok": True, "storage": storage_status()}


@app.post("/api/runs/{run_id}/trigger")
def trigger_demo_run(
    run_id: str,
    _principal: AuthenticatedPrincipal = Depends(_require_admin_access),
):
    return {
        "status": "accepted",
        "run_id": run_id,
        "note": "Use scripts/demo_run.py for local runner.",
    }


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
    data = await upload.read()
    if len(data) > settings.max_upload_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"{upload.filename or 'upload'} exceeds {settings.max_upload_bytes} bytes",
        )
    return data


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



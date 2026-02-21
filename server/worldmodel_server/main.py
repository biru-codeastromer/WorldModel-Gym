from __future__ import annotations

import json
import uuid
from pathlib import Path

from fastapi import Depends, FastAPI, File, Header, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from worldmodel_server.config import settings
from worldmodel_server.db import Base, engine, get_session
from worldmodel_server.models import RunEntry
from worldmodel_server.schemas import LeaderboardRow, RunCreate, RunResponse
from worldmodel_server.storage import ensure_storage_dirs, load_json, run_dir, save_upload_file

app = FastAPI(title=settings.app_name)


@app.on_event("startup")
def _startup() -> None:
    ensure_storage_dirs()
    Base.metadata.create_all(bind=engine)


@app.post("/api/runs", response_model=RunResponse)
def create_run(payload: RunCreate, session: Session = Depends(get_session)):
    run_id = payload.id or uuid.uuid4().hex[:12]
    existing = session.get(RunEntry, run_id)
    if existing:
        raise HTTPException(status_code=409, detail="run id already exists")

    item = RunEntry(
        id=run_id,
        env=payload.env,
        agent=payload.agent,
        track=payload.track,
        status="created",
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
    x_upload_token: str | None = Header(default=None),
    session: Session = Depends(get_session),
):
    if x_upload_token != settings.upload_token:
        raise HTTPException(status_code=401, detail="invalid upload token")

    item = session.get(RunEntry, run_id)
    if not item:
        raise HTTPException(status_code=404, detail="run not found")

    d = run_dir(run_id)

    metrics_path = d / "metrics.json"
    trace_path = d / "trace.jsonl"
    config_path = d / "config.yaml"

    if metrics_file is not None:
        save_upload_file(metrics_path, await metrics_file.read())
    if trace_file is not None:
        save_upload_file(trace_path, await trace_file.read())
    if config_file is not None:
        save_upload_file(config_path, await config_file.read())

    if metrics_path.exists():
        item.metrics_json = metrics_path.read_text(encoding="utf-8")
    item.trace_path = str(trace_path)
    item.config_path = str(config_path)
    item.status = "uploaded"

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
    item = session.get(RunEntry, run_id)
    if not item:
        raise HTTPException(status_code=404, detail="run not found")
    return _to_response(item)


@app.get("/api/runs/{run_id}/trace")
def get_trace(run_id: str):
    path = run_dir(run_id) / "trace.jsonl"
    if not path.exists():
        raise HTTPException(status_code=404, detail="trace not found")
    return FileResponse(path)


@app.get("/api/runs/{run_id}/metrics")
def get_metrics(run_id: str):
    path = run_dir(run_id) / "metrics.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="metrics not found")
    return FileResponse(path)


@app.get("/api/runs/{run_id}/config")
def get_config(run_id: str):
    path = run_dir(run_id) / "config.yaml"
    if not path.exists():
        raise HTTPException(status_code=404, detail="config not found")
    return FileResponse(path)


@app.get("/healthz")
def healthz():
    return {"ok": True}


@app.post("/api/runs/{run_id}/trigger")
def trigger_demo_run(run_id: str):
    return {
        "status": "accepted",
        "run_id": run_id,
        "note": "Use scripts/demo_run.py for local runner.",
    }


def _parse_metrics(raw: str) -> dict:
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        p = Path(raw)
        if p.exists():
            return load_json(p)
        return {}


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
        created_at=item.created_at,
        updated_at=item.updated_at,
        metrics=metrics,
        trace_url=trace_url,
        config_url=config_url,
    )

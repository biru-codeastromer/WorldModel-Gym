from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class RunCreate(BaseModel):
    id: str | None = None
    env: str
    agent: str
    track: str = "test"
    # Optional per-run evaluation budget. ``None`` falls back to the server's
    # default budget at execution time. Bounds keep a single queued job from
    # asking for an unbounded amount of compute.
    max_episodes: int | None = Field(default=None, ge=1, le=1000)
    max_steps: int | None = Field(default=None, ge=1, le=100_000)
    # Optional provenance the submitter can attach so a run is traceable back to
    # the exact code revision and seeding protocol that produced it. Both are
    # free-form short strings (e.g. a git SHA and a protocol identifier).
    code_version: str | None = Field(default=None, max_length=128)
    seed_protocol: str | None = Field(default=None, max_length=128)


class RunResponse(BaseModel):
    id: str
    env: str
    agent: str
    track: str
    status: str
    max_episodes: int | None = None
    max_steps: int | None = None
    created_by: str | None = None
    storage_backend: str | None = None
    created_at: datetime
    updated_at: datetime
    metrics: dict = Field(default_factory=dict)
    trace_url: str | None = None
    config_url: str | None = None
    # Provenance echoed back to clients. ``None`` for runs created before these
    # fields existed or submitted without provenance.
    code_version: str | None = None
    seed_protocol: str | None = None
    metrics_schema_version: str | None = None


class LeaderboardRow(BaseModel):
    run_id: str
    env: str
    agent: str
    track: str
    success_rate: float
    mean_return: float
    planning_cost_ms_per_step: float
    created_at: datetime

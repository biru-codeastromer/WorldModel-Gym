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


class LeaderboardRow(BaseModel):
    run_id: str
    env: str
    agent: str
    track: str
    success_rate: float
    mean_return: float
    planning_cost_ms_per_step: float
    created_at: datetime

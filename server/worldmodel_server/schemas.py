from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class RunCreate(BaseModel):
    id: str | None = None
    env: str
    agent: str
    track: str = "test"


class RunResponse(BaseModel):
    id: str
    env: str
    agent: str
    track: str
    status: str
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

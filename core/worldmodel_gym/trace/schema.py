from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class TraceStep(BaseModel):
    t: int
    action: int
    reward: float
    terminated: bool
    truncated: bool
    events: list[str] = Field(default_factory=list)
    planner: dict[str, Any] = Field(default_factory=dict)
    env_state: dict[str, Any] = Field(default_factory=dict)


class EpisodeTrace(BaseModel):
    env_id: str
    episode_id: int
    seed: int
    steps: list[TraceStep]


class RunMetrics(BaseModel):
    run_id: str
    env: str
    agent: str
    track: str
    success_rate: float
    mean_return: float
    median_steps_to_success: float | None
    achievement_completion: dict[str, float]
    planning_cost: dict[str, float]
    model_fidelity: dict[str, float]
    generalization_gap: float
    continual_metrics: dict[str, float] = Field(default_factory=dict)

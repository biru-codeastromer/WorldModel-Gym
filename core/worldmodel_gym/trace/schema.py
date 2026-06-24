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

    # --- Statistical rigor (all optional / backward compatible) ---
    # Number of episodes the test aggregate was computed over.
    n_episodes: int = 0
    # Number of distinct seeds used for the evaluation track.
    n_seeds: int = 0
    # Bootstrap 95% CI for success_rate as [low, high].
    success_rate_ci: tuple[float, float] | None = None
    # Bootstrap 95% CI for mean_return as [low, high].
    mean_return_ci: tuple[float, float] | None = None
    # Mean return aggregated per seed, keyed by seed (as string).
    per_seed_return: dict[str, float] = Field(default_factory=dict)
    # Success rate aggregated per seed, keyed by seed (as string).
    per_seed_success_rate: dict[str, float] = Field(default_factory=dict)

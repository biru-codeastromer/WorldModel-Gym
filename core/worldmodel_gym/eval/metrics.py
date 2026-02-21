from __future__ import annotations

import statistics
from dataclasses import dataclass, field


@dataclass
class EpisodeStats:
    success: bool
    total_return: float
    steps: int
    achievements: dict[str, int] = field(default_factory=dict)
    wall_clock_ms: float = 0.0
    imagined_transitions: int = 0


@dataclass
class AggregateStats:
    success_rate: float
    mean_return: float
    median_steps_to_success: float | None
    achievement_completion: dict[str, float]
    planning_cost: dict[str, float]


def aggregate_episode_stats(episodes: list[EpisodeStats]) -> AggregateStats:
    if not episodes:
        return AggregateStats(
            success_rate=0.0,
            mean_return=0.0,
            median_steps_to_success=None,
            achievement_completion={},
            planning_cost={
                "wall_clock_ms_per_step": 0.0,
                "imagined_transitions": 0.0,
                "peak_memory_mb": 0.0,
            },
        )

    success = [int(ep.success) for ep in episodes]
    returns = [ep.total_return for ep in episodes]
    success_steps = [ep.steps for ep in episodes if ep.success]

    ach_keys = sorted({k for ep in episodes for k in ep.achievements})
    ach = {
        key: float(sum(ep.achievements.get(key, 0) for ep in episodes)) / len(episodes)
        for key in ach_keys
    }

    total_steps = max(1, sum(ep.steps for ep in episodes))
    wall = sum(ep.wall_clock_ms for ep in episodes) / total_steps
    imagined = sum(ep.imagined_transitions for ep in episodes) / total_steps

    return AggregateStats(
        success_rate=float(sum(success) / len(episodes)),
        mean_return=float(sum(returns) / len(episodes)),
        median_steps_to_success=float(statistics.median(success_steps)) if success_steps else None,
        achievement_completion=ach,
        planning_cost={
            "wall_clock_ms_per_step": float(wall),
            "imagined_transitions": float(imagined),
            "peak_memory_mb": 0.0,
        },
    )

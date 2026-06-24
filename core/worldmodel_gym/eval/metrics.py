from __future__ import annotations

import statistics
from dataclasses import dataclass, field

import numpy as np


@dataclass
class EpisodeStats:
    success: bool
    total_return: float
    steps: int
    achievements: dict[str, int] = field(default_factory=dict)
    wall_clock_ms: float = 0.0
    imagined_transitions: int = 0
    seed: int | None = None


@dataclass
class AggregateStats:
    success_rate: float
    mean_return: float
    median_steps_to_success: float | None
    achievement_completion: dict[str, float]
    planning_cost: dict[str, float]
    n_episodes: int = 0
    n_seeds: int = 0
    success_rate_ci: tuple[float, float] | None = None
    mean_return_ci: tuple[float, float] | None = None
    per_seed_return: dict[int, float] = field(default_factory=dict)
    per_seed_success_rate: dict[int, float] = field(default_factory=dict)


def bootstrap_ci(
    values: list[float],
    *,
    n_resamples: int = 2000,
    confidence: float = 0.95,
    seed: int = 0,
) -> tuple[float, float] | None:
    """Percentile bootstrap confidence interval for the mean of ``values``.

    Returns ``None`` when there are no samples. With a single sample the CI
    collapses to that value (zero width), which is the correct degenerate
    behaviour for a percentile bootstrap.
    """
    if not values:
        return None
    arr = np.asarray(values, dtype=np.float64)
    if arr.size == 1:
        v = float(arr[0])
        return (v, v)

    rng = np.random.default_rng(seed)
    idx = rng.integers(0, arr.size, size=(n_resamples, arr.size))
    means = arr[idx].mean(axis=1)
    alpha = (1.0 - confidence) / 2.0
    low = float(np.quantile(means, alpha))
    high = float(np.quantile(means, 1.0 - alpha))
    return (low, high)


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
            n_episodes=0,
            n_seeds=0,
            success_rate_ci=None,
            mean_return_ci=None,
            per_seed_return={},
            per_seed_success_rate={},
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

    # Per-seed aggregation.
    by_seed: dict[int, list[EpisodeStats]] = {}
    for ep in episodes:
        if ep.seed is None:
            continue
        by_seed.setdefault(int(ep.seed), []).append(ep)
    per_seed_return = {
        seed: float(np.mean([e.total_return for e in eps])) for seed, eps in by_seed.items()
    }
    per_seed_success_rate = {
        seed: float(np.mean([int(e.success) for e in eps])) for seed, eps in by_seed.items()
    }
    n_seeds = len(by_seed)

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
        n_episodes=len(episodes),
        n_seeds=n_seeds,
        success_rate_ci=bootstrap_ci([float(s) for s in success]),
        mean_return_ci=bootstrap_ci(returns),
        per_seed_return=per_seed_return,
        per_seed_success_rate=per_seed_success_rate,
    )

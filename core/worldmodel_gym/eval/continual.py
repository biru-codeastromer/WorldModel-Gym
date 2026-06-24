from __future__ import annotations

from dataclasses import dataclass

import numpy as np


@dataclass
class ContinualSchedule:
    # Episodes per drift phase. With the default of 4 and the harness running
    # over all seeds for several phases, the continual track sweeps through
    # multiple distinct environment configurations.
    shift_every_episodes: int = 4
    # Per-phase magnitude of the environment shift. Large enough that the
    # default schedule genuinely changes wall density / obstacle counts.
    shift_strength: float = 0.06


def apply_shift_kwargs(
    base_kwargs: dict, env_id: str, shift_idx: int, shift_strength: float
) -> dict:
    kwargs = dict(base_kwargs)
    if env_id == "memory_maze":
        kwargs["wall_density"] = min(
            0.35, kwargs.get("wall_density", 0.16) + shift_idx * shift_strength
        )
    elif env_id == "switch_quest":
        kwargs["wall_density"] = min(
            0.25, kwargs.get("wall_density", 0.1) + shift_idx * shift_strength
        )
    elif env_id == "craft_lite":
        kwargs["rock_count"] = int(kwargs.get("rock_count", 5) + shift_idx)
    return kwargs


def phase_scores_to_matrix(episode_scores: list[float], shift_every_episodes: int) -> list[float]:
    """Aggregate per-episode scores into per-phase mean scores.

    Episodes are grouped into contiguous drift phases of length
    ``shift_every_episodes`` (the same grouping the harness uses to choose the
    shift index). Returns the mean score for each phase, in phase order.
    """
    if shift_every_episodes <= 0:
        msg = "shift_every_episodes must be positive"
        raise ValueError(msg)
    phases: dict[int, list[float]] = {}
    for ep_idx, score in enumerate(episode_scores):
        phase = ep_idx // shift_every_episodes
        phases.setdefault(phase, []).append(score)
    return [float(np.mean(phases[p])) for p in sorted(phases)]


def continual_transfer_metrics(
    episode_scores: list[float], shift_every_episodes: int = 4
) -> dict[str, float]:
    """Standard continual-learning transfer metrics, aggregated per drift phase.

    Let ``s_p`` be the mean score on phase ``p`` (p = 0..N-1), measured online as
    the agent encounters each phase for the first time.

    - forward_transfer:  mean_{p>0} (s_p - s_0). Positive when later phases
      benefit from earlier experience (zero-shot transfer to drifted tasks).
    - backward_transfer:  s_{N-1} - s_0. Change on the task distribution between
      the first and last phase; negative values indicate forgetting/degradation
      under drift.
    - forgetting:  max(0, max_p s_p - s_{N-1}). How far final-phase performance
      has dropped below the best phase observed during the run.

    With a single phase, all transfer terms are 0.0.
    """
    if not episode_scores:
        return {"forward_transfer": 0.0, "backward_transfer": 0.0, "forgetting": 0.0}

    phase_scores = phase_scores_to_matrix(episode_scores, shift_every_episodes)
    if len(phase_scores) == 1:
        return {"forward_transfer": 0.0, "backward_transfer": 0.0, "forgetting": 0.0}

    first = phase_scores[0]
    last = phase_scores[-1]
    best = max(phase_scores)

    forward = float(np.mean([s - first for s in phase_scores[1:]]))
    backward = float(last - first)
    forgetting = float(max(0.0, best - last))

    return {
        "forward_transfer": forward,
        "backward_transfer": backward,
        "forgetting": forgetting,
    }

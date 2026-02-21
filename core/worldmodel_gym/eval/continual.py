from __future__ import annotations

from dataclasses import dataclass


@dataclass
class ContinualSchedule:
    shift_every_episodes: int = 5
    shift_strength: float = 0.05


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


def continual_transfer_metrics(phase_scores: list[float]) -> dict[str, float]:
    if not phase_scores:
        return {"forward_transfer": 0.0, "backward_transfer": 0.0, "forgetting": 0.0}

    first = phase_scores[0]
    last = phase_scores[-1]
    best = max(phase_scores)

    return {
        "forward_transfer": float(last - first),
        "backward_transfer": float(sum(phase_scores[1:]) / max(1, len(phase_scores) - 1) - first),
        "forgetting": float(best - last),
    }

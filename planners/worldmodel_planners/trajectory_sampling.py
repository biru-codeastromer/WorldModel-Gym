from __future__ import annotations

from typing import Any, Callable

import numpy as np

from worldmodel_planners.base import PlanningResult


class TrajectorySamplingPlanner:
    def __init__(self, action_space_n: int, horizon: int = 10, num_trajectories: int = 64):
        self.action_space_n = action_space_n
        self.horizon = horizon
        self.num_trajectories = num_trajectories
        self.rng = np.random.default_rng(0)

    def plan(
        self,
        root_state: Any,
        rollout_fn: Callable[[Any, np.ndarray], tuple[float, dict]],
        clone_state_fn: Callable[[Any], Any],
    ) -> PlanningResult:
        best_action = 0
        best_score = -float("inf")
        samples = []
        for _ in range(self.num_trajectories):
            seq = self.rng.integers(0, self.action_space_n, size=(self.horizon,), dtype=np.int64)
            score, _ = rollout_fn(clone_state_fn(root_state), seq)
            samples.append({"sequence": seq.tolist(), "score": float(score)})
            if score > best_score:
                best_score = float(score)
                best_action = int(seq[0])

        return PlanningResult(
            action=best_action,
            value=best_score,
            imagined_transitions=self.num_trajectories * self.horizon,
            trace={
                "planner": "trajectory_sampling",
                "top_rollouts": sorted(samples, key=lambda x: x["score"], reverse=True)[:5],
            },
        )

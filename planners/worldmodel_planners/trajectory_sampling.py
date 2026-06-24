from __future__ import annotations

from typing import Any, Callable

import numpy as np

from worldmodel_planners.base import PlanningResult


class TrajectorySamplingPlanner:
    def __init__(
        self,
        action_space_n: int,
        horizon: int = 10,
        num_trajectories: int = 64,
        seed: int = 0,
    ):
        self.action_space_n = action_space_n
        self.horizon = horizon
        self.num_trajectories = num_trajectories
        self.seed = seed
        self.rng = np.random.default_rng(seed)

    def reseed(self, seed: int) -> None:
        """Reset the planner RNG so repeated plan() calls are reproducible."""
        self.seed = seed
        self.rng = np.random.default_rng(seed)

    def plan(
        self,
        root_state: Any,
        rollout_fn: Callable[[Any, np.ndarray], tuple[float, dict]],
        clone_state_fn: Callable[[Any], Any],
        seed: int | None = None,
    ) -> PlanningResult:
        if seed is not None:
            self.reseed(seed)

        best_action = 0
        best_score = -float("inf")
        best_ties = 0
        samples = []
        for _ in range(self.num_trajectories):
            seq = self.rng.integers(0, self.action_space_n, size=(self.horizon,), dtype=np.int64)
            score, _ = rollout_fn(clone_state_fn(root_state), seq)
            score = float(score)
            samples.append({"sequence": seq.tolist(), "score": score})
            if score > best_score:
                best_score = score
                best_action = int(seq[0])
                best_ties = 1
            elif score == best_score:
                # Reservoir-style uniform choice among trajectories that tie for
                # the best score, so equal-reward rollouts don't always default
                # to the first (lowest-index) sampled action.
                best_ties += 1
                if int(self.rng.integers(best_ties)) == 0:
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

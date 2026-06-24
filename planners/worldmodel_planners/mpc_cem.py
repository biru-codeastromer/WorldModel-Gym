from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

import numpy as np

from worldmodel_planners.base import PlanningResult


@dataclass
class CEMIterationTrace:
    iteration: int
    score_mean: float
    score_std: float
    score_best: float


class MPCCEMPlanner:
    def __init__(
        self,
        action_space_n: int,
        horizon: int = 12,
        population: int = 128,
        iterations: int = 4,
        elite_frac: float = 0.2,
        smoothing: float = 0.6,
        seed: int = 0,
    ):
        self.action_space_n = action_space_n
        self.horizon = horizon
        self.population = population
        self.iterations = iterations
        self.elite_frac = elite_frac
        self.smoothing = smoothing
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

        probs = np.ones((self.horizon, self.action_space_n), dtype=np.float64) / self.action_space_n
        best_seq = np.zeros(self.horizon, dtype=np.int64)
        best_score = -float("inf")
        iter_traces: list[dict] = []

        total_evals = 0
        for iteration in range(self.iterations):
            seqs = np.zeros((self.population, self.horizon), dtype=np.int64)
            scores = np.zeros(self.population, dtype=np.float64)

            for i in range(self.population):
                seq = np.array(
                    [self.rng.choice(self.action_space_n, p=probs[t]) for t in range(self.horizon)],
                    dtype=np.int64,
                )
                seqs[i] = seq
                score, _ = rollout_fn(clone_state_fn(root_state), seq)
                scores[i] = score
                total_evals += 1

            elite_n = max(1, int(self.population * self.elite_frac))
            elite_idx = self._select_elites(scores, elite_n)
            elites = seqs[elite_idx]

            new_probs = np.zeros_like(probs)
            for t in range(self.horizon):
                counts = np.bincount(elites[:, t], minlength=self.action_space_n).astype(np.float64)
                new_probs[t] = counts / max(1.0, counts.sum())

            probs = self.smoothing * probs + (1.0 - self.smoothing) * new_probs

            iter_traces.append(
                {
                    "iteration": iteration,
                    "score_mean": float(scores.mean()),
                    "score_std": float(scores.std()),
                    "score_best": float(scores.max()),
                }
            )

            top = self._argmax_random_tie(scores)
            if float(scores[top]) > best_score:
                best_score = float(scores[top])
                best_seq = seqs[top].copy()

        trace = {
            "planner": "mpc_cem",
            "population": self.population,
            "iterations": self.iterations,
            "horizon": self.horizon,
            "best_sequence": best_seq.tolist(),
            "best_score": best_score,
            "score_distribution": iter_traces,
        }
        return PlanningResult(
            action=int(best_seq[0]),
            value=best_score,
            imagined_transitions=total_evals * self.horizon,
            trace=trace,
        )

    def _argmax_random_tie(self, scores: np.ndarray) -> int:
        """Index of the max score, breaking ties with the seeded RNG.

        ``np.argmax`` always returns the lowest tied index, which biases the
        chosen first action toward low action indices when many candidate
        sequences score equally (e.g. all-zero reward). We instead choose
        uniformly at random among the tied maxima.
        """
        best = scores.max()
        tied = np.flatnonzero(scores == best)
        if tied.size == 1:
            return int(tied[0])
        return int(tied[self.rng.integers(tied.size)])

    def _select_elites(self, scores: np.ndarray, elite_n: int) -> np.ndarray:
        """Return indices of the top-``elite_n`` scores.

        Ties at the elite/non-elite boundary are resolved with the seeded RNG
        rather than by numpy's stable index order, so no systematic action-index
        bias leaks into the refit when many scores are equal.
        """
        if elite_n >= scores.size:
            return np.arange(scores.size)
        order = self.rng.permutation(scores.size)
        # Stable top-k on a randomly permuted view: equal scores are ordered
        # by the random permutation, breaking ties uniformly.
        ranked = order[np.argsort(scores[order], kind="stable")]
        return ranked[-elite_n:]

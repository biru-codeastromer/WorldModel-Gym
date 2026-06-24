from __future__ import annotations

from dataclasses import dataclass, field
from math import sqrt
from typing import Any, Callable

import numpy as np

from worldmodel_planners.base import PlanningResult


@dataclass
class MCTSNode:
    parent: "MCTSNode | None"
    action_from_parent: int | None
    visits: int = 0
    value_sum: float = 0.0
    children: dict[int, "MCTSNode"] = field(default_factory=dict)

    @property
    def value(self) -> float:
        return self.value_sum / self.visits if self.visits else 0.0


class MCTSPlanner:
    def __init__(
        self,
        action_space_n: int,
        num_simulations: int = 64,
        max_depth: int = 20,
        c_uct: float = 1.4,
        discount: float = 0.99,
        seed: int = 0,
    ):
        self.action_space_n = action_space_n
        self.num_simulations = num_simulations
        self.max_depth = max_depth
        self.c_uct = c_uct
        self.discount = discount
        self.seed = seed
        self.rng = np.random.default_rng(seed)

    def reseed(self, seed: int) -> None:
        """Reset the planner RNG so repeated plan() calls are reproducible."""
        self.seed = seed
        self.rng = np.random.default_rng(seed)

    def plan(
        self,
        root_state: Any,
        transition_fn: Callable[[Any, int], tuple[Any, float, bool]],
        clone_state_fn: Callable[[Any], Any],
        legal_actions_fn: Callable[[Any], list[int]] | None = None,
        value_fn: Callable[[Any], float] | None = None,
        seed: int | None = None,
    ) -> PlanningResult:
        """Run MCTS planning from ``root_state``.

        Parameters
        ----------
        value_fn:
            Optional leaf value estimator. When provided, the value of a
            non-terminal leaf is bootstrapped with ``value_fn(state)`` (after
            discounting by the rollout depth) so that credit can propagate
            before a terminal/goal state is reached. This may wrap a learned
            value head exposed by a world model, or an injectable heuristic
            (e.g. negative distance-to-subgoal). When ``None`` (default), only
            observed rewards drive the search -- the original behavior, minus
            the action-index tie-break bias.
        seed:
            Optional per-call seed. When provided, the planner RNG is reset to
            this seed before planning so that repeated calls are reproducible.
        """
        if seed is not None:
            self.reseed(seed)

        if legal_actions_fn is None:

            def legal_actions_fn(_state: Any) -> list[int]:
                return list(range(self.action_space_n))

        root = MCTSNode(parent=None, action_from_parent=None)
        max_reached_depth = 0

        for _ in range(self.num_simulations):
            state = clone_state_fn(root_state)
            node = root
            path = [node]
            rewards: list[float] = []
            done = False
            depth = 0

            while node.children and not done and depth < self.max_depth:
                action, child = self._select(node)
                state, reward, done = transition_fn(state, action)
                rewards.append(reward)
                node = child
                path.append(node)
                depth += 1

            if not done and depth < self.max_depth:
                for action in legal_actions_fn(state):
                    if action not in node.children:
                        node.children[action] = MCTSNode(parent=node, action_from_parent=action)

                if node.children:
                    action, child = self._select(node)
                    state, reward, done = transition_fn(state, action)
                    rewards.append(reward)
                    node = child
                    path.append(node)
                    depth += 1

            max_reached_depth = max(max_reached_depth, depth)

            # Bootstrap the leaf value: discounted rewards collected along the
            # rollout plus, if the leaf is non-terminal and a value function is
            # available, its (discounted) estimate. Without a value function the
            # leaf bootstrap is 0.0, recovering pure reward-driven backup.
            leaf_value = 0.0
            if value_fn is not None and not done:
                leaf_value = float(value_fn(state))
            value = self._discounted_return(rewards, leaf_value)

            for back_node in reversed(path):
                back_node.visits += 1
                back_node.value_sum += value
                value *= self.discount

        if not root.children:
            return PlanningResult(action=0, value=0.0, imagined_transitions=0, trace={"tree": {}})

        best_action, best_child = self._argmax_visits(root)
        tree_stats = {
            str(action): {"visits": child.visits, "value": child.value}
            for action, child in root.children.items()
        }

        ranked = sorted(root.children.items(), key=lambda kv: kv[1].value, reverse=True)
        top_rollouts = [
            {"action": int(action), "value": float(child.value), "visits": int(child.visits)}
            for action, child in ranked[:5]
        ]

        trace = {
            "planner": "mcts",
            "num_simulations": self.num_simulations,
            "max_depth": self.max_depth,
            "max_reached_depth": max_reached_depth,
            "root_children": tree_stats,
            "top_rollouts": top_rollouts,
            "chosen_action": int(best_action),
            "used_value_fn": value_fn is not None,
        }
        return PlanningResult(
            action=int(best_action),
            value=float(best_child.value),
            imagined_transitions=self.num_simulations * max(1, max_reached_depth),
            trace=trace,
        )

    def _argmax_visits(self, node: MCTSNode) -> tuple[int, MCTSNode]:
        """Pick the most-visited child, breaking ties with the seeded RNG.

        Using ``max()`` here would deterministically favor the lowest action
        index inserted first; under sparse reward every root action has equal
        visits, so that collapses to "always return action 0". We instead pick
        uniformly at random among the tied maxima.
        """
        items = list(node.children.items())
        best = max(child.visits for _, child in items)
        tied = [(action, child) for action, child in items if child.visits == best]
        if len(tied) == 1:
            return tied[0]
        idx = int(self.rng.integers(len(tied)))
        return tied[idx]

    def _select(self, node: MCTSNode) -> tuple[int, MCTSNode]:
        total_visits = max(1, node.visits)

        def uct(child: MCTSNode) -> float:
            if child.visits == 0:
                return float("inf")
            exploit = child.value
            explore = self.c_uct * sqrt(total_visits) / (1 + child.visits)
            return exploit + explore

        items = list(node.children.items())
        scores = [uct(child) for _, child in items]
        best_score = max(scores)
        tied = [item for item, score in zip(items, scores) if score == best_score]
        if len(tied) == 1:
            return tied[0]
        idx = int(self.rng.integers(len(tied)))
        return tied[idx]

    def _discounted_return(self, rewards: list[float], leaf_value: float = 0.0) -> float:
        total = 0.0
        discount = 1.0
        for reward in rewards:
            total += discount * reward
            discount *= self.discount
        total += discount * leaf_value
        return total

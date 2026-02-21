from __future__ import annotations

from dataclasses import dataclass, field
from math import sqrt
from typing import Any, Callable

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
    ):
        self.action_space_n = action_space_n
        self.num_simulations = num_simulations
        self.max_depth = max_depth
        self.c_uct = c_uct
        self.discount = discount

    def plan(
        self,
        root_state: Any,
        transition_fn: Callable[[Any, int], tuple[Any, float, bool]],
        clone_state_fn: Callable[[Any], Any],
        legal_actions_fn: Callable[[Any], list[int]] | None = None,
    ) -> PlanningResult:
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
            value = self._discounted_return(rewards)

            for back_node in reversed(path):
                back_node.visits += 1
                back_node.value_sum += value
                value *= self.discount

        if not root.children:
            return PlanningResult(action=0, value=0.0, imagined_transitions=0, trace={"tree": {}})

        best_action, best_child = max(root.children.items(), key=lambda kv: kv[1].visits)
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
        }
        return PlanningResult(
            action=int(best_action),
            value=float(best_child.value),
            imagined_transitions=self.num_simulations * max(1, max_reached_depth),
            trace=trace,
        )

    def _select(self, node: MCTSNode) -> tuple[int, MCTSNode]:
        total_visits = max(1, node.visits)

        def uct(item: tuple[int, MCTSNode]):
            action, child = item
            if child.visits == 0:
                return float("inf")
            exploit = child.value
            explore = self.c_uct * sqrt(total_visits) / (1 + child.visits)
            return exploit + explore + action * 1e-6

        return max(node.children.items(), key=uct)

    def _discounted_return(self, rewards: list[float]) -> float:
        total = 0.0
        discount = 1.0
        for reward in rewards:
            total += discount * reward
            discount *= self.discount
        return total

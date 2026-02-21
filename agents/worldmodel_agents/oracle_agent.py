from __future__ import annotations

import copy

from worldmodel_agents.base import AgentConfig, BaseAgent
from worldmodel_planners.mcts import MCTSPlanner


def _move_toward(agent_pos: list[int], target_pos: list[int]) -> int:
    ar, ac = agent_pos
    tr, tc = target_pos
    if ar > tr:
        return 1
    if ar < tr:
        return 2
    if ac > tc:
        return 3
    if ac < tc:
        return 4
    return 0


class GreedyOracleAgent(BaseAgent):
    def __init__(self, config: AgentConfig | None = None):
        super().__init__(config=config)

    def act(self, obs, info: dict) -> int:
        del obs
        hint = info.get("oracle_hint", {})
        agent_pos = hint.get("agent_pos", [0, 0])

        if "has_key" in hint:
            if not hint.get("has_key", False):
                return _move_toward(agent_pos, hint.get("key_pos", agent_pos))
            if hint.get("has_key", False) and not hint.get("door_open", False):
                door = hint.get("door_pos", agent_pos)
                if abs(agent_pos[0] - door[0]) + abs(agent_pos[1] - door[1]) <= 1:
                    return 5
                return _move_toward(agent_pos, door)
            return _move_toward(agent_pos, hint.get("goal_pos", agent_pos))

        if "next_target_pos" in hint:
            target = hint.get("next_target_pos")
            if target is None:
                return 0
            if target == agent_pos:
                return 7
            return _move_toward(agent_pos, target)

        if "inventory" in hint:
            inv = hint.get("inventory", {})
            if inv.get("wood", 0) < 1 and hint.get("wood_positions"):
                return _move_toward(agent_pos, hint["wood_positions"][0])
            if inv.get("tool", 0) < 1:
                if hint.get("station_pos") == agent_pos:
                    return 6
                return _move_toward(agent_pos, hint.get("station_pos", agent_pos))
            if inv.get("gem", 0) < 1:
                return _move_toward(agent_pos, hint.get("gem_pos", agent_pos))

        return 0


class PlannerOnlyOracleAgent(BaseAgent):
    def __init__(self, config: AgentConfig | None = None):
        super().__init__(config=config)
        self.planner = MCTSPlanner(action_space_n=self.config.action_space_n, num_simulations=48, max_depth=18)

    def act(self, obs, info: dict) -> int:
        del obs
        env = info.get("env_ref")
        if env is None:
            return 0

        root_state = env.clone_env_state()

        def transition_fn(state, action):
            return env.simulate_from_state(state, action)

        result = self.planner.plan(
            root_state=root_state,
            transition_fn=transition_fn,
            clone_state_fn=copy.deepcopy,
        )
        self.last_imagined_transitions = result.imagined_transitions
        self.last_planner_trace = result.trace
        return result.action

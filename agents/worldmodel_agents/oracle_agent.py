from __future__ import annotations

import copy
from collections import deque

from worldmodel_planners.mcts import MCTSPlanner

from worldmodel_agents.base import AgentConfig, BaseAgent

# Movement action ids (shared by all BaseGridEnv subclasses).
#   1 = up    (row - 1)
#   2 = down  (row + 1)
#   3 = left  (col - 1)
#   4 = right (col + 1)
_MOVE_ACTIONS: dict[tuple[int, int], int] = {
    (-1, 0): 1,
    (1, 0): 2,
    (0, -1): 3,
    (0, 1): 4,
}
_STAY = 0


def _bfs_first_step(
    start: tuple[int, int],
    goal: tuple[int, int],
    walls: list[list[int]],
    grid_size: int,
    extra_blocked: set[tuple[int, int]] | None = None,
) -> int | None:
    """Return the first move action on a shortest grid path from ``start`` to ``goal``.

    Uses breadth-first search over 4-connected free cells of the privileged wall
    grid (``walls[r][c] == 1`` is impassable). ``extra_blocked`` marks additional
    cells (e.g. a still-closed door) that must be treated as walls. The goal cell
    itself is always treated as enterable even if it is in ``extra_blocked`` so we
    can path *onto* it once it becomes reachable.

    Returns the action id (1-4) of the first step, ``_STAY`` (0) when already at
    the goal, or ``None`` when the goal is unreachable.
    """
    if start == goal:
        return _STAY

    extra_blocked = extra_blocked or set()

    def passable(r: int, c: int) -> bool:
        if r < 0 or r >= grid_size or c < 0 or c >= grid_size:
            return False
        if walls[r][c] == 1:
            return False
        if (r, c) in extra_blocked and (r, c) != goal:
            return False
        return True

    # BFS, remembering the first action taken out of the start cell so we can
    # recover the immediate move once the goal is popped.
    queue: deque[tuple[int, int, int]] = deque()
    visited = {start}
    for (dr, dc), action in _MOVE_ACTIONS.items():
        nr, nc = start[0] + dr, start[1] + dc
        if passable(nr, nc):
            queue.append((nr, nc, action))
            visited.add((nr, nc))

    while queue:
        r, c, first_action = queue.popleft()
        if (r, c) == goal:
            return first_action
        for dr, dc in _MOVE_ACTIONS:
            nr, nc = r + dr, c + dc
            if (nr, nc) not in visited and passable(nr, nc):
                visited.add((nr, nc))
                queue.append((nr, nc, first_action))
    return None


def _as_tuple(pos) -> tuple[int, int]:
    return (int(pos[0]), int(pos[1]))


def _manhattan_step(agent: tuple[int, int], target: tuple[int, int]) -> int:
    """Fallback greedy step when no wall grid is available."""
    ar, ac = agent
    tr, tc = target
    if ar > tr:
        return 1
    if ar < tr:
        return 2
    if ac > tc:
        return 3
    if ac < tc:
        return 4
    return _STAY


class GreedyOracleAgent(BaseAgent):
    """Privileged oracle that solves the task via real shortest-path planning.

    Unlike a naive Manhattan-greedy controller (which deadlocks against walls),
    this agent runs breadth-first search over the fully-observed wall grid that
    each env exposes through ``info['oracle_hint']`` (see the core workstream's
    oracle-hint contract). It chains the per-env subgoals:

    - memory_maze: go to the key, open the door from an adjacent cell, then walk
      to the goal. The closed door cell is treated as an obstacle for BFS until
      it has been opened.
    - switch_quest: walk to ``next_target_pos`` (the next switch in the hidden
      sequence) and toggle it.
    - craft_lite: gather wood, craft a tool at the station, then collect the gem.

    When the wall grid is unavailable it degrades to Manhattan greedy.
    """

    def __init__(self, config: AgentConfig | None = None):
        super().__init__(config=config)

    def _step_toward(self, hint: dict, agent: tuple[int, int], target, extra_blocked=None) -> int:
        target_t = _as_tuple(target)
        walls = hint.get("walls")
        grid_size = hint.get("grid_size")
        if walls is None or grid_size is None:
            return _manhattan_step(agent, target_t)
        action = _bfs_first_step(agent, target_t, walls, int(grid_size), extra_blocked)
        if action is None:
            # Unreachable under current obstacles; fall back to greedy nudge.
            return _manhattan_step(agent, target_t)
        return action

    def act(self, obs, info: dict) -> int:
        del obs
        hint = info.get("oracle_hint", {})
        agent = _as_tuple(hint.get("agent_pos", [0, 0]))

        if "has_key" in hint:
            return self._act_memory_maze(hint, agent)
        if "next_target_pos" in hint:
            return self._act_switch_quest(hint, agent)
        if "inventory" in hint:
            return self._act_craft_lite(hint, agent)
        return _STAY

    def _act_memory_maze(self, hint: dict, agent: tuple[int, int]) -> int:
        door = _as_tuple(hint.get("door_pos", agent))
        if not hint.get("has_key", False):
            return self._step_toward(hint, agent, hint.get("key_pos", agent), extra_blocked={door})
        if not hint.get("door_open", False):
            # Open the door once adjacent to it; otherwise approach it (the door
            # cell itself stays blocked while still closed).
            if abs(agent[0] - door[0]) + abs(agent[1] - door[1]) == 1:
                return 5
            return self._step_toward(hint, agent, door, extra_blocked={door})
        return self._step_toward(hint, agent, hint.get("goal_pos", agent))

    def _act_switch_quest(self, hint: dict, agent: tuple[int, int]) -> int:
        target = hint.get("next_target_pos")
        if target is None:
            return _STAY
        if _as_tuple(target) == agent:
            return 7
        return self._step_toward(hint, agent, target)

    def _act_craft_lite(self, hint: dict, agent: tuple[int, int]) -> int:
        inv = hint.get("inventory", {})
        if inv.get("tool", 0) < 1:
            if inv.get("wood", 0) < 1 and hint.get("wood_positions"):
                nearest = self._nearest(agent, hint["wood_positions"], hint)
                if _as_tuple(nearest) == agent:
                    return 5
                return self._step_toward(hint, agent, nearest)
            station = hint.get("station_pos", agent)
            if _as_tuple(station) == agent:
                return 6
            return self._step_toward(hint, agent, station)
        if inv.get("gem", 0) < 1:
            gem = hint.get("gem_pos", agent)
            if _as_tuple(gem) == agent:
                return 5
            return self._step_toward(hint, agent, gem)
        return _STAY

    @staticmethod
    def _nearest(agent: tuple[int, int], positions, hint: dict):
        """Pick the position with the shortest true BFS distance (Manhattan fallback)."""
        walls = hint.get("walls")
        grid_size = hint.get("grid_size")
        if walls is None or grid_size is None:
            return min(positions, key=lambda p: abs(p[0] - agent[0]) + abs(p[1] - agent[1]))
        best = positions[0]
        best_dist = None
        for pos in positions:
            dist = _bfs_distance(agent, _as_tuple(pos), walls, int(grid_size))
            key = dist if dist is not None else abs(pos[0] - agent[0]) + abs(pos[1] - agent[1])
            if best_dist is None or key < best_dist:
                best_dist = key
                best = pos
        return best


def _bfs_distance(
    start: tuple[int, int], goal: tuple[int, int], walls: list[list[int]], grid_size: int
) -> int | None:
    if start == goal:
        return 0

    def passable(r: int, c: int) -> bool:
        return 0 <= r < grid_size and 0 <= c < grid_size and walls[r][c] != 1

    queue: deque[tuple[int, int, int]] = deque([(start[0], start[1], 0)])
    visited = {start}
    while queue:
        r, c, dist = queue.popleft()
        if (r, c) == goal:
            return dist
        for dr, dc in _MOVE_ACTIONS:
            nr, nc = r + dr, c + dc
            if (nr, nc) not in visited and passable(nr, nc):
                visited.add((nr, nc))
                queue.append((nr, nc, dist + 1))
    return None


class PlannerOnlyOracleAgent(BaseAgent):
    """Oracle that plans with MCTS over the *perfect* environment simulator.

    The env exposes ``info['env_ref']`` plus ``clone_env_state`` /
    ``simulate_from_state`` so the planner rolls out the true dynamics. Under
    sparse reward the goal often lies beyond the search depth, so we inject a
    privileged shaping heuristic via the planner's ``value_fn`` hook (added in
    the planners workstream). The heuristic is a bounded potential combining (a)
    how many task subgoals the leaf state has completed and (b) the agent's
    BFS ``closeness`` to its current subgoal over the privileged wall grid (see
    ``value_fn`` in :meth:`act` for the exact form and why it is monotone and
    capped below the terminal reward). This carries task signal into the search
    so MCTS over the perfect simulator actually reaches the goal -- it solves
    memory_maze, switch_quest, and craft_lite -- instead of scoring 0 on
    undiscovered reward.

    Nothing here is *learned* -- both the simulator and the heuristic are
    privileged/exact. This agent measures planning quality given a perfect model.
    """

    def __init__(self, config: AgentConfig | None = None, seed: int = 0):
        super().__init__(config=config)
        self.seed = seed
        # Planner budget tuned for the privileged potential heuristic (see
        # ``value_fn`` in :meth:`act`):
        #   * A small ``c_uct`` (0.05) keeps the UCT exploration term below the
        #     heuristic's per-cell gradient, so visits concentrate on the action
        #     that most improves the potential rather than spreading uniformly.
        #   * A shallow ``max_depth`` (3) keeps each backed-up value close to the
        #     leaf heuristic (which is exact and free of local minima along the
        #     optimal path) instead of a noisy deep random rollout, and keeps the
        #     per-step ``deepcopy`` cost of the true simulator bounded.
        #   * ``num_simulations`` (96) is large enough that the best action
        #     reliably accumulates the most visits given the shallow depth.
        # With this budget the planner solves memory_maze, switch_quest, and
        # craft_lite across seeds (see tests).
        self.planner = MCTSPlanner(
            action_space_n=self.config.action_space_n,
            num_simulations=96,
            max_depth=3,
            c_uct=0.05,
            seed=seed,
        )

    def reset(self, seed: int | None = None) -> None:
        if seed is not None:
            self.seed = int(seed)
            self.planner.reseed(int(seed))
        self.last_imagined_transitions = 0
        self.last_planner_trace = {}

    def act(self, obs, info: dict) -> int:
        del obs
        env = info.get("env_ref")
        if env is None:
            return _STAY

        root_state = env.clone_env_state()
        hint = info.get("oracle_hint") or (env.oracle_hint() if hasattr(env, "oracle_hint") else {})
        walls = hint.get("walls")
        grid_size = hint.get("grid_size")

        value_fn = None
        if walls is not None and grid_size is not None:
            grid_size = int(grid_size)
            n_subgoals = self._max_subgoals(hint)

            def value_fn(state):
                # Privileged potential-based shaping for NON-TERMINAL leaves.
                #
                #   potential = (K * completed_subgoals + closeness) / (K*N + 2)
                #
                # where ``closeness`` in [0, 1) grows as the agent nears its
                # current subgoal cell, N is the number of subgoals, and K
                # (PROGRESS_GAIN) amplifies completed-subgoal credit relative to
                # navigation. This single form balances the two forces that an
                # earlier additive version could not satisfy at once:
                #
                # 1. STRONG navigation: the per-cell closeness gradient is
                #    1/(K*N+2), large enough that MCTS (with a small c_uct)
                #    reliably descends toward the active subgoal across the grid.
                # 2. RELIABLE subgoal completion: finishing a subgoal raises the
                #    numerator by K while closeness changes by at most 1, so the
                #    net jump is at least (K-1)/(K*N+2) > 0 (for K>1) and dwarfs
                #    any pure-navigation closeness swing. The planner is therefore
                #    never discouraged from toggling a switch / opening the door
                #    just because the NEXT subgoal is far away -- the oscillation
                #    bug of equally-weighted progress and closeness.
                # 3. BOUNDED below 1.0: the maximum (all subgoals done) is
                #    (K*N+1)/(K*N+2) < 1.0, so the +1.0 terminal goal reward
                #    backed up by MCTS always strictly dominates -- the planner
                #    prefers finishing over hovering at a high-potential state.
                progress_gain = 3.0
                agent_pos = _as_tuple(state.get("agent_pos", [0, 0]))
                progress = self._leaf_progress(state, hint)
                subgoal = self._leaf_subgoal(state, hint, agent_pos)
                diag = 2.0 * float(grid_size)
                closeness = 0.0
                if subgoal is not None:
                    dist = _bfs_distance(agent_pos, subgoal, walls, grid_size)
                    if dist is None:
                        dist = abs(agent_pos[0] - subgoal[0]) + abs(agent_pos[1] - subgoal[1])
                    closeness = max(0.0, 1.0 - float(dist) / diag)
                numerator = progress_gain * float(progress) + closeness
                return numerator / (progress_gain * float(n_subgoals) + 2.0)

        def transition_fn(state, action):
            return env.simulate_from_state(state, action)

        result = self.planner.plan(
            root_state=root_state,
            transition_fn=transition_fn,
            clone_state_fn=copy.deepcopy,
            value_fn=value_fn,
        )
        self.last_imagined_transitions = result.imagined_transitions
        self.last_planner_trace = result.trace
        return int(result.action)

    def _leaf_subgoal(self, state: dict, hint: dict, agent_pos: tuple[int, int]):
        """Compute the active subgoal from a simulated leaf env-state dict.

        The cloned env ``__dict__`` carries the privileged fields directly, so we
        reconstruct progress (e.g. has_key/door_open or inventory) from it and
        fall back to the static positions captured in ``hint``.
        """
        if "has_key" in hint:
            if not bool(state.get("has_key", False)):
                return _as_tuple(state.get("key_pos", hint.get("key_pos", agent_pos)))
            if not bool(state.get("door_open", False)):
                return _as_tuple(state.get("door_pos", hint.get("door_pos", agent_pos)))
            return _as_tuple(state.get("goal_pos", hint.get("goal_pos", agent_pos)))
        if "next_target_pos" in hint:
            switches = state.get("switches")
            sequence = state.get("sequence")
            progress = int(state.get("progress", 0))
            if switches is not None and sequence is not None and progress < len(sequence):
                idx = int(sequence[progress])
                return _as_tuple(switches[idx])
            return (
                None if hint.get("next_target_pos") is None else _as_tuple(hint["next_target_pos"])
            )
        if "inventory" in hint:
            inv = state.get("inventory", hint.get("inventory", {}))
            if inv.get("tool", 0) < 1:
                if inv.get("wood", 0) < 1 and hint.get("wood_positions"):
                    return _as_tuple(hint["wood_positions"][0])
                return _as_tuple(state.get("station_pos", hint.get("station_pos", agent_pos)))
            if inv.get("gem", 0) < 1:
                return _as_tuple(state.get("gem_pos", hint.get("gem_pos", agent_pos)))
        return None

    @staticmethod
    def _max_subgoals(hint: dict) -> int:
        """Number of subgoals that ``_leaf_progress`` can count for this env."""
        if "has_key" in hint:
            return 2  # got key, opened door
        if "next_target_pos" in hint:
            return int(hint.get("n_switches", 4))
        if "inventory" in hint:
            return 3  # collect wood, craft tool, collect gem
        return 1

    @staticmethod
    def _leaf_progress(state: dict, hint: dict) -> float:
        """Count completed subgoals in a simulated leaf state (monotone potential)."""
        if "has_key" in hint:
            return float(bool(state.get("has_key", False))) + float(
                bool(state.get("door_open", False))
            )
        if "next_target_pos" in hint:
            return float(int(state.get("progress", 0)))
        if "inventory" in hint:
            # Use cumulative achievement counters (not the live inventory) so the
            # potential is strictly monotone across the wood->tool transition,
            # where wood is consumed: 0 -> 1 (wood) -> 2 (tool) -> 3 (gem).
            ach = state.get("achievements", hint.get("achievements", {}))
            return (
                float(min(1, ach.get("collect_wood", 0)))
                + float(min(1, ach.get("craft_tool", 0)))
                + float(min(1, ach.get("collect_gem", 0)))
            )
        return 0.0

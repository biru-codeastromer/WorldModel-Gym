from __future__ import annotations

import copy

import numpy as np
from worldmodel_planners.mcts import MCTSPlanner
from worldmodel_planners.mpc_cem import MPCCEMPlanner


def _transition(state, action):
    new_state = dict(state)
    new_state["t"] += 1
    reward = 1.0 if action == 1 else 0.0
    done = new_state["t"] >= 5
    return new_state, reward, done


def _rollout(state, seq: np.ndarray):
    total = 0.0
    for a in seq:
        state, reward, done = _transition(state, int(a))
        total += reward
        if done:
            break
    return total, {}


def test_mcts_respects_budget():
    planner = MCTSPlanner(action_space_n=3, num_simulations=20, max_depth=7)
    result = planner.plan(
        root_state={"t": 0},
        transition_fn=_transition,
        clone_state_fn=copy.deepcopy,
    )

    assert result.trace["num_simulations"] == 20
    assert result.trace["max_reached_depth"] <= 7


def test_mpc_cem_respects_budget():
    planner = MPCCEMPlanner(action_space_n=3, horizon=6, population=12, iterations=3)
    result = planner.plan(root_state={"t": 0}, rollout_fn=_rollout, clone_state_fn=copy.deepcopy)

    assert len(result.trace["score_distribution"]) == 3
    assert result.imagined_transitions == 12 * 3 * 6

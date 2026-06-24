from __future__ import annotations

import copy
from collections import Counter

import numpy as np
from worldmodel_planners.mcts import MCTSPlanner
from worldmodel_planners.mpc_cem import MPCCEMPlanner
from worldmodel_planners.trajectory_sampling import TrajectorySamplingPlanner


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


# ---------------------------------------------------------------------------
# Tiny deterministic, sparse-reward MDP used for correctness tests.
#
# A 1D corridor of positions 0..GOAL. Actions:
#   0 -> stay, 1 -> move toward goal (+1), 2 -> move away (-1, clamped at 0).
# Reward is sparse: +1 exactly on the transition that lands on GOAL; the
# episode terminates there. Every other transition yields 0 reward.
#
# Starting at position 0 with GOAL=4, the unique optimal first action is 1
# (move toward the goal). Action 0 wastes a step; action 2 is clamped and also
# wastes a step. The distance-to-goal heuristic value below is admissible and
# strictly orders the successors of the start state:
#   pos 1 -> -3   (action 1)   <- best
#   pos 0 -> -4   (actions 0 and 2, the latter clamped)
# ---------------------------------------------------------------------------
GOAL = 4
OPTIMAL_FIRST_ACTION = 1


def _corridor_transition(state, action):
    pos = state["pos"]
    if action == 1:
        pos = min(GOAL, pos + 1)
    elif action == 2:
        pos = max(0, pos - 1)
    new_state = {"pos": pos}
    done = pos == GOAL
    reward = 1.0 if done else 0.0
    return new_state, reward, done


def _distance_heuristic(state):
    # Negative remaining distance to the goal: larger (closer to 0) is better.
    return -float(GOAL - state["pos"])


def test_mcts_heuristic_selects_optimal_first_action():
    # Sparse reward + a distance-to-goal leaf value lets credit propagate
    # before the goal is ever reached, so the planner must commit to the
    # toward-goal action even with a shallow depth budget.
    planner = MCTSPlanner(
        action_space_n=3,
        num_simulations=64,
        max_depth=2,
        discount=0.99,
        seed=7,
    )
    result = planner.plan(
        root_state={"pos": 0},
        transition_fn=_corridor_transition,
        clone_state_fn=copy.deepcopy,
        value_fn=_distance_heuristic,
    )
    assert result.action == OPTIMAL_FIRST_ACTION
    assert result.trace["used_value_fn"] is True


def test_mcts_reaches_goal_reward_with_deep_budget():
    # With enough depth the planner can see the +1 goal reward directly even
    # without a heuristic, and should still prefer the toward-goal action.
    planner = MCTSPlanner(
        action_space_n=3,
        num_simulations=200,
        max_depth=GOAL + 2,
        discount=0.99,
        seed=3,
    )
    result = planner.plan(
        root_state={"pos": 0},
        transition_fn=_corridor_transition,
        clone_state_fn=copy.deepcopy,
    )
    assert result.action == OPTIMAL_FIRST_ACTION
    assert result.trace["used_value_fn"] is False


def test_mcts_no_action_index_bias_under_equal_rewards():
    # When every action yields identical reward there is no signal, so the
    # chosen root action should be (roughly) uniform across seeds rather than
    # collapsing to action 0 (the old stable-max + index-bias behavior).
    n_actions = 4

    def flat_transition(state, action):
        t = state["t"] + 1
        return {"t": t}, 0.0, t >= 6

    chosen = Counter()
    n_seeds = 200
    for seed in range(n_seeds):
        planner = MCTSPlanner(action_space_n=n_actions, num_simulations=40, max_depth=5, seed=seed)
        result = planner.plan(
            root_state={"t": 0},
            transition_fn=flat_transition,
            clone_state_fn=copy.deepcopy,
        )
        chosen[result.action] += 1

    # Every action must be selected at least once, and none may dominate the
    # way the old deterministic max() collapsed everything onto action 0.
    assert set(chosen) == set(range(n_actions))
    expected = n_seeds / n_actions
    for action in range(n_actions):
        assert 0.5 * expected <= chosen[action] <= 1.5 * expected, dict(chosen)


def test_mcts_is_seed_reproducible():
    def flat_transition(state, action):
        t = state["t"] + 1
        return {"t": t}, 0.0, t >= 6

    kwargs = dict(
        root_state={"t": 0},
        transition_fn=flat_transition,
        clone_state_fn=copy.deepcopy,
    )
    a = MCTSPlanner(action_space_n=4, num_simulations=40, max_depth=5).plan(seed=11, **kwargs)
    b = MCTSPlanner(action_space_n=4, num_simulations=40, max_depth=5).plan(seed=11, **kwargs)
    assert a.action == b.action

    # Re-seeding the same planner instance is reproducible too.
    planner = MCTSPlanner(action_space_n=4, num_simulations=40, max_depth=5)
    first = planner.plan(seed=11, **kwargs).action
    second = planner.plan(seed=11, **kwargs).action
    assert first == second


def test_mpc_cem_no_action_index_bias_under_equal_rewards():
    # All rollouts score identically -> elite selection and the best-sequence
    # pick must not systematically favor a low action index.
    def flat_rollout(state, seq):
        return 0.0, {}

    chosen = Counter()
    n_seeds = 200
    for seed in range(n_seeds):
        planner = MPCCEMPlanner(action_space_n=4, horizon=4, population=16, iterations=2, seed=seed)
        result = planner.plan(
            root_state={"t": 0}, rollout_fn=flat_rollout, clone_state_fn=copy.deepcopy
        )
        chosen[result.action] += 1

    assert set(chosen) == set(range(4))
    expected = n_seeds / 4
    for action in range(4):
        assert 0.5 * expected <= chosen[action] <= 1.5 * expected, dict(chosen)


def test_mpc_cem_is_seed_reproducible():
    def flat_rollout(state, seq):
        return float(seq.sum()), {}

    p1 = MPCCEMPlanner(action_space_n=4, horizon=4, population=16, iterations=2)
    p2 = MPCCEMPlanner(action_space_n=4, horizon=4, population=16, iterations=2)
    r1 = p1.plan(root_state={}, rollout_fn=flat_rollout, clone_state_fn=copy.deepcopy, seed=5)
    r2 = p2.plan(root_state={}, rollout_fn=flat_rollout, clone_state_fn=copy.deepcopy, seed=5)
    assert r1.trace["best_sequence"] == r2.trace["best_sequence"]


def test_trajectory_sampling_no_index_bias_and_reproducible():
    def flat_rollout(state, seq):
        return 0.0, {}

    chosen = Counter()
    for seed in range(200):
        planner = TrajectorySamplingPlanner(
            action_space_n=4, horizon=4, num_trajectories=16, seed=seed
        )
        result = planner.plan(root_state={}, rollout_fn=flat_rollout, clone_state_fn=copy.deepcopy)
        chosen[result.action] += 1
    assert set(chosen) == set(range(4))

    def sum_rollout(state, seq):
        return float(seq.sum()), {}

    a = TrajectorySamplingPlanner(action_space_n=4, horizon=4, num_trajectories=16).plan(
        root_state={}, rollout_fn=sum_rollout, clone_state_fn=copy.deepcopy, seed=9
    )
    b = TrajectorySamplingPlanner(action_space_n=4, horizon=4, num_trajectories=16).plan(
        root_state={}, rollout_fn=sum_rollout, clone_state_fn=copy.deepcopy, seed=9
    )
    assert a.action == b.action

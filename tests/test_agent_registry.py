from __future__ import annotations

import numpy as np
import pytest
import torch
from worldmodel_agents.ppo_agent import ModelFreePPOAgent
from worldmodel_agents.registry import AGENT_LABELS, create_agent, list_agents
from worldmodel_gym.envs.registry import make_env


def _run_episode(agent, env, seed, max_steps=None, with_env_ref=False):
    """Run one episode, returning (actions, total_return, reached_terminal)."""
    obs, info = env.reset(seed=seed)
    if with_env_ref:
        info["env_ref"] = env
    agent.reset(seed=seed)
    actions: list[int] = []
    total_return = 0.0
    terminated = False
    steps = 0
    done = False
    while not done:
        action = int(agent.act(obs, info))
        actions.append(action)
        next_obs, reward, term, trunc, info = env.step(action)
        if with_env_ref:
            info["env_ref"] = env
        agent.observe(
            {
                "obs": obs,
                "action": action,
                "reward": reward,
                "done": term or trunc,
                "next_obs": next_obs,
            }
        )
        obs = next_obs
        total_return += reward
        terminated = terminated or term
        done = term or trunc
        steps += 1
        if max_steps is not None and steps >= max_steps:
            break
    return actions, total_return, terminated


# --------------------------------------------------------------------------- #
# Basic smoke tests (kept from before, now with deterministic seeding).
# --------------------------------------------------------------------------- #
def test_search_mcts_can_act_on_memory_maze_observation():
    env = make_env("memory_maze", obs_mode="both", max_steps=8)
    obs, info = env.reset(seed=123)
    agent = create_agent("search_mcts")
    agent.reset(seed=123)

    action = agent.act(obs, info)

    assert isinstance(action, int)
    assert 0 <= action < 8


def test_imagination_mpc_can_act_on_switch_quest_observation():
    env = make_env("switch_quest", obs_mode="both", max_steps=8)
    obs, info = env.reset(seed=123)
    agent = create_agent("imagination_mpc")
    agent.reset(seed=123)

    action = agent.act(obs, info)

    assert isinstance(action, int)
    assert 0 <= action < 8


def test_registry_labels_cover_all_agents():
    ids = {entry["id"] for entry in list_agents()}
    assert ids == set(AGENT_LABELS)
    # PPO must be labeled as a real learner, not a random stub.
    assert "ppo" in ids
    assert "random" not in AGENT_LABELS["ppo"].lower()
    assert "ppo" in AGENT_LABELS["ppo"].lower()


# --------------------------------------------------------------------------- #
# (a) Determinism: a learning agent run twice with the same seed yields
#     identical action sequences.
# --------------------------------------------------------------------------- #
@pytest.mark.parametrize("agent_name", ["search_mcts", "imagination_mpc", "ppo"])
def test_learning_agent_is_seed_reproducible(agent_name):
    actions_a = None
    actions_b = None
    for store in ("a", "b"):
        env = make_env("memory_maze", obs_mode="both", max_steps=12)
        agent = create_agent(agent_name)
        actions, _, _ = _run_episode(agent, env, seed=321)
        if store == "a":
            actions_a = actions
        else:
            actions_b = actions

    assert actions_a == actions_b
    assert len(actions_a) > 0


def test_ppo_two_runs_diverge_only_with_different_seed():
    env = make_env("memory_maze", obs_mode="both", max_steps=12)
    a_same, _, _ = _run_episode(create_agent("ppo"), env, seed=7)
    env = make_env("memory_maze", obs_mode="both", max_steps=12)
    b_same, _, _ = _run_episode(create_agent("ppo"), env, seed=7)
    env = make_env("memory_maze", obs_mode="both", max_steps=12)
    c_other, _, _ = _run_episode(create_agent("ppo"), env, seed=99)

    assert a_same == b_same
    # Different seeds should (overwhelmingly) produce a different trajectory.
    assert a_same != c_other


# --------------------------------------------------------------------------- #
# (b) PPO update produces a finite loss and changes policy params.
# --------------------------------------------------------------------------- #
def test_ppo_update_is_finite_and_changes_params():
    env = make_env("memory_maze", obs_mode="both", max_steps=64)
    agent = ModelFreePPOAgent()
    agent.reset(seed=11)

    obs, info = env.reset(seed=11)
    # Drive the policy to fill the rollout buffer with a non-trivial (shaped)
    # reward so the surrogate has a gradient. We call update() directly to assert
    # on its return value and parameter deltas.
    for _ in range(48):
        action = agent.act(obs, info)
        next_obs, reward, term, trunc, info = env.step(action)
        # Hand-injected non-zero reward signal so advantages are non-degenerate.
        agent.observe({"reward": reward + 0.25, "done": False, "next_obs": next_obs})
        obs = next_obs
        if term or trunc:
            obs, info = env.reset(seed=11)

    assert agent.net is not None
    before = [p.detach().clone() for p in agent.net.parameters()]
    loss = agent.update(bootstrap_value=0.0)
    after = list(agent.net.parameters())

    assert loss is not None
    assert np.isfinite(loss)
    changed = any(not torch.equal(b, a) for b, a in zip(before, after))
    assert changed


def test_ppo_update_returns_none_without_enough_data():
    agent = ModelFreePPOAgent()
    agent.reset(seed=0)
    # Network not built and buffer empty -> nothing to update.
    assert agent.update() is None


# --------------------------------------------------------------------------- #
# (c) Oracle solves a fixed-seed episode (assert success).
# --------------------------------------------------------------------------- #
@pytest.mark.parametrize("env_id", ["memory_maze", "switch_quest", "craft_lite"])
def test_greedy_oracle_solves_fixed_seed_episode(env_id):
    env = make_env(env_id, obs_mode="both")
    agent = create_agent("greedy_oracle")
    _actions, total_return, terminated = _run_episode(agent, env, seed=7)

    assert terminated, f"greedy oracle failed to reach the goal on {env_id}"
    assert total_return >= 1.0


def test_greedy_oracle_solves_multiple_seeds_memory_maze():
    # The BFS oracle must not deadlock on walls across different layouts.
    solved = 0
    for seed in range(6):
        env = make_env("memory_maze", obs_mode="both")
        agent = create_agent("greedy_oracle")
        _actions, _ret, terminated = _run_episode(agent, env, seed=seed)
        solved += int(terminated)
    assert solved == 6


def test_planner_only_oracle_solves_memory_maze_fixed_seed():
    env = make_env("memory_maze", obs_mode="both", max_steps=120)
    agent = create_agent("planner_oracle")
    _actions, total_return, terminated = _run_episode(agent, env, seed=7, with_env_ref=True)

    assert terminated, "planner-only oracle (MCTS over perfect sim) failed to reach goal"
    assert total_return >= 1.0
    assert agent.last_planner_trace.get("used_value_fn") is True

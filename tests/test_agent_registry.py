from __future__ import annotations

from worldmodel_agents.registry import create_agent
from worldmodel_gym.envs.registry import make_env


def test_search_mcts_can_act_on_memory_maze_observation():
    env = make_env("memory_maze", obs_mode="both", max_steps=8)
    obs, info = env.reset(seed=123)
    agent = create_agent("search_mcts")
    agent.reset(seed=123)

    action = agent.act(obs, info)

    assert isinstance(action, int)


def test_imagination_mpc_can_act_on_switch_quest_observation():
    env = make_env("switch_quest", obs_mode="both", max_steps=8)
    obs, info = env.reset(seed=123)
    agent = create_agent("imagination_mpc")
    agent.reset(seed=123)

    action = agent.act(obs, info)

    assert isinstance(action, int)

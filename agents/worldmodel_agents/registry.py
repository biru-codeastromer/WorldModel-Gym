from __future__ import annotations

from worldmodel_agents.base import AgentConfig
from worldmodel_agents.imagination_mpc import ImaginationMPCAgent
from worldmodel_agents.oracle_agent import GreedyOracleAgent, PlannerOnlyOracleAgent
from worldmodel_agents.ppo_agent import ModelFreePPOAgent
from worldmodel_agents.random_agent import RandomAgent
from worldmodel_agents.search_mcts import SearchMCTSAgent


def create_agent(name: str, action_space_n: int = 8):
    key = name.lower()
    config = AgentConfig(action_space_n=action_space_n)

    if key in {"random", "random_agent"}:
        return RandomAgent(config=config)
    if key in {"greedy_oracle", "oracle"}:
        return GreedyOracleAgent(config=config)
    if key in {"planner_oracle", "planner_only_oracle"}:
        return PlannerOnlyOracleAgent(config=config)
    if key in {"imagination_mpc", "imag_mpc"}:
        return ImaginationMPCAgent(config=config)
    if key in {"search_mcts", "muzero_skeleton"}:
        return SearchMCTSAgent(config=config)
    if key in {"ppo", "model_free_ppo"}:
        return ModelFreePPOAgent(config=config)

    msg = f"Unknown agent: {name}"
    raise ValueError(msg)

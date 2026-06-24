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


# Human-readable labels describing what each agent actually is. Kept accurate so
# downstream reports do not mislabel agents (e.g. PPO is a genuine learner now,
# not a random stub).
AGENT_LABELS: dict[str, str] = {
    "random": "Uniform-random baseline",
    "greedy_oracle": "Privileged oracle (BFS shortest-path over the true wall grid)",
    "planner_oracle": "MCTS over the perfect simulator with a privileged distance heuristic",
    "imagination_mpc": "Learned ensemble world model + CEM-MPC planning",
    "search_mcts": "Learned latent world model + MCTS planning (MuZero-style)",
    "ppo": "Model-free PPO (actor-critic, GAE, clipped surrogate)",
}


def list_agents() -> list[dict[str, str]]:
    """Return the registered agents with accurate descriptions."""
    return [{"id": key, "label": label} for key, label in AGENT_LABELS.items()]

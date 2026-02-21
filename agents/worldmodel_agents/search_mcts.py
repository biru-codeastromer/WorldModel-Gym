from __future__ import annotations

import copy

import numpy as np
from worldmodel_models.registry import create_world_model
from worldmodel_planners.mcts import MCTSPlanner

from worldmodel_agents.base import AgentConfig, BaseAgent


class SearchMCTSAgent(BaseAgent):
    """Minimal MuZero-style skeleton: learned model + MCTS planning."""

    def __init__(self, config: AgentConfig | None = None):
        super().__init__(config=config)
        self.world_model = create_world_model("deterministic")
        self.planner = MCTSPlanner(
            action_space_n=self.config.action_space_n, num_simulations=56, max_depth=14
        )
        self.latent = self.world_model.init_state(batch_size=1)
        self.buffer: list[dict] = []
        self.rng = np.random.default_rng(0)

    def reset(self, seed: int | None = None) -> None:
        if seed is not None:
            self.rng = np.random.default_rng(seed)
        self.latent = self.world_model.init_state(batch_size=1)
        self.last_imagined_transitions = 0
        self.last_planner_trace = {}

    def act(self, obs, info: dict) -> int:
        del info
        self.latent = self.world_model.observe(self.latent, obs)

        def transition_fn(state, action):
            next_state, _pred_obs, pred_reward, pred_done, _aux = self.world_model.predict(
                state, int(action)
            )
            return next_state, float(pred_reward), bool(pred_done)

        result = self.planner.plan(
            root_state=self.latent,
            transition_fn=transition_fn,
            clone_state_fn=copy.deepcopy,
        )

        self.last_imagined_transitions = result.imagined_transitions
        self.last_planner_trace = result.trace
        return int(result.action)

    def observe(self, transition: dict) -> None:
        self.buffer.append(transition)
        if len(self.buffer) > 1024:
            self.buffer = self.buffer[-1024:]

        if len(self.buffer) >= 32 and hasattr(self.world_model, "update"):
            idx = self.rng.choice(len(self.buffer), size=24, replace=False)
            batch = [self.buffer[int(i)] for i in idx]
            self.world_model.update(batch)

from __future__ import annotations

import copy

import numpy as np

from worldmodel_agents.base import AgentConfig, BaseAgent
from worldmodel_planners.mpc_cem import MPCCEMPlanner
from worldmodel_models.registry import create_world_model


class ImaginationMPCAgent(BaseAgent):
    def __init__(self, config: AgentConfig | None = None):
        super().__init__(config=config)
        self.world_model = create_world_model("ensemble")
        self.planner = MPCCEMPlanner(action_space_n=self.config.action_space_n, horizon=10, population=64, iterations=3)
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

        def rollout_fn(state, action_seq):
            rollout = self.world_model.imagine_rollout(state, action_seq)
            score = float(sum(rollout.get("pred_rewards", [])))
            score -= 0.05 * float(rollout.get("uncertainty", 0.0))
            return score, rollout

        result = self.planner.plan(
            root_state=self.latent,
            rollout_fn=rollout_fn,
            clone_state_fn=copy.deepcopy,
        )
        self.last_imagined_transitions = result.imagined_transitions
        self.last_planner_trace = result.trace
        return int(result.action)

    def observe(self, transition: dict) -> None:
        self.buffer.append(transition)
        if len(self.buffer) > 512:
            self.buffer = self.buffer[-512:]

        if len(self.buffer) >= 32 and hasattr(self.world_model, "update"):
            idx = self.rng.choice(len(self.buffer), size=16, replace=False)
            batch = [self.buffer[int(i)] for i in idx]
            self.world_model.update(batch)

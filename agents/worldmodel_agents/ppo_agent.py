from __future__ import annotations

import numpy as np

from worldmodel_agents.base import AgentConfig, BaseAgent


class ModelFreePPOAgent(BaseAgent):
    """Lightweight placeholder wrapper.

    For CPU-friendly demo runs, this defaults to random actions unless external
    training artifacts are provided.
    """

    def __init__(self, config: AgentConfig | None = None):
        super().__init__(config=config)
        self.rng = np.random.default_rng(0)

    def reset(self, seed: int | None = None) -> None:
        if seed is not None:
            self.rng = np.random.default_rng(seed)

    def act(self, obs, info: dict) -> int:
        del obs, info
        self.last_imagined_transitions = 0
        self.last_planner_trace = {}
        return int(self.rng.integers(0, self.config.action_space_n))

    def observe(self, transition: dict) -> None:
        del transition

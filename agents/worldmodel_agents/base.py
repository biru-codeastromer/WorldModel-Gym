from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np
import torch


@dataclass
class AgentConfig:
    action_space_n: int = 8


def seed_everything(seed: int) -> None:
    """Seed the global torch and numpy RNGs deterministically.

    Centralized so every agent reset produces identical action sequences across
    runs with the same seed. Operations are CPU-only here, so seeding torch's
    global generator plus numpy is sufficient for reproducibility.
    """
    torch.manual_seed(int(seed))
    np.random.seed(int(seed))


class BaseAgent:
    def __init__(self, config: AgentConfig | None = None):
        self.config = config or AgentConfig()
        self.last_imagined_transitions = 0
        self.last_planner_trace: dict[str, Any] = {}

    def reset(self, seed: int | None = None) -> None:
        if seed is not None:
            seed_everything(seed)

    def act(self, obs, info: dict) -> int:
        raise NotImplementedError

    def observe(self, transition: dict) -> None:
        del transition

    def get_trace(self) -> dict[str, Any]:
        return dict(self.last_planner_trace)

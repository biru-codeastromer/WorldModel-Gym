from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class AgentConfig:
    action_space_n: int = 8


class BaseAgent:
    def __init__(self, config: AgentConfig | None = None):
        self.config = config or AgentConfig()
        self.last_imagined_transitions = 0
        self.last_planner_trace: dict[str, Any] = {}

    def reset(self, seed: int | None = None) -> None:
        del seed

    def act(self, obs, info: dict) -> int:
        raise NotImplementedError

    def observe(self, transition: dict) -> None:
        del transition

    def get_trace(self) -> dict[str, Any]:
        return dict(self.last_planner_trace)

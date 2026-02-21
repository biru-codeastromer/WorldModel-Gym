from __future__ import annotations

from typing import Any

from worldmodel_gym.envs.craft_lite import CraftLiteConfig, CraftLiteEnv
from worldmodel_gym.envs.memory_maze import MemoryMazeConfig, MemoryMazeEnv
from worldmodel_gym.envs.switch_quest import SwitchQuestConfig, SwitchQuestEnv


def make_env(env_id: str, **kwargs: Any):
    env_id = env_id.lower()
    if env_id in {"memorymaze", "memory_maze"}:
        return MemoryMazeEnv(MemoryMazeConfig(**kwargs))
    if env_id in {"switchquest", "switch_quest"}:
        return SwitchQuestEnv(SwitchQuestConfig(**kwargs))
    if env_id in {"craftlite", "craft_lite"}:
        return CraftLiteEnv(CraftLiteConfig(**kwargs))
    msg = f"Unknown env_id={env_id}"
    raise ValueError(msg)


def list_tasks() -> list[dict[str, Any]]:
    return [
        {
            "id": "memory_maze",
            "description": "Grid POMDP with key-door dependency and sparse goal reward",
            "defaults": MemoryMazeConfig().__dict__,
        },
        {
            "id": "switch_quest",
            "description": "Subgoal chaining with hidden switch order",
            "defaults": SwitchQuestConfig().__dict__,
        },
        {
            "id": "craft_lite",
            "description": "Lightweight procedural crafting with achievements",
            "defaults": CraftLiteConfig().__dict__,
        },
    ]

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from worldmodel_gym.envs.base import BaseEnvConfig, BaseGridEnv


@dataclass
class MemoryMazeConfig(BaseEnvConfig):
    grid_size: int = 14
    max_steps: int = 600
    wall_density: float = 0.16


class MemoryMazeEnv(BaseGridEnv):
    def __init__(self, config: MemoryMazeConfig | None = None):
        super().__init__(config or MemoryMazeConfig())
        self.walls = np.zeros((self.grid_size, self.grid_size), dtype=bool)
        self.key_pos = np.array([2, 2], dtype=np.int64)
        self.door_pos = np.array([3, 3], dtype=np.int64)
        self.goal_pos = np.array([4, 4], dtype=np.int64)
        self.has_key = False
        self.door_open = False

    def _reset_state(self, seed: int | None = None) -> None:
        del seed
        self.walls[:] = False
        self.walls[[0, -1], :] = True
        self.walls[:, [0, -1]] = True

        inner = (self.grid_size - 2) * (self.grid_size - 2)
        count = int(inner * self.config.wall_density)
        flat = self._rng.choice(inner, size=count, replace=False)
        for idx in flat:
            r = idx // (self.grid_size - 2) + 1
            c = idx % (self.grid_size - 2) + 1
            self.walls[r, c] = True

        free = np.argwhere(~self.walls)
        picks = self._rng.choice(len(free), size=4, replace=False)
        self.agent_pos = free[picks[0]].astype(np.int64)
        self.key_pos = free[picks[1]].astype(np.int64)
        self.door_pos = free[picks[2]].astype(np.int64)
        self.goal_pos = free[picks[3]].astype(np.int64)

        self.has_key = False
        self.door_open = False

    def _step_state(self, action: int) -> tuple[float, bool, list[str]]:
        reward = 0.0
        terminated = False
        events: list[str] = []

        moves = {
            1: (-1, 0),
            2: (1, 0),
            3: (0, -1),
            4: (0, 1),
        }

        blocked = {1}
        if not self.door_open:
            blocked.add(4)

        if action in moves:
            self._attempt_move(*moves[action], blocked_tiles=blocked)

        if np.array_equal(self.agent_pos, self.key_pos) and not self.has_key:
            self.has_key = True
            events.append("found_key")

        if action == 5 and self.has_key and self._adjacent(self.agent_pos, self.door_pos) and not self.door_open:
            self.door_open = True
            events.append("opened_door")

        if np.array_equal(self.agent_pos, self.goal_pos) and self.door_open:
            reward = 1.0
            terminated = True
            events.append("goal_reached")

        return reward, terminated, events

    @staticmethod
    def _adjacent(a: np.ndarray, b: np.ndarray) -> bool:
        return abs(int(a[0]) - int(b[0])) + abs(int(a[1]) - int(b[1])) <= 1

    def _tile_grid(self) -> np.ndarray:
        grid = np.zeros((self.grid_size, self.grid_size), dtype=np.int64)
        grid[self.walls] = 1
        grid[tuple(self.key_pos)] = 0 if self.has_key else 3
        grid[tuple(self.door_pos)] = 5 if self.door_open else 4
        grid[tuple(self.goal_pos)] = 6
        grid[tuple(self.agent_pos)] = 2
        return grid

    def _extra_channels(self) -> np.ndarray:
        extras = np.zeros((4, self.grid_size, self.grid_size), dtype=np.float32)
        extras[0, :, :] = float(self.has_key)
        extras[1, :, :] = float(self.door_open)
        extras[2, :, :] = self.step_count / max(1, self.config.max_steps)
        extras[3, :, :] = 1.0
        return extras

    def _trace_state(self) -> dict:
        base = super()._trace_state()
        base.update(
            {
                "has_key": self.has_key,
                "door_open": self.door_open,
                "goal_pos": [int(self.goal_pos[0]), int(self.goal_pos[1])],
            }
        )
        return base

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from worldmodel_gym.envs.base import BaseEnvConfig, BaseGridEnv


@dataclass
class CraftLiteConfig(BaseEnvConfig):
    grid_size: int = 14
    max_steps: int = 800
    wood_count: int = 6
    rock_count: int = 5
    strict_sparse: bool = True


class CraftLiteEnv(BaseGridEnv):
    def __init__(self, config: CraftLiteConfig | None = None):
        super().__init__(config or CraftLiteConfig())
        self.walls = np.zeros((self.grid_size, self.grid_size), dtype=bool)
        self.wood = np.zeros((0, 2), dtype=np.int64)
        self.rock = np.zeros((0, 2), dtype=np.int64)
        self.gem_pos = np.array([2, 2], dtype=np.int64)
        self.station_pos = np.array([3, 3], dtype=np.int64)
        self.inventory = {"wood": 0, "tool": 0, "gem": 0}
        self.achievements: dict[str, int] = {}

    def _reset_state(self, seed: int | None = None) -> None:
        del seed
        self.walls[:] = False
        self.walls[[0, -1], :] = True
        self.walls[:, [0, -1]] = True

        free = np.argwhere(~self.walls)
        picks = self._rng.choice(
            len(free),
            size=2 + self.config.wood_count + self.config.rock_count + 1,
            replace=False,
        )
        self.agent_pos = free[picks[0]].astype(np.int64)
        self.station_pos = free[picks[1]].astype(np.int64)

        start = 2
        self.wood = free[picks[start : start + self.config.wood_count]].astype(np.int64)
        start += self.config.wood_count
        self.rock = free[picks[start : start + self.config.rock_count]].astype(np.int64)
        self.gem_pos = free[picks[-1]].astype(np.int64)

        self.inventory = {"wood": 0, "tool": 0, "gem": 0}
        self.achievements = {
            "collect_wood": 0,
            "craft_tool": 0,
            "break_rock": 0,
            "collect_gem": 0,
        }

    def _step_state(self, action: int) -> tuple[float, bool, list[str]]:
        events: list[str] = []
        reward = 0.0
        terminated = False

        moves = {
            1: (-1, 0),
            2: (1, 0),
            3: (0, -1),
            4: (0, 1),
        }

        if action in moves:
            self._attempt_move(*moves[action], blocked_tiles={1})

        if action == 5:
            if self._collect_resource(self.wood):
                self.inventory["wood"] += 1
                self.achievements["collect_wood"] += 1
                events.append("collected_wood")
                if not self.config.strict_sparse:
                    reward += 0.05
            if self._break_rock():
                self.achievements["break_rock"] += 1
                events.append("broke_rock")
                if not self.config.strict_sparse:
                    reward += 0.05
            if np.array_equal(self.agent_pos, self.gem_pos) and self.inventory["tool"] > 0:
                self.inventory["gem"] = 1
                self.achievements["collect_gem"] = 1
                events.append("collected_gem")

        if action == 6 and np.array_equal(self.agent_pos, self.station_pos):
            if self.inventory["wood"] >= 1 and self.inventory["tool"] == 0:
                self.inventory["wood"] -= 1
                self.inventory["tool"] = 1
                self.achievements["craft_tool"] = 1
                events.append("crafted_tool")
                if not self.config.strict_sparse:
                    reward += 0.05

        if self.inventory["gem"] > 0:
            reward += 1.0
            terminated = True
            events.append("craft_goal_complete")

        return reward, terminated, events

    def _collect_resource(self, pool: np.ndarray) -> bool:
        for i, pos in enumerate(pool):
            if pos[0] < 0:
                continue
            if np.array_equal(pos, self.agent_pos):
                pool[i] = np.array([-1, -1], dtype=np.int64)
                return True
        return False

    def _break_rock(self) -> bool:
        if self.inventory["tool"] <= 0:
            return False
        return self._collect_resource(self.rock)

    def _tile_grid(self) -> np.ndarray:
        grid = np.zeros((self.grid_size, self.grid_size), dtype=np.int64)
        grid[self.walls] = 1
        for pos in self.wood:
            if pos[0] >= 0:
                grid[tuple(pos)] = 8
        for pos in self.rock:
            if pos[0] >= 0:
                grid[tuple(pos)] = 9

        if self.inventory["gem"] == 0:
            grid[tuple(self.gem_pos)] = 10
        grid[tuple(self.station_pos)] = 11
        grid[tuple(self.agent_pos)] = 2
        return grid

    def _extra_channels(self) -> np.ndarray:
        extras = np.zeros((4, self.grid_size, self.grid_size), dtype=np.float32)
        extras[0, :, :] = float(self.inventory["wood"])
        extras[1, :, :] = float(self.inventory["tool"])
        extras[2, :, :] = float(self.inventory["gem"])
        extras[3, :, :] = self.step_count / max(1, self.config.max_steps)
        return extras

    def _trace_state(self) -> dict:
        base = super()._trace_state()
        base.update(
            {
                "inventory": dict(self.inventory),
                "achievements": dict(self.achievements),
                "station_pos": [int(self.station_pos[0]), int(self.station_pos[1])],
                "gem_pos": [int(self.gem_pos[0]), int(self.gem_pos[1])],
                "wood_positions": [[int(p[0]), int(p[1])] for p in self.wood if p[0] >= 0],
                "rock_positions": [[int(p[0]), int(p[1])] for p in self.rock if p[0] >= 0],
            }
        )
        return base

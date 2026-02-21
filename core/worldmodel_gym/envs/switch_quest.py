from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from worldmodel_gym.envs.base import BaseEnvConfig, BaseGridEnv


@dataclass
class SwitchQuestConfig(BaseEnvConfig):
    grid_size: int = 12
    max_steps: int = 500
    n_switches: int = 4
    wall_density: float = 0.1


class SwitchQuestEnv(BaseGridEnv):
    def __init__(self, config: SwitchQuestConfig | None = None):
        super().__init__(config or SwitchQuestConfig())
        self.walls = np.zeros((self.grid_size, self.grid_size), dtype=bool)
        self.switches = np.zeros((self.config.n_switches, 2), dtype=np.int64)
        self.sequence = np.arange(self.config.n_switches, dtype=np.int64)
        self.progress = 0
        self.toggled = np.zeros(self.config.n_switches, dtype=bool)

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
        picks = self._rng.choice(len(free), size=self.config.n_switches + 1, replace=False)
        self.agent_pos = free[picks[0]].astype(np.int64)
        for i in range(self.config.n_switches):
            self.switches[i] = free[picks[i + 1]]

        self.sequence = self._rng.permutation(self.config.n_switches)
        self.progress = 0
        self.toggled[:] = False

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

        if action in (5, 7):
            idx = self._switch_at_agent()
            if idx is not None:
                if idx == int(self.sequence[self.progress]):
                    self.toggled[idx] = True
                    events.append(f"toggle_correct_{self.progress}")
                    self.progress += 1
                    if self.progress == self.config.n_switches:
                        reward = 1.0
                        terminated = True
                        events.append("switch_chain_complete")
                else:
                    self.toggled[:] = False
                    self.progress = 0
                    events.append("toggle_wrong_reset")

        return reward, terminated, events

    def _switch_at_agent(self) -> int | None:
        for i, pos in enumerate(self.switches):
            if np.array_equal(pos, self.agent_pos):
                return i
        return None

    def _tile_grid(self) -> np.ndarray:
        grid = np.zeros((self.grid_size, self.grid_size), dtype=np.int64)
        grid[self.walls] = 1
        for i, pos in enumerate(self.switches):
            grid[tuple(pos)] = 7 if not self.toggled[i] else 0
        grid[tuple(self.agent_pos)] = 2
        return grid

    def _extra_channels(self) -> np.ndarray:
        extras = np.zeros((4, self.grid_size, self.grid_size), dtype=np.float32)
        extras[0, :, :] = self.progress / max(1, self.config.n_switches)
        extras[1, :, :] = self.step_count / max(1, self.config.max_steps)
        extras[2, :, :] = 1.0
        extras[3, :, :] = 0.0
        return extras

    def _trace_state(self) -> dict:
        base = super()._trace_state()
        base.update({"progress": self.progress, "n_switches": self.config.n_switches})
        return base

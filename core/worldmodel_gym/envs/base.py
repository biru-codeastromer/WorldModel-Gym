from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import gymnasium as gym
import numpy as np
from gymnasium import spaces

from worldmodel_gym.trace.schema import EpisodeTrace, TraceStep


@dataclass
class BaseEnvConfig:
    grid_size: int = 12
    fov_radius: int = 2
    max_steps: int = 500
    obs_mode: str = "both"  # rgb | symbolic | both
    step_penalty: float = 0.0


COLORS: dict[int, tuple[int, int, int]] = {
    0: (24, 28, 37),  # empty
    1: (70, 75, 90),  # wall
    2: (80, 196, 255),  # agent
    3: (255, 215, 90),  # key
    4: (168, 98, 48),  # door closed
    5: (198, 148, 108),  # door open
    6: (96, 232, 125),  # goal
    7: (240, 132, 132),  # switch
    8: (151, 110, 74),  # wood
    9: (124, 124, 124),  # rock
    10: (122, 232, 215),  # gem
    11: (255, 180, 112),  # crafting station
}


class BaseGridEnv(gym.Env):
    metadata = {"render_modes": ["rgb_array"], "render_fps": 15}

    def __init__(self, config: BaseEnvConfig):
        super().__init__()
        self.config = config
        self.grid_size = config.grid_size
        self.action_space = spaces.Discrete(8)
        self._rng = np.random.default_rng(0)

        symbolic_space = spaces.Box(low=0.0, high=1.0, shape=(16, self.grid_size, self.grid_size), dtype=np.float32)
        rgb_space = spaces.Box(low=0, high=255, shape=(64, 64, 3), dtype=np.uint8)

        if self.config.obs_mode == "rgb":
            self.observation_space = rgb_space
        elif self.config.obs_mode == "symbolic":
            self.observation_space = symbolic_space
        elif self.config.obs_mode == "both":
            self.observation_space = spaces.Dict({"rgb": rgb_space, "symbolic": symbolic_space})
        else:
            msg = f"Unsupported obs_mode={self.config.obs_mode}"
            raise ValueError(msg)

        self.agent_pos = np.array([1, 1], dtype=np.int64)
        self.step_count = 0
        self.trace_steps: list[TraceStep] = []
        self.episode_id = 0
        self._seed_value = 0

    def reset(self, *, seed: int | None = None, options: dict[str, Any] | None = None):
        del options
        if seed is not None:
            self._rng = np.random.default_rng(seed)
            self._seed_value = int(seed)
        self.step_count = 0
        self.trace_steps = []
        self.episode_id += 1
        self._reset_state(seed=seed)
        obs = self._format_obs()
        info = {
            "events": [],
            "episode_id": self.episode_id,
        }
        return obs, info

    def step(self, action: int):
        self.step_count += 1
        reward, terminated, events = self._step_state(action)
        truncated = self.step_count >= self.config.max_steps and not terminated
        reward += self.config.step_penalty

        obs = self._format_obs()
        info: dict[str, Any] = {
            "events": events,
            "step": self.step_count,
        }

        trace_step = TraceStep(
            t=self.step_count,
            action=int(action),
            reward=float(reward),
            terminated=bool(terminated),
            truncated=bool(truncated),
            events=list(events),
            planner={},
            env_state=self._trace_state(),
        )
        self.trace_steps.append(trace_step)

        if terminated or truncated:
            info["episode_trace"] = EpisodeTrace(
                env_id=self.__class__.__name__,
                episode_id=self.episode_id,
                seed=self.current_seed,
                steps=self.trace_steps,
            ).model_dump(mode="json")

        return obs, float(reward), bool(terminated), bool(truncated), info

    def render(self):
        tile_grid = self._tile_grid()
        return self._rgb_from_tiles(tile_grid)

    def _format_obs(self):
        symbolic = self._symbolic_obs()
        if self.config.obs_mode == "symbolic":
            return symbolic
        rgb = self.render()
        if self.config.obs_mode == "rgb":
            return rgb
        return {"rgb": rgb, "symbolic": symbolic}

    def _symbolic_obs(self) -> np.ndarray:
        tile_grid = self._tile_grid()
        channels = np.stack([(tile_grid == i).astype(np.float32) for i in range(12)], axis=0)
        extras = self._extra_channels()
        symbolic = np.concatenate([channels, extras], axis=0)

        visibility = self._visibility_mask()
        symbolic[:, ~visibility] = 0.0
        return symbolic

    def _extra_channels(self) -> np.ndarray:
        return np.zeros((4, self.grid_size, self.grid_size), dtype=np.float32)

    def _visibility_mask(self) -> np.ndarray:
        mask = np.zeros((self.grid_size, self.grid_size), dtype=bool)
        r, c = int(self.agent_pos[0]), int(self.agent_pos[1])
        f = self.config.fov_radius
        r0, r1 = max(0, r - f), min(self.grid_size, r + f + 1)
        c0, c1 = max(0, c - f), min(self.grid_size, c + f + 1)
        mask[r0:r1, c0:c1] = True
        return mask

    @staticmethod
    def _rgb_from_tiles(tile_grid: np.ndarray) -> np.ndarray:
        h, w = tile_grid.shape
        rgb = np.zeros((h, w, 3), dtype=np.uint8)
        for tid, color in COLORS.items():
            rgb[tile_grid == tid] = color

        scale = max(1, 64 // h)
        up = np.repeat(np.repeat(rgb, scale, axis=0), scale, axis=1)
        canvas = np.zeros((64, 64, 3), dtype=np.uint8)
        canvas[: up.shape[0], : up.shape[1]] = up[:64, :64]
        return canvas

    def _attempt_move(self, dr: int, dc: int, blocked_tiles: set[int]) -> bool:
        nr, nc = int(self.agent_pos[0] + dr), int(self.agent_pos[1] + dc)
        if nr < 0 or nr >= self.grid_size or nc < 0 or nc >= self.grid_size:
            return False
        if self._tile_grid()[nr, nc] in blocked_tiles:
            return False
        self.agent_pos[:] = [nr, nc]
        return True

    @property
    def current_seed(self) -> int:
        return self._seed_value

    def _trace_state(self) -> dict[str, Any]:
        return {
            "agent_pos": [int(self.agent_pos[0]), int(self.agent_pos[1])],
        }

    def _reset_state(self, seed: int | None = None) -> None:
        raise NotImplementedError

    def _step_state(self, action: int) -> tuple[float, bool, list[str]]:
        raise NotImplementedError

    def _tile_grid(self) -> np.ndarray:
        raise NotImplementedError

from __future__ import annotations

import numpy as np
import torch
from worldmodel_models.common import ModelConfig, to_numpy_obs
from worldmodel_models.registry import create_world_model
from worldmodel_planners.mpc_cem import MPCCEMPlanner

from worldmodel_agents.base import AgentConfig, BaseAgent


def _clone_state(value):
    if isinstance(value, torch.Tensor):
        return value.detach().clone()
    if isinstance(value, dict):
        return {key: _clone_state(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_clone_state(item) for item in value]
    if isinstance(value, tuple):
        return tuple(_clone_state(item) for item in value)
    return value


class ImaginationMPCAgent(BaseAgent):
    """Imagination-based planning: a learned ensemble world model + CEM-MPC.

    What IS learned: the ensemble world model is trained online from the agent's
    transition buffer; its members stay diverse so the disagreement-based
    ``uncertainty`` penalty in the rollout score is meaningful.

    What is NOT learned: there is no learned value head. CEM scores trajectories
    by the sum of the model's predicted rewards (minus an uncertainty penalty);
    on tasks where the gathered data carries only zero reward the model cannot
    fit a reward signal, so planning degrades gracefully to seeded-uniform action
    selection instead of collapsing to a fixed action index.

    Determinism: ``reset(seed)`` seeds the global torch/numpy RNGs and rebuilds
    the world model and planner with that seed, so the same seed yields identical
    action sequences across runs.
    """

    def __init__(self, config: AgentConfig | None = None, seed: int = 0):
        super().__init__(config=config)
        self.seed = seed
        # obs_dim is derived lazily from the first observation (see ``act``);
        # until then the world model uses ModelConfig's default size.
        self._obs_dim: int | None = None
        self.world_model = self._build_world_model()
        self.planner = MPCCEMPlanner(
            action_space_n=self.config.action_space_n,
            horizon=10,
            population=64,
            iterations=3,
            seed=seed,
        )
        self.latent = self.world_model.init_state(batch_size=1)
        self.buffer: list[dict] = []
        self.rng = np.random.default_rng(seed)

    def _build_world_model(self):
        """Construct the ensemble world model, sized to the env when known.

        ``ModelConfig``'s default ``obs_dim`` (16*14*14) only matches a 14x14
        grid. Once ``act`` has seen an observation we rebuild with the real
        flattened obs size (e.g. switch_quest's 12x12 grid -> 16*12*12 = 2304)
        so the world model neither zero-pads nor truncates the observation.
        Seeded so rebuilds stay deterministic.
        """
        config = (
            None
            if self._obs_dim is None
            else ModelConfig(obs_dim=self._obs_dim, action_dim=self.config.action_space_n)
        )
        return create_world_model("ensemble", config=config, seed=self.seed)

    def _match_world_model_to_obs(self, obs) -> None:
        """Resize the world model to the env's actual observation on first sight."""
        obs_dim = int(to_numpy_obs(obs).size)
        if obs_dim == self._obs_dim:
            return
        self._obs_dim = obs_dim
        self.world_model = self._build_world_model()
        self.latent = self.world_model.init_state(batch_size=1)

    def reset(self, seed: int | None = None) -> None:
        super().reset(seed)
        if seed is not None:
            self.seed = int(seed)
            self.rng = np.random.default_rng(self.seed)
            self.world_model = self._build_world_model()
            self.planner.reseed(self.seed)
            self.buffer = []
        self.latent = self.world_model.init_state(batch_size=1)
        self.last_imagined_transitions = 0
        self.last_planner_trace = {}

    def act(self, obs, info: dict) -> int:
        del info
        self._match_world_model_to_obs(obs)
        self.latent = self.world_model.observe(self.latent, obs)

        def rollout_fn(state, action_seq):
            rollout = self.world_model.imagine_rollout(state, action_seq)
            score = float(sum(rollout.get("pred_rewards", [])))
            score -= 0.05 * float(rollout.get("uncertainty", 0.0))
            return score, rollout

        result = self.planner.plan(
            root_state=self.latent,
            rollout_fn=rollout_fn,
            clone_state_fn=_clone_state,
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

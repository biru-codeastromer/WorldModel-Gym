from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import torch
from torch import nn
from torch.distributions import Categorical

from worldmodel_agents.base import AgentConfig, BaseAgent


def _to_flat_obs(obs) -> np.ndarray:
    """Flatten an env observation (dict / array) into a 1-D float32 vector."""
    if isinstance(obs, dict):
        if "symbolic" in obs:
            arr = np.asarray(obs["symbolic"], dtype=np.float32)
        elif "rgb" in obs:
            arr = np.asarray(obs["rgb"], dtype=np.float32) / 255.0
        else:
            arr = np.asarray(next(iter(obs.values())), dtype=np.float32)
    else:
        arr = np.asarray(obs, dtype=np.float32)
    return arr.reshape(-1)


@dataclass
class PPOConfig:
    hidden_dim: int = 128
    lr: float = 3e-4
    gamma: float = 0.99
    gae_lambda: float = 0.95
    clip_eps: float = 0.2
    entropy_coef: float = 0.01
    value_coef: float = 0.5
    max_grad_norm: float = 0.5
    update_epochs: int = 4
    minibatch_size: int = 64
    rollout_len: int = 256


@dataclass
class RolloutBuffer:
    """Fixed-purpose on-policy buffer holding one rollout's transitions."""

    obs: list[np.ndarray] = field(default_factory=list)
    actions: list[int] = field(default_factory=list)
    log_probs: list[float] = field(default_factory=list)
    values: list[float] = field(default_factory=list)
    rewards: list[float] = field(default_factory=list)
    dones: list[bool] = field(default_factory=list)

    def __len__(self) -> int:
        return len(self.actions)

    def add(self, obs, action, log_prob, value, reward, done) -> None:
        self.obs.append(obs)
        self.actions.append(int(action))
        self.log_probs.append(float(log_prob))
        self.values.append(float(value))
        self.rewards.append(float(reward))
        self.dones.append(bool(done))

    def clear(self) -> None:
        self.obs.clear()
        self.actions.clear()
        self.log_probs.clear()
        self.values.clear()
        self.rewards.clear()
        self.dones.clear()


class ActorCritic(nn.Module):
    """Shared-trunk MLP with separate policy-logit and value heads."""

    def __init__(self, obs_dim: int, action_dim: int, hidden_dim: int):
        super().__init__()
        self.trunk = nn.Sequential(
            nn.Linear(obs_dim, hidden_dim),
            nn.Tanh(),
            nn.Linear(hidden_dim, hidden_dim),
            nn.Tanh(),
        )
        self.policy_head = nn.Linear(hidden_dim, action_dim)
        self.value_head = nn.Linear(hidden_dim, 1)

    def forward(self, obs: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        features = self.trunk(obs)
        logits = self.policy_head(features)
        value = self.value_head(features).squeeze(-1)
        return logits, value


class ModelFreePPOAgent(BaseAgent):
    """Genuine model-free PPO (Schulman et al., 2017).

    This is a real PPO implementation, not a random stub:

    - An actor-critic MLP (shared trunk, policy + value heads) chooses actions
      by sampling from the categorical policy.
    - Transitions are stored in an on-policy ``RolloutBuffer``.
    - On rollout/episode boundaries the buffer is processed with
      GAE(lambda) advantage estimation, then optimized with the clipped
      surrogate objective, a value (MSE) loss, and an entropy bonus, using
      several epochs of minibatch SGD (Adam).

    Torch is seeded deterministically in :meth:`reset` so two runs with the same
    seed produce identical action sequences and identical updates. The policy
    *is* learned end-to-end from environment reward; nothing here uses privileged
    state or a world model. In a tiny eval budget it will not reach high reward,
    but the update is a correct PPO step that measurably changes policy params.
    """

    def __init__(self, config: AgentConfig | None = None, ppo_config: PPOConfig | None = None):
        super().__init__(config=config)
        self.ppo = ppo_config or PPOConfig()
        self.action_dim = self.config.action_space_n
        self.device = torch.device("cpu")
        self.seed = 0

        self.net: ActorCritic | None = None
        self.optimizer: torch.optim.Optimizer | None = None
        self.obs_dim: int | None = None
        self.buffer = RolloutBuffer()
        self._last_loss: float | None = None
        self._last_step: dict | None = None

    def reset(self, seed: int | None = None) -> None:
        if seed is not None:
            self.seed = int(seed)
        torch.manual_seed(self.seed)
        np.random.seed(self.seed)
        # Rebuild only if the network has not been created yet (preserve learned
        # weights across episodes within a run, but make construction reproducible).
        if self.net is None and self.obs_dim is not None:
            self._build_network(self.obs_dim)
        self.buffer.clear()
        self.last_imagined_transitions = 0
        self.last_planner_trace = {}

    def _build_network(self, obs_dim: int) -> None:
        torch.manual_seed(self.seed)
        self.obs_dim = obs_dim
        self.net = ActorCritic(obs_dim, self.action_dim, self.ppo.hidden_dim).to(self.device)
        self.optimizer = torch.optim.Adam(self.net.parameters(), lr=self.ppo.lr)

    def _ensure_network(self, obs_flat: np.ndarray) -> None:
        if self.net is None:
            self._build_network(obs_flat.shape[0])

    @torch.no_grad()
    def _policy_step(self, obs_flat: np.ndarray) -> tuple[int, float, float]:
        tensor = torch.from_numpy(obs_flat).float().to(self.device).unsqueeze(0)
        logits, value = self.net(tensor)
        dist = Categorical(logits=logits)
        action = dist.sample()
        log_prob = dist.log_prob(action)
        return int(action.item()), float(log_prob.item()), float(value.item())

    def act(self, obs, info: dict) -> int:
        del info
        obs_flat = _to_flat_obs(obs)
        self._ensure_network(obs_flat)
        action, log_prob, value = self._policy_step(obs_flat)
        # Stash so observe() can pair the transition with the policy outputs that
        # produced it (keeps the buffer strictly on-policy).
        self._last_step = {"obs": obs_flat, "action": action, "log_prob": log_prob, "value": value}
        self.last_imagined_transitions = 0
        self.last_planner_trace = {}
        return action

    def observe(self, transition: dict) -> None:
        if self._last_step is None or self.net is None:
            return
        done = bool(transition.get("done", False))
        self.buffer.add(
            self._last_step["obs"],
            self._last_step["action"],
            self._last_step["log_prob"],
            self._last_step["value"],
            float(transition.get("reward", 0.0)),
            done,
        )
        self._last_step = None

        if done or len(self.buffer) >= self.ppo.rollout_len:
            last_obs = transition.get("next_obs")
            bootstrap_value = 0.0
            if not done and last_obs is not None:
                bootstrap_value = self._value_of(_to_flat_obs(last_obs))
            self.update(bootstrap_value=bootstrap_value)
            self.buffer.clear()

    @torch.no_grad()
    def _value_of(self, obs_flat: np.ndarray) -> float:
        tensor = torch.from_numpy(obs_flat).float().to(self.device).unsqueeze(0)
        _logits, value = self.net(tensor)
        return float(value.item())

    def _compute_gae(self, bootstrap_value: float) -> tuple[np.ndarray, np.ndarray]:
        """Generalized Advantage Estimation; returns (advantages, returns)."""
        rewards = np.asarray(self.buffer.rewards, dtype=np.float32)
        values = np.asarray(self.buffer.values, dtype=np.float32)
        dones = np.asarray(self.buffer.dones, dtype=np.float32)
        n = len(rewards)
        advantages = np.zeros(n, dtype=np.float32)
        gae = 0.0
        next_value = float(bootstrap_value)
        for t in reversed(range(n)):
            mask = 1.0 - dones[t]
            delta = rewards[t] + self.ppo.gamma * next_value * mask - values[t]
            gae = delta + self.ppo.gamma * self.ppo.gae_lambda * mask * gae
            advantages[t] = gae
            next_value = values[t]
        returns = advantages + values
        return advantages, returns

    def update(self, bootstrap_value: float = 0.0) -> float | None:
        """Run PPO minibatch SGD on the current rollout buffer.

        Returns the mean total loss over all updates, or ``None`` if there is not
        enough data. Safe to call directly (used by tests).
        """
        if self.net is None or self.optimizer is None or len(self.buffer) < 2:
            return None

        advantages, returns = self._compute_gae(bootstrap_value)

        obs = torch.from_numpy(np.asarray(self.buffer.obs, dtype=np.float32)).to(self.device)
        actions = torch.tensor(self.buffer.actions, dtype=torch.long, device=self.device)
        old_log_probs = torch.tensor(self.buffer.log_probs, dtype=torch.float32, device=self.device)
        adv_t = torch.from_numpy(advantages).to(self.device)
        ret_t = torch.from_numpy(returns).to(self.device)
        # Normalize advantages for a stable surrogate gradient.
        adv_t = (adv_t - adv_t.mean()) / (adv_t.std() + 1e-8)

        n = len(self.buffer)
        batch_size = min(self.ppo.minibatch_size, n)
        losses: list[float] = []

        for _ in range(self.ppo.update_epochs):
            perm = torch.randperm(n, device=self.device)
            for start in range(0, n, batch_size):
                idx = perm[start : start + batch_size]
                logits, values = self.net(obs[idx])
                dist = Categorical(logits=logits)
                new_log_probs = dist.log_prob(actions[idx])
                entropy = dist.entropy().mean()

                ratio = torch.exp(new_log_probs - old_log_probs[idx])
                mb_adv = adv_t[idx]
                surr1 = ratio * mb_adv
                surr2 = (
                    torch.clamp(ratio, 1.0 - self.ppo.clip_eps, 1.0 + self.ppo.clip_eps) * mb_adv
                )
                policy_loss = -torch.min(surr1, surr2).mean()
                value_loss = nn.functional.mse_loss(values, ret_t[idx])

                loss = (
                    policy_loss + self.ppo.value_coef * value_loss - self.ppo.entropy_coef * entropy
                )

                self.optimizer.zero_grad()
                loss.backward()
                nn.utils.clip_grad_norm_(self.net.parameters(), self.ppo.max_grad_norm)
                self.optimizer.step()
                losses.append(float(loss.item()))

        self._last_loss = float(np.mean(losses)) if losses else None
        return self._last_loss

from __future__ import annotations

from typing import Any

import torch

from worldmodel_models.common import ModelConfig, TorchModelBase


class StochasticLatentModel(TorchModelBase):
    def __init__(self, config: ModelConfig | None = None):
        super().__init__(config or ModelConfig())
        c = self.config
        self.obs_encoder = torch.nn.Sequential(
            torch.nn.Linear(c.obs_dim, c.latent_dim),
            torch.nn.ReLU(),
        )
        self.posterior = torch.nn.Linear(c.latent_dim, 2 * c.latent_dim)
        self.prior = torch.nn.Linear(c.latent_dim + c.action_dim, 2 * c.latent_dim)
        self.gru = torch.nn.GRUCell(c.latent_dim, c.latent_dim)

        self.reward_head = torch.nn.Linear(c.latent_dim, 1)
        self.done_head = torch.nn.Linear(c.latent_dim, 1)
        self.obs_head = torch.nn.Linear(c.latent_dim, c.obs_dim)

    def init_state(self, batch_size: int = 1) -> dict[str, torch.Tensor]:
        h = torch.zeros((batch_size, self.config.latent_dim), device=self.device)
        z = torch.zeros((batch_size, self.config.latent_dim), device=self.device)
        return {"h": h, "z": z}

    def observe(self, prev_state: dict[str, torch.Tensor], obs) -> dict[str, torch.Tensor]:
        emb = self.obs_encoder(self._obs_tensor(obs))
        stats = self.posterior(emb)
        mean, logvar = torch.chunk(stats, 2, dim=-1)
        std = torch.exp(0.5 * logvar).clamp(min=1e-4)
        eps = torch.randn_like(std)
        z = mean + eps * std
        h = self.gru(z, prev_state["h"])
        return {"h": h, "z": z, "mean": mean, "logvar": logvar}

    def predict(self, state: dict[str, torch.Tensor], action: int):
        a = self._action_tensor(action)
        prior_stats = self.prior(torch.cat([state["h"], a], dim=-1))
        mean, logvar = torch.chunk(prior_stats, 2, dim=-1)
        std = torch.exp(0.5 * logvar).clamp(min=1e-4)
        eps = torch.randn_like(std)
        z = mean + eps * std
        h = self.gru(z, state["h"])

        pred_reward = self.reward_head(h)
        pred_done_prob = torch.sigmoid(self.done_head(h))
        pred_obs = self.obs_head(h)

        next_state = {"h": h, "z": z, "mean": mean, "logvar": logvar}
        aux = {
            "done_prob": float(pred_done_prob.item()),
            "latent_var": float(std.pow(2).mean().item()),
        }
        return (
            next_state,
            pred_obs.detach().cpu().numpy().reshape(-1),
            float(pred_reward.item()),
            bool(pred_done_prob.item() > 0.5),
            aux,
        )

    def imagine_rollout(self, state: dict[str, torch.Tensor], action_seq) -> dict[str, Any]:
        cur = {k: v.clone() for k, v in state.items() if isinstance(v, torch.Tensor)}
        rewards = []
        dones = []
        variances = []
        for action in action_seq:
            cur, _obs, reward, done, aux = self.predict(cur, int(action))
            rewards.append(reward)
            dones.append(done)
            variances.append(aux.get("latent_var", 0.0))
            if done:
                break

        uncertainty = float(sum(variances) / max(1, len(variances)))
        return {
            "pred_rewards": rewards,
            "pred_dones": dones,
            "uncertainty": uncertainty,
        }

    def update(self, batch: list[dict]) -> dict[str, float]:
        if not batch:
            return {"loss": 0.0, "kl": 0.0}

        self.train()
        total = torch.zeros((), device=self.device)
        kl_total = torch.zeros((), device=self.device)

        for item in batch:
            posterior_state = self.observe(self.init_state(batch_size=1), item["obs"])
            pred_state, _pred_obs, pred_reward, pred_done, _aux = self.predict(
                posterior_state, int(item["action"])
            )
            del pred_state

            target_reward = torch.tensor([item["reward"]], device=self.device)
            target_done = torch.tensor([float(item["done"])], device=self.device)

            reward_loss = (
                (torch.tensor([pred_reward], device=self.device) - target_reward).pow(2).mean()
            )
            done_loss = (
                (torch.tensor([float(pred_done)], device=self.device) - target_done).pow(2).mean()
            )

            mean = posterior_state["mean"]
            logvar = posterior_state["logvar"]
            kl = -0.5 * torch.mean(1 + logvar - mean.pow(2) - logvar.exp())

            total = total + reward_loss + done_loss + 0.1 * kl
            kl_total = kl_total + kl

        total = total / len(batch)
        kl_total = kl_total / len(batch)

        self.optimizer.zero_grad()
        total.backward()
        torch.nn.utils.clip_grad_norm_(self.parameters(), 1.0)
        self.optimizer.step()
        self.eval()

        return {"loss": float(total.item()), "kl": float(kl_total.item())}

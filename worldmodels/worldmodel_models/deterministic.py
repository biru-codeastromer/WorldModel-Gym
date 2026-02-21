from __future__ import annotations

from typing import Any

import torch

from worldmodel_models.common import ModelConfig, TorchModelBase


class DeterministicLatentModel(TorchModelBase):
    def __init__(self, config: ModelConfig | None = None):
        super().__init__(config or ModelConfig())
        c = self.config
        self.obs_encoder = torch.nn.Sequential(
            torch.nn.Linear(c.obs_dim, c.latent_dim),
            torch.nn.ReLU(),
            torch.nn.Linear(c.latent_dim, c.latent_dim),
        )
        self.gru = torch.nn.GRUCell(c.latent_dim, c.latent_dim)
        self.transition = torch.nn.Sequential(
            torch.nn.Linear(c.latent_dim + c.action_dim, c.latent_dim),
            torch.nn.Tanh(),
        )
        self.obs_head = torch.nn.Linear(c.latent_dim, c.obs_dim)
        self.reward_head = torch.nn.Linear(c.latent_dim, 1)
        self.done_head = torch.nn.Linear(c.latent_dim, 1)

    def init_state(self, batch_size: int = 1) -> dict[str, torch.Tensor]:
        latent = torch.zeros(
            (batch_size, self.config.latent_dim), dtype=torch.float32, device=self.device
        )
        return {"latent": latent}

    def observe(self, prev_state: dict[str, torch.Tensor], obs) -> dict[str, torch.Tensor]:
        obs_emb = self.obs_encoder(self._obs_tensor(obs))
        latent = self.gru(obs_emb, prev_state["latent"])
        return {"latent": latent}

    def predict(self, state: dict[str, torch.Tensor], action: int):
        a = self._action_tensor(action)
        x = torch.cat([state["latent"], a], dim=-1)
        next_latent = self.transition(x)

        pred_obs = self.obs_head(next_latent)
        pred_reward = self.reward_head(next_latent)
        pred_done_logit = self.done_head(next_latent)
        pred_done = torch.sigmoid(pred_done_logit)

        next_state = {"latent": next_latent}
        aux = {"done_prob": float(pred_done.item())}
        return (
            next_state,
            pred_obs.detach().cpu().numpy().reshape(-1),
            float(pred_reward.item()),
            bool(pred_done.item() > 0.5),
            aux,
        )

    def imagine_rollout(self, state: dict[str, torch.Tensor], action_seq) -> dict[str, Any]:
        cur = {"latent": state["latent"].clone()}
        rewards = []
        dones = []
        obs = []
        for action in action_seq:
            cur, pred_obs, pred_reward, pred_done, aux = self.predict(cur, int(action))
            rewards.append(pred_reward)
            dones.append(pred_done)
            obs.append(pred_obs)
            if pred_done:
                break

        return {
            "pred_rewards": rewards,
            "pred_dones": dones,
            "pred_obs": obs,
            "uncertainty": 0.0,
        }

    def update(self, batch: list[dict]) -> dict[str, float]:
        if not batch:
            return {"loss": 0.0}

        self.train()
        loss = torch.zeros((), dtype=torch.float32, device=self.device)

        for item in batch:
            state = self.observe(self.init_state(batch_size=1), item["obs"])
            next_state, _pred_obs, pred_reward, pred_done, _aux = self.predict(
                state, int(item["action"])
            )
            del next_state

            target_reward = torch.tensor([item["reward"]], device=self.device)
            target_done = torch.tensor([float(item["done"])], device=self.device)

            reward_loss = (
                (torch.tensor([pred_reward], device=self.device) - target_reward).pow(2).mean()
            )
            done_loss = (
                (torch.tensor([float(pred_done)], device=self.device) - target_done).pow(2).mean()
            )
            loss = loss + reward_loss + done_loss

        loss = loss / len(batch)
        self.optimizer.zero_grad()
        loss.backward()
        torch.nn.utils.clip_grad_norm_(self.parameters(), 1.0)
        self.optimizer.step()
        self.eval()

        return {"loss": float(loss.item())}

from __future__ import annotations

from typing import Any

import numpy as np

from worldmodel_models.common import ModelConfig
from worldmodel_models.deterministic import DeterministicLatentModel


class EnsembleWorldModel:
    def __init__(self, n_models: int = 5, config: ModelConfig | None = None):
        self.models = [DeterministicLatentModel(config=config or ModelConfig()) for _ in range(n_models)]

    def init_state(self, batch_size: int = 1):
        return [m.init_state(batch_size=batch_size) for m in self.models]

    def observe(self, prev_state: list[Any], obs):
        return [m.observe(s, obs) for m, s in zip(self.models, prev_state, strict=False)]

    def predict(self, state: list[Any], action: int):
        outputs = [m.predict(s, action) for m, s in zip(self.models, state, strict=False)]
        next_states = [o[0] for o in outputs]
        obs = np.mean(np.stack([o[1] for o in outputs], axis=0), axis=0)
        rewards = np.array([o[2] for o in outputs], dtype=np.float32)
        dones = np.array([float(o[3]) for o in outputs], dtype=np.float32)

        aux = {
            "reward_std": float(rewards.std()),
            "done_mean": float(dones.mean()),
            "model_rewards": rewards.tolist(),
        }
        return next_states, obs, float(rewards.mean()), bool(dones.mean() > 0.5), aux

    def imagine_rollout(self, state: list[Any], action_seq):
        cur = state
        rewards = []
        dones = []
        uncertainties = []
        for action in action_seq:
            cur, _obs, reward, done, aux = self.predict(cur, int(action))
            rewards.append(reward)
            dones.append(done)
            uncertainties.append(aux.get("reward_std", 0.0))
            if done:
                break
        return {
            "pred_rewards": rewards,
            "pred_dones": dones,
            "uncertainty": float(np.mean(uncertainties) if uncertainties else 0.0),
        }

    def update(self, batch: list[dict]) -> dict[str, float]:
        losses = [m.update(batch) for m in self.models]
        mean_loss = float(np.mean([x.get("loss", 0.0) for x in losses]))
        return {"loss": mean_loss}

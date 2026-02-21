from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import torch


def to_numpy_obs(obs) -> np.ndarray:
    if isinstance(obs, dict):
        if "symbolic" in obs:
            arr = np.asarray(obs["symbolic"], dtype=np.float32)
        elif "rgb" in obs:
            arr = np.asarray(obs["rgb"], dtype=np.float32) / 255.0
        else:
            arr = np.asarray(list(obs.values())[0], dtype=np.float32)
    else:
        arr = np.asarray(obs, dtype=np.float32)
    return arr.reshape(-1)


@dataclass
class ModelConfig:
    obs_dim: int = 16 * 14 * 14
    action_dim: int = 8
    latent_dim: int = 64
    lr: float = 1e-3
    device: str = "cpu"


class TorchModelBase(torch.nn.Module):
    def __init__(self, config: ModelConfig):
        super().__init__()
        self.config = config
        self.device = torch.device(config.device)
        self.to(self.device)
        self.optimizer = torch.optim.Adam(self.parameters(), lr=config.lr)

    def _obs_tensor(self, obs) -> torch.Tensor:
        arr = to_numpy_obs(obs)
        if arr.size != self.config.obs_dim:
            if arr.size < self.config.obs_dim:
                padded = np.zeros((self.config.obs_dim,), dtype=np.float32)
                padded[: arr.size] = arr
                arr = padded
            else:
                arr = arr[: self.config.obs_dim]
        tensor = torch.from_numpy(arr).float().to(self.device)
        return tensor.unsqueeze(0)

    def _action_tensor(self, action: int) -> torch.Tensor:
        idx = max(0, min(self.config.action_dim - 1, int(action)))
        one_hot = torch.zeros((1, self.config.action_dim), dtype=torch.float32, device=self.device)
        one_hot[0, idx] = 1.0
        return one_hot

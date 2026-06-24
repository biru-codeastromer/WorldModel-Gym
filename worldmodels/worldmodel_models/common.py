from __future__ import annotations

import warnings
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


def _resolve_seed(seed: int | torch.Generator | None) -> tuple[int | None, torch.Generator | None]:
    """Normalize a ``seed`` argument into an ``(int_seed, generator)`` pair.

    Accepts ``None`` (non-deterministic), an integer seed, or a pre-built
    ``torch.Generator``. When a generator is passed we cannot recover an integer
    seed, so ``int_seed`` is ``None`` in that case.
    """
    if seed is None:
        return None, None
    if isinstance(seed, torch.Generator):
        return None, seed
    return int(seed), None


class TorchModelBase(torch.nn.Module):
    def __init__(self, config: ModelConfig, seed: int | torch.Generator | None = None):
        super().__init__()
        self.config = config
        self.device = torch.device(config.device)
        self.optimizer: torch.optim.Optimizer | None = None

        int_seed, generator = _resolve_seed(seed)
        self._seed = int_seed
        if generator is not None:
            self._generator = generator
        elif int_seed is not None:
            self._generator = torch.Generator(device="cpu")
            self._generator.manual_seed(int_seed)
        else:
            self._generator = None

    def reset_rng(self) -> None:
        """Reset the sampling RNG back to the construction seed.

        Only has an effect when the model was built with an integer ``seed``.
        Re-seeding makes a subsequent sequence of stochastic ``observe``/
        ``predict``/``update`` calls reproduce identically.
        """
        if self._generator is not None and self._seed is not None:
            self._generator.manual_seed(self._seed)

    def _seed_parameters(self) -> None:
        """Deterministically (re-)initialize all parameters from ``self._generator``.

        Must be called by subclasses after their submodules are built and after
        ``self.to(device)``. When no seed was provided this is a no-op so the
        global-RNG default initialization is preserved.
        """
        if self._generator is None:
            return
        with torch.no_grad():
            for param in self.parameters():
                if param.dim() >= 2:
                    fan_in = param.shape[1]
                    bound = 1.0 / max(fan_in, 1) ** 0.5
                else:
                    bound = 0.0
                if bound > 0.0:
                    flat = torch.empty(param.shape, dtype=param.dtype, device="cpu").uniform_(
                        -bound, bound, generator=self._generator
                    )
                    param.copy_(flat.to(param.device))
                else:
                    param.zero_()

    def _randn_like(self, ref: torch.Tensor) -> torch.Tensor:
        """Sample ``randn`` shaped like ``ref``, using the seeded generator when set."""
        if self._generator is None:
            return torch.randn_like(ref)
        sample = torch.randn(ref.shape, dtype=ref.dtype, device="cpu", generator=self._generator)
        return sample.to(ref.device)

    def initialize_optimizer(self) -> None:
        self.to(self.device)
        self._seed_parameters()
        self.optimizer = torch.optim.Adam(self.parameters(), lr=self.config.lr)

    def _obs_tensor(self, obs) -> torch.Tensor:
        arr = to_numpy_obs(obs)
        if arr.size != self.config.obs_dim:
            warnings.warn(
                f"Observation size {arr.size} does not match configured obs_dim "
                f"{self.config.obs_dim}; "
                + ("zero-padding" if arr.size < self.config.obs_dim else "truncating")
                + " to fit. This may indicate a mis-configured ModelConfig.obs_dim.",
                stacklevel=2,
            )
            if arr.size < self.config.obs_dim:
                padded = np.zeros((self.config.obs_dim,), dtype=np.float32)
                padded[: arr.size] = arr
                arr = padded
            else:
                arr = arr[: self.config.obs_dim].copy()
        tensor = torch.from_numpy(arr).float().to(self.device)
        return tensor.unsqueeze(0)

    def _action_tensor(self, action: int) -> torch.Tensor:
        idx = max(0, min(self.config.action_dim - 1, int(action)))
        one_hot = torch.zeros((1, self.config.action_dim), dtype=torch.float32, device=self.device)
        one_hot[0, idx] = 1.0
        return one_hot

    def save_state(self) -> dict:
        """Return a fully self-contained checkpoint dict for ``load_state``.

        Includes network weights, optimizer state, config, and RNG state so the
        model round-trips exactly (predictions under the same seed are identical
        before and after a save/load cycle).
        """
        gen_state = None if self._generator is None else self._generator.get_state()
        return {
            "model": self.state_dict(),
            "optimizer": None if self.optimizer is None else self.optimizer.state_dict(),
            "config": vars(self.config).copy(),
            "seed": self._seed,
            "generator_state": gen_state,
        }

    def load_state(self, checkpoint: dict) -> None:
        """Restore a checkpoint produced by :meth:`save_state` in place."""
        self.load_state_dict(checkpoint["model"])
        if checkpoint.get("optimizer") is not None and self.optimizer is not None:
            self.optimizer.load_state_dict(checkpoint["optimizer"])
        self._seed = checkpoint.get("seed", self._seed)
        gen_state = checkpoint.get("generator_state")
        if gen_state is not None:
            if self._generator is None:
                self._generator = torch.Generator(device="cpu")
            self._generator.set_state(gen_state)

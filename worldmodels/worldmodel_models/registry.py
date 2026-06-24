from __future__ import annotations

import torch

from worldmodel_models.common import ModelConfig
from worldmodel_models.deterministic import DeterministicLatentModel
from worldmodel_models.ensemble import EnsembleWorldModel
from worldmodel_models.stochastic import StochasticLatentModel


def create_world_model(
    name: str,
    config: ModelConfig | None = None,
    seed: int | torch.Generator | None = None,
):
    """Build a world model by name.

    ``seed`` is optional and backward compatible. When provided (an int or a
    ``torch.Generator``) the returned model uses it for deterministic weight
    initialization and for all stochastic sampling, so two models built with
    the same seed produce identical predictions. The ensemble only accepts an
    integer seed (each member is offset deterministically).
    """
    key = name.lower()
    if key in {"det", "deterministic", "deterministic_mlp"}:
        return DeterministicLatentModel(config=config, seed=seed)
    if key in {"stochastic", "rssm", "rssm_like"}:
        return StochasticLatentModel(config=config, seed=seed)
    if key in {"ensemble", "ensemble_det"}:
        if isinstance(seed, torch.Generator):
            msg = "EnsembleWorldModel requires an integer seed, not a torch.Generator"
            raise TypeError(msg)
        return EnsembleWorldModel(config=config, seed=seed)
    msg = f"Unknown world model: {name}"
    raise ValueError(msg)

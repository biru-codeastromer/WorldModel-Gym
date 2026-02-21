from __future__ import annotations

from worldmodel_models.common import ModelConfig
from worldmodel_models.deterministic import DeterministicLatentModel
from worldmodel_models.ensemble import EnsembleWorldModel
from worldmodel_models.stochastic import StochasticLatentModel


def create_world_model(name: str, config: ModelConfig | None = None):
    key = name.lower()
    if key in {"det", "deterministic", "deterministic_mlp"}:
        return DeterministicLatentModel(config=config)
    if key in {"stochastic", "rssm", "rssm_like"}:
        return StochasticLatentModel(config=config)
    if key in {"ensemble", "ensemble_det"}:
        return EnsembleWorldModel(config=config)
    msg = f"Unknown world model: {name}"
    raise ValueError(msg)

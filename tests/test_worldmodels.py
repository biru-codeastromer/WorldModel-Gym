from __future__ import annotations

import math
import warnings

import numpy as np
import pytest
from worldmodel_models.common import ModelConfig
from worldmodel_models.registry import create_world_model

MODEL_NAMES = ["deterministic", "stochastic", "ensemble"]


def _config() -> ModelConfig:
    return ModelConfig(obs_dim=32, action_dim=4, latent_dim=16)


def _obs() -> np.ndarray:
    return np.random.RandomState(0).randn(32).astype(np.float32)


def _all_finite(values) -> bool:
    flat = np.asarray(values, dtype=np.float64).reshape(-1)
    return bool(np.all(np.isfinite(flat)))


@pytest.mark.parametrize("name", MODEL_NAMES)
def test_observe_predict_shapes_and_finite(name: str):
    model = create_world_model(name, config=_config(), seed=123)
    state = model.observe(model.init_state(), _obs())
    next_state, pred_obs, reward, done, aux = model.predict(state, 1)

    assert isinstance(reward, float)
    assert math.isfinite(reward)
    assert isinstance(done, bool)
    # Deterministic/ensemble return an obs vector; stochastic returns one too.
    assert pred_obs is not None
    assert np.asarray(pred_obs).reshape(-1).shape[0] == 32
    assert _all_finite(pred_obs)
    assert _all_finite([v for v in aux.values() if isinstance(v, (int, float))])


@pytest.mark.parametrize("name", MODEL_NAMES)
def test_imagine_rollout_shapes_and_finite(name: str):
    model = create_world_model(name, config=_config(), seed=123)
    state = model.observe(model.init_state(), _obs())
    actions = [0, 1, 2, 3, 0]
    out = model.imagine_rollout(state, actions)

    assert "pred_rewards" in out
    assert "pred_dones" in out
    assert "uncertainty" in out
    # A rollout may stop early on a predicted done, so it cannot exceed len(actions).
    assert 1 <= len(out["pred_rewards"]) <= len(actions)
    assert len(out["pred_rewards"]) == len(out["pred_dones"])
    assert _all_finite(out["pred_rewards"])
    assert math.isfinite(float(out["uncertainty"]))


@pytest.mark.parametrize("name", MODEL_NAMES)
def test_update_returns_finite_loss(name: str):
    model = create_world_model(name, config=_config(), seed=123)
    obs = _obs()
    batch = [
        {"obs": obs, "action": 1, "reward": 0.5, "done": False},
        {"obs": obs * -1.0, "action": 2, "reward": -0.3, "done": True},
        {"obs": obs + 0.1, "action": 0, "reward": 1.0, "done": False},
    ]
    metrics = model.update(batch)
    assert "loss" in metrics
    assert math.isfinite(metrics["loss"])


@pytest.mark.parametrize("name", MODEL_NAMES)
def test_same_seed_identical_predictions(name: str):
    obs = _obs()
    a = create_world_model(name, config=_config(), seed=2024)
    b = create_world_model(name, config=_config(), seed=2024)

    sa = a.observe(a.init_state(), obs)
    sb = b.observe(b.init_state(), obs)
    _, _, reward_a, _, _ = a.predict(sa, 1)
    _, _, reward_b, _, _ = b.predict(sb, 1)
    assert reward_a == pytest.approx(reward_b, abs=1e-9)


@pytest.mark.parametrize("name", ["deterministic", "stochastic"])
def test_different_seed_differs(name: str):
    obs = _obs()
    a = create_world_model(name, config=_config(), seed=1)
    b = create_world_model(name, config=_config(), seed=2)
    sa = a.observe(a.init_state(), obs)
    sb = b.observe(b.init_state(), obs)
    _, _, reward_a, _, _ = a.predict(sa, 1)
    _, _, reward_b, _, _ = b.predict(sb, 1)
    assert reward_a != pytest.approx(reward_b, abs=1e-9)


def test_ensemble_reports_reward_std_with_multiple_members():
    obs = _obs()
    model = create_world_model("ensemble", config=_config(), seed=7)
    assert len(model.models) > 1
    state = model.observe(model.init_state(), obs)
    _, _, _, _, aux = model.predict(state, 1)
    assert "reward_std" in aux
    assert math.isfinite(aux["reward_std"])
    # Distinct per-member seeds must yield genuinely different members.
    assert aux["reward_std"] > 0.0


@pytest.mark.parametrize("name", MODEL_NAMES)
def test_save_load_roundtrip_reproduces_predictions(name: str):
    obs = _obs()
    model = create_world_model(name, config=_config(), seed=55)
    # Take a training step so optimizer state is non-trivial in the checkpoint.
    model.update([{"obs": obs, "action": 1, "reward": 0.4, "done": False}])

    model.reset_rng()
    s1 = model.observe(model.init_state(), obs)
    _, _, reward_before, _, _ = model.predict(s1, 2)

    checkpoint = model.save_state()

    # Build a fresh model with a *different* seed, then load the checkpoint.
    restored = create_world_model(name, config=_config(), seed=999)
    restored.load_state(checkpoint)
    restored.reset_rng()
    s2 = restored.observe(restored.init_state(), obs)
    _, _, reward_after, _, _ = restored.predict(s2, 2)

    assert reward_after == pytest.approx(reward_before, abs=1e-9)


def test_obs_dim_mismatch_warns():
    model = create_world_model("deterministic", config=_config(), seed=1)
    too_small = np.ones(8, dtype=np.float32)
    with pytest.warns(UserWarning, match="obs_dim"):
        model.observe(model.init_state(), too_small)

    too_large = np.ones(64, dtype=np.float32)
    with pytest.warns(UserWarning, match="obs_dim"):
        model.observe(model.init_state(), too_large)


def test_matching_obs_dim_does_not_warn():
    model = create_world_model("deterministic", config=_config(), seed=1)
    with warnings.catch_warnings():
        warnings.simplefilter("error")
        model.observe(model.init_state(), _obs())

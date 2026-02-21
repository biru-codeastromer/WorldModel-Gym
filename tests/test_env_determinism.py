from __future__ import annotations

import hashlib

import numpy as np
from worldmodel_gym.envs.registry import make_env


def _hash_obs(obs) -> str:
    if isinstance(obs, dict):
        parts = []
        for key in sorted(obs.keys()):
            parts.append(np.asarray(obs[key]).tobytes())
        payload = b"".join(parts)
    else:
        payload = np.asarray(obs).tobytes()
    return hashlib.sha256(payload).hexdigest()


def _check_seed(env_id: str):
    env_a = make_env(env_id, obs_mode="both")
    env_b = make_env(env_id, obs_mode="both")

    obs_a, _ = env_a.reset(seed=123)
    obs_b, _ = env_b.reset(seed=123)
    assert _hash_obs(obs_a) == _hash_obs(obs_b)

    obs_c, _ = env_b.reset(seed=124)
    assert _hash_obs(obs_a) != _hash_obs(obs_c)


def test_memory_maze_seed_determinism():
    _check_seed("memory_maze")


def test_switch_quest_seed_determinism():
    _check_seed("switch_quest")


def test_craft_lite_seed_determinism():
    _check_seed("craft_lite")

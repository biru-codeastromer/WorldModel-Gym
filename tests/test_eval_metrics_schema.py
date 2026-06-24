from __future__ import annotations

import math

from worldmodel_gym.envs.registry import make_env
from worldmodel_gym.eval.metrics import (
    EpisodeStats,
    aggregate_episode_stats,
    bootstrap_ci,
)
from worldmodel_gym.trace.schema import RunMetrics


def test_run_metrics_schema_validation():
    payload = {
        "run_id": "abc123",
        "env": "memory_maze",
        "agent": "random",
        "track": "test",
        "success_rate": 0.5,
        "mean_return": 0.3,
        "median_steps_to_success": 120.0,
        "achievement_completion": {"collect_wood": 0.1},
        "planning_cost": {
            "wall_clock_ms_per_step": 1.2,
            "imagined_transitions": 14.0,
            "peak_memory_mb": 5.0,
        },
        "model_fidelity": {"k1": 0.2, "k5": 0.3, "k10": 0.4},
        "generalization_gap": 0.15,
        "continual_metrics": {
            "forward_transfer": 0.1,
            "backward_transfer": 0.05,
            "forgetting": 0.02,
        },
    }

    parsed = RunMetrics(**payload)
    assert parsed.run_id == "abc123"
    assert parsed.planning_cost["peak_memory_mb"] == 5.0


def test_legacy_payload_still_validates_with_new_optional_fields():
    # A payload WITHOUT any of the new statistical fields must still validate
    # (backward compatibility) and pick up sensible defaults.
    payload = {
        "run_id": "legacy",
        "env": "memory_maze",
        "agent": "random",
        "track": "test",
        "success_rate": 0.5,
        "mean_return": 0.3,
        "median_steps_to_success": None,
        "achievement_completion": {},
        "planning_cost": {},
        "model_fidelity": {},
        "generalization_gap": 0.0,
    }
    parsed = RunMetrics(**payload)
    assert parsed.n_episodes == 0
    assert parsed.n_seeds == 0
    assert parsed.success_rate_ci is None
    assert parsed.mean_return_ci is None
    assert parsed.per_seed_return == {}
    assert parsed.per_seed_success_rate == {}


def test_new_statistical_fields_round_trip():
    parsed = RunMetrics(
        run_id="x",
        env="memory_maze",
        agent="random",
        track="test",
        success_rate=0.5,
        mean_return=0.5,
        median_steps_to_success=10.0,
        achievement_completion={},
        planning_cost={},
        model_fidelity={},
        generalization_gap=0.0,
        n_episodes=8,
        n_seeds=4,
        success_rate_ci=(0.25, 0.75),
        mean_return_ci=(0.2, 0.8),
        per_seed_return={"11": 1.0, "13": 0.0},
        per_seed_success_rate={"11": 1.0, "13": 0.0},
    )
    dumped = parsed.model_dump()
    reparsed = RunMetrics(**dumped)
    assert reparsed.n_seeds == 4
    assert reparsed.success_rate_ci == (0.25, 0.75)
    assert reparsed.per_seed_return["11"] == 1.0


def test_bootstrap_ci_degenerate_cases():
    assert bootstrap_ci([]) is None
    # single sample -> zero-width CI at that value
    assert bootstrap_ci([3.0]) == (3.0, 3.0)
    # all-equal samples -> CI collapses to the constant
    lo, hi = bootstrap_ci([2.0, 2.0, 2.0, 2.0])
    assert lo == 2.0 and hi == 2.0


def test_bootstrap_ci_brackets_mean():
    values = [0.0, 1.0] * 25  # mean 0.5
    lo, hi = bootstrap_ci(values, seed=0)
    assert lo < 0.5 < hi
    # CI must be within the data range [0, 1].
    assert 0.0 <= lo <= hi <= 1.0


def test_aggregate_per_seed_and_counts():
    # Two seeds, two episodes each. Hand-computed aggregates.
    episodes = [
        EpisodeStats(success=True, total_return=1.0, steps=5, seed=11),
        EpisodeStats(success=False, total_return=0.0, steps=20, seed=11),
        EpisodeStats(success=True, total_return=1.0, steps=7, seed=13),
        EpisodeStats(success=True, total_return=1.0, steps=9, seed=13),
    ]
    agg = aggregate_episode_stats(episodes)

    assert agg.n_episodes == 4
    assert agg.n_seeds == 2
    # success_rate = 3/4
    assert math.isclose(agg.success_rate, 0.75)
    # mean_return = 3.0/4
    assert math.isclose(agg.mean_return, 0.75)
    # per-seed: seed 11 -> return mean 0.5, success 0.5 ; seed 13 -> 1.0, 1.0
    assert math.isclose(agg.per_seed_return[11], 0.5)
    assert math.isclose(agg.per_seed_success_rate[11], 0.5)
    assert math.isclose(agg.per_seed_return[13], 1.0)
    assert math.isclose(agg.per_seed_success_rate[13], 1.0)
    # median steps to success over successful episodes [5, 7, 9] = 7
    assert agg.median_steps_to_success == 7.0
    # CIs present and well-formed.
    assert agg.success_rate_ci is not None
    assert agg.success_rate_ci[0] <= agg.success_rate <= agg.success_rate_ci[1]


def test_empty_aggregate_safe():
    agg = aggregate_episode_stats([])
    assert agg.n_episodes == 0
    assert agg.n_seeds == 0
    assert agg.success_rate_ci is None
    assert agg.per_seed_return == {}


def test_oracle_hint_exposes_walls_and_goals():
    # memory_maze: privileged hint must include the full wall grid + goal coords.
    env = make_env("memory_maze", obs_mode="symbolic")
    obs, info = env.reset(seed=123)
    hint = info["oracle_hint"]
    assert "walls" in hint
    assert hint["grid_size"] == env.grid_size
    assert len(hint["walls"]) == env.grid_size
    assert len(hint["walls"][0]) == env.grid_size
    # border is wall.
    assert hint["walls"][0][0] == 1
    assert "goal_pos" in hint and "key_pos" in hint and "door_pos" in hint

    # The normal observation must NOT carry the privileged hint.
    assert not (isinstance(obs, dict) and "walls" in obs)

    # switch_quest exposes switches + next target.
    sq = make_env("switch_quest", obs_mode="symbolic")
    _, sq_info = sq.reset(seed=233)
    sq_hint = sq_info["oracle_hint"]
    assert "walls" in sq_hint
    assert "switches" in sq_hint
    assert "next_target_pos" in sq_hint

    # craft_lite exposes station/gem + resource positions.
    cl = make_env("craft_lite", obs_mode="symbolic")
    _, cl_info = cl.reset(seed=257)
    cl_hint = cl_info["oracle_hint"]
    assert "walls" in cl_hint
    assert "gem_pos" in cl_hint and "station_pos" in cl_hint
    assert "wood_positions" in cl_hint and "rock_positions" in cl_hint


def test_oracle_hint_present_after_step():
    env = make_env("memory_maze", obs_mode="symbolic")
    env.reset(seed=123)
    _, _, _, _, info = env.step(1)
    assert "walls" in info["oracle_hint"]
    assert info["oracle_hint"]["grid_size"] == env.grid_size

from __future__ import annotations

import math

from worldmodel_gym.eval.continual import (
    ContinualSchedule,
    apply_shift_kwargs,
    continual_transfer_metrics,
    phase_scores_to_matrix,
)


def test_phase_scores_to_matrix_groups_by_phase():
    # 6 episodes, 2 per phase -> 3 phases.
    scores = [1.0, 1.0, 0.0, 1.0, 0.0, 0.0]
    phases = phase_scores_to_matrix(scores, shift_every_episodes=2)
    # phase0 mean = 1.0 ; phase1 mean = 0.5 ; phase2 mean = 0.0
    assert phases == [1.0, 0.5, 0.0]


def test_continual_transfer_standard_definitions():
    # Per-episode scores; 2 episodes per phase -> phases [1.0, 0.5, 0.0]
    scores = [1.0, 1.0, 0.0, 1.0, 0.0, 0.0]
    m = continual_transfer_metrics(scores, shift_every_episodes=2)

    # forward_transfer = mean over p>0 of (s_p - s_0)
    #   = ((0.5 - 1.0) + (0.0 - 1.0)) / 2 = (-0.5 + -1.0)/2 = -0.75
    assert math.isclose(m["forward_transfer"], -0.75)
    # backward_transfer = s_last - s_first = 0.0 - 1.0 = -1.0
    assert math.isclose(m["backward_transfer"], -1.0)
    # forgetting = max(0, best - last) = max(0, 1.0 - 0.0) = 1.0
    assert math.isclose(m["forgetting"], 1.0)


def test_continual_transfer_improving_run():
    # phases improve: [0.0, 0.5, 1.0]
    scores = [0.0, 0.0, 0.5, 0.5, 1.0, 1.0]
    m = continual_transfer_metrics(scores, shift_every_episodes=2)
    # forward = ((0.5-0.0)+(1.0-0.0))/2 = 0.75
    assert math.isclose(m["forward_transfer"], 0.75)
    # backward = 1.0 - 0.0 = 1.0
    assert math.isclose(m["backward_transfer"], 1.0)
    # forgetting = max(0, 1.0 - 1.0) = 0.0 (last is also the best)
    assert math.isclose(m["forgetting"], 0.0)


def test_single_phase_has_zero_transfer():
    m = continual_transfer_metrics([1.0, 1.0], shift_every_episodes=5)
    assert m == {"forward_transfer": 0.0, "backward_transfer": 0.0, "forgetting": 0.0}


def test_empty_scores():
    m = continual_transfer_metrics([], shift_every_episodes=4)
    assert m == {"forward_transfer": 0.0, "backward_transfer": 0.0, "forgetting": 0.0}


def test_default_schedule_induces_drift():
    # With the default schedule, advancing the phase index must actually change
    # the environment configuration for every env.
    sched = ContinualSchedule()
    assert sched.shift_every_episodes > 0
    assert sched.shift_strength > 0.0

    base = {"wall_density": 0.16}
    p0 = apply_shift_kwargs(
        base, env_id="memory_maze", shift_idx=0, shift_strength=sched.shift_strength
    )
    p3 = apply_shift_kwargs(
        base, env_id="memory_maze", shift_idx=3, shift_strength=sched.shift_strength
    )
    assert p3["wall_density"] > p0["wall_density"]

    sq0 = apply_shift_kwargs(
        {"wall_density": 0.1},
        env_id="switch_quest",
        shift_idx=0,
        shift_strength=sched.shift_strength,
    )
    sq3 = apply_shift_kwargs(
        {"wall_density": 0.1},
        env_id="switch_quest",
        shift_idx=3,
        shift_strength=sched.shift_strength,
    )
    assert sq3["wall_density"] > sq0["wall_density"]

    cl0 = apply_shift_kwargs(
        {"rock_count": 5}, env_id="craft_lite", shift_idx=0, shift_strength=sched.shift_strength
    )
    cl2 = apply_shift_kwargs(
        {"rock_count": 5}, env_id="craft_lite", shift_idx=2, shift_strength=sched.shift_strength
    )
    assert cl2["rock_count"] > cl0["rock_count"]

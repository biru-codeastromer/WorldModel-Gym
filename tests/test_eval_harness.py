from __future__ import annotations

import numpy as np
from worldmodel_gym.eval.harness import (
    GOAL_EVENTS,
    _reward_prediction_error,
    _trace_has_event,
)


class _CountingWorldModel:
    """Deterministic world model used to hand-check open-loop k-step fidelity.

    - ``init_state`` -> {"c": 0.0}
    - ``observe(state, obs)`` -> sets counter to the (scalar) observation value.
    - ``predict(state, action)`` -> increments the counter and returns it as the
      predicted reward. So from a start whose observation scalar is ``o``, the
      predicted reward at horizon ``k`` (the k-th predict call) is ``o + k``.

    The predicted reward is INDEPENDENT of the action, which is exactly what an
    open-loop rollout exercises: predictions are driven only by the seeded
    belief and the model's own forward dynamics, never by re-observation.
    """

    def init_state(self, batch_size: int = 1):
        return {"c": 0.0}

    def observe(self, prev_state, obs):
        return {"c": float(np.asarray(obs).reshape(-1)[0])}

    def predict(self, state, action: int):
        c = state["c"] + 1.0
        next_state = {"c": c}
        return next_state, np.zeros(1), float(c), False, {}


class _Agent:
    def __init__(self, world_model):
        self.world_model = world_model


def _make_transitions(obs_values, rewards):
    # transition tuple = (obs, action, reward, done, next_obs)
    return [
        (np.array([float(o)]), 0, float(r), False, np.array([float(o)]))
        for o, r in zip(obs_values, rewards)
    ]


def test_open_loop_kstep_does_not_reobserve():
    # Single episode, 3 transitions.
    # obs scalars:    [10, 20, 30]
    # actual rewards: [ 1,  2,  3]  (reward of transition i)
    #
    # The model is seeded ONLY at the start index. From start s with obs o_s,
    # predicted reward at horizon k is o_s + k. If it (wrongly) re-observed each
    # step the predictions would jump to the new obs value; this test pins the
    # open-loop behaviour.
    transitions = _make_transitions([10, 20, 30], [1, 2, 3])
    agent = _Agent(_CountingWorldModel())

    out = _reward_prediction_error(agent, [transitions], ks=(1, 2, 3))

    # k=1 samples: starts 0,1,2 -> pred = obs+1 = 11,21,31 ; actual = r_i = 1,2,3
    #   |11-1| + |21-2| + |31-3| = 10 + 19 + 28 = 57 ; mean = 57/3 = 19.0
    assert out["k1"] == 19.0

    # k=2 samples: starts 0,1 (start 2 has no i+1).
    #   start 0: pred = obs0+2 = 12 ; actual reward at offset1 = r_1 = 2 -> |12-2|=10
    #   start 1: pred = obs1+2 = 22 ; actual reward at offset1 = r_2 = 3 -> |22-3|=19
    #   mean = (10+19)/2 = 14.5
    assert out["k2"] == 14.5

    # k=3 samples: only start 0.
    #   pred = obs0+3 = 13 ; actual reward at offset2 = r_2 = 3 -> |13-3| = 10
    assert out["k3"] == 10.0


def test_episode_shorter_than_k_contributes_nothing():
    # Two episodes of length 2: no k=5 samples exist anywhere.
    ep = _make_transitions([0, 0], [0.0, 0.0])
    agent = _Agent(_CountingWorldModel())
    out = _reward_prediction_error(agent, [ep, ep], ks=(1, 5, 10))
    # length-2 episode yields k1 samples but no k5/k10 samples -> defaults to 0.0
    assert out["k5"] == 0.0
    assert out["k10"] == 0.0
    # k1 still produced: each start s predicts obs(=0)+1 = 1, actual = 0 -> err 1
    assert out["k1"] == 1.0


def test_rollouts_do_not_cross_episode_boundaries():
    # If rollouts leaked across episodes, k=2 from the last index of ep0 would
    # find a "next" reward in ep1. We assert it does not by constructing two
    # length-1 episodes: there can be no k=2 sample at all.
    ep0 = _make_transitions([5], [7.0])
    ep1 = _make_transitions([9], [3.0])
    agent = _Agent(_CountingWorldModel())
    out = _reward_prediction_error(agent, [ep0, ep1], ks=(1, 2))
    assert out["k2"] == 0.0
    # k1: ep0 start pred=5+1=6 vs 7 -> 1 ; ep1 pred=9+1=10 vs 3 -> 7 ; mean=4.0
    assert out["k1"] == 4.0


def test_no_world_model_returns_zeroes():
    out = _reward_prediction_error(object(), [_make_transitions([1], [1.0])], ks=(1, 5))
    assert out == {"k1": 0.0, "k5": 0.0}


def test_trace_has_event():
    trace = {
        "steps": [
            {"events": ["found_key"]},
            {"events": ["goal_reached"]},
        ]
    }
    assert _trace_has_event(trace, "goal_reached")
    assert not _trace_has_event(trace, "switch_chain_complete")


def test_goal_events_cover_all_envs():
    assert GOAL_EVENTS["MemoryMazeEnv"] == "goal_reached"
    assert GOAL_EVENTS["SwitchQuestEnv"] == "switch_chain_complete"
    assert GOAL_EVENTS["CraftLiteEnv"] == "craft_goal_complete"

from __future__ import annotations

import json
import logging
import time
import tracemalloc
import uuid
from pathlib import Path
from typing import Callable

import numpy as np
import yaml

from worldmodel_gym.envs.registry import make_env
from worldmodel_gym.eval.continual import (
    ContinualSchedule,
    apply_shift_kwargs,
    continual_transfer_metrics,
)
from worldmodel_gym.eval.metrics import EpisodeStats, aggregate_episode_stats
from worldmodel_gym.eval.seeds import TEST_SEEDS, TRAIN_SEEDS
from worldmodel_gym.trace.schema import EpisodeTrace, RunMetrics

logger = logging.getLogger(__name__)

# Terminal goal event signalled by each environment on genuine task completion.
GOAL_EVENTS: dict[str, str] = {
    "MemoryMazeEnv": "goal_reached",
    "SwitchQuestEnv": "switch_chain_complete",
    "CraftLiteEnv": "craft_goal_complete",
    # env_id aliases (in case the resolved name differs)
    "memory_maze": "goal_reached",
    "switch_quest": "switch_chain_complete",
    "craft_lite": "craft_goal_complete",
}


def _reward_prediction_error(
    agent, episode_transitions: list[list[tuple]], ks: tuple[int, ...] = (1, 5, 10)
) -> dict[str, float]:
    """Genuine open-loop k-step model fidelity.

    For each start index ``i`` within an episode we seed the world model by
    observing the real observation at ``i``, then roll the model forward ``k``
    steps by feeding its OWN predicted latent state forward (never re-observing
    ground truth). The predicted reward at horizon ``k`` is compared against the
    actual reward ``k`` steps ahead, i.e. the reward of transition ``i+k-1``.

    A separate mean absolute error is accumulated for each ``k``. Episodes
    shorter than ``k`` contribute no samples to that horizon. ``episode_transitions``
    is a list of per-episode transition lists; rollouts never cross episode
    boundaries.
    """
    world_model = getattr(agent, "world_model", None)
    if world_model is None:
        return {f"k{k}": 0.0 for k in ks}

    errors: dict[int, list[float]] = {k: [] for k in ks}
    max_k = max(ks)

    for transitions in episode_transitions:
        n = len(transitions)
        if n == 0:
            continue
        for start in range(n):
            # Seed belief from the real observation at the start index.
            state = world_model.init_state(batch_size=1)
            obs0 = transitions[start][0]
            state = world_model.observe(state, _obs_to_array(obs0))

            pred_state = state
            for offset in range(min(max_k, n - start)):
                action = int(transitions[start + offset][1])
                pred_state, _pred_obs, pred_reward, _pred_done, _aux = world_model.predict(
                    pred_state, action
                )
                k = offset + 1
                if k in errors:
                    actual_reward = float(transitions[start + offset][2])
                    errors[k].append(abs(float(pred_reward) - actual_reward))

    return {f"k{k}": float(np.mean(v)) if v else 0.0 for k, v in errors.items()}


def _obs_to_array(obs):
    if isinstance(obs, dict):
        if "symbolic" in obs:
            return np.asarray(obs["symbolic"])
        if "rgb" in obs:
            return np.asarray(obs["rgb"])
        return np.asarray(list(obs.values())[0])
    return np.asarray(obs)


def evaluate_episodes(
    env_id: str,
    agent,
    seeds: list[int],
    env_kwargs: dict,
    max_episodes: int,
    continual_schedule: ContinualSchedule | None = None,
):
    episodes: list[EpisodeStats] = []
    traces: list[dict] = []
    episode_transitions: list[list[tuple]] = []
    phase_scores: list[float] = []

    # Cover every seed at least once. If max_episodes exceeds the seed count we
    # wrap around (running each seed multiple times); if it is smaller we still
    # ensure no seed is starved by iterating seeds in order. The number of
    # episodes is max(max_episodes, len(seeds)) so success_rate spans all seeds.
    n_episodes = max(int(max_episodes), len(seeds))
    goal_event = GOAL_EVENTS.get(env_id) or GOAL_EVENTS.get(
        make_env(env_id, **env_kwargs).__class__.__name__
    )

    tracemalloc.start()

    for ep_idx in range(n_episodes):
        seed = seeds[ep_idx % len(seeds)]
        kwargs = dict(env_kwargs)

        if continual_schedule is not None:
            shift_idx = ep_idx // continual_schedule.shift_every_episodes
            kwargs = apply_shift_kwargs(
                kwargs,
                env_id=env_id,
                shift_idx=shift_idx,
                shift_strength=continual_schedule.shift_strength,
            )

        env = make_env(env_id, **kwargs)
        obs, info = env.reset(seed=seed)
        info["env_ref"] = env
        agent.reset(seed=seed)

        done = False
        total_return = 0.0
        steps = 0
        imagined_transitions = 0
        step_compute_ms = 0.0
        reached_goal = False
        agent_failed = False
        ep_transitions: list[tuple] = []

        while not done:
            # A misbehaving agent must not crash the whole evaluation run: if
            # act() or observe() raises, terminate THIS episode cleanly, mark it
            # failed, and move on. We deliberately do not let the exception
            # propagate past the per-episode loop.
            t0 = time.perf_counter()
            try:
                action = int(agent.act(obs, info))
            except Exception:
                logger.exception(
                    "agent.act raised on env=%s seed=%s step=%s; marking episode failed",
                    env_id,
                    seed,
                    steps,
                )
                agent_failed = True
                break
            act_ms = (time.perf_counter() - t0) * 1000.0
            step_compute_ms += act_ms

            next_obs, reward, terminated, truncated, info = env.step(action)
            info["env_ref"] = env
            done = bool(terminated or truncated)

            step_events = info.get("events", [])
            if goal_event is not None and goal_event in step_events:
                reached_goal = True

            transition = {
                "obs": obs,
                "action": action,
                "reward": reward,
                "done": done,
                "next_obs": next_obs,
                "events": step_events,
            }
            try:
                agent.observe(transition)
            except Exception:
                logger.exception(
                    "agent.observe raised on env=%s seed=%s step=%s; marking episode failed",
                    env_id,
                    seed,
                    steps,
                )
                agent_failed = True
                break
            planner_trace = {}
            if hasattr(agent, "get_trace"):
                planner_trace = agent.get_trace() or {}
            if getattr(env, "trace_steps", None):
                env.trace_steps[-1].planner = planner_trace

            obs = next_obs
            total_return += reward
            steps += 1
            imagined_transitions += int(getattr(agent, "last_imagined_transitions", 0))
            ep_transitions.append((transition["obs"], action, reward, done, transition["next_obs"]))

        wall_clock_ms = step_compute_ms
        if agent_failed:
            # The agent raised mid-episode. Persist whatever partial trace the
            # env produced so the run is still introspectable, and force a
            # failure regardless of any goal event seen so far.
            if getattr(env, "trace_steps", None):
                trace = EpisodeTrace(
                    env_id=env.__class__.__name__,
                    episode_id=env.episode_id,
                    seed=env.current_seed,
                    steps=env.trace_steps,
                ).model_dump(mode="json")
            else:
                trace = info.get("episode_trace", {"steps": []})
            trace = dict(trace)
            trace["agent_failed"] = True
            traces.append(trace)
            achievements = _extract_achievements(trace)
            success = False
        else:
            if done and getattr(env, "trace_steps", None):
                trace = EpisodeTrace(
                    env_id=env.__class__.__name__,
                    episode_id=env.episode_id,
                    seed=env.current_seed,
                    steps=env.trace_steps,
                ).model_dump(mode="json")
            else:
                trace = info.get("episode_trace", {"steps": []})
            traces.append(trace)
            achievements = _extract_achievements(trace)

            # Honest success: the episode is a success only if the environment
            # signalled its terminal GOAL event. Fall back to scanning the
            # trace's events when we did not observe it live (e.g. trace-only
            # envs).
            if goal_event is not None and not reached_goal:
                reached_goal = _trace_has_event(trace, goal_event)
            success = bool(reached_goal)

        episode_transitions.append(ep_transitions)
        episodes.append(
            EpisodeStats(
                success=success,
                total_return=total_return,
                steps=steps,
                achievements=achievements,
                wall_clock_ms=wall_clock_ms,
                imagined_transitions=imagined_transitions,
                seed=int(seed),
            )
        )
        phase_scores.append(total_return)

    peak_mb = tracemalloc.get_traced_memory()[1] / (1024.0 * 1024.0)
    tracemalloc.stop()

    aggregate = aggregate_episode_stats(episodes)
    aggregate.planning_cost["peak_memory_mb"] = float(peak_mb)

    if continual_schedule is not None:
        continual = continual_transfer_metrics(
            phase_scores, shift_every_episodes=continual_schedule.shift_every_episodes
        )
    else:
        continual = {}

    return {
        "episodes": episodes,
        "aggregate": aggregate,
        "traces": traces,
        "episode_transitions": episode_transitions,
        "continual": continual,
    }


def _trace_has_event(trace: dict, event: str) -> bool:
    for step in trace.get("steps", []):
        if event in step.get("events", []):
            return True
    return False


def _extract_achievements(trace: dict) -> dict[str, int]:
    out: dict[str, int] = {}
    for step in trace.get("steps", []):
        for evt in step.get("events", []):
            if "craft" in evt or "collect" in evt or "break" in evt:
                out[evt] = out.get(evt, 0) + 1
    return out


def build_metrics(
    run_id: str,
    env_id: str,
    agent_name: str,
    track: str,
    train_stats,
    test_stats,
    continual_stats: dict[str, float],
    model_fidelity: dict[str, float],
) -> RunMetrics:
    generalization_gap = train_stats.success_rate - test_stats.success_rate
    return RunMetrics(
        run_id=run_id,
        env=env_id,
        agent=agent_name,
        track=track,
        success_rate=test_stats.success_rate,
        mean_return=test_stats.mean_return,
        median_steps_to_success=test_stats.median_steps_to_success,
        achievement_completion=test_stats.achievement_completion,
        planning_cost=test_stats.planning_cost,
        model_fidelity=model_fidelity,
        generalization_gap=float(generalization_gap),
        continual_metrics=continual_stats,
        n_episodes=test_stats.n_episodes,
        n_seeds=test_stats.n_seeds,
        success_rate_ci=test_stats.success_rate_ci,
        mean_return_ci=test_stats.mean_return_ci,
        per_seed_return={str(k): v for k, v in test_stats.per_seed_return.items()},
        per_seed_success_rate={str(k): v for k, v in test_stats.per_seed_success_rate.items()},
    )


def evaluate_and_write(
    agent_name: str,
    agent_factory: Callable[[str], object],
    env_id: str,
    track: str,
    seeds: list[int] | None,
    max_episodes: int,
    budget: dict,
    out_dir: str = "runs",
    run_id: str | None = None,
) -> tuple[str, Path]:
    run_id = run_id or uuid.uuid4().hex[:12]
    run_dir = Path(out_dir) / run_id
    run_dir.mkdir(parents=True, exist_ok=True)

    env_kwargs = {"obs_mode": "both", "max_steps": int(budget.get("max_steps", 300))}

    if seeds:
        eval_seeds = seeds
    else:
        eval_seeds = (
            TEST_SEEDS.get(env_id, [123, 456])
            if track != "train"
            else TRAIN_SEEDS.get(env_id, [11, 13])
        )

    train_agent = agent_factory(agent_name)
    test_agent = agent_factory(agent_name)

    train_eval = evaluate_episodes(
        env_id=env_id,
        agent=train_agent,
        seeds=TRAIN_SEEDS.get(env_id, [11, 13]),
        env_kwargs=env_kwargs,
        max_episodes=max_episodes,
        continual_schedule=None,
    )

    continual_schedule = ContinualSchedule() if track == "continual" else None
    test_eval = evaluate_episodes(
        env_id=env_id,
        agent=test_agent,
        seeds=eval_seeds,
        env_kwargs=env_kwargs,
        max_episodes=max_episodes,
        continual_schedule=continual_schedule,
    )

    model_fidelity = _reward_prediction_error(test_agent, test_eval["episode_transitions"])

    metrics = build_metrics(
        run_id=run_id,
        env_id=env_id,
        agent_name=agent_name,
        track=track,
        train_stats=train_eval["aggregate"],
        test_stats=test_eval["aggregate"],
        continual_stats=test_eval["continual"],
        model_fidelity=model_fidelity,
    )

    (run_dir / "metrics.json").write_text(metrics.model_dump_json(indent=2), encoding="utf-8")
    with (run_dir / "trace.jsonl").open("w", encoding="utf-8") as f:
        for trace in test_eval["traces"]:
            f.write(json.dumps(trace) + "\n")

    config = {
        "run_id": run_id,
        "agent": agent_name,
        "env": env_id,
        "track": track,
        "seeds": eval_seeds,
        "budget": budget,
    }
    (run_dir / "config.yaml").write_text(yaml.safe_dump(config, sort_keys=False), encoding="utf-8")

    return run_id, run_dir

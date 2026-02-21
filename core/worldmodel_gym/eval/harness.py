from __future__ import annotations

import json
import time
import tracemalloc
import uuid
from pathlib import Path
from typing import Callable

import numpy as np
import yaml

from worldmodel_gym.envs.registry import make_env
from worldmodel_gym.eval.continual import ContinualSchedule, apply_shift_kwargs, continual_transfer_metrics
from worldmodel_gym.eval.metrics import EpisodeStats, aggregate_episode_stats
from worldmodel_gym.eval.seeds import TEST_SEEDS, TRAIN_SEEDS
from worldmodel_gym.trace.schema import EpisodeTrace, RunMetrics


def _reward_prediction_error(agent, transitions: list[tuple], ks: tuple[int, ...] = (1, 5, 10)) -> dict[str, float]:
    world_model = getattr(agent, "world_model", None)
    if world_model is None or not transitions:
        return {f"k{k}": 0.0 for k in ks}

    errors = {k: [] for k in ks}
    state = world_model.init_state(batch_size=1)

    for obs, action, reward, done, _next_obs in transitions:
        state = world_model.observe(state, _obs_to_array(obs))
        pred_state, _pred_obs, pred_reward, pred_done, _aux = world_model.predict(state, int(action))
        state = pred_state
        for k in ks:
            errors[k].append(abs(float(pred_reward) - float(reward)))
            if done or bool(pred_done):
                break

    return {f"k{k}": float(np.mean(v) if v else 0.0) for k, v in errors.items()}


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
    transitions: list[tuple] = []
    phase_scores: list[float] = []

    tracemalloc.start()

    for ep_idx in range(max_episodes):
        seed = seeds[ep_idx % len(seeds)]
        kwargs = dict(env_kwargs)

        if continual_schedule is not None:
            shift_idx = ep_idx // continual_schedule.shift_every_episodes
            kwargs = apply_shift_kwargs(kwargs, env_id=env_id, shift_idx=shift_idx, shift_strength=continual_schedule.shift_strength)

        env = make_env(env_id, **kwargs)
        obs, info = env.reset(seed=seed)
        info["env_ref"] = env
        agent.reset(seed=seed)

        done = False
        total_return = 0.0
        steps = 0
        imagined_transitions = 0
        step_compute_ms = 0.0

        while not done:
            t0 = time.perf_counter()
            action = int(agent.act(obs, info))
            act_ms = (time.perf_counter() - t0) * 1000.0
            step_compute_ms += act_ms

            next_obs, reward, terminated, truncated, info = env.step(action)
            info["env_ref"] = env
            done = bool(terminated or truncated)

            transition = {
                "obs": obs,
                "action": action,
                "reward": reward,
                "done": done,
                "next_obs": next_obs,
                "events": info.get("events", []),
            }
            agent.observe(transition)
            planner_trace = {}
            if hasattr(agent, "get_trace"):
                planner_trace = agent.get_trace() or {}
            if getattr(env, "trace_steps", None):
                env.trace_steps[-1].planner = planner_trace

            obs = next_obs
            total_return += reward
            steps += 1
            imagined_transitions += int(getattr(agent, "last_imagined_transitions", 0))
            transitions.append((transition["obs"], action, reward, done, transition["next_obs"]))

        wall_clock_ms = step_compute_ms
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
        episodes.append(
            EpisodeStats(
                success=total_return > 0.0,
                total_return=total_return,
                steps=steps,
                achievements=achievements,
                wall_clock_ms=wall_clock_ms,
                imagined_transitions=imagined_transitions,
            )
        )
        phase_scores.append(total_return)

    peak_mb = tracemalloc.get_traced_memory()[1] / (1024.0 * 1024.0)
    tracemalloc.stop()

    aggregate = aggregate_episode_stats(episodes)
    aggregate.planning_cost["peak_memory_mb"] = float(peak_mb)

    return {
        "episodes": episodes,
        "aggregate": aggregate,
        "traces": traces,
        "transitions": transitions,
        "continual": continual_transfer_metrics(phase_scores) if continual_schedule else {},
    }


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
) -> tuple[str, Path]:
    run_id = uuid.uuid4().hex[:12]
    run_dir = Path(out_dir) / run_id
    run_dir.mkdir(parents=True, exist_ok=True)

    env_kwargs = {"obs_mode": "both", "max_steps": int(budget.get("max_steps", 300))}

    if seeds:
        eval_seeds = seeds
    else:
        eval_seeds = TEST_SEEDS.get(env_id, [123, 456]) if track != "train" else TRAIN_SEEDS.get(env_id, [11, 13])

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

    model_fidelity = _reward_prediction_error(test_agent, test_eval["transitions"])

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

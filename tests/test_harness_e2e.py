from __future__ import annotations

import json

import pytest
import yaml
from worldmodel_agents.base import AgentConfig, BaseAgent
from worldmodel_agents.registry import create_agent
from worldmodel_gym.eval.harness import evaluate_and_write
from worldmodel_gym.trace.schema import EpisodeTrace, RunMetrics

ENV_IDS = ["memory_maze", "switch_quest", "craft_lite"]


def _random_factory(name: str):
    return create_agent(name)


@pytest.mark.parametrize("env_id", ENV_IDS)
def test_evaluate_and_write_end_to_end(env_id, tmp_path):
    """RandomAgent runs end-to-end on every env and writes schema-valid artifacts."""
    run_id, run_dir = evaluate_and_write(
        agent_name="random",
        agent_factory=_random_factory,
        env_id=env_id,
        track="test",
        seeds=None,
        max_episodes=2,
        budget={"max_steps": 40},
        out_dir=str(tmp_path),
    )

    metrics_path = run_dir / "metrics.json"
    trace_path = run_dir / "trace.jsonl"
    config_path = run_dir / "config.yaml"

    assert metrics_path.exists()
    assert trace_path.exists()
    assert config_path.exists()

    # metrics.json must parse against the RunMetrics schema.
    metrics = RunMetrics(**json.loads(metrics_path.read_text(encoding="utf-8")))
    assert metrics.run_id == run_id
    assert metrics.env == env_id
    assert metrics.agent == "random"
    assert metrics.track == "test"
    assert 0.0 <= metrics.success_rate <= 1.0
    assert metrics.n_episodes >= 1
    assert metrics.n_seeds >= 1

    # trace.jsonl: one JSON object per line, each a schema-valid EpisodeTrace.
    lines = [line for line in trace_path.read_text(encoding="utf-8").splitlines() if line.strip()]
    assert lines, "expected at least one trace line"
    for line in lines:
        obj = json.loads(line)
        assert isinstance(obj, dict)
        # The harness writes EpisodeTrace dumps; they must round-trip through
        # the schema (env_state/planner extras are ignored by pydantic).
        EpisodeTrace(**{k: obj[k] for k in ("env_id", "episode_id", "seed", "steps")})

    # config.yaml carries the run configuration.
    config = yaml.safe_load(config_path.read_text(encoding="utf-8"))
    assert config["run_id"] == run_id
    assert config["env"] == env_id
    assert config["agent"] == "random"
    assert config["track"] == "test"
    assert config["budget"] == {"max_steps": 40}


class _ExplodingAgent(BaseAgent):
    """Agent whose act() always raises, simulating a misbehaving submission."""

    def __init__(self, config: AgentConfig | None = None):
        super().__init__(config=config)

    def reset(self, seed: int | None = None) -> None:
        del seed

    def act(self, obs, info) -> int:
        del obs, info
        raise RuntimeError("simulated agent crash")


def _exploding_factory(name: str):
    del name
    return _ExplodingAgent(config=AgentConfig(action_space_n=8))


def test_misbehaving_agent_is_handled_gracefully(tmp_path):
    """An agent whose act() raises must not crash the run.

    The run completes, every episode is marked failed (success_rate == 0), and
    no exception propagates out of evaluate_and_write.
    """
    run_id, run_dir = evaluate_and_write(
        agent_name="exploder",
        agent_factory=_exploding_factory,
        env_id="memory_maze",
        track="test",
        seeds=None,
        max_episodes=2,
        budget={"max_steps": 40},
        out_dir=str(tmp_path),
    )

    metrics_path = run_dir / "metrics.json"
    trace_path = run_dir / "trace.jsonl"
    assert metrics_path.exists()
    assert trace_path.exists()

    metrics = RunMetrics(**json.loads(metrics_path.read_text(encoding="utf-8")))
    # Every episode failed because act() always raised before any progress.
    assert metrics.success_rate == 0.0
    assert metrics.n_episodes >= 1

    # The failed episodes are recorded (flagged) rather than silently dropped.
    lines = [line for line in trace_path.read_text(encoding="utf-8").splitlines() if line.strip()]
    assert lines, "failed episodes must still be recorded"
    assert all(json.loads(line).get("agent_failed") is True for line in lines)

from __future__ import annotations

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

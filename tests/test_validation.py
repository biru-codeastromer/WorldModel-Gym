from __future__ import annotations

import math

import pytest
from worldmodel_server.validation import (
    METRICS_SCHEMA_VERSION,
    ValidationProblem,
    validate_metrics,
)


def test_minimal_valid_metrics_normalizes_and_returns_version():
    normalized, version = validate_metrics({"success_rate": 0.5})
    assert version == METRICS_SCHEMA_VERSION
    assert normalized["success_rate"] == 0.5
    # Integer-valued metrics are coerced to float on the way out.
    assert isinstance(normalized["success_rate"], float)


def test_success_rate_boundaries_inclusive():
    for value in (0.0, 1.0):
        normalized, _ = validate_metrics({"success_rate": value})
        assert normalized["success_rate"] == value


def test_missing_success_rate_is_rejected():
    with pytest.raises(ValidationProblem) as exc:
        validate_metrics({"mean_return": 0.3})
    fields = {e["field"] for e in exc.value.errors}
    assert "success_rate" in fields


def test_success_rate_above_one_is_physically_impossible():
    with pytest.raises(ValidationProblem) as exc:
        validate_metrics({"success_rate": 1.5})
    msgs = {e["field"]: e["message"] for e in exc.value.errors}
    assert "within [0, 1]" in msgs["success_rate"]


def test_negative_success_rate_rejected():
    with pytest.raises(ValidationProblem):
        validate_metrics({"success_rate": -0.01})


@pytest.mark.parametrize("bad", [float("nan"), float("inf"), float("-inf")])
def test_non_finite_success_rate_rejected(bad):
    with pytest.raises(ValidationProblem) as exc:
        validate_metrics({"success_rate": bad})
    assert exc.value.errors[0]["field"] == "success_rate"


def test_non_finite_mean_return_rejected():
    with pytest.raises(ValidationProblem) as exc:
        validate_metrics({"success_rate": 0.5, "mean_return": float("inf")})
    fields = {e["field"] for e in exc.value.errors}
    assert "mean_return" in fields


def test_bool_is_not_a_valid_number():
    # True would otherwise sneak through as int(1); ensure it is rejected.
    with pytest.raises(ValidationProblem):
        validate_metrics({"success_rate": True})


def test_planning_cost_shape_accepts_finite_numbers():
    normalized, _ = validate_metrics(
        {
            "success_rate": 0.5,
            "planning_cost": {
                "wall_clock_ms_per_step": 1.2,
                "imagined_transitions": 14,
                "peak_memory_mb": 5.0,
            },
        }
    )
    assert normalized["planning_cost"]["imagined_transitions"] == 14.0


def test_planning_cost_must_be_object():
    with pytest.raises(ValidationProblem) as exc:
        validate_metrics({"success_rate": 0.5, "planning_cost": [1, 2, 3]})
    assert any(e["field"] == "planning_cost" for e in exc.value.errors)


def test_planning_cost_non_finite_value_rejected():
    with pytest.raises(ValidationProblem) as exc:
        validate_metrics({"success_rate": 0.5, "planning_cost": {"peak_memory_mb": float("nan")}})
    fields = {e["field"] for e in exc.value.errors}
    assert "planning_cost.peak_memory_mb" in fields


def test_tolerant_of_optional_rich_fields():
    payload = {
        "success_rate": 0.5,
        "mean_return": 0.3,
        "median_steps_to_success": 120.0,
        "generalization_gap": 0.15,
        "model_fidelity": {"k1": 0.2, "k5": 0.3},
        "achievement_completion": {"collect_wood": 0.1},
        "per_seed_return": {"11": 1.0, "13": 0.0},
        "per_seed_success_rate": {"11": 1.0, "13": 0.0},
        "success_rate_ci": [0.25, 0.75],
        "mean_return_ci": (0.2, 0.8),
        # An unknown field is preserved, not rejected.
        "experimental_thing": {"foo": "bar"},
    }
    normalized, version = validate_metrics(payload)
    assert version == METRICS_SCHEMA_VERSION
    assert normalized["success_rate_ci"] == [0.25, 0.75]
    assert normalized["mean_return_ci"] == [0.2, 0.8]
    assert normalized["experimental_thing"] == {"foo": "bar"}


def test_ci_must_be_ordered_pair():
    with pytest.raises(ValidationProblem) as exc:
        validate_metrics({"success_rate": 0.5, "success_rate_ci": [0.8, 0.2]})
    assert any(e["field"] == "success_rate_ci" for e in exc.value.errors)


def test_ci_wrong_arity_rejected():
    with pytest.raises(ValidationProblem):
        validate_metrics({"success_rate": 0.5, "mean_return_ci": [0.1]})


def test_non_dict_input_rejected():
    with pytest.raises(ValidationProblem) as exc:
        validate_metrics([1, 2, 3])
    assert exc.value.errors[0]["field"] == "metrics"


def test_multiple_failures_all_reported():
    with pytest.raises(ValidationProblem) as exc:
        validate_metrics({"success_rate": 2.0, "mean_return": float("nan")})
    fields = {e["field"] for e in exc.value.errors}
    assert {"success_rate", "mean_return"} <= fields


def test_input_not_mutated():
    payload = {"success_rate": 1, "planning_cost": {"a": 2}}
    validate_metrics(payload)
    # Original ints untouched.
    assert payload["success_rate"] == 1
    assert payload["planning_cost"]["a"] == 2


def test_problem_str_summarizes_errors():
    err = ValidationProblem([{"field": "success_rate", "message": "is required"}])
    assert "success_rate" in str(err)


def test_none_optional_fields_skipped():
    # Explicit None on optional numerics is tolerated (treated as absent).
    normalized, _ = validate_metrics(
        {"success_rate": 0.5, "median_steps_to_success": None, "mean_return": None}
    )
    assert math.isclose(normalized["success_rate"], 0.5)

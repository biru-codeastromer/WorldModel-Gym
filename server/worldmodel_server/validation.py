"""Versioned validation for uploaded metrics submissions.

The validator enforces the *physical* invariants a metrics document must satisfy
(``success_rate`` is a probability in ``[0, 1]``, numeric fields are finite, the
optional ``planning_cost`` block is well-shaped) while staying tolerant of the
richer optional fields produced by the eval harness (confidence intervals,
per-seed breakdowns, model-fidelity scores). It returns a normalized dict plus
the schema version it validated against, or raises :class:`ValidationProblem`
listing every failure so the API layer can surface them as RFC 9457 errors.
"""

from __future__ import annotations

import math
from typing import Any

# Bump when the accepted shape changes in a backward-incompatible way. The
# version travels with the validated document (and is persisted on the run) so
# downstream consumers can reason about which rules a submission passed.
METRICS_SCHEMA_VERSION = "1.0"

# Top-level numeric fields that must be finite real numbers when present.
_FINITE_FIELDS = (
    "success_rate",
    "mean_return",
    "median_steps_to_success",
    "generalization_gap",
)

# Sub-dicts whose every value must be a finite number when present.
_FINITE_MAP_FIELDS = (
    "planning_cost",
    "model_fidelity",
    "achievement_completion",
    "per_seed_return",
    "per_seed_success_rate",
)


class ValidationProblem(Exception):  # noqa: N818 - public contract name (not "...Error")
    """Raised when a metrics document fails validation.

    ``errors`` is a list of ``{"field": ..., "message": ...}`` dicts describing
    every failure (validation does not short-circuit on the first one), so the
    caller can render a complete problem document.
    """

    def __init__(self, errors: list[dict[str, str]]) -> None:
        self.errors = errors
        summary = "; ".join(f"{e['field']}: {e['message']}" for e in errors)
        super().__init__(summary or "metrics validation failed")


def _is_finite_number(value: Any) -> bool:
    # bool is a subclass of int; reject it so True/False can't masquerade as a
    # metric value.
    if isinstance(value, bool):
        return False
    if not isinstance(value, (int, float)):
        return False
    return math.isfinite(float(value))


def validate_metrics(
    metrics: Any,
) -> tuple[dict[str, Any], str]:
    """Validate and normalize an uploaded metrics dict.

    Returns ``(normalized_metrics, METRICS_SCHEMA_VERSION)`` on success.
    Raises :class:`ValidationProblem` (with the full list of failures) otherwise.
    The input is not mutated; a shallow-normalized copy is returned.
    """

    errors: list[dict[str, str]] = []

    if not isinstance(metrics, dict):
        raise ValidationProblem([{"field": "metrics", "message": "must be a JSON object"}])

    normalized: dict[str, Any] = dict(metrics)

    # --- success_rate: required probability in [0, 1] ---
    if "success_rate" not in normalized:
        errors.append({"field": "success_rate", "message": "is required"})
    else:
        sr = normalized["success_rate"]
        if not _is_finite_number(sr):
            errors.append({"field": "success_rate", "message": "must be a finite number"})
        else:
            sr = float(sr)
            if sr < 0.0 or sr > 1.0:
                errors.append(
                    {
                        "field": "success_rate",
                        "message": "must be within [0, 1]",
                    }
                )
            else:
                normalized["success_rate"] = sr

    # --- other top-level numeric fields: finite when present ---
    for field in _FINITE_FIELDS:
        if field == "success_rate":
            continue
        if field not in normalized or normalized[field] is None:
            continue
        value = normalized[field]
        if not _is_finite_number(value):
            errors.append({"field": field, "message": "must be a finite number"})
        else:
            normalized[field] = float(value)

    # --- planning_cost / model_fidelity / per-seed maps: finite numbers ---
    for field in _FINITE_MAP_FIELDS:
        if field not in normalized or normalized[field] is None:
            continue
        block = normalized[field]
        if not isinstance(block, dict):
            errors.append({"field": field, "message": "must be an object of numbers"})
            continue
        cleaned: dict[str, float] = {}
        bad = False
        for key, value in block.items():
            if not _is_finite_number(value):
                errors.append(
                    {
                        "field": f"{field}.{key}",
                        "message": "must be a finite number",
                    }
                )
                bad = True
            else:
                cleaned[str(key)] = float(value)
        if not bad:
            normalized[field] = cleaned

    # --- confidence intervals: ordered, finite pairs when present ---
    for field in ("success_rate_ci", "mean_return_ci"):
        if field not in normalized or normalized[field] is None:
            continue
        ci = normalized[field]
        if not isinstance(ci, (list, tuple)) or len(ci) != 2:
            errors.append({"field": field, "message": "must be a [low, high] pair"})
            continue
        low, high = ci
        if not (_is_finite_number(low) and _is_finite_number(high)):
            errors.append({"field": field, "message": "bounds must be finite numbers"})
        elif float(low) > float(high):
            errors.append({"field": field, "message": "low bound exceeds high bound"})
        else:
            normalized[field] = [float(low), float(high)]

    if errors:
        raise ValidationProblem(errors)

    return normalized, METRICS_SCHEMA_VERSION

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class PlanningResult:
    action: int
    value: float
    imagined_transitions: int
    trace: dict[str, Any] = field(default_factory=dict)

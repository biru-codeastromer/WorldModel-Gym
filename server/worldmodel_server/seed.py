from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from worldmodel_server.models import RunEntry
from worldmodel_server.storage import save_run_artifact, storage_status

DEMO_RUNS = [
    {
        "id": "demo_mpc_test",
        "env": "memory_maze",
        "agent": "demo-mpc",
        "track": "test",
        "success_rate": 0.84,
        "mean_return": 12.4,
        "planning_cost": 18.6,
        "created_offset_hours": 18,
    },
    {
        "id": "demo_mcts_test",
        "env": "switch_quest",
        "agent": "demo-mcts",
        "track": "test",
        "success_rate": 0.67,
        "mean_return": 8.9,
        "planning_cost": 26.1,
        "created_offset_hours": 12,
    },
    {
        "id": "demo_oracle_train",
        "env": "craft_lite",
        "agent": "demo-oracle",
        "track": "train",
        "success_rate": 0.95,
        "mean_return": 15.7,
        "planning_cost": 9.4,
        "created_offset_hours": 8,
    },
    {
        "id": "demo_random_continual",
        "env": "memory_maze",
        "agent": "demo-random",
        "track": "continual",
        "success_rate": 0.28,
        "mean_return": 2.1,
        "planning_cost": 5.8,
        "created_offset_hours": 4,
    },
]


def seed_demo_runs(session: Session, *, force: bool = False) -> int:
    existing_uploaded = session.scalars(
        select(RunEntry.id).where(RunEntry.status == "uploaded").limit(1)
    ).first()
    if existing_uploaded and not force:
        return 0

    created_count = 0
    now = datetime.now(UTC).replace(tzinfo=None)

    for spec in DEMO_RUNS:
        item = session.get(RunEntry, spec["id"])
        if item and not force:
            continue
        if item and force:
            session.delete(item)
            session.flush()

        metrics = {
            "success_rate": spec["success_rate"],
            "mean_return": spec["mean_return"],
            "planning_cost": {
                "wall_clock_ms_per_step": spec["planning_cost"],
            },
            "notes": "Synthetic seeded benchmark data for demo and smoke-test flows.",
        }
        trace_lines = "\n".join(
            json.dumps(
                {
                    "step": step,
                    "observation": f"latent_state_{step}",
                    "action": action,
                    "reward": reward,
                }
            )
            for step, action, reward in (
                (0, "scan", 0.0),
                (1, "plan", 0.1),
                (2, "commit", spec["mean_return"]),
            )
        )
        config_text = (
            f"env: {spec['env']}\n"
            f"agent: {spec['agent']}\n"
            f"track: {spec['track']}\n"
            "seeded: true\n"
        )

        save_run_artifact(spec["id"], "metrics.json", json.dumps(metrics, indent=2).encode("utf-8"))
        trace_key = save_run_artifact(spec["id"], "trace.jsonl", f"{trace_lines}\n".encode("utf-8"))
        config_key = save_run_artifact(spec["id"], "config.yaml", config_text.encode("utf-8"))

        created_at = now - timedelta(hours=int(spec["created_offset_hours"]))
        session.add(
            RunEntry(
                id=str(spec["id"]),
                env=str(spec["env"]),
                agent=str(spec["agent"]),
                track=str(spec["track"]),
                status="uploaded",
                metrics_json=json.dumps(metrics),
                trace_path=trace_key,
                config_path=config_key,
                storage_backend=storage_status()["backend"],
                created_by="demo-seed",
                created_at=created_at,
                updated_at=created_at,
            )
        )
        created_count += 1

    session.commit()
    return created_count

from __future__ import annotations

import time
import uuid
from pathlib import Path

import httpx
from worldmodel_agents.registry import create_agent
from worldmodel_gym.eval.harness import evaluate_and_write

API = "http://localhost:8000"
TOKEN = "dev-token"


def wait_for_server(timeout_s: int = 60) -> None:
    deadline = time.time() + timeout_s
    with httpx.Client(timeout=2.0) as client:
        while time.time() < deadline:
            try:
                res = client.get(f"{API}/healthz")
                if res.status_code == 200:
                    return
            except httpx.HTTPError:
                pass
            time.sleep(1)
    raise RuntimeError("Server did not become ready in time")


def main() -> None:
    wait_for_server()
    run_id = uuid.uuid4().hex[:12]

    with httpx.Client(timeout=30.0) as client:
        create = client.post(
            f"{API}/api/runs",
            json={"id": run_id, "env": "memory_maze", "agent": "random", "track": "test"},
        )
        create.raise_for_status()

    _, run_dir = evaluate_and_write(
        agent_name="random",
        agent_factory=lambda name: create_agent(name),
        env_id="memory_maze",
        track="test",
        seeds=[211, 223],
        max_episodes=2,
        budget={"max_steps": 120},
        out_dir="runs",
        run_id=run_id,
    )

    files = {
        "metrics_file": (
            "metrics.json",
            (run_dir / "metrics.json").read_bytes(),
            "application/json",
        ),
        "trace_file": ("trace.jsonl", (run_dir / "trace.jsonl").read_bytes(), "application/json"),
        "config_file": ("config.yaml", (run_dir / "config.yaml").read_bytes(), "text/yaml"),
    }

    with httpx.Client(timeout=60.0) as client:
        upload = client.post(
            f"{API}/api/runs/{run_id}/upload",
            files=files,
            headers={"x-upload-token": TOKEN},
        )
        upload.raise_for_status()

        leaderboard = client.get(f"{API}/api/leaderboard?track=test")
        leaderboard.raise_for_status()

    print(f"Demo run uploaded: {run_id}")
    print("Leaderboard entries:", len(leaderboard.json()))
    print("Run artifacts:", Path(run_dir).resolve())


if __name__ == "__main__":
    main()

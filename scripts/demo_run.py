from __future__ import annotations

import argparse
import os
import time
import uuid
from pathlib import Path

import httpx
from worldmodel_agents.registry import create_agent
from worldmodel_gym.eval.harness import evaluate_and_write

API = os.getenv("WMG_API_BASE", "http://localhost:8000")
TOKEN = os.getenv("WMG_UPLOAD_TOKEN", "dev-token")
API_KEY = os.getenv("WMG_API_KEY")


def auth_headers(api_key: str | None, upload_token: str) -> dict[str, str]:
    if api_key:
        return {"x-api-key": api_key}
    return {"x-upload-token": upload_token}


def wait_for_server(api_base: str, timeout_s: int = 60) -> None:
    deadline = time.time() + timeout_s
    with httpx.Client(timeout=2.0) as client:
        while time.time() < deadline:
            try:
                res = client.get(f"{api_base}/healthz")
                if res.status_code == 200:
                    return
            except httpx.HTTPError:
                pass
            time.sleep(1)
    raise RuntimeError("Server did not become ready in time")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Create and upload a demo benchmark run.")
    parser.add_argument("--api-base", default=API)
    parser.add_argument("--api-key", default=API_KEY)
    parser.add_argument("--upload-token", default=TOKEN)
    parser.add_argument("--env", default="memory_maze")
    parser.add_argument("--agent", default="random")
    parser.add_argument("--track", default="test")
    parser.add_argument("--run-id", default="")
    parser.add_argument("--wait-timeout", type=int, default=60)
    return parser


def main() -> None:
    args = build_parser().parse_args()
    wait_for_server(args.api_base, timeout_s=args.wait_timeout)
    run_id = args.run_id or uuid.uuid4().hex[:12]

    with httpx.Client(timeout=30.0) as client:
        create = client.post(
            f"{args.api_base}/api/runs",
            json={"id": run_id, "env": args.env, "agent": args.agent, "track": args.track},
            headers=auth_headers(args.api_key, args.upload_token),
        )
        create.raise_for_status()

    _, run_dir = evaluate_and_write(
        agent_name=args.agent,
        agent_factory=lambda name: create_agent(name),
        env_id=args.env,
        track=args.track,
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
            f"{args.api_base}/api/runs/{run_id}/upload",
            files=files,
            headers=auth_headers(args.api_key, args.upload_token),
        )
        upload.raise_for_status()

        leaderboard = client.get(f"{args.api_base}/api/leaderboard?track={args.track}")
        leaderboard.raise_for_status()

    print(f"Demo run uploaded: {run_id}")
    print(f"API: {args.api_base}")
    print(f"Track: {args.track}")
    print("Leaderboard entries:", len(leaderboard.json()))
    print("Run artifacts:", Path(run_dir).resolve())


if __name__ == "__main__":
    main()

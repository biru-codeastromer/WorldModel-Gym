from __future__ import annotations

import argparse

from worldmodel_gym.eval.harness import evaluate_and_write


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run WorldModel Gym evaluations")
    parser.add_argument("--agent", required=True, type=str)
    parser.add_argument("--env", required=True, type=str)
    parser.add_argument("--track", default="test", choices=["train", "test", "continual"])
    parser.add_argument("--seeds", default="", type=str)
    parser.add_argument("--budget", default="", type=str, help="comma-separated key=value pairs")
    parser.add_argument("--max-episodes", default=2, type=int)
    return parser.parse_args()


def _parse_budget(raw: str) -> dict:
    if not raw:
        return {"max_steps": 300}
    out: dict[str, int | float] = {}
    for item in raw.split(","):
        key, val = item.split("=", 1)
        out[key] = int(val) if val.isdigit() else float(val)
    if "max_steps" not in out:
        out["max_steps"] = 300
    return out


def _agent_factory(name: str):
    from worldmodel_agents.registry import create_agent

    return create_agent(name)


def main() -> None:
    args = _parse_args()
    seed_list = [int(s.strip()) for s in args.seeds.split(",") if s.strip()] or None
    budget = _parse_budget(args.budget)

    run_id, run_dir = evaluate_and_write(
        agent_name=args.agent,
        agent_factory=_agent_factory,
        env_id=args.env,
        track=args.track,
        seeds=seed_list,
        max_episodes=args.max_episodes,
        budget=budget,
    )
    print(f"run_id={run_id}")
    print(f"artifacts={run_dir}")


if __name__ == "__main__":
    main()

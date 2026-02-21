from __future__ import annotations

import subprocess



def run_local_submission(agent: str, env: str, track: str = "test") -> int:
    cmd = [
        "python",
        "-m",
        "worldmodel_gym.eval.run",
        "--agent",
        agent,
        "--env",
        env,
        "--track",
        track,
        "--max-episodes",
        "2",
    ]
    return subprocess.call(cmd)


if __name__ == "__main__":
    raise SystemExit(run_local_submission(agent="random", env="memory_maze"))

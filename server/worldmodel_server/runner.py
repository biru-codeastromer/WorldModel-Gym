"""Async benchmark job tier.

The heavy lifting (running an evaluation and recording results) lives in
``run_benchmark_job``. It is deliberately import-light at module scope so it can
be enqueued onto an RQ queue and executed inside a worker process that does not
import the FastAPI app.

Redis / RQ are OPTIONAL. ``get_queue`` returns ``None`` whenever Redis is not
configured (or the optional deps are missing), and every queue-touching helper
degrades gracefully so the server keeps working on sqlite + in-process fallback.
"""

from __future__ import annotations

import json
import logging
import subprocess
import tempfile
from pathlib import Path

from worldmodel_server.config import settings

logger = logging.getLogger(__name__)

# RunEntry.status state machine (see SHARED CONTRACT):
#   created -> queued -> running -> completed | failed
STATUS_QUEUED = "queued"
STATUS_RUNNING = "running"
STATUS_COMPLETED = "completed"
STATUS_FAILED = "failed"

# Statuses for which a run is considered "in flight" and must NOT be
# re-enqueued (idempotency guard).
ACTIVE_STATUSES = frozenset({STATUS_QUEUED, STATUS_RUNNING})

# Default evaluation budget for a server-orchestrated run. Kept small so a
# queued job finishes quickly; callers can override via ``max_episodes``.
DEFAULT_MAX_EPISODES = 2
DEFAULT_MAX_STEPS = 120


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


# --------------------------------------------------------------------------- #
# Optional Redis / RQ plumbing
# --------------------------------------------------------------------------- #


def _redis_url() -> str:
    return settings.redis_url or ""


def get_redis_connection():
    """Return a redis client for the configured URL, or ``None``.

    Guarded import: a missing ``redis`` dependency or an empty WMG_REDIS_URL
    both yield ``None`` rather than raising, so callers can branch on it.
    """
    url = _redis_url()
    if not url:
        return None
    try:
        import redis  # type: ignore
    except ImportError:  # pragma: no cover - redis is installed in this env
        logger.warning("redis package is not installed; job queue disabled")
        return None
    try:
        return redis.Redis.from_url(url)
    except Exception as exc:  # noqa: BLE001 - any failure => queue disabled
        logger.warning("could not build redis client (%s); job queue disabled", exc)
        return None


def get_queue(connection=None):
    """Return an RQ ``Queue`` bound to the configured Redis, or ``None``.

    Returns ``None`` when the queue is not active (WMG_QUEUE_ENABLED false or
    WMG_REDIS_URL unset) or when the optional ``rq`` dependency is missing. A
    caller-supplied ``connection`` (e.g. fakeredis in tests) bypasses the
    settings-derived connection so the queue can be exercised without a real
    Redis or the WMG_QUEUE_ENABLED flag.
    """
    if connection is None:
        if not settings.queue_active:
            return None
        connection = get_redis_connection()
        if connection is None:
            return None
    try:
        from rq import Queue  # type: ignore
    except ImportError:  # pragma: no cover - rq is installed in this env
        logger.warning("rq package is not installed; job queue disabled")
        return None
    return Queue(settings.queue_name, connection=connection)


def _job_id(run_id: str) -> str:
    # RQ job ids may only contain letters, numbers, underscores and dashes.
    return f"run-{run_id}"


def enqueue_run(
    run_id: str,
    agent: str,
    env: str,
    track: str,
    *,
    max_episodes: int = DEFAULT_MAX_EPISODES,
    queue=None,
) -> bool:
    """Enqueue ``run_benchmark_job`` for ``run_id``; idempotent on run_id.

    Uses a deterministic RQ job id (``run:<run_id>``). If a job for the run is
    already queued or running we do NOT enqueue a duplicate and return ``False``;
    a freshly enqueued job returns ``True``. Returns ``False`` when no queue is
    available (Redis/queue disabled).
    """
    q = queue if queue is not None else get_queue()
    if q is None:
        return False

    job_id = _job_id(run_id)
    try:
        from rq.exceptions import NoSuchJobError  # type: ignore
        from rq.job import Job  # type: ignore

        try:
            existing = Job.fetch(job_id, connection=q.connection)
        except NoSuchJobError:
            existing = None
        if existing is not None and existing.get_status(refresh=True) in {
            "queued",
            "started",
            "deferred",
            "scheduled",
        }:
            # Already in flight: do not double-enqueue.
            return False
    except ImportError:  # pragma: no cover - rq is installed in this env
        pass

    q.enqueue(
        run_benchmark_job,
        kwargs={
            "run_id": run_id,
            "agent": agent,
            "env": env,
            "track": track,
            "max_episodes": max_episodes,
        },
        job_id=job_id,
    )
    return True


# --------------------------------------------------------------------------- #
# The actual job
# --------------------------------------------------------------------------- #


def _set_status(run_id: str, status: str, **fields) -> None:
    """Update a RunEntry's status (and optional columns) in its own session.

    Imported lazily so the worker process does not pull in the DB layer until a
    job actually runs. Safe to call even if the row does not exist yet.
    """
    from worldmodel_server.db import SessionLocal
    from worldmodel_server.models import RunEntry

    with SessionLocal() as session:
        item = session.get(RunEntry, run_id)
        if item is None:
            logger.warning("run %s not found while setting status=%s", run_id, status)
            return
        item.status = status
        for key, value in fields.items():
            setattr(item, key, value)
        session.add(item)
        session.commit()


def run_benchmark_job(
    run_id: str,
    agent: str,
    env: str,
    track: str = "test",
    *,
    max_episodes: int = DEFAULT_MAX_EPISODES,
    max_steps: int = DEFAULT_MAX_STEPS,
) -> dict:
    """Run a real evaluation for ``run_id`` and record the results.

    Transitions ``RunEntry.status`` queued -> running -> completed|failed and,
    on success, persists the produced metrics/trace/config artifacts through the
    storage layer (so the row works on both local and S3 backends) and updates
    the denormalized leaderboard columns.

    Returns a small result dict (also used as the RQ job return value). Re-raises
    on failure AFTER marking the run failed, so the worker records the failure.
    """
    from worldmodel_gym.eval.harness import evaluate_and_write

    from worldmodel_server.storage import save_run_artifact, storage_status

    _set_status(run_id, STATUS_RUNNING)

    try:
        with tempfile.TemporaryDirectory(prefix=f"wmg-run-{run_id}-") as tmp:

            def _factory(name: str):
                from worldmodel_agents.registry import create_agent

                return create_agent(name)

            _, produced_dir = evaluate_and_write(
                agent_name=agent,
                agent_factory=_factory,
                env_id=env,
                track=track,
                seeds=None,
                max_episodes=max_episodes,
                budget={"max_steps": max_steps},
                out_dir=tmp,
                run_id=run_id,
            )
            produced_dir = Path(produced_dir)

            metrics_bytes = (produced_dir / "metrics.json").read_bytes()
            trace_bytes = (produced_dir / "trace.jsonl").read_bytes()
            config_bytes = (produced_dir / "config.yaml").read_bytes()

            save_run_artifact(run_id, "metrics.json", metrics_bytes)
            trace_key = save_run_artifact(run_id, "trace.jsonl", trace_bytes)
            config_key = save_run_artifact(run_id, "config.yaml", config_bytes)

        metrics = json.loads(metrics_bytes.decode("utf-8"))
        success_rate = _coerce_float(metrics.get("success_rate"))
        mean_return = _coerce_float(metrics.get("mean_return"))

        _set_status(
            run_id,
            STATUS_COMPLETED,
            metrics_json=json.dumps(metrics),
            success_rate=success_rate,
            mean_return=mean_return,
            trace_path=trace_key,
            config_path=config_key,
            storage_backend=storage_status()["backend"],
        )
    except Exception:  # noqa: BLE001 - record failure, then re-raise
        logger.exception("benchmark job for run %s failed", run_id)
        _set_status(run_id, STATUS_FAILED)
        raise

    return {
        "run_id": run_id,
        "status": STATUS_COMPLETED,
        "success_rate": success_rate,
        "mean_return": mean_return,
    }


def _coerce_float(value: object) -> float:
    try:
        return float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return 0.0


if __name__ == "__main__":
    raise SystemExit(run_local_submission(agent="random", env="memory_maze"))

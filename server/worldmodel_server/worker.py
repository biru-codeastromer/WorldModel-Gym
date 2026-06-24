"""RQ worker entrypoint for the async benchmark job tier.

Start a worker that drains the configured queue with::

    python -m worldmodel_server.worker

Redis / RQ are OPTIONAL dependencies: if WMG_REDIS_URL is unset or the optional
packages are missing, the worker exits with a clear, non-zero status instead of
crashing with an import error. The web server keeps working without a worker --
queueing just stays disabled (see runner.get_queue).
"""

from __future__ import annotations

import logging
import sys

from worldmodel_server.config import settings
from worldmodel_server.request_logging import configure_logging

logger = logging.getLogger(__name__)


def run_worker(burst: bool = False) -> int:
    """Start an RQ worker on the configured Redis queue.

    Returns a process exit code. ``burst=True`` drains the queue once and
    returns (used by tests / one-shot runs); the default blocks and serves jobs
    until interrupted.
    """
    configure_logging()

    if not settings.redis_url:
        logger.error(
            "WMG_REDIS_URL is not set; cannot start the queue worker. "
            "Configure Redis to enable the async job tier."
        )
        return 2

    try:
        from rq import Queue, Worker  # type: ignore
    except ImportError:
        logger.error("rq package is not installed; cannot start the queue worker.")
        return 2

    from worldmodel_server.runner import get_redis_connection

    connection = get_redis_connection()
    if connection is None:
        logger.error("could not connect to Redis at WMG_REDIS_URL; worker not started.")
        return 2

    queue = Queue(settings.queue_name, connection=connection)
    worker = Worker([queue], connection=connection)
    logger.info(
        "starting RQ worker on queue %r (redis configured, burst=%s)",
        settings.queue_name,
        burst,
    )
    worker.work(burst=burst, with_scheduler=False)
    return 0


def main() -> int:
    burst = "--burst" in sys.argv[1:]
    return run_worker(burst=burst)


if __name__ == "__main__":
    raise SystemExit(main())

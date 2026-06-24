from __future__ import annotations

import itertools
import logging
import threading
import time
from collections import defaultdict, deque
from dataclasses import dataclass
from threading import Lock

logger = logging.getLogger("worldmodel.rate_limit")

WINDOW_SECONDS = 60


@dataclass(frozen=True)
class RateLimitResult:
    allowed: bool
    remaining: int
    retry_after: int


class SlidingWindowRateLimiter:
    """In-process sliding-window limiter.

    Not shared across replicas, but used as a graceful fallback whenever Redis
    is not configured or is unreachable. Empty buckets are evicted so the
    backing dict cannot grow without bound from one-off keys (e.g. unique IPs).
    """

    def __init__(self, window_seconds: int = WINDOW_SECONDS) -> None:
        self.window_seconds = window_seconds
        self._events: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def _evict_locked(self, now: float) -> None:
        # Drop keys whose entire window has expired so the dict stays bounded.
        cutoff = now - self.window_seconds
        stale = [key for key, bucket in self._events.items() if not bucket or bucket[-1] <= cutoff]
        for key in stale:
            del self._events[key]

    def hit(self, key: str, limit_per_minute: int) -> RateLimitResult:
        now = time.time()
        cutoff = now - self.window_seconds

        with self._lock:
            bucket = self._events[key]
            while bucket and bucket[0] <= cutoff:
                bucket.popleft()

            if len(bucket) >= limit_per_minute:
                retry_after = max(1, int(self.window_seconds - (now - bucket[0])))
                # Opportunistically evict other stale buckets on the rejection path.
                if not bucket:
                    del self._events[key]
                self._evict_locked(now)
                return RateLimitResult(allowed=False, remaining=0, retry_after=retry_after)

            bucket.append(now)
            remaining = max(limit_per_minute - len(bucket), 0)
            # Cheap amortized cleanup of unrelated stale keys.
            if len(self._events) > 1:
                self._evict_locked(now)
            return RateLimitResult(allowed=True, remaining=remaining, retry_after=0)


class RedisRateLimiter:
    """Sliding-window limiter backed by a Redis sorted set per key.

    Unlike a fixed-window counter (which can admit up to ~2x the limit straddling
    a window boundary), this keeps one ZSET per key whose members are the
    timestamps of the hits in the trailing ``window_seconds``. Each call runs a
    single atomic pipeline that:

      1. ZREMRANGEBYSCORE drops entries older than ``now - window_seconds``.
      2. ZADD inserts the current hit (a unique member so identical timestamps
         never collide and overwrite each other).
      3. ZCARD counts the live entries in the window.
      4. ZRANGE ... WITHSCORES reads the oldest surviving entry for retry_after.
      5. EXPIRE refreshes the key's TTL to ~window_seconds so idle keys reap
         themselves.

    The whole sequence is one round-trip in a MULTI/EXEC pipeline, so the count
    is computed against the same snapshot the ZADD wrote into and the limiter is
    correct across concurrent replicas sharing the same Redis.

    A request is allowed when the post-insert count is ``<= limit_per_minute``.
    When it is over the limit the just-added member is removed again so a blocked
    request does not itself push the oldest entry's expiry forward, and
    retry_after is derived from when the oldest in-window entry will fall out.

    If Redis is unreachable at call time the limiter fails OPEN to the in-process
    fallback (logging once) rather than turning a Redis outage into a flood of
    500s.
    """

    def __init__(self, redis_client, window_seconds: int = WINDOW_SECONDS) -> None:
        self._redis = redis_client
        self.window_seconds = window_seconds
        self._fallback = SlidingWindowRateLimiter(window_seconds=window_seconds)
        self._warned_unavailable = False
        self._warn_lock = threading.Lock()
        # Monotonic-ish disambiguator so two hits sharing a wall-clock timestamp
        # still land as distinct ZSET members.
        self._counter = itertools.count()

    def _warn_once(self, exc: Exception) -> None:
        with self._warn_lock:
            if self._warned_unavailable:
                return
            self._warned_unavailable = True
        logger.warning(
            "Redis rate limiter unavailable (%s); falling back to in-process limiter",
            exc,
        )

    def _redis_key(self, key: str) -> str:
        return f"wmg:ratelimit:{key}"

    def hit(self, key: str, limit_per_minute: int) -> RateLimitResult:
        now = time.time()
        cutoff = now - self.window_seconds
        try:
            redis_key = self._redis_key(key)
            # Unique member: score is the timestamp (used for windowing), and the
            # member string carries a counter so equal timestamps don't collide.
            member = f"{now:.6f}:{next(self._counter)}"
            pipe = self._redis.pipeline()
            pipe.zremrangebyscore(redis_key, "-inf", cutoff)
            pipe.zadd(redis_key, {member: now})
            pipe.zcard(redis_key)
            pipe.zrange(redis_key, 0, 0, withscores=True)
            pipe.expire(redis_key, self.window_seconds)
            _removed, _added, card, oldest, _expired = pipe.execute()
            current = int(card)
        except Exception as exc:  # noqa: BLE001 - any redis/connection error => fail open
            self._warn_once(exc)
            return self._fallback.hit(key, limit_per_minute)

        if current > limit_per_minute:
            # Don't let a rejected request count toward (or refresh) the window.
            try:
                self._redis.zrem(redis_key, member)
            except Exception:  # noqa: BLE001 - cleanup is best-effort
                pass
            oldest_score = float(oldest[0][1]) if oldest else now
            retry_after = max(1, int(self.window_seconds - (now - oldest_score)))
            return RateLimitResult(allowed=False, remaining=0, retry_after=retry_after)

        remaining = max(limit_per_minute - current, 0)
        return RateLimitResult(allowed=True, remaining=remaining, retry_after=0)


def _build_default_limiter():
    """Build the module singleton.

    Uses Redis when WMG_REDIS_URL is configured (and the redis client imports
    and connects); otherwise the in-process sliding-window limiter. Redis is
    fully optional: a missing dependency, missing setting, or failed connection
    all degrade gracefully to the in-process limiter.
    """
    try:
        from worldmodel_server.config import settings

        redis_url = getattr(settings, "WMG_REDIS_URL", "") or ""
    except Exception:  # noqa: BLE001 - config import must never break the limiter
        redis_url = ""

    if not redis_url:
        return SlidingWindowRateLimiter()

    try:
        import redis  # type: ignore

        client = redis.Redis.from_url(redis_url)
        return RedisRateLimiter(client)
    except Exception as exc:  # noqa: BLE001 - any failure => in-process fallback
        logger.warning(
            "Could not initialize Redis rate limiter (%s); using in-process limiter",
            exc,
        )
        return SlidingWindowRateLimiter()


rate_limiter = _build_default_limiter()

from __future__ import annotations

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
    """Fixed-window limiter backed by Redis so all replicas share one counter.

    Each call atomically INCRs a window-scoped key in a pipeline and sets its
    EXPIRE, so the counter is shared across replicas and old windows clean
    themselves up via the TTL. The key embeds the current window index, so
    refreshing the TTL on every hit is harmless: the key only ever lives for the
    window it names. If Redis is unreachable at call time the limiter fails OPEN
    to the in-process fallback (logging once) rather than turning a Redis outage
    into a flood of 500s.
    """

    def __init__(self, redis_client, window_seconds: int = WINDOW_SECONDS) -> None:
        self._redis = redis_client
        self.window_seconds = window_seconds
        self._fallback = SlidingWindowRateLimiter(window_seconds=window_seconds)
        self._warned_unavailable = False
        self._warn_lock = threading.Lock()

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
        # Bucket by wall-clock window so a key naturally rolls over and old
        # windows expire on their own via the TTL set above.
        window_index = int(time.time() // self.window_seconds)
        return f"wmg:ratelimit:{key}:{window_index}"

    def hit(self, key: str, limit_per_minute: int) -> RateLimitResult:
        try:
            redis_key = self._redis_key(key)
            pipe = self._redis.pipeline()
            pipe.incr(redis_key)
            pipe.expire(redis_key, self.window_seconds)
            pipe.ttl(redis_key)
            incr_result, _expire_result, ttl_result = pipe.execute()
            current = int(incr_result)
            ttl = int(ttl_result)
            if ttl < 0:
                ttl = self.window_seconds
        except Exception as exc:  # noqa: BLE001 - any redis/connection error => fail open
            self._warn_once(exc)
            return self._fallback.hit(key, limit_per_minute)

        if current > limit_per_minute:
            retry_after = max(1, ttl)
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

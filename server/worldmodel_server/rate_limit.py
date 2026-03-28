from __future__ import annotations

import time
from collections import defaultdict, deque
from dataclasses import dataclass
from threading import Lock


@dataclass(frozen=True)
class RateLimitResult:
    allowed: bool
    remaining: int
    retry_after: int


class SlidingWindowRateLimiter:
    def __init__(self, window_seconds: int = 60) -> None:
        self.window_seconds = window_seconds
        self._events: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def hit(self, key: str, limit: int) -> RateLimitResult:
        now = time.time()
        cutoff = now - self.window_seconds

        with self._lock:
            bucket = self._events[key]
            while bucket and bucket[0] <= cutoff:
                bucket.popleft()

            if len(bucket) >= limit:
                retry_after = max(1, int(self.window_seconds - (now - bucket[0])))
                return RateLimitResult(allowed=False, remaining=0, retry_after=retry_after)

            bucket.append(now)
            remaining = max(limit - len(bucket), 0)
            return RateLimitResult(allowed=True, remaining=remaining, retry_after=0)


rate_limiter = SlidingWindowRateLimiter()

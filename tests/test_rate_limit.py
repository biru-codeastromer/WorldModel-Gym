from __future__ import annotations

import fakeredis
from worldmodel_server.rate_limit import (
    RedisRateLimiter,
    SlidingWindowRateLimiter,
)


def test_inprocess_allows_then_blocks():
    limiter = SlidingWindowRateLimiter(window_seconds=60)
    for _ in range(3):
        assert limiter.hit("k", 3).allowed is True
    blocked = limiter.hit("k", 3)
    assert blocked.allowed is False
    assert blocked.retry_after >= 1


def test_inprocess_evicts_stale_buckets():
    limiter = SlidingWindowRateLimiter(window_seconds=60)
    # Two keys; advance time so their windows expire, then a fresh hit should
    # garbage-collect the old keys instead of leaking them forever.
    base = 1_000_000.0
    times = iter([base, base + 1, base + 200])

    import worldmodel_server.rate_limit as rl

    orig_time = rl.time.time
    rl.time.time = lambda: next(times)
    try:
        limiter.hit("old-a", 5)
        limiter.hit("old-b", 5)
        assert set(limiter._events.keys()) == {"old-a", "old-b"}
        # 200s later, a hit on a new key evicts the two expired ones.
        limiter.hit("fresh", 5)
    finally:
        rl.time.time = orig_time

    assert "old-a" not in limiter._events
    assert "old-b" not in limiter._events
    assert "fresh" in limiter._events


def test_redis_allows_n_then_blocks_and_reports_retry_after():
    server = fakeredis.FakeServer()
    client = fakeredis.FakeStrictRedis(server=server)
    limiter = RedisRateLimiter(client, window_seconds=60)

    for _ in range(5):
        assert limiter.hit("user", 5).allowed is True

    blocked = limiter.hit("user", 5)
    assert blocked.allowed is False
    assert blocked.remaining == 0
    assert 1 <= blocked.retry_after <= 60


def test_redis_window_resets(monkeypatch):
    server = fakeredis.FakeServer()
    client = fakeredis.FakeStrictRedis(server=server)
    limiter = RedisRateLimiter(client, window_seconds=60)

    import worldmodel_server.rate_limit as rl

    # Pin to a fixed window first.
    monkeypatch.setattr(rl.time, "time", lambda: 1_000_000.0)
    for _ in range(3):
        assert limiter.hit("u", 3).allowed is True
    assert limiter.hit("u", 3).allowed is False

    # Jump to the next window: the key rolls over, so requests are allowed again.
    monkeypatch.setattr(rl.time, "time", lambda: 1_000_000.0 + 120)
    assert limiter.hit("u", 3).allowed is True


def test_two_redis_limiters_share_state():
    # Cross-replica correctness: two independent limiter instances pointed at the
    # same Redis must share the counter.
    server = fakeredis.FakeServer()
    a = RedisRateLimiter(fakeredis.FakeStrictRedis(server=server), window_seconds=60)
    b = RedisRateLimiter(fakeredis.FakeStrictRedis(server=server), window_seconds=60)

    assert a.hit("shared", 2).allowed is True
    assert b.hit("shared", 2).allowed is True
    # Third hit (regardless of which replica) is over the shared limit.
    assert a.hit("shared", 2).allowed is False
    assert b.hit("shared", 2).allowed is False


def test_redis_fails_open_to_inprocess(monkeypatch):
    server = fakeredis.FakeServer()
    client = fakeredis.FakeStrictRedis(server=server)
    limiter = RedisRateLimiter(client, window_seconds=60)

    # Simulate Redis being unreachable at call time.
    def boom(*args, **kwargs):
        raise ConnectionError("redis down")

    monkeypatch.setattr(limiter._redis, "pipeline", boom)

    # Should not raise; falls back to the in-process limiter.
    result = limiter.hit("k", 2)
    assert result.allowed is True
    result = limiter.hit("k", 2)
    assert result.allowed is True
    blocked = limiter.hit("k", 2)
    assert blocked.allowed is False


def test_module_singleton_is_inprocess_without_redis():
    # With no WMG_REDIS_URL configured, the default singleton is in-process.
    from worldmodel_server.rate_limit import rate_limiter

    assert isinstance(rate_limiter, SlidingWindowRateLimiter)

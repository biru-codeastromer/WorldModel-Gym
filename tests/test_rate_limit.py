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


def test_redis_window_slides_forward(monkeypatch):
    server = fakeredis.FakeServer()
    client = fakeredis.FakeStrictRedis(server=server)
    limiter = RedisRateLimiter(client, window_seconds=60)

    import worldmodel_server.rate_limit as rl

    now = {"t": 1_000_000.0}
    monkeypatch.setattr(rl.time, "time", lambda: now["t"])

    for _ in range(3):
        assert limiter.hit("u", 3).allowed is True
    assert limiter.hit("u", 3).allowed is False

    # Advance past the window so every earlier hit ages out; the sliding window
    # is now empty and requests are allowed again.
    now["t"] += 61
    assert limiter.hit("u", 3).allowed is True


def test_redis_sliding_window_blocks_2x_across_boundary(monkeypatch):
    # A fixed-window counter would allow ~2x the limit by firing limit hits at
    # the end of one window and limit more at the start of the next. The sliding
    # window must NOT: any burst inside any trailing 60s span is capped at limit.
    server = fakeredis.FakeServer()
    client = fakeredis.FakeStrictRedis(server=server)
    limiter = RedisRateLimiter(client, window_seconds=60)

    import worldmodel_server.rate_limit as rl

    now = {"t": 1_000_000.0}
    monkeypatch.setattr(rl.time, "time", lambda: now["t"])

    # Fill the limit late in a notional fixed window.
    now["t"] = 1_000_059.0
    for _ in range(3):
        assert limiter.hit("u", 3).allowed is True

    # 2s later we'd cross a fixed-window boundary (…059 -> …061), but only 2s of
    # real time has passed, so all 3 earlier hits are still in the trailing 60s.
    now["t"] = 1_000_061.0
    blocked = limiter.hit("u", 3)
    assert blocked.allowed is False
    assert blocked.remaining == 0
    # The oldest hit was at …059, so it leaves the window ~58s from now.
    assert 55 <= blocked.retry_after <= 60

    # Even partway through, the burst is still in-window and stays blocked:
    # at +30s the oldest hit (…059) is only 31s old, well inside the 60s window.
    now["t"] = 1_000_091.0
    assert limiter.hit("u", 3).allowed is False

    # Only once the original burst ages out of the trailing window do slots free
    # up again. All three landed at …059, so they leave together at …059 + 60.
    now["t"] = 1_000_119.5
    for _ in range(3):
        assert limiter.hit("u", 3).allowed is True
    assert limiter.hit("u", 3).allowed is False


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
    # Import both the singleton and the class from the *current* module object so
    # the isinstance check stays valid even if another test file reloaded
    # ``worldmodel_server.rate_limit`` (which rebinds the class object) earlier in
    # the session — the module-level import above would otherwise be stale.
    import worldmodel_server.rate_limit as rl

    assert isinstance(rl.rate_limiter, rl.SlidingWindowRateLimiter)

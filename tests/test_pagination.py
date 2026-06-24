"""Keyset/cursor pagination on the public leaderboard endpoint.

The leaderboard stays a plain JSON list of ``LeaderboardRow`` (web/mobile are
unaffected); the opaque keyset cursor is advertised only via the
``X-Next-Cursor`` response header. These tests exercise full, in-order,
non-overlapping coverage when paging by cursor, the header lifecycle (present
until the last page, then absent), malformed-cursor handling, and that the
legacy offset path is unchanged.
"""

from __future__ import annotations

import base64
import json

from fastapi.testclient import TestClient


def _make_writer_client(modules):
    app = modules["worldmodel_server.main"].app
    create_api_key = modules["worldmodel_server.auth"].create_api_key
    session_local = modules["worldmodel_server.db"].SessionLocal
    client = TestClient(app)
    client.__enter__()
    with session_local() as session:
        _, secret = create_api_key(session, name="writer", scopes=["runs:write"])
    return client, secret


def _upload_run(client, secret, run_id, success_rate, mean_return):
    client.post(
        "/api/runs",
        json={"id": run_id, "env": "memory_maze", "agent": run_id, "track": "test"},
        headers={"x-api-key": secret},
    )
    return client.post(
        f"/api/runs/{run_id}/upload",
        headers={"x-api-key": secret},
        files={
            "metrics_file": (
                "metrics.json",
                json.dumps({"success_rate": success_rate, "mean_return": mean_return}),
                "application/json",
            )
        },
    )


def _seed_ranked_runs(client, secret, count):
    """Seed ``count`` runs with strictly descending, distinct scores.

    Returns the run ids in their expected ranked order (success_rate DESC).
    """
    expected_order = []
    for i in range(count):
        run_id = f"run_{i:03d}"
        # Descending success_rate so run_000 ranks first, run_001 next, etc.
        score = (count - i) / (count + 1)
        _upload_run(client, secret, run_id, round(score, 6), round(score, 6))
        expected_order.append(run_id)
    return expected_order


def test_cursor_pages_cover_full_ranked_order_without_overlap(server_modules):
    modules = server_modules()
    client, secret = _make_writer_client(modules)
    try:
        expected = _seed_ranked_runs(client, secret, 10)

        collected: list[str] = []
        cursors_seen: list[str] = []
        url = "/api/leaderboard?track=test&limit=3"
        # Walk the cursor chain to exhaustion.
        for _ in range(20):  # generous bound to prevent an infinite loop on a bug
            resp = client.get(url)
            assert resp.status_code == 200
            page = resp.json()
            collected.extend(r["run_id"] for r in page)
            next_cursor = resp.headers.get("X-Next-Cursor")
            if not next_cursor:
                break
            cursors_seen.append(next_cursor)
            url = f"/api/leaderboard?track=test&limit=3&cursor={next_cursor}"
    finally:
        client.__exit__(None, None, None)

    # Full coverage, exact ranked order, no duplicates.
    assert collected == expected
    assert len(collected) == len(set(collected))
    # 10 rows at limit=3 -> pages of 3,3,3,1 -> a cursor after each of the first
    # three pages, none after the last.
    assert len(cursors_seen) == 3


def test_x_next_cursor_present_until_last_page_then_absent(server_modules):
    modules = server_modules()
    client, secret = _make_writer_client(modules)
    try:
        _seed_ranked_runs(client, secret, 5)

        first = client.get("/api/leaderboard?track=test&limit=2")
        assert first.status_code == 200
        cursor1 = first.headers.get("X-Next-Cursor")
        assert cursor1  # more rows remain

        second = client.get(f"/api/leaderboard?track=test&limit=2&cursor={cursor1}")
        cursor2 = second.headers.get("X-Next-Cursor")
        assert cursor2

        third = client.get(f"/api/leaderboard?track=test&limit=2&cursor={cursor2}")
        # Final page: exactly the leftover row, and no further cursor.
        assert len(third.json()) == 1
        assert not third.headers.get("X-Next-Cursor")
    finally:
        client.__exit__(None, None, None)


def test_cursor_exact_multiple_last_page_omits_cursor(server_modules):
    # When the row count is an exact multiple of the page size, the final full
    # page must NOT advertise a cursor (there is genuinely nothing after it).
    modules = server_modules()
    client, secret = _make_writer_client(modules)
    try:
        _seed_ranked_runs(client, secret, 4)
        first = client.get("/api/leaderboard?track=test&limit=2")
        cursor1 = first.headers["X-Next-Cursor"]
        second = client.get(f"/api/leaderboard?track=test&limit=2&cursor={cursor1}")
        assert len(second.json()) == 2
        assert not second.headers.get("X-Next-Cursor")
    finally:
        client.__exit__(None, None, None)


def test_malformed_cursor_returns_400_problem_json(server_modules):
    modules = server_modules()
    client, secret = _make_writer_client(modules)
    try:
        _seed_ranked_runs(client, secret, 3)

        not_base64 = client.get("/api/leaderboard?track=test&cursor=not!!base64!!")
        # Valid base64url but wrong JSON shape (an object, not the 4-tuple list).
        wrong_shape = base64.urlsafe_b64encode(json.dumps({"x": 1}).encode()).decode().rstrip("=")
        bad_shape = client.get(f"/api/leaderboard?track=test&cursor={wrong_shape}")
        # Valid base64url + JSON list but with a non-timestamp created_at field.
        bad_ts_token = (
            base64.urlsafe_b64encode(json.dumps([0.5, 0.5, "not-a-date", "x"]).encode())
            .decode()
            .rstrip("=")
        )
        bad_ts = client.get(f"/api/leaderboard?track=test&cursor={bad_ts_token}")
    finally:
        client.__exit__(None, None, None)

    for resp in (not_base64, bad_shape, bad_ts):
        assert resp.status_code == 400
        assert resp.headers["content-type"].startswith("application/problem+json")
        body = resp.json()
        # Legacy contract: a top-level ``detail`` string is always present.
        assert isinstance(body["detail"], str)
        assert body["status"] == 400


def test_offset_path_unchanged_and_no_cursor_header(server_modules):
    modules = server_modules()
    client, secret = _make_writer_client(modules)
    try:
        expected = _seed_ranked_runs(client, secret, 3)

        page1 = client.get("/api/leaderboard?track=test&limit=2&offset=0")
        page2 = client.get("/api/leaderboard?track=test&limit=2&offset=2")
    finally:
        client.__exit__(None, None, None)

    # Offset slices match the legacy contract exactly.
    assert [r["run_id"] for r in page1.json()] == expected[:2]
    assert [r["run_id"] for r in page2.json()] == expected[2:]
    # Both responses stay a plain JSON list (no envelope).
    assert isinstance(page1.json(), list)
    assert isinstance(page2.json(), list)
    # An explicit OFFSET>0 page is pure offset paging: no cursor header at all,
    # so existing offset clients see unchanged behavior.
    assert not page2.headers.get("X-Next-Cursor")


def test_cursor_paging_is_stable_when_new_rows_inserted(server_modules):
    # Insert a fresh row *between* fetching page 1 and page 2. Keyset paging must
    # not skip or duplicate already-seen rows: the new row simply appears in its
    # ranked position if it sorts after the cursor.
    modules = server_modules()
    client, secret = _make_writer_client(modules)
    try:
        _seed_ranked_runs(client, secret, 4)  # scores ~0.8,0.6,0.4,0.2

        first = client.get("/api/leaderboard?track=test&limit=2")
        page1_ids = [r["run_id"] for r in first.json()]
        cursor1 = first.headers["X-Next-Cursor"]

        # New low-scoring row -> ranks after the page-1 cursor.
        _upload_run(client, secret, "late_low", 0.10, 0.10)

        second = client.get(f"/api/leaderboard?track=test&limit=2&cursor={cursor1}")
        page2_ids = [r["run_id"] for r in second.json()]
    finally:
        client.__exit__(None, None, None)

    # No overlap between the two pages despite the concurrent insert.
    assert set(page1_ids).isdisjoint(page2_ids)
    assert len(page1_ids) == 2


def test_cursor_codec_round_trips(server_modules):
    # Directly exercise the encode/decode helpers for an exact round trip.
    modules = server_modules()
    main = modules["worldmodel_server.main"]
    from datetime import datetime

    # ``LeaderboardRow`` is re-exported into ``main`` (imported from schemas).
    row = main.LeaderboardRow(
        run_id="abc123",
        env="memory_maze",
        agent="ppo",
        track="test",
        success_rate=0.75,
        mean_return=0.5,
        planning_cost_ms_per_step=1.0,
        created_at=datetime(2026, 5, 1, 12, 30, 45),
    )
    token = main._encode_leaderboard_cursor(row)
    success_rate, mean_return, created_at, run_id = main._decode_leaderboard_cursor(token)
    assert success_rate == 0.75
    assert mean_return == 0.5
    assert created_at == datetime(2026, 5, 1, 12, 30, 45)
    assert run_id == "abc123"

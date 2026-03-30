from __future__ import annotations

import argparse
import os
import sys
import time

import httpx


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Verify API and web deployment endpoints.")
    parser.add_argument(
        "--api-base",
        default=os.getenv("WMG_API_BASE", "http://localhost:8000"),
        help="Base URL for the FastAPI service.",
    )
    parser.add_argument(
        "--web-base",
        default=os.getenv("WMG_WEB_BASE", "http://localhost:3000"),
        help="Base URL for the web deployment. Pass an empty string to skip web checks.",
    )
    parser.add_argument(
        "--track",
        default="test",
        help="Leaderboard track to probe through the API and web proxy.",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=20.0,
        help="Per-request timeout in seconds.",
    )
    parser.add_argument(
        "--retries",
        type=int,
        default=3,
        help="Retries per endpoint to tolerate cold starts.",
    )
    parser.add_argument(
        "--expect-nonempty-leaderboard",
        action="store_true",
        help="Fail if the leaderboard endpoint returns an empty list.",
    )
    return parser


def request_json(
    client: httpx.Client,
    url: str,
    *,
    retries: int,
) -> object:
    last_error: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            response = client.get(url)
            response.raise_for_status()
            return response.json()
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            if attempt == retries:
                break
            time.sleep(2)
    raise RuntimeError(f"{url} failed after {retries} attempts: {last_error}") from last_error


def request_ok(
    client: httpx.Client,
    url: str,
    *,
    retries: int,
) -> None:
    last_error: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            response = client.get(url)
            response.raise_for_status()
            return
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            if attempt == retries:
                break
            time.sleep(2)
    raise RuntimeError(f"{url} failed after {retries} attempts: {last_error}") from last_error


def main() -> int:
    args = build_parser().parse_args()
    web_base = args.web_base.rstrip("/")
    api_base = args.api_base.rstrip("/")

    checks: list[tuple[str, str]] = [
        ("api_health", f"{api_base}/healthz"),
        ("api_ready", f"{api_base}/readyz"),
        ("api_leaderboard", f"{api_base}/api/leaderboard?track={args.track}"),
    ]
    if web_base:
        checks.extend(
            [
                ("web_homepage", web_base),
                (
                    "web_proxy_leaderboard",
                    f"{web_base}/api/proxy/api/leaderboard?track={args.track}",
                ),
            ]
        )

    with httpx.Client(timeout=args.timeout, follow_redirects=True) as client:
        results: dict[str, object] = {}
        for name, url in checks:
            if name == "web_homepage":
                request_ok(client, url, retries=args.retries)
                results[name] = {"ok": True}
            else:
                results[name] = request_json(client, url, retries=args.retries)
            print(f"{name}: ok")

    leaderboard_payload = results["api_leaderboard"]
    if not isinstance(leaderboard_payload, list):
        print("api_leaderboard did not return a JSON list", file=sys.stderr)
        return 1

    print(f"Leaderboard entries: {len(leaderboard_payload)}")
    if args.expect_nonempty_leaderboard and not leaderboard_payload:
        print("Expected a non-empty leaderboard but found zero entries.", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

from __future__ import annotations

import argparse
import json
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
    parser.add_argument(
        "--check-artifact-integrity",
        action="store_true",
        help=(
            "Pick a run off the leaderboard and assert its metrics/config/trace "
            "artifacts are non-empty and schema-plausible (not just HTTP 200)."
        ),
    )
    parser.add_argument(
        "--run-id",
        default=None,
        help=(
            "Specific run id to integrity-check. Defaults to the top run on the "
            "probed track when --check-artifact-integrity is set."
        ),
    )
    parser.add_argument(
        "--require-artifact-integrity",
        action="store_true",
        help=(
            "Fail (instead of skipping) when --check-artifact-integrity finds no "
            "run to probe. Use this once the leaderboard is expected to be seeded."
        ),
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


def request_text(
    client: httpx.Client,
    url: str,
    *,
    retries: int,
) -> str:
    last_error: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            response = client.get(url)
            response.raise_for_status()
            return response.text
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            if attempt == retries:
                break
            time.sleep(2)
    raise RuntimeError(f"{url} failed after {retries} attempts: {last_error}") from last_error


class IntegrityError(RuntimeError):
    """Raised when a run's artifacts are missing or schema-implausible."""


def _resolve_integrity_run_id(
    *,
    explicit_run_id: str | None,
    leaderboard: object,
) -> str | None:
    """Choose the run id to integrity-check: explicit flag, else top leaderboard row."""
    if explicit_run_id:
        return explicit_run_id
    if isinstance(leaderboard, list) and leaderboard:
        top = leaderboard[0]
        if isinstance(top, dict):
            run_id = top.get("run_id")
            if isinstance(run_id, str) and run_id:
                return run_id
    return None


def _assert_plausible_metrics(run_id: str, metrics: object) -> None:
    if not isinstance(metrics, dict) or not metrics:
        raise IntegrityError(f"run {run_id}: metrics artifact is empty or not a JSON object")
    for field in ("success_rate", "mean_return"):
        if field not in metrics:
            raise IntegrityError(f"run {run_id}: metrics missing required field '{field}'")
        value = metrics[field]
        if not isinstance(value, (int, float)) or isinstance(value, bool):
            raise IntegrityError(f"run {run_id}: metrics['{field}'] is not numeric ({value!r})")
    success_rate = float(metrics["success_rate"])
    if not 0.0 <= success_rate <= 1.0:
        raise IntegrityError(
            f"run {run_id}: success_rate {success_rate} outside the plausible [0, 1] range"
        )
    # planning_cost is nested ({"wall_clock_ms_per_step": ...}) when present; a
    # missing block is tolerated but a malformed one is not.
    planning_cost = metrics.get("planning_cost")
    if planning_cost is not None and not isinstance(planning_cost, (int, float, dict)):
        raise IntegrityError(
            f"run {run_id}: metrics['planning_cost'] has unexpected type {type(planning_cost)!r}"
        )


def verify_artifact_integrity(
    client: httpx.Client,
    api_base: str,
    *,
    run_id: str,
    retries: int,
) -> None:
    """Fetch a run's detail/metrics/config/trace and assert they are real artifacts."""
    detail = request_json(client, f"{api_base}/api/runs/{run_id}", retries=retries)
    if not isinstance(detail, dict) or detail.get("id") != run_id:
        raise IntegrityError(f"run {run_id}: detail endpoint returned an unexpected payload")
    if detail.get("status") != "uploaded":
        raise IntegrityError(
            f"run {run_id}: expected status 'uploaded' but found {detail.get('status')!r}"
        )

    metrics = request_json(client, f"{api_base}/api/runs/{run_id}/metrics", retries=retries)
    _assert_plausible_metrics(run_id, metrics)

    # config + trace are served as raw artifact bodies; assert they are present
    # and non-trivial. A run on the leaderboard has been uploaded, so a missing
    # (404) config/trace is a genuine data-integrity failure surfaced by raise.
    config_text = request_text(client, f"{api_base}/api/runs/{run_id}/config", retries=retries)
    if not config_text.strip():
        raise IntegrityError(f"run {run_id}: config artifact is empty")

    trace_text = request_text(client, f"{api_base}/api/runs/{run_id}/trace", retries=retries)
    if not trace_text.strip():
        raise IntegrityError(f"run {run_id}: trace artifact is empty")
    # trace.jsonl is newline-delimited JSON; at least the first line must parse.
    first_line = trace_text.strip().splitlines()[0]
    try:
        json.loads(first_line)
    except json.JSONDecodeError as exc:
        raise IntegrityError(f"run {run_id}: trace first line is not valid JSON: {exc}") from exc

    print(
        f"artifact_integrity: ok (run={run_id}, "
        f"success_rate={metrics['success_rate']}, mean_return={metrics['mean_return']})"
    )


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

    if args.check_artifact_integrity:
        run_id = _resolve_integrity_run_id(
            explicit_run_id=args.run_id,
            leaderboard=leaderboard_payload,
        )
        if run_id is None:
            message = (
                "artifact_integrity: no run available to probe "
                f"(track={args.track}, pass --run-id to target one)."
            )
            if args.require_artifact_integrity:
                print(message, file=sys.stderr)
                return 1
            print(f"{message} skipping.")
        else:
            with httpx.Client(timeout=args.timeout, follow_redirects=True) as client:
                try:
                    verify_artifact_integrity(
                        client,
                        api_base,
                        run_id=run_id,
                        retries=args.retries,
                    )
                except (IntegrityError, RuntimeError) as exc:
                    print(f"artifact_integrity: FAILED — {exc}", file=sys.stderr)
                    return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

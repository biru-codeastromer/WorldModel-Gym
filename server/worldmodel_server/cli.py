from __future__ import annotations

import argparse

from worldmodel_server.auth import (
    create_api_key,
    deserialize_scopes,
    find_api_key_by_prefix,
    is_key_expired,
    revoke_api_key,
    rotate_api_key,
)
from worldmodel_server.db import SessionLocal
from worldmodel_server.migrations import run_migrations
from worldmodel_server.models import ApiKey
from worldmodel_server.seed import seed_demo_runs


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="worldmodel-server-admin")
    subparsers = parser.add_subparsers(dest="command", required=True)

    migrate = subparsers.add_parser("migrate", help="Run Alembic migrations")
    migrate.set_defaults(handler=handle_migrate)

    create_key = subparsers.add_parser("create-api-key", help="Generate a scoped API key")
    create_key.add_argument("--name", required=True)
    create_key.add_argument("--scope", action="append", required=True)
    create_key.add_argument("--rate-limit", type=int, default=None)
    create_key.add_argument(
        "--expires-in-days",
        type=int,
        default=None,
        help="Optional hard expiry; the key is rejected after this many days.",
    )
    create_key.set_defaults(handler=handle_create_api_key)

    rotate_key = subparsers.add_parser(
        "rotate-api-key",
        help="Mint a new secret for a key (by prefix) and deactivate the old one",
    )
    rotate_key.add_argument("--prefix", required=True)
    rotate_key.add_argument("--rate-limit", type=int, default=None)
    rotate_key.add_argument("--expires-in-days", type=int, default=None)
    rotate_key.set_defaults(handler=handle_rotate_api_key)

    revoke_key = subparsers.add_parser(
        "revoke-api-key",
        help="Deactivate a key (by prefix) so it can no longer authenticate",
    )
    revoke_key.add_argument("--prefix", required=True)
    revoke_key.set_defaults(handler=handle_revoke_api_key)

    list_keys = subparsers.add_parser(
        "list-api-keys",
        help="List API keys with status and expiry",
    )
    list_keys.set_defaults(handler=handle_list_api_keys)

    seed = subparsers.add_parser("seed-demo-data", help="Insert demo leaderboard runs")
    seed.add_argument("--force", action="store_true")
    seed.set_defaults(handler=handle_seed_demo_data)

    worker = subparsers.add_parser(
        "worker",
        help="Start an RQ worker for the async job queue (requires WMG_REDIS_URL)",
    )
    worker.add_argument(
        "--burst",
        action="store_true",
        help="Drain the queue once and exit instead of serving forever",
    )
    worker.set_defaults(handler=handle_worker)

    return parser


def handle_migrate(_args: argparse.Namespace) -> int:
    run_migrations()
    print("Database migrations applied.")
    return 0


def handle_create_api_key(args: argparse.Namespace) -> int:
    run_migrations()
    with SessionLocal() as session:
        item, secret = create_api_key(
            session,
            name=args.name,
            scopes=args.scope,
            rate_limit_per_minute=args.rate_limit,
            expires_in_days=args.expires_in_days,
        )

        print(f"Created API key '{item.name}'")
        print(f"Prefix: {item.key_prefix}")
        print(f"Scopes: {item.scopes_json}")
        print(f"Expires: {item.expires_at.isoformat() if item.expires_at else 'never'}")
        print(f"Secret: {secret}")
    return 0


def handle_rotate_api_key(args: argparse.Namespace) -> int:
    run_migrations()
    with SessionLocal() as session:
        existing = find_api_key_by_prefix(session, args.prefix)
        if existing is None:
            print(f"No API key found with prefix '{args.prefix}'")
            return 1
        old_prefix = existing.key_prefix
        new_key, secret = rotate_api_key(
            session,
            existing,
            rate_limit_per_minute=args.rate_limit,
            expires_in_days=args.expires_in_days,
        )

        print(f"Rotated API key '{new_key.name}'")
        print(f"Old prefix (deactivated): {old_prefix}")
        print(f"New prefix: {new_key.key_prefix}")
        print(f"Expires: {new_key.expires_at.isoformat() if new_key.expires_at else 'never'}")
        print(f"Secret: {secret}")
    return 0


def handle_revoke_api_key(args: argparse.Namespace) -> int:
    run_migrations()
    with SessionLocal() as session:
        existing = find_api_key_by_prefix(session, args.prefix)
        if existing is None:
            print(f"No API key found with prefix '{args.prefix}'")
            return 1
        revoke_api_key(session, existing)

        print(f"Revoked API key '{existing.name}' (prefix {existing.key_prefix})")
    return 0


def _key_status(item: ApiKey) -> str:
    if not item.is_active:
        return "revoked"
    if is_key_expired(item):
        return "expired"
    return "active"


def handle_list_api_keys(_args: argparse.Namespace) -> int:
    run_migrations()
    with SessionLocal() as session:
        keys = session.query(ApiKey).order_by(ApiKey.created_at).all()

    if not keys:
        print("No API keys.")
        return 0

    for item in keys:
        expiry = item.expires_at.isoformat() if item.expires_at else "never"
        scopes = ",".join(deserialize_scopes(item.scopes_json)) or "-"
        print(
            f"{item.key_prefix}  status={_key_status(item)}  expires={expiry}  "
            f"scopes={scopes}  name={item.name}"
        )
    return 0


def handle_seed_demo_data(args: argparse.Namespace) -> int:
    run_migrations()
    with SessionLocal() as session:
        created = seed_demo_runs(session, force=args.force)

    print(f"Seeded {created} demo runs.")
    return 0


def handle_worker(args: argparse.Namespace) -> int:
    from worldmodel_server.worker import run_worker

    return run_worker(burst=args.burst)


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    return args.handler(args)


if __name__ == "__main__":
    raise SystemExit(main())

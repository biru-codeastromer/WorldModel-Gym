from __future__ import annotations

import argparse

from worldmodel_server.auth import create_api_key
from worldmodel_server.db import SessionLocal
from worldmodel_server.migrations import run_migrations
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
    create_key.set_defaults(handler=handle_create_api_key)

    seed = subparsers.add_parser("seed-demo-data", help="Insert demo leaderboard runs")
    seed.add_argument("--force", action="store_true")
    seed.set_defaults(handler=handle_seed_demo_data)

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
        )

    print(f"Created API key '{item.name}'")
    print(f"Prefix: {item.key_prefix}")
    print(f"Scopes: {item.scopes_json}")
    print(f"Secret: {secret}")
    return 0


def handle_seed_demo_data(args: argparse.Namespace) -> int:
    run_migrations()
    with SessionLocal() as session:
        created = seed_demo_runs(session, force=args.force)

    print(f"Seeded {created} demo runs.")
    return 0


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    return args.handler(args)


if __name__ == "__main__":
    raise SystemExit(main())

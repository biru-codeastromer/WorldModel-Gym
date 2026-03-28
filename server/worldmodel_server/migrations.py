from __future__ import annotations

from pathlib import Path

from alembic import command
from alembic.config import Config

from worldmodel_server.config import settings


def _build_alembic_config() -> Config:
    repo_root = Path(__file__).resolve().parents[2]
    config = Config(str(repo_root / "alembic.ini"))
    config.set_main_option("script_location", str(repo_root / "server" / "alembic"))
    config.set_main_option("sqlalchemy.url", settings.db_url)
    return config


def run_migrations() -> None:
    command.upgrade(_build_alembic_config(), "head")

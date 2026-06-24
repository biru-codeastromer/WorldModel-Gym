from __future__ import annotations

import json
from pathlib import Path

import sqlalchemy as sa
from alembic import command
from alembic.config import Config

REPO_ROOT = Path(__file__).resolve().parents[1]


def _alembic_config(db_url: str) -> Config:
    config = Config(str(REPO_ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(REPO_ROOT / "server" / "alembic"))
    config.set_main_option("sqlalchemy.url", db_url)
    return config


def _columns(engine: sa.Engine, table: str) -> set[str]:
    inspector = sa.inspect(engine)
    return {column["name"] for column in inspector.get_columns(table)}


def _indexes(engine: sa.Engine, table: str) -> set[str]:
    inspector = sa.inspect(engine)
    return {index["name"] for index in inspector.get_indexes(table)}


def _point_settings_at(monkeypatch, db_url: str) -> None:
    # alembic/env.py overrides the config URL with worldmodel_server.config.settings.db_url,
    # which is a module-level singleton that may already be imported with a different URL.
    from worldmodel_server.config import settings

    monkeypatch.setenv("WMG_DB_URL", db_url)
    monkeypatch.setattr(settings, "db_url", db_url, raising=False)


def test_migrations_roundtrip_on_sqlite(tmp_path, monkeypatch):
    db_path = tmp_path / "migration_roundtrip.db"
    db_url = f"sqlite:///{db_path}"
    _point_settings_at(monkeypatch, db_url)
    config = _alembic_config(db_url)

    command.upgrade(config, "head")

    engine = sa.create_engine(db_url)
    try:
        columns = _columns(engine, "runs")
        assert "success_rate" in columns
        assert "mean_return" in columns
        assert "max_episodes" in columns
        assert "max_steps" in columns
        assert "ix_runs_leaderboard" in _indexes(engine, "runs")
    finally:
        engine.dispose()

    # A true inverse: downgrade all the way to base, then upgrade again.
    command.downgrade(config, "base")
    command.upgrade(config, "head")

    engine = sa.create_engine(db_url)
    try:
        columns = _columns(engine, "runs")
        assert "success_rate" in columns
        assert "mean_return" in columns
        assert "ix_runs_leaderboard" in _indexes(engine, "runs")
    finally:
        engine.dispose()


def test_ranking_columns_backfilled_from_metrics_json(tmp_path, monkeypatch):
    db_path = tmp_path / "migration_backfill.db"
    db_url = f"sqlite:///{db_path}"
    _point_settings_at(monkeypatch, db_url)
    config = _alembic_config(db_url)

    # Bring schema up to the revision *before* the ranking columns exist.
    command.upgrade(config, "20260328_01")

    engine = sa.create_engine(db_url)
    runs = sa.table(
        "runs",
        sa.column("id", sa.String),
        sa.column("env", sa.String),
        sa.column("agent", sa.String),
        sa.column("track", sa.String),
        sa.column("status", sa.String),
        sa.column("metrics_json", sa.Text),
    )
    try:
        with engine.begin() as conn:
            conn.execute(
                sa.insert(runs),
                [
                    {
                        "id": "good",
                        "env": "memory_maze",
                        "agent": "a",
                        "track": "test",
                        "status": "uploaded",
                        "metrics_json": json.dumps({"success_rate": 0.75, "mean_return": 4.2}),
                    },
                    {
                        "id": "malformed",
                        "env": "memory_maze",
                        "agent": "b",
                        "track": "test",
                        "status": "uploaded",
                        "metrics_json": "{not valid json",
                    },
                    {
                        "id": "missing",
                        "env": "memory_maze",
                        "agent": "c",
                        "track": "test",
                        "status": "uploaded",
                        "metrics_json": json.dumps({"other": 1}),
                    },
                ],
            )
    finally:
        engine.dispose()

    command.upgrade(config, "head")

    engine = sa.create_engine(db_url)
    try:
        with engine.connect() as conn:
            rows = conn.execute(
                sa.text("SELECT id, success_rate, mean_return FROM runs")
            ).fetchall()
        result = {row[0]: (row[1], row[2]) for row in rows}
    finally:
        engine.dispose()

    assert result["good"] == (0.75, 4.2)
    # Malformed / missing JSON falls back to the 0.0 defaults without error.
    assert result["malformed"] == (0.0, 0.0)
    assert result["missing"] == (0.0, 0.0)


def test_artifact_paths_normalized_to_agnostic_keys(tmp_path, monkeypatch):
    db_path = tmp_path / "migration_keys.db"
    db_url = f"sqlite:///{db_path}"
    _point_settings_at(monkeypatch, db_url)
    config = _alembic_config(db_url)

    # Bring schema up to the revision *before* the key-normalization migration.
    command.upgrade(config, "20260415_01")

    runs = sa.table(
        "runs",
        sa.column("id", sa.String),
        sa.column("env", sa.String),
        sa.column("agent", sa.String),
        sa.column("track", sa.String),
        sa.column("status", sa.String),
        sa.column("trace_path", sa.Text),
        sa.column("config_path", sa.Text),
    )
    engine = sa.create_engine(db_url)
    try:
        with engine.begin() as conn:
            conn.execute(
                sa.insert(runs),
                [
                    {
                        "id": "legacy_abs",
                        "env": "memory_maze",
                        "agent": "a",
                        "track": "test",
                        "status": "uploaded",
                        "trace_path": "/var/data/wmg/legacy_abs/trace.jsonl",
                        "config_path": "/var/data/wmg/legacy_abs/config.yaml",
                    },
                    {
                        "id": "already_key",
                        "env": "memory_maze",
                        "agent": "b",
                        "track": "test",
                        "status": "uploaded",
                        "trace_path": "already_key/trace.jsonl",
                        "config_path": "already_key/config.yaml",
                    },
                    {
                        "id": "no_artifacts",
                        "env": "memory_maze",
                        "agent": "c",
                        "track": "test",
                        "status": "created",
                        "trace_path": "",
                        "config_path": "",
                    },
                ],
            )
    finally:
        engine.dispose()

    command.upgrade(config, "head")

    engine = sa.create_engine(db_url)
    try:
        with engine.connect() as conn:
            rows = conn.execute(sa.text("SELECT id, trace_path, config_path FROM runs")).fetchall()
        result = {row[0]: (row[1], row[2]) for row in rows}
    finally:
        engine.dispose()

    # Legacy absolute paths are rewritten to backend-agnostic "<run_id>/<basename>".
    assert result["legacy_abs"] == ("legacy_abs/trace.jsonl", "legacy_abs/config.yaml")
    # Already-agnostic and empty values are left untouched (idempotent).
    assert result["already_key"] == ("already_key/trace.jsonl", "already_key/config.yaml")
    assert result["no_artifacts"] == ("", "")

    # Downgrade/upgrade round-trips cleanly on sqlite.
    command.downgrade(config, "20260415_01")
    command.upgrade(config, "head")


def test_eval_budget_columns_added_and_downgrade_drops_them(tmp_path, monkeypatch):
    db_path = tmp_path / "migration_budget.db"
    db_url = f"sqlite:///{db_path}"
    _point_settings_at(monkeypatch, db_url)
    config = _alembic_config(db_url)

    # The revision *before* the per-run budget columns exist.
    command.upgrade(config, "20260425_01")
    engine = sa.create_engine(db_url)
    try:
        columns = _columns(engine, "runs")
        assert "max_episodes" not in columns
        assert "max_steps" not in columns
    finally:
        engine.dispose()

    command.upgrade(config, "head")
    engine = sa.create_engine(db_url)
    try:
        columns = _columns(engine, "runs")
        assert "max_episodes" in columns
        assert "max_steps" in columns
    finally:
        engine.dispose()

    # Downgrade is a true inverse: both columns are dropped again.
    command.downgrade(config, "20260425_01")
    engine = sa.create_engine(db_url)
    try:
        columns = _columns(engine, "runs")
        assert "max_episodes" not in columns
        assert "max_steps" not in columns
    finally:
        engine.dispose()

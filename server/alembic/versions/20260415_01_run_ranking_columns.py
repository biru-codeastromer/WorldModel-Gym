"""Denormalized ranking columns + leaderboard index for runs.

Adds ``success_rate`` and ``mean_return`` columns to ``runs`` so the
leaderboard can be ranked and paginated in SQL instead of fetching every row
and sorting in Python. Backfills both columns from the existing
``metrics_json`` payloads and creates a composite index matching the
leaderboard query's filter + ordering.
"""

from __future__ import annotations

import json

import sqlalchemy as sa
from alembic import op

revision = "20260415_01"
down_revision = "20260328_01"
branch_labels = None
depends_on = None


LEADERBOARD_INDEX = "ix_runs_leaderboard"


def _coerce_float(value: object) -> float:
    try:
        if isinstance(value, bool):
            return 0.0
        return float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return 0.0


def _backfill_ranking_columns(bind: sa.engine.Connection) -> None:
    runs = sa.table(
        "runs",
        sa.column("id", sa.String),
        sa.column("metrics_json", sa.Text),
        sa.column("success_rate", sa.Float),
        sa.column("mean_return", sa.Float),
    )

    rows = bind.execute(sa.select(runs.c.id, runs.c.metrics_json)).fetchall()
    for run_id, metrics_json in rows:
        success_rate = 0.0
        mean_return = 0.0
        if metrics_json:
            try:
                parsed = json.loads(metrics_json)
            except (TypeError, ValueError):
                parsed = None
            if isinstance(parsed, dict):
                success_rate = _coerce_float(parsed.get("success_rate", 0.0))
                mean_return = _coerce_float(parsed.get("mean_return", 0.0))

        bind.execute(
            sa.update(runs)
            .where(runs.c.id == run_id)
            .values(success_rate=success_rate, mean_return=mean_return)
        )


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    existing_columns = {column["name"] for column in inspector.get_columns("runs")}
    with op.batch_alter_table("runs") as batch:
        if "success_rate" not in existing_columns:
            batch.add_column(
                sa.Column("success_rate", sa.Float(), nullable=False, server_default="0")
            )
        if "mean_return" not in existing_columns:
            batch.add_column(
                sa.Column("mean_return", sa.Float(), nullable=False, server_default="0")
            )

    _backfill_ranking_columns(bind)

    existing_indexes = {index["name"] for index in inspector.get_indexes("runs")}
    if LEADERBOARD_INDEX not in existing_indexes:
        op.create_index(
            LEADERBOARD_INDEX,
            "runs",
            ["track", "success_rate", "mean_return", "created_at"],
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    existing_indexes = {index["name"] for index in inspector.get_indexes("runs")}
    if LEADERBOARD_INDEX in existing_indexes:
        op.drop_index(LEADERBOARD_INDEX, table_name="runs")

    existing_columns = {column["name"] for column in inspector.get_columns("runs")}
    with op.batch_alter_table("runs") as batch:
        if "mean_return" in existing_columns:
            batch.drop_column("mean_return")
        if "success_rate" in existing_columns:
            batch.drop_column("success_rate")

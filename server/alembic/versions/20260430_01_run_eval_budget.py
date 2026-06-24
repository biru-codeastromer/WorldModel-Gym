"""Add an optional per-run evaluation budget to runs.

Adds ``runs.max_episodes`` and ``runs.max_steps`` (both nullable integers). NULL
means "use the server default budget" at execution time, so existing rows and
runs created without an explicit budget keep working unchanged.

The upgrade is idempotent (it only adds a column when missing) and the downgrade
drops both columns, giving a true inverse on both sqlite and postgres.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260430_01"
down_revision = "20260425_01"
branch_labels = None
depends_on = None


def _columns(inspector: sa.Inspector, table: str) -> set[str]:
    return {column["name"] for column in inspector.get_columns(table)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = _columns(inspector, "runs")
    with op.batch_alter_table("runs") as batch:
        if "max_episodes" not in existing:
            batch.add_column(sa.Column("max_episodes", sa.Integer(), nullable=True))
        if "max_steps" not in existing:
            batch.add_column(sa.Column("max_steps", sa.Integer(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = _columns(inspector, "runs")
    with op.batch_alter_table("runs") as batch:
        if "max_steps" in existing:
            batch.drop_column("max_steps")
        if "max_episodes" in existing:
            batch.drop_column("max_episodes")

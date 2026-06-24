"""Add an optional hard-expiry column to API keys.

Adds ``api_keys.expires_at`` (nullable datetime). A key past this instant is
rejected at authentication time exactly like an inactive key. NULL means the key
never expires, so the column is fully backward-compatible for existing rows.

The upgrade is idempotent (it only adds the column when missing) and the
downgrade drops it, giving a true inverse on both sqlite and postgres.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260425_01"
down_revision = "20260420_01"
branch_labels = None
depends_on = None


def _columns(inspector: sa.Inspector, table: str) -> set[str]:
    return {column["name"] for column in inspector.get_columns(table)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "expires_at" not in _columns(inspector, "api_keys"):
        with op.batch_alter_table("api_keys") as batch:
            batch.add_column(sa.Column("expires_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "expires_at" in _columns(inspector, "api_keys"):
        with op.batch_alter_table("api_keys") as batch:
            batch.drop_column("expires_at")

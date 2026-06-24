"""Add run provenance/schema columns and the idempotency-record table.

Two related contract-layer additions:

* Four nullable provenance columns on ``runs`` (``code_version``,
  ``seed_protocol``, ``package_versions``, ``metrics_schema_version``). NULL on
  existing rows means "unknown", so the change is backward-compatible.
* A new ``idempotency_records`` table backing safe write retries, with a unique
  index over ``(key, principal_id, method, path)``.

Both halves are idempotent on upgrade (columns/table are only created when
missing) and the downgrade is a true inverse on sqlite and postgres. All schema
changes go through ``batch_alter_table`` so they work on sqlite.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260505_01"
down_revision = "20260430_01"
branch_labels = None
depends_on = None

_PROVENANCE_COLUMNS = (
    ("code_version", sa.String(length=128)),
    ("seed_protocol", sa.String(length=128)),
    ("package_versions", sa.Text()),
    ("metrics_schema_version", sa.String(length=16)),
)


def _columns(inspector: sa.Inspector, table: str) -> set[str]:
    return {column["name"] for column in inspector.get_columns(table)}


def _has_table(inspector: sa.Inspector, table: str) -> bool:
    return inspector.has_table(table)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    existing = _columns(inspector, "runs")
    with op.batch_alter_table("runs") as batch:
        for name, type_ in _PROVENANCE_COLUMNS:
            if name not in existing:
                batch.add_column(sa.Column(name, type_, nullable=True))

    if not _has_table(inspector, "idempotency_records"):
        op.create_table(
            "idempotency_records",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("key", sa.String(length=255), nullable=False),
            sa.Column(
                "principal_id",
                sa.String(length=128),
                nullable=False,
                server_default="anonymous",
            ),
            sa.Column("method", sa.String(length=16), nullable=False),
            sa.Column("path", sa.String(length=512), nullable=False),
            sa.Column("request_fingerprint", sa.String(length=64), nullable=False),
            sa.Column("response_status", sa.Integer(), nullable=False),
            sa.Column("response_body", sa.Text(), nullable=False, server_default=""),
            sa.Column("created_at", sa.DateTime(), nullable=False),
        )
        op.create_index(
            "ix_idempotency_records_key",
            "idempotency_records",
            ["key"],
        )
        op.create_index(
            "ix_idempotency_records_created_at",
            "idempotency_records",
            ["created_at"],
        )
        op.create_index(
            "ix_idempotency_scope",
            "idempotency_records",
            ["key", "principal_id", "method", "path"],
            unique=True,
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if _has_table(inspector, "idempotency_records"):
        op.drop_index("ix_idempotency_scope", table_name="idempotency_records")
        op.drop_index("ix_idempotency_records_created_at", table_name="idempotency_records")
        op.drop_index("ix_idempotency_records_key", table_name="idempotency_records")
        op.drop_table("idempotency_records")

    existing = _columns(inspector, "runs")
    with op.batch_alter_table("runs") as batch:
        for name, _type in reversed(_PROVENANCE_COLUMNS):
            if name in existing:
                batch.drop_column(name)

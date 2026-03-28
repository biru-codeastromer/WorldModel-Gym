"""Initial schema with API keys and artifact metadata."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260328_01"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "runs" not in tables:
        op.create_table(
            "runs",
            sa.Column("id", sa.String(length=64), primary_key=True),
            sa.Column("env", sa.String(length=64), nullable=False),
            sa.Column("agent", sa.String(length=64), nullable=False),
            sa.Column("track", sa.String(length=32), nullable=False),
            sa.Column("status", sa.String(length=32), nullable=False, server_default="created"),
            sa.Column("metrics_json", sa.Text(), nullable=False, server_default="{}"),
            sa.Column("trace_path", sa.Text(), nullable=False, server_default=""),
            sa.Column("config_path", sa.Text(), nullable=False, server_default=""),
            sa.Column(
                "storage_backend", sa.String(length=32), nullable=False, server_default="local"
            ),
            sa.Column("created_by", sa.String(length=32), nullable=False, server_default="system"),
            sa.Column(
                "created_at",
                sa.DateTime(),
                nullable=False,
                server_default=sa.text("CURRENT_TIMESTAMP"),
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(),
                nullable=False,
                server_default=sa.text("CURRENT_TIMESTAMP"),
            ),
        )
    else:
        existing_columns = {column["name"] for column in inspector.get_columns("runs")}
        with op.batch_alter_table("runs") as batch:
            if "metrics_json" not in existing_columns:
                batch.add_column(
                    sa.Column("metrics_json", sa.Text(), nullable=False, server_default="{}")
                )
            if "trace_path" not in existing_columns:
                batch.add_column(
                    sa.Column("trace_path", sa.Text(), nullable=False, server_default="")
                )
            if "config_path" not in existing_columns:
                batch.add_column(
                    sa.Column("config_path", sa.Text(), nullable=False, server_default="")
                )
            if "storage_backend" not in existing_columns:
                batch.add_column(
                    sa.Column(
                        "storage_backend",
                        sa.String(length=32),
                        nullable=False,
                        server_default="local",
                    )
                )
            if "created_by" not in existing_columns:
                batch.add_column(
                    sa.Column(
                        "created_by", sa.String(length=32), nullable=False, server_default="system"
                    )
                )
            if "created_at" not in existing_columns:
                batch.add_column(
                    sa.Column(
                        "created_at",
                        sa.DateTime(),
                        nullable=False,
                        server_default=sa.text("CURRENT_TIMESTAMP"),
                    )
                )
            if "updated_at" not in existing_columns:
                batch.add_column(
                    sa.Column(
                        "updated_at",
                        sa.DateTime(),
                        nullable=False,
                        server_default=sa.text("CURRENT_TIMESTAMP"),
                    )
                )

    existing_indexes = {index["name"] for index in inspector.get_indexes("runs")}
    if "ix_runs_env" not in existing_indexes:
        op.create_index("ix_runs_env", "runs", ["env"])
    if "ix_runs_agent" not in existing_indexes:
        op.create_index("ix_runs_agent", "runs", ["agent"])
    if "ix_runs_track" not in existing_indexes:
        op.create_index("ix_runs_track", "runs", ["track"])
    if "ix_runs_created_by" not in existing_indexes:
        op.create_index("ix_runs_created_by", "runs", ["created_by"])

    if "api_keys" not in tables:
        op.create_table(
            "api_keys",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("name", sa.String(length=128), nullable=False),
            sa.Column("key_prefix", sa.String(length=32), nullable=False),
            sa.Column("key_hash", sa.String(length=64), nullable=False),
            sa.Column("scopes_json", sa.Text(), nullable=False, server_default="[]"),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("rate_limit_per_minute", sa.Integer(), nullable=False, server_default="120"),
            sa.Column(
                "created_at",
                sa.DateTime(),
                nullable=False,
                server_default=sa.text("CURRENT_TIMESTAMP"),
            ),
            sa.Column("last_used_at", sa.DateTime(), nullable=True),
            sa.UniqueConstraint("key_prefix", name="uq_api_keys_key_prefix"),
            sa.UniqueConstraint("key_hash", name="uq_api_keys_key_hash"),
        )
    else:
        existing_key_columns = {column["name"] for column in inspector.get_columns("api_keys")}
        with op.batch_alter_table("api_keys") as batch:
            if "scopes_json" not in existing_key_columns:
                batch.add_column(
                    sa.Column("scopes_json", sa.Text(), nullable=False, server_default="[]")
                )
            if "is_active" not in existing_key_columns:
                batch.add_column(
                    sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true())
                )
            if "rate_limit_per_minute" not in existing_key_columns:
                batch.add_column(
                    sa.Column(
                        "rate_limit_per_minute",
                        sa.Integer(),
                        nullable=False,
                        server_default="120",
                    )
                )
            if "created_at" not in existing_key_columns:
                batch.add_column(
                    sa.Column(
                        "created_at",
                        sa.DateTime(),
                        nullable=False,
                        server_default=sa.text("CURRENT_TIMESTAMP"),
                    )
                )
            if "last_used_at" not in existing_key_columns:
                batch.add_column(sa.Column("last_used_at", sa.DateTime(), nullable=True))

    api_indexes = {index["name"] for index in inspector.get_indexes("api_keys")}
    if "ix_api_keys_key_prefix" not in api_indexes:
        op.create_index("ix_api_keys_key_prefix", "api_keys", ["key_prefix"], unique=True)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "api_keys" in tables:
        op.drop_table("api_keys")

    if "runs" in tables:
        with op.batch_alter_table("runs") as batch:
            columns = {column["name"] for column in inspector.get_columns("runs")}
            if "created_by" in columns:
                batch.drop_column("created_by")
            if "storage_backend" in columns:
                batch.drop_column("storage_backend")

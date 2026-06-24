"""Normalize artifact path columns to backend-agnostic keys.

Older builds persisted ABSOLUTE host filesystem paths into
``runs.trace_path`` / ``runs.config_path`` (the local backend returned the full
path from ``save_artifact``). Those values are not portable: they break when the
storage root moves and cannot be served by the S3 backend. This migration
rewrites any absolute-looking value to the backend-agnostic key
``"<run_id>/<basename>"`` so a row is portable between local and S3.

Already-agnostic values (relative, no leading slash, no drive letter) are left
untouched, so the upgrade is idempotent. The downgrade is intentionally a no-op:
the agnostic key is strictly more correct and we cannot reconstruct a host
absolute path that may no longer exist.
"""

from __future__ import annotations

import posixpath

import sqlalchemy as sa
from alembic import op

revision = "20260420_01"
down_revision = "20260415_01"
branch_labels = None
depends_on = None


def _looks_absolute(value: str) -> bool:
    # POSIX absolute ("/var/...") or Windows drive/UNC ("C:\\...", "\\\\host\\...").
    if not value:
        return False
    if value.startswith("/") or value.startswith("\\"):
        return True
    return len(value) >= 2 and value[1] == ":" and value[0].isalpha()


def _to_agnostic_key(run_id: str, value: str) -> str:
    # Use the basename so the result is "<run_id>/<filename>" regardless of which
    # host path prefix the legacy value carried.
    basename = value.replace("\\", "/").rstrip("/").rsplit("/", 1)[-1]
    if not basename:
        return value
    return posixpath.join(run_id, basename)


def _normalize_column(bind: sa.engine.Connection, runs: sa.Table, column: sa.Column) -> None:
    rows = bind.execute(sa.select(runs.c.id, column).where(column != "")).fetchall()
    for run_id, value in rows:
        if not value or not _looks_absolute(str(value)):
            continue
        new_value = _to_agnostic_key(str(run_id), str(value))
        if new_value != value:
            bind.execute(
                sa.update(runs).where(runs.c.id == run_id).values({column.name: new_value})
            )


def upgrade() -> None:
    bind = op.get_bind()
    runs = sa.table(
        "runs",
        sa.column("id", sa.String),
        sa.column("trace_path", sa.Text),
        sa.column("config_path", sa.Text),
    )
    _normalize_column(bind, runs, runs.c.trace_path)
    _normalize_column(bind, runs, runs.c.config_path)


def downgrade() -> None:
    # No-op: backend-agnostic keys are the correct representation and the original
    # absolute host paths are neither reconstructable nor desirable to restore.
    pass

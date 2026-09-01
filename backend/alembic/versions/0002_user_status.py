"""Add public profile status column.

Revision ID: 0002_user_status
Revises: 0001_baseline
Create Date: 2026-08-27

"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "0002_user_status"
down_revision: Union[str, Sequence[str], None] = "0001_baseline"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT ''
        """
    )


def downgrade() -> None:
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS status")

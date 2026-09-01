"""Add per-user QR token and PNG.

Revision ID: 0003_user_qr
Revises: 0002_user_status
Create Date: 2026-08-31

"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "0003_user_qr"
down_revision: Union[str, Sequence[str], None] = "0002_user_status"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS qr_token UUID UNIQUE,
        ADD COLUMN IF NOT EXISTS qr_png BYTEA
        """
    )
    op.execute(
        """
        UPDATE users
        SET qr_token = gen_random_uuid()
        WHERE qr_token IS NULL
        """
    )


def downgrade() -> None:
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS qr_png")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS qr_token")

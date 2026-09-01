"""Store APNs device tokens on sessions.

Revision ID: 0005_apns_token
Revises: 0004_user_sessions
Create Date: 2026-08-31

"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "0005_apns_token"
down_revision: Union[str, Sequence[str], None] = "0004_user_sessions"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE user_sessions
        ADD COLUMN IF NOT EXISTS apns_token VARCHAR(256),
        ADD COLUMN IF NOT EXISTS apns_sandbox BOOLEAN NOT NULL DEFAULT TRUE
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_user_sessions_apns_token
        ON user_sessions (apns_token)
        WHERE apns_token IS NOT NULL
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_user_sessions_apns_token")
    op.execute("ALTER TABLE user_sessions DROP COLUMN IF EXISTS apns_sandbox")
    op.execute("ALTER TABLE user_sessions DROP COLUMN IF EXISTS apns_token")

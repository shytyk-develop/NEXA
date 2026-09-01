"""Track signed-in devices per account.

Revision ID: 0004_user_sessions
Revises: 0003_user_qr
Create Date: 2026-08-31

"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "0004_user_sessions"
down_revision: Union[str, Sequence[str], None] = "0003_user_qr"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS user_sessions (
            id SERIAL PRIMARY KEY,
            username VARCHAR(255) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
            device_id UUID NOT NULL,
            device_name VARCHAR(64) NOT NULL DEFAULT '',
            platform VARCHAR(32) NOT NULL DEFAULT 'unknown',
            os_version VARCHAR(64) NOT NULL DEFAULT '',
            last_seen TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (username, device_id)
        )
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_user_sessions_username
        ON user_sessions (username)
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_user_sessions_username")
    op.execute("DROP TABLE IF EXISTS user_sessions")

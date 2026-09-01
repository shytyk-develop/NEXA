"""Muted chats and per-session notification flags.

Revision ID: 0006_push_prefs
Revises: 0005_apns_token
Create Date: 2026-08-31

"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "0006_push_prefs"
down_revision: Union[str, Sequence[str], None] = "0005_apns_token"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE user_sessions
        ADD COLUMN IF NOT EXISTS notify_messages BOOLEAN NOT NULL DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS notify_sound BOOLEAN NOT NULL DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS notify_preview BOOLEAN NOT NULL DEFAULT TRUE
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS muted_chats (
            username VARCHAR(255) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
            partner VARCHAR(255) NOT NULL,
            PRIMARY KEY (username, partner)
        )
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS muted_chats")
    op.execute("ALTER TABLE user_sessions DROP COLUMN IF EXISTS notify_preview")
    op.execute("ALTER TABLE user_sessions DROP COLUMN IF EXISTS notify_sound")
    op.execute("ALTER TABLE user_sessions DROP COLUMN IF EXISTS notify_messages")

"""Per-user removal of a message saved "for everyone".

A share is one row per message (shared_saved_messages); removing it from one
person's Saved Messages must not touch the other's. A dismissal records that
this user removed it, so the catch-up list (GET /api/saved-messages/shared)
stops returning it to them — after a refresh or on a new device too.

Revision ID: 0008_shared_saved_dismissals
Revises: 0007_shared_saved_messages
Create Date: 2026-09-26

"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "0008_shared_saved_dismissals"
down_revision: Union[str, Sequence[str], None] = "0007_shared_saved_messages"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS shared_saved_dismissals (
            message_id INTEGER NOT NULL REFERENCES shared_saved_messages(message_id) ON DELETE CASCADE,
            username VARCHAR(255) NOT NULL,
            dismissed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (message_id, username)
        )
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS shared_saved_dismissals")

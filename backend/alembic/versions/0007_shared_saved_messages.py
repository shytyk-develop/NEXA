"""Messages saved "for everyone" in a 1-on-1 chat.

Only a reference is stored (the message id + the pair) — never content: the
chat is end-to-end encrypted, and each client fills in the text from its own
decrypted history. The row goes with the message (ON DELETE CASCADE); saved
copies already on a device stay there.

Revision ID: 0007_shared_saved_messages
Revises: 0006_push_prefs
Create Date: 2026-09-26

"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "0007_shared_saved_messages"
down_revision: Union[str, Sequence[str], None] = "0006_push_prefs"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS shared_saved_messages (
            message_id INTEGER PRIMARY KEY REFERENCES chat_history(id) ON DELETE CASCADE,
            user_a VARCHAR(255) NOT NULL,
            user_b VARCHAR(255) NOT NULL,
            saved_by VARCHAR(255) NOT NULL,
            saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_shared_saved_pair ON shared_saved_messages (user_a, user_b)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS shared_saved_messages")

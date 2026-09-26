"""Terminated device sessions ("Terminate session" in Settings → Devices).

Terminating deletes the device's user_sessions row and kicks its live
sockets. The row here keeps it out afterwards: a socket join / device
upsert from that device with a token issued before revoked_at is refused
(the client signs out). Signing in again mints a newer token, which clears
the row.

Revision ID: 0009_revoked_device_sessions
Revises: 0008_shared_saved_dismissals
Create Date: 2026-09-26

"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "0009_revoked_device_sessions"
down_revision: Union[str, Sequence[str], None] = "0008_shared_saved_dismissals"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS revoked_device_sessions (
            username VARCHAR(255) NOT NULL,
            device_id UUID NOT NULL,
            revoked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (username, device_id)
        )
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS revoked_device_sessions")

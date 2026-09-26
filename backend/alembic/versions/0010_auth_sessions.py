"""Session-based auth: one row per signed-in browser / device.

Login and register create a session and hand its refresh token to the
browser in an HttpOnly cookie; only the token's SHA-256 is stored here.
POST /api/auth/refresh trades the cookie for a new access token while the
session is alive (active within 7 days and not past expires_at), and
Settings can list / revoke sessions (routers/sessions.py).

Separate from user_sessions (0004), which tracks devices joined over the
WebSocket for presence and push.

Revision ID: 0010_auth_sessions
Revises: 0009_revoked_device_sessions
Create Date: 2026-09-26

"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "0010_auth_sessions"
down_revision: Union[str, Sequence[str], None] = "0009_revoked_device_sessions"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS auth_sessions (
            id UUID PRIMARY KEY,
            username VARCHAR(255) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
            refresh_token_hash CHAR(64) NOT NULL,
            device_name VARCHAR(128) NOT NULL DEFAULT '',
            user_agent VARCHAR(512) NOT NULL DEFAULT '',
            ip_address VARCHAR(64) NOT NULL DEFAULT '',
            last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            expires_at TIMESTAMPTZ NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_sessions_token ON auth_sessions (refresh_token_hash)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_auth_sessions_username ON auth_sessions (username)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_auth_sessions_username")
    op.execute("DROP INDEX IF EXISTS idx_auth_sessions_token")
    op.execute("DROP TABLE IF EXISTS auth_sessions")

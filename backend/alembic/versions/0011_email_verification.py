"""Email on accounts + one-time codes to verify it.

users.email (unique, case-insensitive) and users.is_verified. Accounts made
before this have no email and keep signing in as before; an account with an
email must verify it (a 6-digit code, 15 minutes) before it can sign in.

email_otps holds one pending code per email: only its hash (peppered with
the JWT secret), an expiry, a wrong-attempt counter and when it was last
sent (resend cooldown).

Revision ID: 0011_email_verification
Revises: 0010_auth_sessions
Create Date: 2026-09-27

"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "0011_email_verification"
down_revision: Union[str, Sequence[str], None] = "0010_auth_sessions"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(254)")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE")
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email)) WHERE email IS NOT NULL"
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS email_otps (
            email VARCHAR(254) PRIMARY KEY,
            username VARCHAR(255) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
            code_hash CHAR(64) NOT NULL,
            expires_at TIMESTAMPTZ NOT NULL,
            attempts INTEGER NOT NULL DEFAULT 0,
            last_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS email_otps")
    op.execute("DROP INDEX IF EXISTS idx_users_email_lower")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS is_verified")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS email")

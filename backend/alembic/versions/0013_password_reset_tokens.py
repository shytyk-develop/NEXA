"""Password reset links ("Forgot password?").

One row per emailed reset link: only the SHA-256 of its token (the raw
token lives in the link alone), who it's for, when it dies (15 minutes) and
whether it was used. users is keyed by username, so the link points at
users(username) and goes with the account (ON DELETE CASCADE).

Revision ID: 0013_password_reset_tokens
Revises: 0012_folders
Create Date: 2026-09-27

"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "0013_password_reset_tokens"
down_revision: Union[str, Sequence[str], None] = "0012_folders"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
            id UUID PRIMARY KEY,
            username VARCHAR(255) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
            token_hash CHAR(64) NOT NULL,
            expires_at TIMESTAMPTZ NOT NULL,
            used BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_password_reset_tokens_hash ON password_reset_tokens (token_hash)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_username ON password_reset_tokens (username)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_password_reset_tokens_username")
    op.execute("DROP INDEX IF EXISTS idx_password_reset_tokens_hash")
    op.execute("DROP TABLE IF EXISTS password_reset_tokens")

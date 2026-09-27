"""Chat folders, per account (they used to live in the browser's localStorage).

folders: Work and Personal are fixed roots (kind 'work' / 'personal', one of
each per user, made on first use); custom folders (kind 'custom') sit one
level under a root (parent_id). folder_chats files a 1-on-1 chat — identified
by the partner's username — into a folder (roots included).

Revision ID: 0012_folders
Revises: 0011_email_verification
Create Date: 2026-09-27

"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "0012_folders"
down_revision: Union[str, Sequence[str], None] = "0011_email_verification"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS folders (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            username VARCHAR(255) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
            kind VARCHAR(16) NOT NULL DEFAULT 'custom' CHECK (kind IN ('work', 'personal', 'custom')),
            parent_id UUID REFERENCES folders(id) ON DELETE CASCADE,
            name VARCHAR(32) NOT NULL CHECK (length(btrim(name)) > 0),
            icon VARCHAR(32),
            position INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CHECK ((kind = 'custom') = (parent_id IS NOT NULL))
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS idx_folders_username ON folders (username)")
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_folders_root ON folders (username, kind) WHERE kind <> 'custom'"
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS folder_chats (
            folder_id UUID NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
            partner VARCHAR(255) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
            added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (folder_id, partner)
        )
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS folder_chats")
    op.execute("DROP INDEX IF EXISTS idx_folders_root")
    op.execute("DROP INDEX IF EXISTS idx_folders_username")
    op.execute("DROP TABLE IF EXISTS folders")

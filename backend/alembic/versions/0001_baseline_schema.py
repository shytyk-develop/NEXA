"""Baseline schema matching former database.init_db() final state.

Revision ID: 0001_baseline
Revises:
Create Date: 2026-08-25

"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "0001_baseline"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            username VARCHAR(255) PRIMARY KEY,
            public_key TEXT NOT NULL,
            password_hash TEXT NOT NULL DEFAULT '',
            encrypted_private_key TEXT NOT NULL DEFAULT '',
            display_name VARCHAR(32) NOT NULL DEFAULT '',
            bio VARCHAR(140) NOT NULL DEFAULT '',
            avatar_data TEXT
        )
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_users_username_lower
        ON users (LOWER(username))
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS offline_messages (
            id SERIAL PRIMARY KEY,
            sender VARCHAR(255) NOT NULL,
            receiver VARCHAR(255) NOT NULL,
            content TEXT NOT NULL,
            chat_history_id INTEGER,
            client_message_id VARCHAR(80),
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS chat_history (
            id SERIAL PRIMARY KEY,
            sender VARCHAR(255) NOT NULL,
            receiver VARCHAR(255) NOT NULL,
            content_recipient TEXT NOT NULL,
            content_sender TEXT NOT NULL,
            client_message_id VARCHAR(80),
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            delivered_at TIMESTAMP,
            read_at TIMESTAMP,
            reply_to_message_id INTEGER
        )
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_chat_history_routing
        ON chat_history (sender, receiver)
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_chat_history_sender
        ON chat_history (sender)
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_chat_history_receiver
        ON chat_history (receiver)
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_chat_history_timestamp
        ON chat_history (timestamp)
        """
    )
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_history_client_message_id
        ON chat_history (client_message_id)
        WHERE client_message_id IS NOT NULL
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS conversation_read_state (
            username VARCHAR(255) NOT NULL,
            partner VARCHAR(255) NOT NULL,
            last_read_message_id INTEGER NOT NULL DEFAULT 0,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (username, partner)
        )
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS message_reactions (
            message_id INTEGER NOT NULL,
            username VARCHAR(255) NOT NULL,
            emoji VARCHAR(16) NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (message_id, username)
        )
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id
        ON message_reactions (message_id)
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS message_reactions")
    op.execute("DROP TABLE IF EXISTS conversation_read_state")
    op.execute("DROP TABLE IF EXISTS chat_history")
    op.execute("DROP TABLE IF EXISTS offline_messages")
    op.execute("DROP TABLE IF EXISTS users")

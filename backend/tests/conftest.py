"""Test harness: a throwaway PostgreSQL (pgserver) migrated with the real
Alembic revisions, and the FastAPI app against it.

Everything here runs before `database` is imported: it reads DATABASE_URL at
import time (and load_dotenv() never overrides a variable that is already
set), so the tests can't reach the database or the mail provider in .env.

    cd backend && ../venv/bin/python -m pytest
"""

from __future__ import annotations

import os
import shutil
import sys
import tempfile
from pathlib import Path

import pgserver
import pytest

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

_PGDATA = tempfile.mkdtemp(prefix="nexa-test-pg-")
_server = pgserver.get_server(_PGDATA, cleanup_mode="stop")

os.environ["DATABASE_URL"] = _server.get_uri()
os.environ["JWT_SECRET_KEY"] = "test-secret-key-at-least-32-bytes-long"
os.environ["APP_URL"] = "https://nexa.test"
# No real mail, ever (send functions are stubbed too, see `outbox`).
os.environ["RESEND_API_KEY"] = ""
os.environ["SMTP_HOST"] = ""
# The test client talks plain http: a Secure cookie would never come back.
os.environ["AUTH_COOKIE_SECURE"] = "false"
os.environ["AUTH_COOKIE_SAMESITE"] = "lax"

assert _PGDATA in os.environ["DATABASE_URL"], "tests must run against the throwaway database only"


def _migrate() -> None:
    from alembic import command
    from alembic.config import Config

    config = Config(str(BACKEND / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND / "alembic"))
    command.upgrade(config, "head")


_migrate()

import database  # noqa: E402  (after DATABASE_URL points at the test server)
from fastapi.testclient import TestClient  # noqa: E402
from main import app  # noqa: E402


def pytest_sessionfinish(session, exitstatus):
    database.db_pool.closeall()
    _server.cleanup()
    shutil.rmtree(_PGDATA, ignore_errors=True)


@pytest.fixture(autouse=True)
def clean_db():
    """Every test starts from empty tables."""
    yield
    conn = database.get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("TRUNCATE users, offline_messages, chat_history RESTART IDENTITY CASCADE")
        conn.commit()
    finally:
        database.release_connection(conn)


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def sql():
    """Run one statement against the test database: sql(query, params) → rows (or None)."""

    def run(query: str, params: tuple = ()):
        conn = database.get_connection()
        try:
            with conn.cursor() as cursor:
                cursor.execute(query, params)
                rows = cursor.fetchall() if cursor.description else None
            conn.commit()
            return rows
        finally:
            database.release_connection(conn)

    return run

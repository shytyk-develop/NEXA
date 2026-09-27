"""Forgot / reset password: POST /api/auth/forgot-password and
POST /api/auth/reset-password against a real (throwaway) PostgreSQL."""

from __future__ import annotations

import hashlib

import pytest

import database
from core.auth_sessions import REFRESH_COOKIE
from core.email_verification import render_password_reset_email
from routers import auth as auth_router

OLD_PASSWORD = "old-password-1"
NEW_PASSWORD = "new-password-2"
OLD_KEY = {"kty": "EC", "crv": "P-256", "x": "old-x", "y": "old-y"}
NEW_KEY = {"kty": "EC", "crv": "P-256", "x": "new-x", "y": "new-y"}


@pytest.fixture
def outbox(monkeypatch):
    """Reset mails the endpoint would send: [(email, raw token)]."""
    sent: list[tuple[str, str]] = []

    def fake_send(email, token, **_kwargs):
        sent.append((email, token))
        return True

    monkeypatch.setattr(auth_router, "send_password_reset_email", fake_send)
    return sent


@pytest.fixture
def alice(sql):
    assert database.register_user_db("alice", OLD_PASSWORD, OLD_KEY, "enc-old-private-key", "alice@example.com")
    sql("UPDATE users SET is_verified = TRUE WHERE username = 'alice'")
    return "alice"


def request_link(client, outbox, identifier="alice@example.com") -> str:
    response = client.post("/api/auth/forgot-password", json={"email_or_username": identifier})
    assert response.status_code == 200
    assert outbox, "no reset mail was sent"
    return outbox[-1][1]


def reset(client, token, password=NEW_PASSWORD):
    return client.post(
        "/api/auth/reset-password",
        json={
            "token": token,
            "new_password": password,
            "public_key": NEW_KEY,
            "encrypted_private_key": "enc-new-private-key",
        },
    )


# ─── forgot-password ───


@pytest.mark.parametrize("identifier", ["alice@example.com", "ALICE@Example.com", "alice", " Alice "])
def test_forgot_password_creates_token_and_sends_email(client, outbox, alice, sql, identifier):
    response = client.post("/api/auth/forgot-password", json={"email_or_username": identifier})

    assert response.status_code == 200
    assert len(outbox) == 1
    email, token = outbox[0]
    assert email == "alice@example.com"
    assert len(token) >= 40  # token_urlsafe(32)

    rows = sql(
        "SELECT username, token_hash, used, expires_at - NOW() FROM password_reset_tokens"
    )
    assert len(rows) == 1
    username, token_hash, used, ttl = rows[0]
    assert username == "alice"
    assert used is False
    # Only the hash is stored, never the token itself.
    assert token_hash == hashlib.sha256(token.encode()).hexdigest()
    assert token not in token_hash
    assert 14 * 60 < ttl.total_seconds() <= 15 * 60


def test_forgot_password_unknown_account_gives_the_same_reply(client, outbox, alice, sql):
    known = client.post("/api/auth/forgot-password", json={"email_or_username": "alice@example.com"})
    outbox.clear()
    unknown = client.post("/api/auth/forgot-password", json={"email_or_username": "nobody@example.com"})
    bad = client.post("/api/auth/forgot-password", json={"email_or_username": "not a name!"})

    assert unknown.status_code == bad.status_code == known.status_code == 200
    assert unknown.json() == bad.json() == known.json()
    assert outbox == []
    assert sql("SELECT COUNT(*) FROM password_reset_tokens")[0][0] == 1


def test_forgot_password_account_without_email_gets_no_mail(client, outbox, sql):
    database.register_user_db("legacy", OLD_PASSWORD, OLD_KEY, "enc", None)
    response = client.post("/api/auth/forgot-password", json={"email_or_username": "legacy"})
    assert response.status_code == 200
    assert outbox == []


def test_forgot_password_is_limited_to_one_link_a_minute(client, outbox, alice, sql):
    request_link(client, outbox)
    client.post("/api/auth/forgot-password", json={"email_or_username": "alice"})
    assert len(outbox) == 1
    assert sql("SELECT COUNT(*) FROM password_reset_tokens")[0][0] == 1


def test_a_new_link_kills_the_previous_one(client, outbox, alice, sql):
    first = request_link(client, outbox)
    sql("UPDATE password_reset_tokens SET created_at = NOW() - INTERVAL '2 minutes'")
    second = request_link(client, outbox)
    assert first != second

    assert reset(client, first).status_code == 400
    assert reset(client, second).status_code == 200


# ─── reset-password ───


def test_valid_token_changes_password_and_signs_in(client, outbox, alice, sql):
    # A session from before the reset (another browser).
    old_login = client.post("/api/login", json={"username": "alice", "password": OLD_PASSWORD})
    assert old_login.status_code == 200
    old_refresh_cookie = client.cookies.get(REFRESH_COOKIE)
    client.cookies.clear()

    token = request_link(client, outbox)
    response = reset(client, token)

    assert response.status_code == 200
    body = response.json()
    assert body["username"] == "alice"
    assert body["access_token"]
    assert body["public_key"] == NEW_KEY
    assert body["encrypted_private_key"] == "enc-new-private-key"
    # Signed in: a session cookie came back and the access token works.
    assert client.cookies.get(REFRESH_COOKIE)
    me = client.get("/api/users/resolve/alice", headers={"Authorization": f"Bearer {body['access_token']}"})
    assert me.status_code == 200
    assert client.post("/api/auth/refresh").status_code == 200

    # The password and the key pair were replaced.
    assert database.verify_user_password_db("alice", NEW_PASSWORD)
    assert not database.verify_user_password_db("alice", OLD_PASSWORD)
    keys = database.login_user_db("alice", NEW_PASSWORD)
    assert keys["public_key"] == NEW_KEY
    assert keys["encrypted_private_key"] == "enc-new-private-key"

    # The session from before the reset is gone.
    client.cookies.clear()
    client.cookies.set(REFRESH_COOKIE, old_refresh_cookie, path="/api")
    assert client.post("/api/auth/refresh").status_code == 401
    assert sql("SELECT COUNT(*) FROM auth_sessions WHERE username = 'alice'")[0][0] == 1


def test_reset_verifies_an_unverified_email(client, outbox, sql):
    database.register_user_db("bob", OLD_PASSWORD, OLD_KEY, "enc", "bob@example.com")
    token = request_link(client, outbox, "bob@example.com")
    assert reset(client, token).status_code == 200
    assert sql("SELECT is_verified FROM users WHERE username = 'bob'")[0][0] is True


def test_reused_token_returns_400(client, outbox, alice):
    token = request_link(client, outbox)
    assert reset(client, token).status_code == 200

    again = reset(client, token, password="another-password-3")
    assert again.status_code == 400
    assert "already used" in again.json()["detail"]
    assert database.verify_user_password_db("alice", NEW_PASSWORD)


def test_expired_token_returns_400(client, outbox, alice, sql):
    token = request_link(client, outbox)
    sql("UPDATE password_reset_tokens SET expires_at = NOW() - INTERVAL '1 second'")

    response = reset(client, token)
    assert response.status_code == 400
    assert "expired" in response.json()["detail"]
    assert database.verify_user_password_db("alice", OLD_PASSWORD)


def test_unknown_token_returns_400(client, outbox, alice):
    response = reset(client, "not-a-real-token")
    assert response.status_code == 400
    assert database.verify_user_password_db("alice", OLD_PASSWORD)


def test_short_password_is_rejected_and_the_token_survives(client, outbox, alice):
    token = request_link(client, outbox)
    assert reset(client, token, password="short").status_code == 422
    assert reset(client, token).status_code == 200


def test_reset_drops_the_undelivered_queue(client, outbox, alice, sql):
    sql("INSERT INTO offline_messages (sender, receiver, content) VALUES ('bob', 'alice', 'for-the-old-key')")
    sql("INSERT INTO offline_messages (sender, receiver, content) VALUES ('alice', 'bob', 'stays')")
    assert reset(client, request_link(client, outbox)).status_code == 200
    rows = sql("SELECT receiver FROM offline_messages")
    assert rows == [("bob",)]


# ─── the mail ───


def test_reset_email_carries_the_link():
    link = "https://nexa.test/reset-password?token=abc_DEF-123"
    subject, text, html_body = render_password_reset_email(link, email="alice@example.com")
    assert subject == "Reset your NEXA password"
    assert link in text
    assert f'href="{link}"' in html_body
    assert "Reset Password" in html_body
    assert "This link is valid for 15 minutes" in html_body
    assert "#141414" in html_body

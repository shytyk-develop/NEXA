import os
import re
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from fastapi import Header, HTTPException

JWT_SECRET = os.getenv("JWT_SECRET_KEY", "super_secret_fallback_key_built_32_bytes!!")
JWT_ALGORITHM = "HS256"
USERNAME_RE = re.compile(r"^[a-z0-9_]{3,32}$")


def create_access_token(username: str, session_id: Optional[str] = None) -> str:
    now = datetime.utcnow()
    # iat: a terminated device session only rejects tokens issued before it.
    payload = {"sub": username, "iat": now, "exp": now + timedelta(hours=24)}
    # sid: the auth session (auth_sessions) this token belongs to — revoking
    # the session revokes the token (see _session_alive).
    if session_id:
        payload["sid"] = session_id
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def token_issued_at(authorization: Optional[str]) -> Optional[datetime]:
    """UTC issue time of a Bearer token (None for tokens minted before iat)."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    return issued_at_from_token(authorization[len("Bearer "):].strip())


def issued_at_from_token(token: str) -> Optional[datetime]:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None
    iat = payload.get("iat")
    if not isinstance(iat, (int, float)):
        return None
    return datetime.fromtimestamp(iat, tz=timezone.utc)


def normalize_username(username: str) -> str:
    return username.strip().lower()


def validate_username(username: str):
    if not USERNAME_RE.fullmatch(username):
        raise HTTPException(
            status_code=422,
            detail="Username must be 3-32 characters and contain only lowercase English letters, digits, and underscore.",
        )


# sid → (alive, checked_at): a revoked session's tokens stop working within
# this many seconds, without a database round-trip on every request.
_SESSION_CACHE_SECONDS = 30
_session_cache: dict = {}


def _session_alive(session_id: str) -> bool:
    import database  # local: core.security is imported by database-free modules

    cached = _session_cache.get(session_id)
    now = time.monotonic()
    if cached and now - cached[1] < _SESSION_CACHE_SECONDS:
        return cached[0]
    alive = database.auth_session_exists_db(session_id)
    _session_cache[session_id] = (alive, now)
    if len(_session_cache) > 10000:
        _session_cache.clear()
    return alive


def forget_session(session_id: str) -> None:
    """Drop a revoked session from the cache so its tokens fail at once here."""
    _session_cache.pop(session_id, None)


def decode_bearer(authorization: Optional[str]) -> dict:
    """The verified JWT payload of a Bearer header (401 otherwise, or when its
    session was revoked)."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization token")

    token = authorization[len("Bearer "):].strip()
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    if not payload.get("sub"):
        raise HTTPException(status_code=401, detail="Invalid token subject")
    sid = payload.get("sid")
    if sid and not _session_alive(sid):
        raise HTTPException(status_code=401, detail="Session revoked")
    return payload


def get_current_username(authorization: Optional[str] = Header(default=None)) -> str:
    return normalize_username(decode_bearer(authorization)["sub"])


def get_current_session(authorization: Optional[str] = Header(default=None)) -> tuple[str, Optional[str]]:
    """(username, session id) — the session id is None for tokens minted before sessions."""
    payload = decode_bearer(authorization)
    return normalize_username(payload["sub"]), payload.get("sid")

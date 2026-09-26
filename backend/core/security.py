import os
import re
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from fastapi import Header, HTTPException

JWT_SECRET = os.getenv("JWT_SECRET_KEY", "super_secret_fallback_key_built_32_bytes!!")
JWT_ALGORITHM = "HS256"
USERNAME_RE = re.compile(r"^[a-z0-9_]{3,32}$")


def create_access_token(username: str) -> str:
    now = datetime.utcnow()
    # iat: a terminated device session only rejects tokens issued before it.
    payload = {"sub": username, "iat": now, "exp": now + timedelta(hours=24)}
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


def get_current_username(authorization: Optional[str] = Header(default=None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization token")

    token = authorization[len("Bearer "):].strip()
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        username = payload.get("sub")
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    if not username:
        raise HTTPException(status_code=401, detail="Invalid token subject")
    return normalize_username(username)

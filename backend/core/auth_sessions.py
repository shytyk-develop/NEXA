"""Session-based auth helpers: refresh tokens, the HttpOnly cookie, and the
device / IP a session is labelled with.

The refresh token is a random secret handed to the browser only in an
HttpOnly cookie; the database keeps its SHA-256 (auth_sessions), so a leaked
table can't be replayed. Access tokens stay short-lived JWTs in the JSON
body and carry the session id (`sid`) they were minted for.
"""

from __future__ import annotations

import hashlib
import os
import re
import secrets
from typing import Optional

from fastapi import Request, Response

REFRESH_COOKIE = "refresh_token"
# A session lives while it's used: 7 days since the last refresh.
SESSION_TTL_SECONDS = 7 * 24 * 3600
# Cookie flags. SameSite "lax" only reaches same-site requests: while the
# frontend and the API live on different sites, the refresh call needs
# AUTH_COOKIE_SAMESITE=none (Secure is then mandatory) or a same-site proxy.
COOKIE_SAMESITE = os.getenv("AUTH_COOKIE_SAMESITE", "lax").lower()
COOKIE_SECURE = os.getenv("AUTH_COOKIE_SECURE", "true").lower() != "false"
# The API's own paths only (login / register replace this browser's previous
# session, so they need to see it too).
COOKIE_PATH = "/api"


def new_refresh_token() -> str:
    return secrets.token_urlsafe(48)


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=token,
        max_age=SESSION_TTL_SECONDS,
        httponly=True,
        secure=COOKIE_SECURE or COOKIE_SAMESITE == "none",
        samesite=COOKIE_SAMESITE if COOKIE_SAMESITE in {"lax", "strict", "none"} else "lax",
        path=COOKIE_PATH,
    )


def clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key=REFRESH_COOKIE,
        path=COOKIE_PATH,
        httponly=True,
        secure=COOKIE_SECURE or COOKIE_SAMESITE == "none",
        samesite=COOKIE_SAMESITE if COOKIE_SAMESITE in {"lax", "strict", "none"} else "lax",
    )


def client_ip(request: Request) -> str:
    """The caller's IP: first X-Forwarded-For hop behind a proxy (Render), else the socket peer."""
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()[:64]
    return (request.client.host if request.client else "")[:64]


_OS_RULES = [
    (r"iPhone", "iPhone"),
    (r"iPad", "iPad"),
    (r"Android", "Android"),
    (r"Windows NT", "Windows"),
    (r"CrOS", "ChromeOS"),
    (r"Macintosh|Mac OS X", "Mac"),
    (r"Linux", "Linux"),
]

_BROWSER_RULES = [
    (r"Edg/", "Edge"),
    (r"OPR/|Opera", "Opera"),
    (r"Firefox/|FxiOS/", "Firefox"),
    (r"CriOS/|Chrome/", "Chrome"),
    (r"Safari/", "Safari"),
]


def device_label(user_agent: Optional[str]) -> str:
    """"Mac / Chrome", "iPhone / Safari"… from a User-Agent ("Unknown device" when unparseable)."""
    ua = user_agent or ""
    os_name = next((name for pattern, name in _OS_RULES if re.search(pattern, ua)), "")
    browser = next((name for pattern, name in _BROWSER_RULES if re.search(pattern, ua)), "")
    if os_name and browser:
        return f"{os_name} / {browser}"
    return os_name or browser or "Unknown device"

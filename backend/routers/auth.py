import uuid
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import JSONResponse

import database
from core.auth_sessions import (
    REFRESH_COOKIE,
    SESSION_TTL_SECONDS,
    clear_refresh_cookie,
    client_ip,
    device_label,
    hash_refresh_token,
    new_refresh_token,
    set_refresh_cookie,
)
from core.schemas import LoginRequest, RegisterRequest
from core.security import create_access_token, forget_session, normalize_username, validate_username

router = APIRouter()


def _start_session(request: Request, response: Response, username: str) -> str:
    """Open an auth session for this browser: refresh token → HttpOnly cookie,
    its hash + device / IP → auth_sessions. Returns the access token (bound to
    the session). A re-login from the same browser replaces its old session."""
    previous = request.cookies.get(REFRESH_COOKIE)
    if previous:
        old = database.get_auth_session_by_token_hash_db(hash_refresh_token(previous))
        if old and old["username"] == username:
            database.delete_auth_session_db(old["id"])
            forget_session(old["id"])

    refresh_token = new_refresh_token()
    session_id = str(uuid.uuid4())
    user_agent = request.headers.get("user-agent", "")
    database.create_auth_session_db(
        session_id,
        username,
        hash_refresh_token(refresh_token),
        device_label(user_agent),
        user_agent,
        client_ip(request),
        SESSION_TTL_SECONDS,
    )
    set_refresh_cookie(response, refresh_token)
    return create_access_token(username, session_id)


def _unauthorized(detail: str) -> JSONResponse:
    """401 that also drops the refresh cookie (an HTTPException would lose it)."""
    response = JSONResponse(status_code=401, content={"detail": detail})
    clear_refresh_cookie(response)
    return response


@router.post("/api/register")
async def register(req: RegisterRequest, request: Request, response: Response):
    username = normalize_username(req.username)
    validate_username(username)

    success = database.register_user_db(username, req.password, req.public_key, req.encrypted_private_key)
    if not success:
        raise HTTPException(status_code=400, detail="Username is already taken")
    access_token = _start_session(request, response, username)
    return {"message": "Registration successful", "access_token": access_token}


@router.post("/api/login")
async def login(req: LoginRequest, request: Request, response: Response):
    username = normalize_username(req.username)
    validate_username(username)

    user_keys = database.login_user_db(username, req.password)
    if user_keys is None:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    # The refresh token goes out only as an HttpOnly cookie, never in the body.
    access_token = _start_session(request, response, username)
    return {
        "message": "Login successful",
        "access_token": access_token,
        "public_key": user_keys["public_key"],
        "encrypted_private_key": user_keys["encrypted_private_key"],
    }


@router.post("/api/auth/refresh")
async def refresh(request: Request, response: Response):
    """Silent refresh: the refresh cookie → a new access token, while the
    session is alive (used within 7 days, not past expires_at). Each refresh
    slides the session (and the cookie) another 7 days."""
    token: Optional[str] = request.cookies.get(REFRESH_COOKIE)
    if not token:
        return _unauthorized("No session")

    session = database.get_auth_session_by_token_hash_db(hash_refresh_token(token))
    if session is None:
        return _unauthorized("Session not found")

    if not database.is_auth_session_alive_db(session["id"], SESSION_TTL_SECONDS):
        database.delete_auth_session_db(session["id"])
        forget_session(session["id"])
        return _unauthorized("Session expired")

    database.touch_auth_session_db(session["id"], SESSION_TTL_SECONDS)
    set_refresh_cookie(response, token)
    return {"access_token": create_access_token(session["username"], session["id"])}


@router.post("/api/auth/logout")
async def logout(request: Request, response: Response):
    """End this browser's session (idempotent) and drop its cookie."""
    token = request.cookies.get(REFRESH_COOKIE)
    if token:
        session = database.get_auth_session_by_token_hash_db(hash_refresh_token(token))
        if session:
            database.delete_auth_session_db(session["id"])
            forget_session(session["id"])
    clear_refresh_cookie(response)
    return {"message": "Logged out"}

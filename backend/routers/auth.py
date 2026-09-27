import asyncio
import logging
import re
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
from core.email_verification import (
    OTP_MAX_ATTEMPTS,
    OTP_RESEND_COOLDOWN_SECONDS,
    OTP_TTL_SECONDS,
    hash_otp,
    is_valid_email,
    new_otp_code,
    normalize_email,
    send_otp_email,
)
from core.schemas import LoginRequest, RegisterRequest, ResendOtpRequest, VerifyEmailRequest
from core.security import create_access_token, forget_session, normalize_username, validate_username

router = APIRouter()
logger = logging.getLogger("nexa.auth")


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


async def _issue_otp(email: str, username: str, cooldown: int = OTP_RESEND_COOLDOWN_SECONDS) -> bool:
    """Store and mail a fresh code. False (nothing sent) inside the resend
    cooldown. A mail provider failure is logged; the code stays valid, so a
    resend can retry."""
    code = new_otp_code()
    stored = await asyncio.to_thread(
        database.store_email_otp_db, email, username, hash_otp(email, code), OTP_TTL_SECONDS, cooldown
    )
    if not stored:
        return False
    try:
        await asyncio.to_thread(send_otp_email, email, code)
    except Exception:
        logger.exception("Could not send the verification email to %s", email)
    return True


@router.post("/api/register")
async def register(req: RegisterRequest):
    """Create an unverified account and email it a 6-digit code. The session
    starts once the code is confirmed (/api/auth/verify-email)."""
    username = normalize_username(req.username)
    validate_username(username)
    email = normalize_email(req.email)
    if not is_valid_email(email):
        raise HTTPException(status_code=422, detail="Enter a valid email address")
    if database.email_in_use_db(email):
        raise HTTPException(status_code=400, detail="This email is already in use")

    success = database.register_user_db(username, req.password, req.public_key, req.encrypted_private_key, email)
    if not success:
        raise HTTPException(status_code=400, detail="Username is already taken")
    await _issue_otp(email, username, cooldown=0)
    return {"message": "Verification code sent to email", "email": email}


@router.post("/api/login")
async def login(req: LoginRequest, request: Request, response: Response):
    username = normalize_username(req.username)
    validate_username(username)

    user_keys = database.login_user_db(username, req.password)
    if user_keys is None:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    # An account with an email signs in only once it's verified; a fresh code
    # goes out (once a minute at most). Accounts from before emails have none.
    if user_keys.get("email") and not user_keys.get("is_verified"):
        email = normalize_email(user_keys["email"])
        await _issue_otp(email, username)
        return JSONResponse(
            status_code=403,
            content={"detail": "Verify your email to sign in", "code": "email_not_verified", "email": email},
        )

    # The refresh token goes out only as an HttpOnly cookie, never in the body.
    access_token = _start_session(request, response, username)
    return {
        "message": "Login successful",
        "access_token": access_token,
        "public_key": user_keys["public_key"],
        "encrypted_private_key": user_keys["encrypted_private_key"],
    }


_OTP_ERRORS = {
    "invalid": "That code isn't right. Check it and try again.",
    "expired": "This code has expired. Request a new one.",
    "locked": "Too many wrong attempts. Request a new code.",
    "missing": "No code is pending for this email. Request a new one.",
}


@router.post("/api/auth/verify-email")
async def verify_email(req: VerifyEmailRequest, request: Request, response: Response):
    """The emailed code → the account is verified and signed in (session
    cookie + access token, plus the keys login would return)."""
    email = normalize_email(req.email)
    code = (req.code or "").strip()
    if not re.fullmatch(r"\d{6}", code) or not is_valid_email(email):
        raise HTTPException(status_code=400, detail=_OTP_ERRORS["invalid"])

    status, username = await asyncio.to_thread(
        database.consume_email_otp_db, email, hash_otp(email, code), OTP_MAX_ATTEMPTS
    )
    if status != "ok" or not username:
        raise HTTPException(status_code=400, detail=_OTP_ERRORS.get(status, _OTP_ERRORS["invalid"]))

    account = database.get_user_by_email_db(email)
    access_token = _start_session(request, response, username)
    return {
        "message": "Email verified",
        "access_token": access_token,
        "username": username,
        "public_key": account["public_key"] if account else None,
        "encrypted_private_key": account["encrypted_private_key"] if account else None,
    }


@router.post("/api/auth/resend-otp")
async def resend_otp(req: ResendOtpRequest):
    """A new code, at most once a minute (429 with retry_after inside the
    cooldown). Doesn't reveal whether an email has an account."""
    email = normalize_email(req.email)
    generic = {"message": "If this email needs verifying, a new code is on its way.", "retry_after": OTP_RESEND_COOLDOWN_SECONDS}
    if not is_valid_email(email):
        return generic
    account = database.get_user_by_email_db(email)
    if not account or account["is_verified"]:
        return generic
    if not await _issue_otp(email, account["username"]):
        retry_after = database.email_otp_retry_after_db(email, OTP_RESEND_COOLDOWN_SECONDS)
        return JSONResponse(
            status_code=429,
            content={"detail": f"Wait {retry_after}s before requesting another code", "retry_after": retry_after},
        )
    return generic


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

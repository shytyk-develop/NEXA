"""Settings → Devices: this account's auth sessions (auth_sessions)."""

import uuid
from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Response

import database
from core.auth_sessions import clear_refresh_cookie
from core.security import forget_session, get_current_session

router = APIRouter()


@router.get("/api/sessions/my")
async def list_my_sessions(authorization: Optional[str] = Header(default=None)):
    """Active sessions, most recently used first; the caller's is flagged."""
    username, current_id = get_current_session(authorization)
    sessions = database.list_auth_sessions_db(username)
    for session in sessions:
        session["is_current_device"] = session["id"] == current_id
    return {"sessions": sessions}


# Declared before /{session_id} so "revoke-others" isn't read as an id.
@router.delete("/api/sessions/revoke-others")
async def revoke_other_sessions(authorization: Optional[str] = Header(default=None)):
    """Sign out every other session of this account, keeping the caller's."""
    username, current_id = get_current_session(authorization)
    if not current_id:
        raise HTTPException(status_code=400, detail="Sign in again to manage sessions")
    others = [s["id"] for s in database.list_auth_sessions_db(username) if s["id"] != current_id]
    revoked = database.delete_other_auth_sessions_db(username, current_id)
    for session_id in others:
        forget_session(session_id)
    return {"revoked": revoked}


@router.delete("/api/sessions/{session_id}")
async def revoke_session(session_id: str, response: Response, authorization: Optional[str] = Header(default=None)):
    """Force sign-out of one session (its refresh cookie stops working and
    its access tokens are refused within ~30s)."""
    username, current_id = get_current_session(authorization)
    try:
        target = str(uuid.UUID(session_id))
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid session id")
    if not database.delete_auth_session_db(target, username):
        raise HTTPException(status_code=404, detail="No such session")
    forget_session(target)
    if target == current_id:
        clear_refresh_cookie(response)
    return {"revoked": target}

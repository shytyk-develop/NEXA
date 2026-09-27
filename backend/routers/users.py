from typing import Optional
from urllib.parse import unquote

from fastapi import APIRouter, Header, HTTPException, Query

import database
from core.security import USERNAME_RE, get_current_username, normalize_username, validate_username
from ws_manager import manager

router = APIRouter()


@router.get("/api/users/search")
async def search_users(
    q: str = Query(""),
    limit: int = Query(20),
    authorization: Optional[str] = Header(default=None),
):
    current_username = get_current_username(authorization)
    query = normalize_username(q)

    if len(query) < 2:
        return []

    if not USERNAME_RE.fullmatch(query):
        raise HTTPException(
            status_code=422,
            detail="Search can contain only lowercase English letters, digits, and underscore.",
        )

    return database.search_users_db(query, current_username, limit=limit)


@router.get("/api/users/resolve/{username}")
async def resolve_user(username: str, authorization: Optional[str] = Header(default=None)):
    """Deeplink target (/chat/@alex): the public card for a handle, `@` optional."""
    get_current_username(authorization)
    handle = normalize_username(unquote(username)).lstrip("@")
    # A malformed handle can't belong to anyone: same answer as a missing one.
    user = database.resolve_user_db(handle) if USERNAME_RE.fullmatch(handle) else None
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "username": user["username"],
        "display_name": user["display_name"] or user["username"],
        "avatar_url": user["avatar_data"],
        "public_key": user["public_key"],
        "is_online": manager.is_visibly_online(user["username"]),
    }


@router.get("/api/users/{username}")
async def get_user(username: str, authorization: Optional[str] = Header(default=None)):
    get_current_username(authorization)
    normalized_username = normalize_username(username)
    validate_username(normalized_username)

    user = database.get_user_db(normalized_username)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user

from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Query

import database
from core.security import USERNAME_RE, get_current_username, normalize_username, validate_username

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


@router.get("/api/users/{username}")
async def get_user(username: str, authorization: Optional[str] = Header(default=None)):
    get_current_username(authorization)
    normalized_username = normalize_username(username)
    validate_username(normalized_username)

    user = database.get_user_db(normalized_username)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user

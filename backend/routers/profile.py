import re
from typing import Optional

from fastapi import APIRouter, Header, HTTPException

import database
from core.schemas import ProfileUpdateRequest
from core.security import get_current_username
from ws_manager import manager

router = APIRouter()

PROFILE_DISPLAY_NAME_MAX = 32
PROFILE_BIO_MAX = 140
PROFILE_AVATAR_MAX_LEN = 700_000


def sanitize_profile_field(value: str, max_len: int) -> str:
    if not isinstance(value, str):
        return ""
    cleaned = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", value.strip())
    return cleaned[:max_len]


def validate_avatar_data(value: Optional[str]) -> Optional[str]:
    if value is None or value == "":
        return None
    if not isinstance(value, str) or not value.startswith("data:image/"):
        raise HTTPException(status_code=422, detail="Avatar must be a data:image/ URL.")
    if len(value) > PROFILE_AVATAR_MAX_LEN:
        raise HTTPException(status_code=422, detail="Avatar image is too large.")
    return value


@router.put("/api/profile")
async def update_profile(req: ProfileUpdateRequest, authorization: Optional[str] = Header(default=None)):
    current_username = get_current_username(authorization)
    display_name = sanitize_profile_field(req.display_name, PROFILE_DISPLAY_NAME_MAX)
    bio = sanitize_profile_field(req.bio, PROFILE_BIO_MAX)
    avatar_data = validate_avatar_data(req.avatar_data)

    updated = database.update_user_profile_db(current_username, display_name, bio, avatar_data)
    if not updated:
        raise HTTPException(status_code=404, detail="User not found")

    profile = {
        "display_name": display_name,
        "bio": bio,
        "avatar_data": avatar_data,
    }
    await manager.broadcast_profile_update(current_username, profile)
    return {"username": current_username, **profile}

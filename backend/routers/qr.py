from typing import Optional

from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import Response

import database
from core.security import get_current_username

router = APIRouter()


@router.get("/api/me/qr")
async def get_my_qr(authorization: Optional[str] = Header(default=None)):
    current_username = get_current_username(authorization)
    qr = database.ensure_user_qr_db(current_username)
    if qr is None:
        raise HTTPException(status_code=404, detail="User not found")
    return Response(
        content=qr["png"],
        media_type="image/png",
        headers={
            "Cache-Control": "private, no-store",
            "Content-Disposition": f'inline; filename="nexa-qr-{current_username}.png"',
        },
    )


@router.get("/api/me/qr/meta")
async def get_my_qr_meta(authorization: Optional[str] = Header(default=None)):
    current_username = get_current_username(authorization)
    qr = database.ensure_user_qr_db(current_username)
    if qr is None:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "username": qr["username"],
        "payload": qr["payload"],
    }

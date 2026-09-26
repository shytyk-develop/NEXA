from typing import Optional

from fastapi import APIRouter, Header, HTTPException

import database
from core.schemas import SaveMessageRequest
from core.security import get_current_username, normalize_username, validate_username
from ws_manager import manager

router = APIRouter()


@router.post("/api/saved-messages")
async def save_message(body: SaveMessageRequest, authorization: Optional[str] = Header(default=None)):
    """Save for everyone: both participants get the message in Saved Messages
    (live over WS). Only a reference is stored — the chat is end-to-end
    encrypted, so the text never reaches the server; each client reads it from
    its own history. A personal save (save_for_everyone=False) stays on the
    user's device and stores nothing here."""
    current_username = get_current_username(authorization)
    if not body.save_for_everyone:
        return {"shared": False, "message_id": body.message_id}

    metadata = database.save_shared_message_db(current_username, body.message_id)
    if not metadata:
        raise HTTPException(status_code=404, detail="Message not found")
    await manager.notify_shared_message_saved(metadata)
    return {"shared": True, **metadata}


@router.get("/api/saved-messages/shared")
async def get_shared_saved(partner: str, authorization: Optional[str] = Header(default=None)):
    """Messages saved for everyone in one chat — lets a device that was
    offline (or a new one) catch up when the chat opens."""
    current_username = get_current_username(authorization)
    partner = normalize_username(partner)
    validate_username(partner)
    return database.get_shared_saved_messages_db(current_username, partner)

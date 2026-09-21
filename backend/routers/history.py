from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Query

import database
from core.security import get_current_username, normalize_username, validate_username
from ws_manager import manager

router = APIRouter()


@router.get("/api/history")
async def get_history(
    user: str,
    partner: str,
    limit: int = Query(50),
    offset: int = Query(0),
    authorization: Optional[str] = Header(default=None),
):
    current_username = get_current_username(authorization)
    user = normalize_username(user)
    partner = normalize_username(partner)
    validate_username(user)
    validate_username(partner)

    if user != current_username:
        raise HTTPException(status_code=403, detail="Cannot read history for another user")

    return database.get_chat_history_db(user, partner, limit=limit, offset=offset)


@router.get("/api/chats")
async def get_chats(limit: int = Query(50), authorization: Optional[str] = Header(default=None)):
    current_username = get_current_username(authorization)
    return database.get_chat_partners_db(current_username, limit=limit)


@router.delete("/api/history/message/{message_id}")
async def delete_message(message_id: int, authorization: Optional[str] = Header(default=None)):
    current_username = get_current_username(authorization)
    metadata = database.delete_chat_message_db(current_username, message_id)
    if not metadata:
        raise HTTPException(status_code=404, detail="Message not found")
    await manager.notify_message_deleted(metadata)
    return {"deleted": True, **metadata}


@router.delete("/api/history/conversation/{partner}")
async def delete_conversation(partner: str, authorization: Optional[str] = Header(default=None)):
    current_username = get_current_username(authorization)
    normalized_partner = normalize_username(partner)
    validate_username(normalized_partner)

    deleted_count = database.delete_conversation_db(current_username, normalized_partner)
    await manager.notify_conversation_deleted(current_username, normalized_partner)
    return {"deleted": True, "count": deleted_count}

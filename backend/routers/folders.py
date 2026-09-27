"""Chat folders (sidebar → Folders): Work / Personal and custom folders under
them, with the chats filed into each. Stored per account (database.py)."""

import uuid
from typing import Optional

from fastapi import APIRouter, Header, HTTPException

import database
from core.schemas import FolderCreateRequest, FolderUpdateRequest
from core.security import get_current_username

router = APIRouter()

MAX_NAME = 32
MAX_ICON = 32
MAX_CHATS = 500


def _clean_name(name: Optional[str]) -> str:
    cleaned = " ".join((name or "").split())
    if not cleaned:
        raise HTTPException(status_code=422, detail="Folder name can't be empty")
    if len(cleaned) > MAX_NAME:
        raise HTTPException(status_code=422, detail=f"Folder name is limited to {MAX_NAME} characters")
    return cleaned


def _clean_icon(icon: Optional[str]) -> Optional[str]:
    if icon is None:
        return None
    icon = icon.strip()
    if len(icon) > MAX_ICON:
        raise HTTPException(status_code=422, detail=f"Icon name is limited to {MAX_ICON} characters")
    return icon or None


def _clean_chat_ids(chat_ids: Optional[list[str]]) -> Optional[list[str]]:
    if chat_ids is None:
        return None
    if len(chat_ids) > MAX_CHATS:
        raise HTTPException(status_code=422, detail=f"A folder holds at most {MAX_CHATS} chats")
    return chat_ids


def _parse_id(folder_id: str) -> str:
    try:
        return str(uuid.UUID(folder_id))
    except ValueError:
        raise HTTPException(status_code=404, detail="No such folder")


@router.get("/api/folders")
async def list_folders(authorization: Optional[str] = Header(default=None)):
    """Every folder of this account (Work, Personal, then custom by position) with its chat_ids."""
    username = get_current_username(authorization)
    return {"folders": database.list_folders_db(username)}


@router.post("/api/folders", status_code=201)
async def create_folder(req: FolderCreateRequest, authorization: Optional[str] = Header(default=None)):
    username = get_current_username(authorization)
    if req.root not in ("work", "personal"):
        raise HTTPException(status_code=422, detail="root must be 'work' or 'personal'")
    folder_id = _parse_id(req.id) if req.id else None
    folder = database.create_folder_db(
        username,
        req.root,
        _clean_name(req.name),
        _clean_icon(req.icon),
        _clean_chat_ids(req.chat_ids) or [],
        folder_id=folder_id,
        position=req.position,
    )
    if folder is None:
        raise HTTPException(status_code=409, detail="A folder with this id already exists")
    return folder


@router.put("/api/folders/{folder_id}")
async def update_folder(folder_id: str, req: FolderUpdateRequest, authorization: Optional[str] = Header(default=None)):
    """Rename, re-icon, reorder a custom folder, or replace any folder's chat_ids."""
    username = get_current_username(authorization)
    target = _parse_id(folder_id)
    fields = req.model_fields_set
    error = database.update_folder_db(
        username,
        target,
        name=_clean_name(req.name) if "name" in fields else None,
        icon=_clean_icon(req.icon) if "icon" in fields else None,
        clear_icon="icon" in fields and not (req.icon or "").strip(),
        position=req.position if "position" in fields else None,
        chat_ids=_clean_chat_ids(req.chat_ids) if "chat_ids" in fields else None,
    )
    if error == "not_found":
        raise HTTPException(status_code=404, detail="No such folder")
    if error == "root_locked":
        raise HTTPException(status_code=400, detail="Work and Personal can only change their chats")
    return database.get_folder_db(username, target)


@router.delete("/api/folders/{folder_id}")
async def delete_folder(folder_id: str, authorization: Optional[str] = Header(default=None)):
    """Delete a custom folder. The chats themselves stay; only the grouping goes."""
    username = get_current_username(authorization)
    target = _parse_id(folder_id)
    error = database.delete_folder_db(username, target)
    if error == "not_found":
        raise HTTPException(status_code=404, detail="No such folder")
    if error == "root_locked":
        raise HTTPException(status_code=400, detail="Work and Personal can't be deleted")
    return {"deleted": target}

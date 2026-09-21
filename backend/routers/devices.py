from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Query

import database
from core.schemas import DeviceUpsertRequest, MutedPartnersRequest
from core.security import USERNAME_RE, get_current_username, normalize_username
from ws_manager import manager

router = APIRouter()


@router.put("/api/me/device")
async def upsert_my_device(req: DeviceUpsertRequest, authorization: Optional[str] = Header(default=None)):
    current_username = get_current_username(authorization)
    session = database.upsert_user_session_db(
        current_username,
        req.device_id,
        req.device_name,
        req.platform,
        req.os_version,
        apns_token=req.apns_token,
        apns_sandbox=req.apns_sandbox,
        notify_messages=req.notify_messages,
        notify_sound=req.notify_sound,
        notify_preview=req.notify_preview,
    )
    if session is None:
        raise HTTPException(status_code=422, detail="Invalid device_id")
    parsed_id = database.parse_device_id(req.device_id)
    session["online"] = parsed_id in manager.online_device_ids(current_username)
    session["this_device"] = True
    return session


@router.get("/api/me/devices")
async def list_my_devices(
    authorization: Optional[str] = Header(default=None),
    device_id: Optional[str] = Query(default=None),
):
    current_username = get_current_username(authorization)
    current_id = database.parse_device_id(device_id)
    online_ids = manager.online_device_ids(current_username)
    devices = []
    for session in database.list_user_sessions_db(current_username):
        sid = session["device_id"]
        session["online"] = sid in online_ids
        session["this_device"] = bool(current_id and sid == current_id)
        devices.append(session)
    return {"devices": devices}


@router.put("/api/me/muted")
async def set_muted_partners(req: MutedPartnersRequest, authorization: Optional[str] = Header(default=None)):
    current_username = get_current_username(authorization)
    partners = []
    for raw in req.partners:
        partner = normalize_username(raw)
        if USERNAME_RE.fullmatch(partner) and partner != current_username:
            partners.append(partner)
    saved = database.set_muted_partners_db(current_username, partners)
    return {"partners": saved}

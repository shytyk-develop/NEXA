from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Query

import database
from core.schemas import DeviceUpsertRequest, MutedPartnersRequest
from core.security import USERNAME_RE, get_current_username, normalize_username, token_issued_at
from ws_manager import manager

router = APIRouter()


@router.put("/api/me/device")
async def upsert_my_device(req: DeviceUpsertRequest, authorization: Optional[str] = Header(default=None)):
    current_username = get_current_username(authorization)
    if database.is_device_session_revoked_db(current_username, req.device_id, token_issued_at(authorization)):
        raise HTTPException(status_code=401, detail="Session terminated")
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


@router.delete("/api/me/devices/{device_id}")
async def terminate_my_device(
    device_id: str,
    authorization: Optional[str] = Header(default=None),
    current_device_id: Optional[str] = Query(default=None),
):
    """Terminate another device's session: its row goes, its live sockets are
    told to sign out, and its current token can't bring it back (see
    revoked_device_sessions). This device signs out with Log out instead."""
    current_username = get_current_username(authorization)
    target = database.parse_device_id(device_id)
    if not target:
        raise HTTPException(status_code=422, detail="Invalid device_id")
    if target == database.parse_device_id(current_device_id):
        raise HTTPException(status_code=400, detail="Use Log out to end this device's session")
    if not database.terminate_user_session_db(current_username, target):
        raise HTTPException(status_code=404, detail="No such session")
    await manager.terminate_device(current_username, target)
    return {"terminated": target}


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

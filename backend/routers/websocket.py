import json

import jwt
from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from core.security import JWT_ALGORITHM, JWT_SECRET, USERNAME_RE, normalize_username
from ws_manager import manager

router = APIRouter()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(None)):
    if not token:
        print("❌ Handshake blocked: missing token parameter")
        await websocket.close(code=1008, reason="Missing token")
        return

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        token_username = normalize_username(payload.get("sub", ""))
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        print("❌ Handshake blocked: invalid or expired token signature")
        await websocket.close(code=1008, reason="Invalid token")
        return

    await manager.connect(websocket)
    try:
        while True:
            data_str = await websocket.receive_text()
            data = json.loads(data_str)

            if data["type"] == "join":
                username = normalize_username(data["username"])
                if not USERNAME_RE.fullmatch(username):
                    await websocket.close(code=1008, reason="Invalid username")
                    return

                if username != token_username:
                    print("⚠️ Security alert: Identity theft attempt detected from token payload context")
                    await websocket.close(code=1008, reason="Identity theft detected")
                    return

                await manager.register_user(
                    websocket,
                    username,
                    data["public_key"],
                    share_presence=bool(data.get("share_presence", True)),
                    device_id=data.get("device_id"),
                    device_name=data.get("device_name"),
                    platform=data.get("platform"),
                    os_version=data.get("os_version"),
                )
                await manager.broadcast_users_list()

            elif data["type"] == "message":
                await manager.send_personal_message(data, websocket)

            elif data["type"] == "typing":
                await manager.handle_typing(data, websocket)

            elif data["type"] == "delivery_ack":
                await manager.handle_delivery_ack(data, websocket)

            elif data["type"] == "read_receipt":
                await manager.handle_read_receipt(data, websocket)

            elif data["type"] == "chat_focus":
                await manager.handle_chat_focus(data, websocket)

            elif data["type"] == "presence_setting":
                await manager.handle_presence_setting(data, websocket)

            elif data["type"] == "reaction":
                await manager.handle_reaction(data, websocket)

    except WebSocketDisconnect:
        await manager.disconnect(websocket)

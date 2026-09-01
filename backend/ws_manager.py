# backend/ws_manager.py
from fastapi import WebSocket
import json
import asyncio
from typing import Dict, Any, Optional, Set

import database


class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[WebSocket, Dict[str, Any]] = {}
        self.username_to_websockets: Dict[str, Set[WebSocket]] = {}
        self.online_usernames: Set[str] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[websocket] = {
            "username": None,
            "public_key": None,
            "active_chat": None,
            "device_id": None,
        }

    async def disconnect(self, websocket: WebSocket):
        session = self.active_connections.pop(websocket, None)
        username = session.get("username") if session else None
        if not username:
            return

        sockets = self.username_to_websockets.get(username)
        if sockets:
            sockets.discard(websocket)
            if not sockets:
                del self.username_to_websockets[username]

        remaining = self.username_to_websockets.get(username, set())
        if remaining:
            if not self._user_shares_presence(username):
                await self.broadcast_presence(username, False)
            return

        self.online_usernames.discard(username)
        await self.broadcast_presence(username, False)

    def get_websockets_for_user(self, username: str) -> list:
        return list(self.username_to_websockets.get(username, set()))

    def get_websocket_for_user(self, username: str) -> Optional[WebSocket]:
        sockets = self.get_websockets_for_user(username)
        return sockets[0] if sockets else None

    def online_device_ids(self, username: str) -> Set[str]:
        ids: Set[str] = set()
        for ws in self.username_to_websockets.get(username, set()):
            device_id = self.active_connections.get(ws, {}).get("device_id")
            if device_id:
                ids.add(device_id)
        return ids

    def _session_username(self, websocket: WebSocket) -> Optional[str]:
        return self.active_connections.get(websocket, {}).get("username")

    def _user_shares_presence(self, username: str) -> bool:
        for ws in self.username_to_websockets.get(username, set()):
            if self.active_connections.get(ws, {}).get("share_presence", True):
                return True
        return False

    def _visible_online_usernames(self) -> list:
        return sorted(
            username
            for username in self.online_usernames
            if self._user_shares_presence(username)
        )

    async def register_user(
        self,
        websocket: WebSocket,
        username: str,
        public_key: str,
        share_presence: bool = True,
        device_id: Optional[str] = None,
        device_name: Optional[str] = None,
        platform: Optional[str] = None,
        os_version: Optional[str] = None,
    ):
        parsed_device_id = database.parse_device_id(device_id)
        sockets = self.username_to_websockets.setdefault(username, set())

        if parsed_device_id:
            for existing in list(sockets):
                if existing is websocket:
                    continue
                if self.active_connections.get(existing, {}).get("device_id") != parsed_device_id:
                    continue
                await self.disconnect(existing)
                try:
                    await existing.close(code=1000, reason="Replaced by a newer session")
                except Exception:
                    pass

        had_other_devices = any(ws is not websocket for ws in self.username_to_websockets.get(username, set()))

        self.active_connections[websocket]["username"] = username
        self.active_connections[websocket]["public_key"] = public_key
        self.active_connections[websocket]["share_presence"] = share_presence
        self.active_connections[websocket]["device_id"] = parsed_device_id
        profile = await asyncio.to_thread(database.get_user_profile_db, username)
        if profile:
            self.active_connections[websocket]["display_name"] = profile.get("display_name", "")
            self.active_connections[websocket]["bio"] = profile.get("bio", "")
            self.active_connections[websocket]["avatar_data"] = profile.get("avatar_data")
            self.active_connections[websocket]["status"] = profile.get("status") or ""
        self.username_to_websockets.setdefault(username, set()).add(websocket)
        self.online_usernames.add(username)

        if parsed_device_id:
            await asyncio.to_thread(
                database.upsert_user_session_db,
                username,
                parsed_device_id,
                device_name or "",
                platform or "unknown",
                os_version or "",
            )

        await self._send_json(websocket, {
            "type": "presence_sync",
            "online": self._visible_online_usernames() if share_presence else [],
        })
        if share_presence:
            await self.broadcast_presence(username, True, exclude=websocket)

        if not had_other_devices:
            offline_msgs = await asyncio.to_thread(
                database.get_and_delete_offline_messages, username
            )
            for msg in offline_msgs:
                packet = {
                    "type": "message",
                    "from": msg["sender"],
                    "content": msg["content"],
                    "id": msg.get("id"),
                    "client_message_id": msg.get("client_message_id"),
                    "timestamp": msg.get("timestamp"),
                }
                await websocket.send_text(json.dumps(packet))

        return True

    async def broadcast_presence(self, username: str, is_online: bool, exclude: Optional[WebSocket] = None):
        if is_online and not self._user_shares_presence(username):
            return

        payload = {
            "type": "presence",
            "username": username,
            "online": is_online,
        }
        for ws in list(self.active_connections.keys()):
            if ws is exclude:
                continue
            try:
                await self._send_json(ws, payload)
            except Exception:
                await self.disconnect(ws)

    async def broadcast_users_list(self):
        seen = {}
        for session in self.active_connections.values():
            username = session.get("username")
            if not username or not session.get("public_key") or username in seen:
                continue
            seen[username] = {
                "username": username,
                "public_key": session["public_key"],
                "display_name": session.get("display_name", ""),
                "bio": session.get("bio", ""),
                "avatar_data": session.get("avatar_data"),
                "status": session.get("status") or "",
            }
        users_from_db = list(seen.values())
        message = {"type": "users_list", "users": users_from_db}
        message_json = json.dumps(message)
        for ws in list(self.active_connections.keys()):
            try:
                await ws.send_text(message_json)
            except Exception:
                await self.disconnect(ws)

    async def set_user_profile(self, username: str, profile: dict):
        for ws in self.get_websockets_for_user(username):
            session = self.active_connections.get(ws)
            if not session:
                continue
            session["display_name"] = profile.get("display_name", "")
            session["bio"] = profile.get("bio", "")
            session["avatar_data"] = profile.get("avatar_data")
            if "status" in profile:
                session["status"] = profile.get("status") or ""

    async def broadcast_profile_update(self, username: str, profile: dict):
        await self.set_user_profile(username, profile)
        payload = {
            "type": "profile_updated",
            "username": username,
            "display_name": profile.get("display_name", ""),
            "bio": profile.get("bio", ""),
            "avatar_data": profile.get("avatar_data"),
            "status": profile.get("status") or "",
        }
        for ws in list(self.active_connections.keys()):
            try:
                await self._send_json(ws, payload)
            except Exception:
                await self.disconnect(ws)

    async def _send_json(self, websocket: WebSocket, payload: dict):
        await websocket.send_text(json.dumps(payload))

    async def _notify_user(self, username: str, payload: dict):
        sockets = self.get_websockets_for_user(username)
        if not sockets:
            return False
        delivered = False
        for ws in sockets:
            try:
                await self._send_json(ws, payload)
                delivered = True
            except Exception:
                await self.disconnect(ws)
        return delivered

    async def notify_message_deleted(self, metadata: dict):
        """Push message_deleted to both conversation participants (all tabs via WS)."""
        partner = metadata.get("partner") or metadata.get("chat_id")
        deleted_by = metadata.get("deleted_by")
        if not partner or not deleted_by:
            return

        payload = {
            "type": "message_deleted",
            "message_id": metadata.get("message_id"),
            "chat_id": partner,
            "partner": partner,
            "sender": metadata.get("sender"),
            "receiver": metadata.get("receiver"),
            "deleted_by": deleted_by,
            "client_message_id": metadata.get("client_message_id"),
            "deleted_at": metadata.get("deleted_at"),
            "deleted_for_everyone": metadata.get("deleted_for_everyone", True),
        }
        for username in {deleted_by, partner}:
            await self._notify_user(username, payload)

    async def notify_conversation_deleted(self, deleted_by: str, partner: str):
        payload = {
            "type": "conversation_deleted",
            "chat_id": partner,
            "partner": partner,
            "deleted_by": deleted_by,
        }
        for username in {deleted_by, partner}:
            await self._notify_user(username, payload)

    async def handle_presence_setting(self, data: dict, websocket: WebSocket):
        username = self._session_username(websocket)
        if not username:
            return

        session = self.active_connections.get(websocket, {})
        share_presence = bool(data.get("share_presence", True))
        was_sharing = session.get("share_presence", True)
        session["share_presence"] = share_presence

        if was_sharing and not share_presence:
            await self.broadcast_presence(username, False)
        elif not was_sharing and share_presence:
            await self.broadcast_presence(username, True, exclude=websocket)

        await self._send_json(websocket, {
            "type": "presence_sync",
            "online": self._visible_online_usernames() if share_presence else [],
        })

    async def handle_typing(self, data: dict, websocket: WebSocket):
        sender = self._session_username(websocket)
        target = data.get("to")
        if not sender or not target:
            return

        await self._notify_user(target, {
            "type": "typing",
            "from": sender,
            "is_typing": bool(data.get("is_typing", True)),
        })

    async def handle_chat_focus(self, data: dict, websocket: WebSocket):
        username = self._session_username(websocket)
        if not username:
            return
        partner = data.get("partner")
        if partner:
            self.active_connections[websocket]["active_chat"] = partner
        else:
            self.active_connections[websocket]["active_chat"] = None

    async def handle_delivery_ack(self, data: dict, websocket: WebSocket):
        recipient = self._session_username(websocket)
        message_id = data.get("message_id")
        client_message_id = data.get("client_message_id")
        sender = data.get("from")
        if not recipient or not sender or not message_id:
            return

        marked = await asyncio.to_thread(database.mark_message_delivered_db, int(message_id))
        if not marked:
            return

        await self._notify_user(sender, {
            "type": "message_status",
            "status": "delivered",
            "message_id": message_id,
            "client_message_id": client_message_id,
            "partner": recipient,
        })

    async def handle_read_receipt(self, data: dict, websocket: WebSocket):
        reader = self._session_username(websocket)
        partner = data.get("partner")
        up_to_message_id = data.get("up_to_message_id")
        if not reader or not partner or not up_to_message_id:
            return

        session = self.active_connections.get(websocket, {})
        if session.get("active_chat") != partner:
            return

        await asyncio.to_thread(
            database.mark_conversation_read_db,
            reader,
            partner,
            int(up_to_message_id),
        )

        await self._notify_user(partner, {
            "type": "message_status",
            "status": "read",
            "partner": reader,
            "up_to_message_id": up_to_message_id,
        })

        await self._send_json(websocket, {
            "type": "unread_sync",
            "partner": partner,
            "unread_count": 0,
        })

    async def send_personal_message(self, data: dict, sender_websocket: WebSocket):
        """Push ciphertext to the recipient first, persist to PostgreSQL in a worker thread."""
        target_username = data.get("to")
        content_recipient = data.get("content_recipient")
        content_sender = data.get("content_sender")
        client_message_id = data.get("client_message_id")
        reply_to_message_id = data.get("reply_to_message_id")

        sender_session = self.active_connections.get(sender_websocket, {})
        sender_username = sender_session.get("username", "Unknown")
        sender_public_key = sender_session.get("public_key")

        validated_reply_id = None
        if reply_to_message_id is not None:
            try:
                reply_id = int(reply_to_message_id)
                in_chat = await asyncio.to_thread(
                    database.message_in_conversation_db,
                    reply_id,
                    sender_username,
                    target_username,
                )
                if in_chat:
                    validated_reply_id = reply_id
            except (TypeError, ValueError):
                validated_reply_id = None

        is_new_chat = not await asyncio.to_thread(
            database.conversation_exists_db, sender_username, target_username
        )

        packet = {
            "type": "message",
            "from": sender_username,
            "content": content_recipient,
            "id": None,
            "client_message_id": client_message_id,
            "timestamp": None,
            "reply_to_message_id": validated_reply_id,
        }

        target_sockets = self.get_websockets_for_user(target_username)
        delivered_sockets = []
        for target_websocket in target_sockets:
            try:
                if is_new_chat:
                    await self._send_json(target_websocket, {
                        "type": "new_chat",
                        "partner": {
                            "username": sender_username,
                            "public_key": sender_public_key,
                        },
                    })
                await self._send_json(target_websocket, packet)
                delivered_sockets.append(target_websocket)
            except Exception:
                await self.disconnect(target_websocket)

        saved_message = await asyncio.to_thread(
            database.save_chat_history_message,
            sender_username,
            target_username,
            content_recipient,
            content_sender,
            client_message_id,
            validated_reply_id,
        )

        packet["id"] = saved_message["id"]
        packet["timestamp"] = saved_message["timestamp"]

        if delivered_sockets:
            unread_count = await asyncio.to_thread(
                database.get_unread_count_db, target_username, sender_username
            )
            still_alive = []
            for target_websocket in delivered_sockets:
                try:
                    await self._send_json(target_websocket, {
                        "type": "message_sync",
                        "from": sender_username,
                        "client_message_id": client_message_id,
                        "id": saved_message["id"],
                        "timestamp": saved_message["timestamp"],
                        "reply_to_message_id": validated_reply_id,
                    })
                    await self._send_json(target_websocket, {
                        "type": "unread_sync",
                        "partner": sender_username,
                        "unread_count": unread_count,
                    })
                    still_alive.append(target_websocket)
                except Exception:
                    await self.disconnect(target_websocket)
            delivered_sockets = still_alive

        if not delivered_sockets:
            await asyncio.to_thread(
                database.save_offline_message,
                sender_username,
                target_username,
                content_recipient,
                saved_message["id"],
                saved_message["client_message_id"],
                saved_message["timestamp"],
            )

        ack_packet = {
            "type": "message_ack",
            "id": saved_message["id"],
            "client_message_id": saved_message["client_message_id"],
            "timestamp": saved_message["timestamp"],
            "reply_to_message_id": validated_reply_id,
        }
        await self._send_json(sender_websocket, ack_packet)

        await self._send_json(sender_websocket, {
            "type": "message_status",
            "status": "sent",
            "message_id": saved_message["id"],
            "client_message_id": client_message_id,
        })

        if is_new_chat:
            partner_data = await asyncio.to_thread(database.get_user_db, target_username)
            if partner_data:
                await self._send_json(sender_websocket, {
                    "type": "new_chat",
                    "partner": partner_data,
                    "last_message_at": saved_message["timestamp"],
                })

        await self._push_incoming_message(sender_username, target_username)

    async def _push_incoming_message(self, sender_username: str, target_username: str):
        try:
            import apns
        except ImportError:
            return
        if not apns.is_configured():
            return
        if await asyncio.to_thread(database.is_muted_db, target_username, sender_username):
            return

        online_ids = {device_id.lower() for device_id in self.online_device_ids(target_username)}
        targets = await asyncio.to_thread(database.list_apns_targets_db, target_username)
        if not targets:
            return

        profile = await asyncio.to_thread(database.get_user_profile_db, sender_username)
        sender_label = (profile or {}).get("display_name") or sender_username
        unread = await asyncio.to_thread(database.get_unread_counts_db, target_username)
        badge = sum(int(count or 0) for count in unread.values())

        for row in targets:
            device_id = str(row.get("device_id") or "").lower()
            if device_id and device_id in online_ids:
                continue
            if not row.get("notify_messages", True):
                continue
            title = sender_label if row.get("notify_preview", True) else "NEXA"
            result = await apns.send_message_alert(
                row["apns_token"],
                sandbox=bool(row.get("apns_sandbox", True)),
                title=title,
                body="New message",
                badge=badge,
                partner=sender_username,
                sound=bool(row.get("notify_sound", True)),
            )
            if result == "gone":
                await asyncio.to_thread(database.clear_apns_token_db, row["apns_token"])

    async def handle_reaction(self, data: dict, websocket: WebSocket):
        username = self._session_username(websocket)
        message_id = data.get("message_id")
        emoji = data.get("emoji")
        if not username or message_id is None:
            return

        if emoji == "":
            emoji = None

        try:
            message_id_int = int(message_id)
        except (TypeError, ValueError):
            return

        result = await asyncio.to_thread(
            database.set_message_reaction_db,
            username,
            message_id_int,
            emoji,
        )
        if not result:
            return

        participants = await asyncio.to_thread(
            database.get_message_participants_db,
            message_id_int,
        )
        if not participants:
            return

        sender, receiver = participants
        for participant in participants:
            # Each client stores history under their counterparty's username.
            chat_partner = receiver if participant == sender else sender
            await self._notify_user(participant, {
                "type": "reaction_sync",
                "message_id": result["message_id"],
                "partner": chat_partner,
                "username": result["username"],
                "emoji": result["emoji"],
                "reactions": result["reactions"],
            })


manager = ConnectionManager()

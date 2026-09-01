# backend/apns.py
"""Apple Push Notification service helper (token auth / HTTP/2)."""

from __future__ import annotations

import os
import time
from typing import Optional

import jwt

try:
    import httpx
except ImportError:  # pragma: no cover
    httpx = None


BUNDLE_ID = os.getenv("APNS_BUNDLE_ID", "com.yanshytyk.NEXA")
KEY_ID = os.getenv("APNS_KEY_ID", "").strip()
TEAM_ID = os.getenv("APNS_TEAM_ID", "").strip()
KEY_P8 = os.getenv("APNS_KEY_P8", "").strip()
KEY_PATH = os.getenv("APNS_KEY_PATH", "").strip()

_jwt = ""
_jwt_issued_at = 0
_missing_logged = False
_client: Optional["httpx.AsyncClient"] = None


def is_configured() -> bool:
    return bool(KEY_ID and TEAM_ID and (_key_material()))


def _key_material() -> str:
    if KEY_P8:
        return KEY_P8.replace("\\n", "\n")
    if KEY_PATH and os.path.isfile(KEY_PATH):
        with open(KEY_PATH, "r", encoding="utf-8") as handle:
            return handle.read()
    return ""


def _provider_jwt() -> str:
    global _jwt, _jwt_issued_at
    now = int(time.time())
    if _jwt and now - _jwt_issued_at < 50 * 60:
        return _jwt
    key = _key_material()
    _jwt = jwt.encode(
        {"iss": TEAM_ID, "iat": now},
        key,
        algorithm="ES256",
        headers={"kid": KEY_ID, "alg": "ES256"},
    )
    if isinstance(_jwt, bytes):
        _jwt = _jwt.decode("ascii")
    _jwt_issued_at = now
    return _jwt


def _host(sandbox: bool) -> str:
    if sandbox:
        return "https://api.sandbox.push.apple.com"
    return "https://api.push.apple.com"


async def _http() -> "httpx.AsyncClient":
    global _client
    if httpx is None:
        raise RuntimeError("httpx is required for APNs")
    if _client is None:
        _client = httpx.AsyncClient(http2=True, timeout=12.0)
    return _client


async def send_message_alert(
    device_token: str,
    *,
    sandbox: bool,
    title: str,
    body: str,
    badge: int,
    partner: str,
    sound: bool = True,
) -> Optional[str]:
    """Send a visible message alert. Returns 'gone' if Apple invalidated the token."""
    if not is_configured():
        global _missing_logged
        if not _missing_logged:
            print("⚠️ APNs is not configured. Set APNS_KEY_ID, APNS_TEAM_ID, and APNS_KEY_P8.")
            _missing_logged = True
        return None

    token = "".join(ch for ch in (device_token or "") if ch.isalnum()).lower()
    if len(token) < 32:
        return None

    payload = {
        "aps": {
            "alert": {
                "title": title[:80],
                "body": body[:180],
            },
            "badge": max(0, int(badge)),
            "thread-id": f"nexa.chat.{partner}",
            "mutable-content": 0,
        },
        "partner": partner,
    }
    if sound:
        payload["aps"]["sound"] = "default"

    client = await _http()
    url = f"{_host(sandbox)}/3/device/{token}"
    headers = {
        "authorization": f"bearer {_provider_jwt()}",
        "apns-topic": BUNDLE_ID,
        "apns-push-type": "alert",
        "apns-priority": "10",
        "apns-collapse-id": f"nexa.chat.{partner}"[:64],
    }
    try:
        response = await client.post(url, json=payload, headers=headers)
    except Exception as exc:
        print(f"⚠️ APNs request failed: {exc}")
        return None

    if response.status_code in (200, 202):
        return "ok"
    if response.status_code in (400, 410):
        reason = ""
        try:
            reason = (response.json() or {}).get("reason", "")
        except Exception:
            reason = response.text[:120]
        if reason in {"BadDeviceToken", "Unregistered", "ExpiredProviderToken", "DeviceTokenNotForTopic"}:
            return "gone"
        if response.status_code == 410:
            return "gone"
        print(f"⚠️ APNs rejected push ({response.status_code}): {reason or response.text[:120]}")
        return None

    print(f"⚠️ APNs unexpected status {response.status_code}: {response.text[:160]}")
    return None

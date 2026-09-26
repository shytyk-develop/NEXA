from typing import Any, Optional

from pydantic import BaseModel


class RegisterRequest(BaseModel):
    username: str
    password: str
    public_key: Any
    encrypted_private_key: str


class LoginRequest(BaseModel):
    username: str
    password: str


class ProfileUpdateRequest(BaseModel):
    display_name: str = ""
    bio: str = ""
    avatar_data: Optional[str] = None


class DeviceUpsertRequest(BaseModel):
    device_id: str
    device_name: str = ""
    platform: str = "unknown"
    os_version: str = ""
    apns_token: Optional[str] = None
    apns_sandbox: Optional[bool] = None
    notify_messages: Optional[bool] = None
    notify_sound: Optional[bool] = None
    notify_preview: Optional[bool] = None


class MutedPartnersRequest(BaseModel):
    partners: list[str] = []


class SaveMessageRequest(BaseModel):
    message_id: int
    # False: a personal save — kept on the user's own device, nothing stored here.
    save_for_everyone: bool = False


from typing import Any, Optional

from pydantic import BaseModel


class RegisterRequest(BaseModel):
    username: str
    password: str
    public_key: Any
    encrypted_private_key: str
    email: str


class VerifyEmailRequest(BaseModel):
    email: str
    code: str


class ResendOtpRequest(BaseModel):
    email: str


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



class FolderCreateRequest(BaseModel):
    name: str
    root: str  # 'work' | 'personal' — the custom folder's parent
    icon: Optional[str] = None
    chat_ids: list[str] = []
    # Client-chosen id (UUID) so an optimistic UI keeps the same id as the server.
    id: Optional[str] = None
    position: Optional[int] = None


class FolderUpdateRequest(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    position: Optional[int] = None
    chat_ids: Optional[list[str]] = None


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str
    # The private key re-encrypted with the new password, client-side (E2EE:
    # the server only ever stores it encrypted). Without it, signing in on a
    # new device with the new password couldn't unlock the key.
    encrypted_private_key: str


class DeleteAccountRequest(BaseModel):
    password: str


class ForgotPasswordRequest(BaseModel):
    email_or_username: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str
    # A fresh key pair made by the client: the old private key was encrypted
    # with the forgotten password, so it can't be unlocked anymore. The
    # server only ever sees the new private key encrypted with the new password.
    public_key: Any
    encrypted_private_key: str

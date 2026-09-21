from fastapi import APIRouter, HTTPException

import database
from core.schemas import LoginRequest, RegisterRequest
from core.security import create_access_token, normalize_username, validate_username

router = APIRouter()


@router.post("/api/register")
async def register(req: RegisterRequest):
    username = normalize_username(req.username)
    validate_username(username)

    success = database.register_user_db(username, req.password, req.public_key, req.encrypted_private_key)
    if not success:
        raise HTTPException(status_code=400, detail="Username is already taken")
    return {"message": "Registration successful"}


@router.post("/api/login")
async def login(req: LoginRequest):
    username = normalize_username(req.username)
    validate_username(username)

    user_keys = database.login_user_db(username, req.password)
    if user_keys is None:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    token = create_access_token(username)
    return {
        "message": "Login successful",
        "access_token": token,
        "public_key": user_keys["public_key"],
        "encrypted_private_key": user_keys["encrypted_private_key"],
    }

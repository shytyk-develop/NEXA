from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import auth, devices, history, profile, qr, saved, users, websocket

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://nexatalk.vercel.app",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(history.router)
app.include_router(users.router)
app.include_router(profile.router)
app.include_router(qr.router)
app.include_router(devices.router)
app.include_router(saved.router)
app.include_router(websocket.router)

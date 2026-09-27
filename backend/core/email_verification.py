"""Email verification: 6-digit one-time codes and the mail that carries them.

Codes live in email_otps (database.py) as a peppered SHA-256, expire after
15 minutes, allow 5 wrong tries, and can be re-sent once a minute.

Delivery: Resend (RESEND_API_KEY + MAIL_FROM), else SMTP (SMTP_HOST, SMTP_PORT,
SMTP_USER, SMTP_PASSWORD, MAIL_FROM), else — local dev — the code is printed
to the backend log. With a provider configured the code never hits the logs.
"""

from __future__ import annotations

import hashlib
import logging
import os
import re
import secrets
import smtplib
from email.message import EmailMessage
from typing import Optional

import httpx

from core.security import JWT_SECRET

OTP_TTL_SECONDS = 15 * 60
OTP_RESEND_COOLDOWN_SECONDS = 60
OTP_MAX_ATTEMPTS = 5

MAIL_FROM = os.getenv("MAIL_FROM", "NEXA <no-reply@nexa.chat>")
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")

logger = logging.getLogger("nexa.email")

_EMAIL_RE = re.compile(r"^[^@\s]{1,64}@[^@\s]+\.[^@\s]{2,}$")


def normalize_email(value: Optional[str]) -> str:
    return (value or "").strip().lower()


def is_valid_email(email: str) -> bool:
    return len(email) <= 254 and bool(_EMAIL_RE.match(email))


def new_otp_code() -> str:
    """Six digits from the OS CSPRNG (100000–999999)."""
    return str(secrets.randbelow(900000) + 100000)


def hash_otp(email: str, code: str) -> str:
    return hashlib.sha256(f"{JWT_SECRET}:{email}:{code}".encode("utf-8")).hexdigest()


def _body(code: str) -> tuple[str, str]:
    text = (
        f"Your NEXA verification code is {code}.\n\n"
        "It expires in 15 minutes. If you didn't try to create an account, ignore this email."
    )
    html = (
        '<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:420px">'
        "<p>Your NEXA verification code:</p>"
        f'<p style="font-size:32px;font-weight:700;letter-spacing:6px;margin:16px 0">{code}</p>'
        '<p style="color:#666">It expires in 15 minutes. If you didn\'t try to create an account, ignore this email.</p>'
        "</div>"
    )
    return text, html


def send_otp_email(email: str, code: str) -> None:
    """Deliver a code (blocking — call it in a worker thread). Raises on a provider error."""
    subject = f"{code} is your NEXA verification code"
    text, html = _body(code)
    if RESEND_API_KEY:
        response = httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {RESEND_API_KEY}"},
            json={"from": MAIL_FROM, "to": [email], "subject": subject, "text": text, "html": html},
            timeout=10,
        )
        response.raise_for_status()
        return
    if SMTP_HOST:
        message = EmailMessage()
        message["From"] = MAIL_FROM
        message["To"] = email
        message["Subject"] = subject
        message.set_content(text)
        message.add_alternative(html, subtype="html")
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as smtp:
            smtp.starttls()
            if SMTP_USER:
                smtp.login(SMTP_USER, SMTP_PASSWORD)
            smtp.send_message(message)
        return
    # Local dev: no mail provider — the code goes to the log instead.
    logger.warning("[dev] no mail provider configured — verification code for %s: %s", email, code)
    print(f"[dev] verification code for {email}: {code}", flush=True)

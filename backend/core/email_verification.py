"""Email verification: 6-digit one-time codes and the mail that carries them.

Codes live in email_otps (database.py) as a peppered SHA-256, expire after
15 minutes, allow 5 wrong tries, and can be re-sent once a minute.

Delivery: Resend (RESEND_API_KEY + MAIL_FROM), else SMTP (SMTP_HOST, SMTP_PORT,
SMTP_USER, SMTP_PASSWORD, MAIL_FROM), else — local dev — the code is printed
to the backend log. With a provider configured the code never hits the logs.
"""

from __future__ import annotations

import hashlib
import html
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


def render_otp_email(code: str) -> tuple[str, str, str]:
    """(subject, plain text, HTML) for a verification code.

    Dark minimalist card: #0B0B0B page, #141414 card with a hairline border,
    white title, the code big in lime monospace. Table layout + inline styles
    only — what mail clients (Gmail, Outlook, Apple Mail) actually render.
    """
    safe_code = html.escape(code)
    subject = f"{code} is your NEXA verification code"
    text = (
        "Verify your email\n\n"
        f"Your NEXA verification code: {code}\n\n"
        "This code expires in 15 minutes. If you didn't request this email, please ignore it."
    )
    mono = "'SF Mono',SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace"
    sans = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
    html_body = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>Verify your email</title>
</head>
<body style="margin:0;padding:0;background-color:#0B0B0B;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#0B0B0B;">Your NEXA verification code is {safe_code}. It expires in 15 minutes.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#0B0B0B;">
  <tr>
    <td align="center" style="padding:48px 16px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:440px;background-color:#141414;border:1px solid rgba(255,255,255,0.1);border-radius:16px;">
        <tr>
          <td style="padding:40px 36px 36px;font-family:{sans};text-align:center;">
            <p style="margin:0 0 28px;font-size:13px;font-weight:700;letter-spacing:4px;color:#FFFFFF;">NEXA</p>
            <h1 style="margin:0 0 12px;font-size:26px;line-height:1.2;font-weight:700;color:#FFFFFF;letter-spacing:-0.5px;">Verify your email</h1>
            <p style="margin:0 0 28px;font-size:15px;line-height:1.5;color:#A3A3A3;">Enter this code to finish creating your account.</p>
            <div style="font-family:{mono};font-size:32px;letter-spacing:6px;font-weight:bold;color:#CCFF00;background:#1A1A1A;padding:16px;border-radius:12px;display:inline-block;">{safe_code}</div>
            <p style="margin:28px 0 0;font-size:13px;line-height:1.6;color:#737373;">This code expires in 15 minutes. If you didn't request this email, please ignore it.</p>
          </td>
        </tr>
      </table>
      <p style="margin:24px 0 0;font-family:{sans};font-size:12px;color:#525252;">Private &middot; End-to-end encrypted</p>
    </td>
  </tr>
</table>
</body>
</html>"""
    return subject, text, html_body


def _resend_error_detail(response: httpx.Response) -> str:
    """Resend's own explanation (e.g. the free-tier "only to your own address" rule)."""
    try:
        payload = response.json()
        return str(payload.get("message") or payload.get("error") or payload)
    except ValueError:
        return response.text[:300]


def send_otp_email(email: str, code: str) -> bool:
    """Deliver a code (blocking — call it in a worker thread). Never raises:
    a provider failure is logged with the reason and returns False, so the
    request that triggered it doesn't turn into a 500 (the code stays valid
    and "Resend code" can retry)."""
    subject, text, html_body = render_otp_email(code)
    if RESEND_API_KEY:
        try:
            response = httpx.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {RESEND_API_KEY}"},
                json={"from": MAIL_FROM, "to": [email], "subject": subject, "html": html_body, "text": text},
                timeout=10,
            )
        except httpx.HTTPError as exc:
            logger.error("Resend unreachable, verification email to %s not sent: %s", email, exc)
            return False
        if response.status_code >= 400:
            detail = _resend_error_detail(response)
            logger.error(
                "Resend refused the verification email to %s (HTTP %s): %s — on the free plan without a "
                "verified domain Resend only delivers to your own address; verify a domain and set MAIL_FROM.",
                email,
                response.status_code,
                detail,
            )
            print(f"[mail] Resend error {response.status_code} for {email}: {detail}", flush=True)
            return False
        return True
    if SMTP_HOST:
        message = EmailMessage()
        message["From"] = MAIL_FROM
        message["To"] = email
        message["Subject"] = subject
        message.set_content(text)
        message.add_alternative(html_body, subtype="html")
        try:
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as smtp:
                smtp.starttls()
                if SMTP_USER:
                    smtp.login(SMTP_USER, SMTP_PASSWORD)
                smtp.send_message(message)
        except (smtplib.SMTPException, OSError) as exc:
            logger.error("SMTP could not send the verification email to %s: %s", email, exc)
            return False
        return True
    # Local dev: no mail provider — the code goes to the log instead.
    logger.warning("[dev] no mail provider configured — verification code for %s: %s", email, code)
    print(f"[dev] verification code for {email}: {code}", flush=True)
    return True

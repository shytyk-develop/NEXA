"""Email verification: 6-digit one-time codes and the mail that carries them.

Codes live in email_otps (database.py) as a peppered SHA-256, expire after
15 minutes, allow 5 wrong tries, and can be re-sent once a minute.

Password reset links ("Forgot password?") go out the same way: a random
token in a link valid for 15 minutes, stored as its SHA-256.

Delivery: Resend (RESEND_API_KEY + MAIL_FROM), else SMTP (SMTP_HOST, SMTP_PORT,
SMTP_USER, SMTP_PASSWORD, MAIL_FROM), else — local dev — the code / link is
printed to the backend log. With a provider configured it never hits the logs.
"""

from __future__ import annotations

import hashlib
import html
import logging
import os
import re
import secrets
import smtplib
from datetime import datetime, timezone
from email.message import EmailMessage
from typing import Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import httpx

from core.config import settings
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
GITHUB_URL = os.getenv("GITHUB_URL", "https://github.com/shytyk-develop")

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


def _format_time(moment: datetime) -> str:
    """"4:43 AM" in the requester's zone; "4:43 AM UTC" when their zone is unknown."""
    text = moment.strftime("%I:%M %p").lstrip("0")
    return f"{text} UTC" if str(moment.tzinfo) == "UTC" else text


def render_otp_email(
    code: str,
    *,
    email: str = "",
    device: Optional[str] = None,
    requested_at: Optional[datetime] = None,
) -> tuple[str, str, str]:
    """(subject, plain text, HTML) for a verification code.

    Black card on #0B0B0B: the NEXA wordmark, "Verify your email", the six
    digits in their own tiles (3 – 3), the expiry, where / when it was
    requested, a never-share warning and a quiet footer. Table layout and
    inline styles (what Gmail / Outlook / Apple Mail render); images are PNGs
    on the colour they sit on, so a client that repaints the background
    can't make them vanish.
    """
    digits = [html.escape(d) for d in code]
    safe_email = html.escape(email)
    moment = requested_at or datetime.now(timezone.utc)
    when = _format_time(moment)
    where = (device or "Unknown device").replace(" / ", " · ")
    safe_where = html.escape(where)
    assets = f"{settings.FRONTEND_URL}/brand/email"
    app_host = html.escape(settings.FRONTEND_URL.split("://", 1)[-1].rstrip("/"))

    subject = f"{code} is your NEXA verification code"
    text = "\n".join([
        "Verify your email",
        "",
        "Enter this code in Nexa to finish creating your account:",
        "",
        f"    {code[:3]} {code[3:]}",
        "",
        "It expires in 15 minutes.",
        "",
        f"Requested from: {where}",
        f"Time: {when}",
        "",
        "Never share this code. Nobody at Nexa will ever ask for it. If you didn't try to sign up,",
        "ignore this email — no account is created without the code.",
        "",
        "Private · End-to-end encrypted",
        f"Sent to {email} because this address was used to sign up for Nexa." if email else "",
        settings.FRONTEND_URL,
    ]).strip()

    mono = "'SF Mono',SFMono-Regular,ui-monospace,Menlo,Consolas,'Liberation Mono',monospace"
    sans = "Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

    def tile(digit: str) -> str:
        return (
            '<td class="otp" width="52" height="64" align="center" valign="middle" '
            f'style="width:52px;height:64px;background-color:#0F0F10;border:1px solid #242426;border-radius:14px;'
            f'font-family:{mono};font-size:34px;line-height:64px;font-weight:500;color:#FFFFFF;">{digit}</td>'
        )

    gap = '<td class="gap" width="10" style="width:10px;font-size:0;line-height:0;">&nbsp;</td>'
    dash = (
        '<td class="dash" width="34" align="center" valign="middle" style="width:34px;">'
        '<div style="width:14px;height:2px;background-color:#3A3A3C;border-radius:1px;font-size:0;line-height:0;">&nbsp;</div></td>'
    )
    code_row = gap.join(tile(d) for d in digits[:3]) + dash + gap.join(tile(d) for d in digits[3:])

    def info_row(label: str, value: str, first: bool) -> str:
        border = "" if first else "border-top:1px solid #1C1C1E;"
        return (
            f'<tr><td class="row" style="{border}padding:20px 24px;font-family:{sans};font-size:15px;color:#7A7A7E;white-space:nowrap;">{label}</td>'
            f'<td class="row" align="right" style="{border}padding:20px 24px;font-family:{mono};font-size:15px;color:#D6D6D8;white-space:nowrap;">{value}</td></tr>'
        )

    sent_to = (
        f'<p style="margin:0 0 14px;font-family:{sans};font-size:13px;line-height:1.6;color:#6B6B70;">'
        f'Sent to {safe_email} because this address was used to sign up for Nexa.</p>'
        if email else ""
    )

    html_body = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>Verify your email</title>
<style>
  @media (max-width: 520px) {{
    .card {{ padding: 40px 20px 32px !important; border-radius: 20px !important; }}
    .title {{ font-size: 30px !important; }}
    .lead {{ font-size: 15px !important; }}
    .outer {{ padding: 24px 8px 28px !important; }}
    .otp {{ width: 38px !important; height: 50px !important; font-size: 25px !important; line-height: 50px !important; border-radius: 11px !important; }}
    .gap {{ width: 6px !important; }}
    .dash {{ width: 20px !important; }}
    .row {{ padding: 16px 16px !important; font-size: 14px !important; }}
    .note {{ padding: 18px 16px 18px 12px !important; font-size: 14px !important; }}
    .note-icon {{ padding: 20px 0 20px 16px !important; }}
  }}
  @media (max-width: 360px) {{
    .outer {{ padding-left: 4px !important; padding-right: 4px !important; }}
    .card {{ padding-left: 14px !important; padding-right: 14px !important; }}
    .title {{ font-size: 26px !important; }}
    .otp {{ width: 32px !important; height: 44px !important; font-size: 21px !important; line-height: 44px !important; border-radius: 10px !important; }}
    .gap {{ width: 4px !important; }}
    .dash {{ width: 14px !important; }}
    .row {{ padding: 14px 12px !important; font-size: 13px !important; white-space: normal !important; }}
  }}
</style>
</head>
<body style="margin:0;padding:0;background-color:#0B0B0B;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#0B0B0B;">Your NEXA code is {digits[0]}{digits[1]}{digits[2]} {digits[3]}{digits[4]}{digits[5]}. It expires in 15 minutes.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#0B0B0B;">
  <tr>
    <td class="outer" align="center" style="padding:40px 12px 36px;">
      <table role="presentation" class="card" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background-color:#000000;border:1px solid #1F1F21;border-radius:24px;">
        <tr>
          <td class="card" align="center" style="padding:56px 44px 48px;font-family:{sans};">
            <img src="{assets}/nexa-logo.png" width="160" height="28" alt="NEXA" style="display:block;margin:0 auto 34px;border:0;outline:none;color:#FFFFFF;font-family:{sans};font-size:22px;font-weight:700;letter-spacing:8px;">
            <h1 class="title" style="margin:0 0 14px;font-family:{sans};font-size:40px;line-height:1.1;font-weight:700;letter-spacing:-1.2px;color:#FFFFFF;">Verify your email</h1>
            <p class="lead" style="margin:0;font-family:{sans};font-size:17px;line-height:1.5;color:#A1A1A6;">Enter this code in Nexa to finish creating your account.</p>

            <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:36px auto 22px;border-collapse:separate;">
              <tr>{code_row}</tr>
            </table>

            <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:0 auto;">
              <tr>
                <td valign="middle" style="padding-right:8px;"><img src="{assets}/clock.png" width="18" height="18" alt="" style="display:block;border:0;"></td>
                <td valign="middle" style="font-family:{sans};font-size:15px;color:#9A9A9F;">Expires in 15 minutes</td>
              </tr>
            </table>

            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:36px;background-color:#0F0F10;border:1px solid #1F1F21;border-radius:16px;border-collapse:separate;">
              {info_row("Requested from", safe_where, True)}
              {info_row("Time", html.escape(when), False)}
            </table>

            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:24px;background-color:#0F0F10;border:1px solid #1F1F21;border-radius:16px;border-collapse:separate;">
              <tr>
                <td class="note-icon" valign="top" width="22" style="padding:22px 0 22px 24px;width:22px;"><img src="{assets}/shield.png" width="22" height="22" alt="" style="display:block;border:0;margin-top:1px;"></td>
                <td class="note" align="left" style="padding:20px 24px 20px 16px;font-family:{sans};font-size:15px;line-height:1.6;color:#9A9A9F;text-align:left;"><strong style="color:#FFFFFF;font-weight:600;">Never share this code.</strong> Nobody at Nexa will ever ask for it. If you didn't try to sign up, ignore this email &mdash; no account is created without the code.</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:32px auto 14px;">
        <tr>
          <td valign="middle" style="padding-right:8px;"><img src="{assets}/lock.png" width="16" height="16" alt="" style="display:block;border:0;"></td>
          <td valign="middle" style="font-family:{sans};font-size:14px;color:#9A9A9F;">Private &middot; End-to-end encrypted</td>
        </tr>
      </table>
      {sent_to}
      <p style="margin:0;font-family:{sans};font-size:13px;">
        <a href="{settings.FRONTEND_URL}" style="color:#A1A1A6;text-decoration:underline;">{app_host}</a>
        &nbsp;&nbsp;&nbsp;
        <a href="{GITHUB_URL}" style="color:#A1A1A6;text-decoration:underline;">GitHub</a>
      </p>
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


def local_time(tz_name: Optional[str]) -> datetime:
    """Now in the requester's IANA zone (X-Client-Timezone), UTC when unknown."""
    try:
        return datetime.now(ZoneInfo(tz_name)) if tz_name else datetime.now(timezone.utc)
    except (ZoneInfoNotFoundError, ValueError):
        return datetime.now(timezone.utc)


def _deliver(email: str, subject: str, text: str, html_body: str, *, kind: str, dev_note: str) -> bool:
    """Send one mail: Resend, else SMTP, else (local dev) `dev_note` goes to
    the log. Blocking — call it in a worker thread. Never raises: a provider
    failure is logged with the reason and returns False."""
    if RESEND_API_KEY:
        try:
            response = httpx.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {RESEND_API_KEY}"},
                json={"from": MAIL_FROM, "to": [email], "subject": subject, "html": html_body, "text": text},
                timeout=10,
            )
        except httpx.HTTPError as exc:
            logger.error("Resend unreachable, %s email to %s not sent: %s", kind, email, exc)
            return False
        if response.status_code >= 400:
            detail = _resend_error_detail(response)
            logger.error(
                "Resend refused the %s email to %s (HTTP %s): %s — on the free plan without a "
                "verified domain Resend only delivers to your own address; verify a domain and set MAIL_FROM.",
                kind,
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
            logger.error("SMTP could not send the %s email to %s: %s", kind, email, exc)
            return False
        return True
    # Local dev: no mail provider — what the mail carries goes to the log instead.
    logger.warning("[dev] no mail provider configured — %s for %s: %s", kind, email, dev_note)
    print(f"[dev] {kind} for {email}: {dev_note}", flush=True)
    return True


def send_otp_email(
    email: str,
    code: str,
    *,
    device: Optional[str] = None,
    requested_at: Optional[datetime] = None,
) -> bool:
    """Deliver a code (blocking — call it in a worker thread). Never raises:
    a provider failure is logged with the reason and returns False, so the
    request that triggered it doesn't turn into a 500 (the code stays valid
    and "Resend code" can retry)."""
    subject, text, html_body = render_otp_email(code, email=email, device=device, requested_at=requested_at)
    return _deliver(email, subject, text, html_body, kind="verification code", dev_note=code)


# ─── Password reset ───

PASSWORD_RESET_TTL_SECONDS = 15 * 60
PASSWORD_RESET_COOLDOWN_SECONDS = 60


def new_reset_token() -> str:
    """The secret in a reset link (only its SHA-256 is stored)."""
    return secrets.token_urlsafe(32)


def hash_reset_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def reset_link(token: str) -> str:
    return f"{settings.FRONTEND_URL}/reset-password?token={token}"


def render_password_reset_email(
    link: str,
    *,
    email: str = "",
    device: Optional[str] = None,
    requested_at: Optional[datetime] = None,
) -> tuple[str, str, str]:
    """(subject, plain text, HTML) for a reset link — the OTP mail's dark
    style: a #141414 card, "Reset your NEXA password", a white "Reset
    Password" button, the 15-minute validity, where / when it was asked for,
    and what a reset does to the encryption keys."""
    safe_link = html.escape(link, quote=True)
    safe_email = html.escape(email)
    moment = requested_at or datetime.now(timezone.utc)
    when = _format_time(moment)
    where = (device or "Unknown device").replace(" / ", " · ")
    assets = f"{settings.FRONTEND_URL}/brand/email"
    app_host = html.escape(settings.FRONTEND_URL.split("://", 1)[-1].rstrip("/"))

    subject = "Reset your NEXA password"
    text = "\n".join([
        "Reset your NEXA password",
        "",
        "Someone asked to reset the password of the NEXA account for this address.",
        "Open this link to choose a new one:",
        "",
        link,
        "",
        "This link is valid for 15 minutes and works once.",
        "",
        f"Requested from: {where}",
        f"Time: {when}",
        "",
        "A reset creates new encryption keys: messages from before it can't be read on your devices anymore.",
        "If you didn't ask for this, ignore this email — your password stays the same.",
        "",
        "Private · End-to-end encrypted",
        settings.FRONTEND_URL,
    ])

    mono = "'SF Mono',SFMono-Regular,ui-monospace,Menlo,Consolas,'Liberation Mono',monospace"
    sans = "Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

    def info_row(label: str, value: str, first: bool) -> str:
        border = "" if first else "border-top:1px solid #1C1C1E;"
        return (
            f'<tr><td class="row" style="{border}padding:18px 22px;font-family:{sans};font-size:15px;color:#7A7A7E;white-space:nowrap;">{label}</td>'
            f'<td class="row" align="right" style="{border}padding:18px 22px;font-family:{mono};font-size:15px;color:#D6D6D8;white-space:nowrap;">{value}</td></tr>'
        )

    sent_to = (
        f'<p style="margin:0 0 14px;font-family:{sans};font-size:13px;line-height:1.6;color:#6B6B70;">'
        f"Sent to {safe_email} because a password reset was requested for this address.</p>"
        if email else ""
    )

    html_body = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>Reset your NEXA password</title>
<style>
  @media (max-width: 520px) {{
    .card {{ padding: 40px 20px 32px !important; border-radius: 20px !important; }}
    .title {{ font-size: 28px !important; }}
    .lead {{ font-size: 15px !important; }}
    .outer {{ padding: 24px 8px 28px !important; }}
    .row {{ padding: 16px 16px !important; font-size: 14px !important; }}
    .note {{ padding: 18px 16px 18px 12px !important; font-size: 14px !important; }}
    .note-icon {{ padding: 20px 0 20px 16px !important; }}
  }}
</style>
</head>
<body style="margin:0;padding:0;background-color:#0B0B0B;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#0B0B0B;">Choose a new NEXA password. The link is valid for 15 minutes.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#0B0B0B;">
  <tr>
    <td class="outer" align="center" style="padding:40px 12px 36px;">
      <table role="presentation" class="card" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background-color:#141414;border:1px solid #242426;border-radius:24px;">
        <tr>
          <td class="card" align="center" style="padding:56px 44px 48px;font-family:{sans};">
            <img src="{assets}/nexa-logo.png" width="160" height="28" alt="NEXA" style="display:block;margin:0 auto 34px;border:0;outline:none;color:#FFFFFF;font-family:{sans};font-size:22px;font-weight:700;letter-spacing:8px;">
            <h1 class="title" style="margin:0 0 14px;font-family:{sans};font-size:36px;line-height:1.12;font-weight:700;letter-spacing:-1px;color:#FFFFFF;">Reset your NEXA password</h1>
            <p class="lead" style="margin:0;font-family:{sans};font-size:17px;line-height:1.5;color:#A1A1A6;">Someone asked to reset the password of your account. Choose a new one here.</p>

            <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:34px auto 20px;">
              <tr>
                <td align="center" bgcolor="#FFFFFF" style="border-radius:999px;">
                  <a href="{safe_link}" target="_blank" style="display:inline-block;padding:16px 40px;font-family:{sans};font-size:16px;font-weight:600;color:#0B0B0B;text-decoration:none;border-radius:999px;">Reset Password</a>
                </td>
              </tr>
            </table>

            <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:0 auto;background-color:#0F0F10;border:1px solid #242426;border-radius:999px;border-collapse:separate;">
              <tr>
                <td valign="middle" style="padding:9px 8px 9px 16px;"><img src="{assets}/clock.png" width="16" height="16" alt="" style="display:block;border:0;"></td>
                <td valign="middle" style="padding:9px 16px 9px 0;font-family:{sans};font-size:14px;color:#9A9A9F;">This link is valid for 15 minutes</td>
              </tr>
            </table>

            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:34px;background-color:#0F0F10;border:1px solid #1F1F21;border-radius:16px;border-collapse:separate;">
              {info_row("Requested from", html.escape(where), True)}
              {info_row("Time", html.escape(when), False)}
            </table>

            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:22px;background-color:#0F0F10;border:1px solid #1F1F21;border-radius:16px;border-collapse:separate;">
              <tr>
                <td class="note-icon" valign="top" width="22" style="padding:22px 0 22px 24px;width:22px;"><img src="{assets}/shield.png" width="22" height="22" alt="" style="display:block;border:0;margin-top:1px;"></td>
                <td class="note" align="left" style="padding:20px 24px 20px 16px;font-family:{sans};font-size:15px;line-height:1.6;color:#9A9A9F;text-align:left;"><strong style="color:#FFFFFF;font-weight:600;">A reset creates new encryption keys.</strong> Messages from before it can't be read on your devices anymore. If you didn't ask for this, ignore this email &mdash; your password stays the same.</td>
              </tr>
            </table>

            <p style="margin:26px 0 0;font-family:{sans};font-size:13px;line-height:1.6;color:#6B6B70;word-break:break-all;">Button not working? Paste this link into your browser:<br><a href="{safe_link}" style="color:#A1A1A6;">{safe_link}</a></p>
          </td>
        </tr>
      </table>

      <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:32px auto 14px;">
        <tr>
          <td valign="middle" style="padding-right:8px;"><img src="{assets}/lock.png" width="16" height="16" alt="" style="display:block;border:0;"></td>
          <td valign="middle" style="font-family:{sans};font-size:14px;color:#9A9A9F;">Private &middot; End-to-end encrypted</td>
        </tr>
      </table>
      {sent_to}
      <p style="margin:0;font-family:{sans};font-size:13px;">
        <a href="{settings.FRONTEND_URL}" style="color:#A1A1A6;text-decoration:underline;">{app_host}</a>
        &nbsp;&nbsp;&nbsp;
        <a href="{GITHUB_URL}" style="color:#A1A1A6;text-decoration:underline;">GitHub</a>
      </p>
    </td>
  </tr>
</table>
</body>
</html>"""
    return subject, text, html_body


def send_password_reset_email(
    email: str,
    token: str,
    *,
    device: Optional[str] = None,
    requested_at: Optional[datetime] = None,
) -> bool:
    """Deliver a reset link (blocking — call it in a worker thread; never raises)."""
    link = reset_link(token)
    subject, text, html_body = render_password_reset_email(link, email=email, device=device, requested_at=requested_at)
    return _deliver(email, subject, text, html_body, kind="password reset link", dev_note=link)

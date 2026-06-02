"""Email delivery via SendGrid, SMTP, or preview mode."""
from __future__ import annotations

import smtplib
from dataclasses import dataclass
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

import requests

from .config import (
    EMAIL_PROVIDER, FROM_EMAIL, FROM_NAME,
    SENDGRID_API_KEY, SMTP_HOST, SMTP_PASSWORD, SMTP_PORT, SMTP_USERNAME,
)


@dataclass
class SendResult:
    success: bool
    message_id: Optional[str] = None
    error: Optional[str] = None
    preview_only: bool = False


def send_email(to_email: str, to_name: str, subject: str, body: str,
               reply_to: Optional[str] = None) -> SendResult:
    """Send an email using the configured provider."""
    if not to_email:
        return SendResult(success=False, error="No recipient email address")

    provider = EMAIL_PROVIDER.lower()

    if provider == "sendgrid":
        return _send_sendgrid(to_email, to_name, subject, body, reply_to)
    elif provider == "smtp":
        return _send_smtp(to_email, to_name, subject, body, reply_to)
    else:
        return SendResult(success=True, preview_only=True,
                          message_id=f"preview_{to_email}_{subject[:20]}")


def _send_sendgrid(to_email: str, to_name: str, subject: str, body: str,
                   reply_to: Optional[str]) -> SendResult:
    if not SENDGRID_API_KEY:
        return SendResult(success=False, error="SENDGRID_API_KEY not configured")
    if not FROM_EMAIL:
        return SendResult(success=False, error="R2R_FROM_EMAIL not configured")

    payload = {
        "personalizations": [{"to": [{"email": to_email, "name": to_name}]}],
        "from": {"email": FROM_EMAIL, "name": FROM_NAME},
        "subject": subject,
        "content": [{"type": "text/plain", "value": body}],
    }
    if reply_to:
        payload["reply_to"] = {"email": reply_to}

    r = requests.post(
        "https://api.sendgrid.com/v3/mail/send",
        headers={"Authorization": f"Bearer {SENDGRID_API_KEY}", "Content-Type": "application/json"},
        json=payload,
        timeout=15,
    )
    if r.status_code in (200, 202):
        return SendResult(success=True, message_id=r.headers.get("X-Message-Id"))
    return SendResult(success=False, error=f"SendGrid error {r.status_code}: {r.text[:200]}")


def _send_smtp(to_email: str, to_name: str, subject: str, body: str,
               reply_to: Optional[str]) -> SendResult:
    if not SMTP_USERNAME or not SMTP_PASSWORD:
        return SendResult(success=False, error="R2R_SMTP_USERNAME / R2R_SMTP_PASSWORD not configured")
    if not FROM_EMAIL:
        return SendResult(success=False, error="R2R_FROM_EMAIL not configured")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{FROM_NAME} <{FROM_EMAIL}>"
    msg["To"] = f"{to_name} <{to_email}>" if to_name else to_email
    if reply_to:
        msg["Reply-To"] = reply_to
    msg.attach(MIMEText(body, "plain"))

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.ehlo()
            server.starttls()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.sendmail(FROM_EMAIL, [to_email], msg.as_string())
        return SendResult(success=True, message_id=f"smtp_{to_email}")
    except smtplib.SMTPException as exc:
        return SendResult(success=False, error=str(exc))


def provider_label() -> str:
    labels = {"sendgrid": "SendGrid", "smtp": "SMTP", "preview": "Preview (not sent)"}
    return labels.get(EMAIL_PROVIDER.lower(), EMAIL_PROVIDER)


def is_configured() -> bool:
    p = EMAIL_PROVIDER.lower()
    if p == "sendgrid":
        return bool(SENDGRID_API_KEY and FROM_EMAIL)
    if p == "smtp":
        return bool(SMTP_USERNAME and SMTP_PASSWORD and FROM_EMAIL)
    return True  # preview always works

"""Alert dispatchers for AFF LAUNCHER failures and events."""
import json
import os
import urllib.error
import urllib.request
from dataclasses import dataclass, field

from logger import setup_logger

logger = setup_logger("alerts")


@dataclass
class AlertConfig:
    slack_webhook: str = field(
        default_factory=lambda: os.getenv("SLACK_WEBHOOK_URL", "")
    )
    email_webhook: str = field(
        default_factory=lambda: os.getenv("EMAIL_WEBHOOK_URL", "")
    )


def _send_webhook(url: str, payload: dict) -> bool:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status in (200, 201, 204)
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as exc:
        logger.error("Webhook failed: %s", exc)
        return False


def send_slack(config: AlertConfig, message: str, details: dict | None = None) -> bool:
    if not config.slack_webhook:
        logger.debug("Slack webhook not configured")
        return False
    payload = {"text": message}
    if details:
        payload["attachments"] = [
            {
                "color": "danger",
                "fields": [
                    {"title": k, "value": str(v), "short": True}
                    for k, v in details.items()
                ],
            }
        ]
    ok = _send_webhook(config.slack_webhook, payload)
    if ok:
        logger.info("Slack alert sent")
    return ok


def send_email(config: AlertConfig, subject: str, body: str) -> bool:
    if not config.email_webhook:
        logger.debug("Email webhook not configured")
        return False
    payload = {"subject": subject, "body": body}
    ok = _send_webhook(config.email_webhook, payload)
    if ok:
        logger.info("Email alert sent")
    return ok


def alert_launch_failure(
    config: AlertConfig,
    product_name: str,
    platform: str,
    error: str,
) -> None:
    msg = f"AFF LAUNCHER failure: {product_name} on {platform}"
    details = {"product": product_name, "platform": platform, "error": error}
    send_slack(config, msg, details)
    send_email(config, msg, f"Platform: {platform}\nError: {error}")


def alert_health_failure(config: AlertConfig, check_name: str, message: str) -> None:
    msg = f"AFF LAUNCHER health check failed: {check_name}"
    details = {"check": check_name, "message": message}
    send_slack(config, msg, details)
    send_email(config, msg, f"Check: {check_name}\nMessage: {message}")

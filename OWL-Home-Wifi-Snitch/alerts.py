import os
import requests
from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")
TELEGRAM_URL = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"


def send_new_device_alert(device: dict):
    """Send Telegram message for a newly detected device."""
    if not BOT_TOKEN or not CHAT_ID:
        print("[OWL] Telegram not configured — skipping alert")
        return

    ports = device.get("open_ports", [])
    if isinstance(ports, str):
        import json
        try:
            ports = json.loads(ports)
        except Exception:
            ports = []
    ports_str = ", ".join(str(p) for p in ports) if ports else "none detected"

    message = (
        f"🦉 Hoot Hoot: New device on your network!\n"
        f"IP: {device['ip']}\n"
        f"MAC: {device['mac']}\n"
        f"Vendor: {device['vendor']}\n"
        f"Description: {device['description']}\n"
        f"Ports open: {ports_str}\n"
        f"First seen: {device['first_seen']}"
    )

    try:
        resp = requests.post(TELEGRAM_URL, json={
            "chat_id": CHAT_ID,
            "text": message,
            "parse_mode": "HTML"
        }, timeout=10)
        resp.raise_for_status()
    except Exception as e:
        print(f"[OWL] Telegram alert failed: {e}")


def validate_telegram() -> bool:
    """Check that bot token + chat ID work. Used by setup.py."""
    if not BOT_TOKEN or not CHAT_ID:
        return False
    try:
        resp = requests.get(
            f"https://api.telegram.org/bot{BOT_TOKEN}/getMe",
            timeout=10
        )
        return resp.ok
    except Exception:
        return False

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


def send_daily_report(all_devices: list):
    """Send 6am daily summary to Telegram."""
    if not BOT_TOKEN or not CHAT_ID:
        return

    named    = [d for d in all_devices if d.get("label")]
    unnamed  = [d for d in all_devices if d.get("acknowledged") == 1 and not d.get("label")]
    new      = [d for d in all_devices if d.get("acknowledged") == 0]

    lines = ["🦉 OWL Daily Report\n"]
    lines.append(f"✅ Named devices: {len(named)}")
    for d in named:
        lines.append(f"  • {d['label']} — {d['ip']}")

    lines.append(f"\n🔍 Scanned, not named: {len(unnamed)}")
    for d in unnamed:
        name = d.get("hostname") or d["mac"]
        lines.append(f"  • {name} ({d['vendor']}) — {d['ip']}")

    lines.append(f"\n🚨 New / unseen: {len(new)}")
    for d in new:
        name = d.get("hostname") or d["mac"]
        lines.append(f"  • {name} ({d['vendor']}) — first seen {d['first_seen']}")

    lines.append(f"\nTotal on network: {len(all_devices)}")

    try:
        requests.post(TELEGRAM_URL, json={
            "chat_id": CHAT_ID,
            "text": "\n".join(lines),
            "parse_mode": "HTML"
        }, timeout=10)
    except Exception as e:
        print(f"[OWL] Daily report failed: {e}")


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

import os
import time
import threading
import signal
import sys
from dotenv import load_dotenv

load_dotenv()

from datetime import datetime
from store import init_db, get_all_devices
from scanner import scan
from identifier import identify
from store import upsert_device, get_device
from alerts import send_new_device_alert, send_daily_report
from dashboard import app

SCAN_INTERVAL = int(os.getenv("SCAN_INTERVAL", "60"))
DASHBOARD_PORT = int(os.getenv("DASHBOARD_PORT", "5000"))

_running = True
_last_report_date = None


def _check_daily_report():
    global _last_report_date
    now = datetime.now()
    today = now.date()
    if now.hour == 6 and _last_report_date != today:
        _last_report_date = today
        devices = get_all_devices()
        send_daily_report(devices)
        print("[OWL] Daily report sent.")


def scanner_loop():
    print("[OWL] Scanner started.")
    while _running:
        try:
            devices = scan()
            for d in devices:
                info = identify(d["mac"], d["ip"])
                is_new = upsert_device(
                    mac=d["mac"],
                    ip=d["ip"],
                    hostname=d["hostname"],
                    vendor=info["vendor"],
                    description=info["description"],
                    open_ports=info["open_ports"],
                    services=info.get("services", []),
                    os_guess=info.get("os_guess", ""),
                )
                if is_new:
                    device_record = get_device(d["mac"])
                    send_new_device_alert(device_record)
                    print(f"[OWL] NEW DEVICE: {d['mac']} ({d['ip']}) — {info['description']}")
                else:
                    print(f"[OWL] Seen: {d['mac']} ({d['ip']})")
        except Exception as e:
            print(f"[OWL] Scanner error: {e}")

        _check_daily_report()
        time.sleep(SCAN_INTERVAL)


def start_dashboard():
    app.run(host="127.0.0.1", port=DASHBOARD_PORT, debug=False, use_reloader=False)


def handle_shutdown(sig, frame):
    global _running
    print("\n[OWL] Shutting down.")
    _running = False
    sys.exit(0)


if __name__ == "__main__":
    signal.signal(signal.SIGINT, handle_shutdown)
    signal.signal(signal.SIGTERM, handle_shutdown)

    init_db()

    dashboard_thread = threading.Thread(target=start_dashboard, daemon=True)
    dashboard_thread.start()
    print(f"[OWL] Dashboard running at http://localhost:{DASHBOARD_PORT}")

    scanner_loop()

"""
OWL one-time setup:
  1. Download OUI database
  2. Init SQLite database
  3. Validate Telegram credentials
  4. Register Windows Task Scheduler startup task
"""
import os
import sys
import subprocess
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

from identifier import download_oui, OUI_PATH
from store import init_db
from alerts import validate_telegram

PROJECT_DIR = Path(__file__).parent.resolve()
PYTHON = sys.executable.replace("python.exe", "pythonw.exe")
TASK_NAME = "OWL WiFi Monitor"


def setup_oui():
    if OUI_PATH.exists():
        size_mb = OUI_PATH.stat().st_size / 1_000_000
        print(f"[OWL] OUI database already exists ({size_mb:.1f} MB). Skipping download.")
    else:
        download_oui()


def setup_db():
    init_db()
    print("[OWL] SQLite database initialised (owl.db)")


def setup_telegram():
    token = os.getenv("TELEGRAM_BOT_TOKEN", "")
    chat_id = os.getenv("TELEGRAM_CHAT_ID", "")
    if not token or not chat_id:
        print("[OWL] WARNING: Telegram not configured. Edit .env with BOT_TOKEN and CHAT_ID.")
        return
    if validate_telegram():
        print("[OWL] Telegram credentials valid.")
    else:
        print("[OWL] WARNING: Telegram credentials invalid — check BOT_TOKEN in .env")


def setup_task_scheduler():
    main_py = PROJECT_DIR / "main.py"
    xml = f"""<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <Triggers>
    <BootTrigger>
      <Enabled>true</Enabled>
    </BootTrigger>
  </Triggers>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <RestartOnFailure>
      <Interval>PT30S</Interval>
      <Count>999</Count>
    </RestartOnFailure>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>{PYTHON}</Command>
      <Arguments>"{main_py}"</Arguments>
      <WorkingDirectory>{PROJECT_DIR}</WorkingDirectory>
    </Exec>
  </Actions>
</Task>"""

    xml_path = PROJECT_DIR / "owl_task.xml"
    xml_path.write_text(xml, encoding="utf-16")

    result = subprocess.run(
        ["schtasks", "/Create", "/TN", TASK_NAME, "/XML", str(xml_path), "/F"],
        capture_output=True, text=True
    )
    xml_path.unlink(missing_ok=True)

    if result.returncode == 0:
        print(f"[OWL] Windows Task Scheduler task '{TASK_NAME}' registered. OWL will start on next boot.")
    else:
        print(f"[OWL] Task Scheduler registration failed: {result.stderr}")
        print("[OWL] You can start OWL manually: python main.py")


if __name__ == "__main__":
    print("🦉 OWL Setup\n")
    setup_oui()
    setup_db()
    setup_telegram()
    setup_task_scheduler()
    print("\n✅ Setup complete. Run 'python main.py' to start OWL now.")
    print("   Dashboard will be at http://localhost:5000")

"""
ReferIt — Entry Point
Launches the Flask dashboard and the background automation loop.
"""
import logging
import sys
import os

# Force UTF-8 output on Windows so Unicode chars in logs don't crash the process
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
import time
import json
import random
import datetime
from threading import Thread

from dotenv import load_dotenv
load_dotenv()  # loads ANTHROPIC_API_KEY and any other vars from .env before anything else

from referIt.ui.app import app, set_status, get_trigger_event
from referIt.core.commenter import CommentBot
from referIt.core.proxy_mgr import ProxyManager
from referIt.core.db import init_db

os.makedirs("logs", exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler("logs/referit.log"),
        logging.StreamHandler(),
    ],
)
logger = logging.getLogger("ReferIt")


def run_automation_loop():
    logger.info("[AUTO] Background automation thread started")
    time.sleep(10)  # Let Flask bind its port first

    trigger = get_trigger_event()

    try:
        bot = CommentBot(
            accounts_path="referIt/accounts/profiles.json",
            config_path="config.json",
        )
        bot.proxy_manager.health_check_all()

        set_status({"running": False})

        while True:
            with open("config.json") as f:
                cfg = json.load(f)

            behavior  = cfg.get("behavior", {})
            keywords  = cfg.get("keywords", ["plumber", "handyman"])
            posts_per  = behavior.get("posts_per_session", 5)
            op_hours  = behavior.get("operating_hours", {"start": 8, "end": 22})

            now  = datetime.datetime.now()
            hour = now.hour

            if hour < op_hours.get("start", 8) or hour > op_hours.get("end", 22):
                logger.info(f"[AUTO] Outside operating hours ({hour}:00). Sleeping 30m...")
                set_status({"running": False})
                trigger.wait(timeout=1800)
                trigger.clear()
                continue

            logger.info("[AUTO] Starting campaign cycle...")
            set_status({"running": True, "last_campaign": time.time(), "last_error": None})

            try:
                # Reload config each cycle so live edits take effect without restart
                bot = CommentBot(
                    accounts_path="referIt/accounts/profiles.json",
                    config_path="config.json",
                )
                bot.run_campaign(keywords, post_count=posts_per)
            except Exception as e:
                logger.error(f"[AUTO] Campaign error: {e}")
                set_status({"last_error": str(e)})

            # 2-4 hour delay between campaign cycles
            delay = random.randint(7200, 14400)
            next_run = time.time() + delay
            set_status({"running": False, "next_campaign": next_run})
            logger.info(f"[AUTO] Done. Next run in {delay // 60}m (unless triggered).")

            # Wait but wake up instantly if triggered via UI
            trigger.wait(timeout=delay)
            trigger.clear()

    except Exception as e:
        logger.error(f"[AUTO] Automation thread crashed: {e}")
        set_status({"running": False, "last_error": str(e)})


def main():
    init_db()
    logger.info("[MAIN] Database initialised")

    auto_thread = Thread(target=run_automation_loop, daemon=True)
    auto_thread.start()

    port = int(os.environ.get("PORT", 5000))
    logger.info(f"[MAIN] Starting ReferIt dashboard on 0.0.0.0:{port}")
    try:
        app.run(host="0.0.0.0", port=port, debug=False, threaded=True)
    except Exception as e:
        logger.error(f"[MAIN] Critical failure: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()

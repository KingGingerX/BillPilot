"""Central configuration for AFF LAUNCHER."""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent
RUNS_DIR = ROOT / "runs"
PRODUCTS_DIR = ROOT / "products"
REPORTS_DIR = ROOT / "reports"
TESTS_DIR = ROOT / "tests"

DEFAULT_PLATFORMS = [
    "digistore24",
    "jvzoo",
    "warriorplus",
    "clickbank",
    "gumroad",
    "payhip",
]

VAULT_PATH = Path(os.getenv("AFF_VAULT_PATH", Path.home() / ".aff_vault"))
LOG_DIR = ROOT / "logs"
LOG_DIR.mkdir(exist_ok=True)

LOG_LEVEL = os.getenv("AFF_LOG_LEVEL", "INFO").upper()
MAX_RETRIES = int(os.getenv("AFF_MAX_RETRIES", "3"))
RETRY_BACKOFF = float(os.getenv("AFF_RETRY_BACKOFF", "2.0"))

STRIPE_TEST_SECRET_KEY = os.getenv("STRIPE_TEST_SECRET_KEY", "")
STRIPE_TEST_PUBLISHABLE_KEY = os.getenv("STRIPE_TEST_PUBLISHABLE_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")

PRICING_TIERS = {
    "starter": {"name": "AFF Launcher Starter", "price_usd": 97},
    "pro": {"name": "AFF Launcher Pro", "price_usd": 297},
    "agency": {"name": "AFF Launcher Agency", "price_usd": 997},
    "maintenance": {"name": "AFF Launcher Maintenance", "price_usd": 29},
}

# Alert webhooks (populated from env by AlertConfig)
SLACK_WEBHOOK_URL = os.getenv("SLACK_WEBHOOK_URL", "")
EMAIL_WEBHOOK_URL = os.getenv("EMAIL_WEBHOOK_URL", "")

# Post-purchase fulfillment
SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")
SMTP_FROM = os.getenv("SMTP_FROM", SMTP_USER)
PRODUCT_DOWNLOAD_URL = os.getenv("PRODUCT_DOWNLOAD_URL", "")

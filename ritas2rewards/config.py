import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
SENDGRID_API_KEY: str = os.getenv("SENDGRID_API_KEY", "")
SMTP_HOST: str = os.getenv("R2R_SMTP_HOST", "smtp.gmail.com")
SMTP_PORT: int = int(os.getenv("R2R_SMTP_PORT", "587"))
SMTP_USERNAME: str = os.getenv("R2R_SMTP_USERNAME", "")
SMTP_PASSWORD: str = os.getenv("R2R_SMTP_PASSWORD", "")
FROM_EMAIL: str = os.getenv("R2R_FROM_EMAIL", "")
FROM_NAME: str = os.getenv("R2R_FROM_NAME", "Rita's Rewards")
SENDER_NAME: str = os.getenv("R2R_SENDER_NAME", "Alex")

GOOGLE_PLACES_API_KEY: str = os.getenv("GOOGLE_PLACES_API_KEY", "")
YELP_API_KEY: str = os.getenv("YELP_API_KEY", "")

_db_dir = Path(os.getenv("R2R_DATABASE_PATH", "data/ritas2rewards.db"))
_db_dir.parent.mkdir(parents=True, exist_ok=True)
DATABASE_PATH: Path = _db_dir

PROGRAM_URL: str = os.getenv("R2R_PROGRAM_URL", "https://ritasrewards.com")
COMPANY_NAME: str = "Rita's Rewards"
EMAIL_PROVIDER: str = os.getenv("R2R_EMAIL_PROVIDER", "preview")  # sendgrid | smtp | preview
HUMAN_HANDOFF_THRESHOLD: int = int(os.getenv("R2R_HANDOFF_THRESHOLD", "60"))

# Funnel timing (days before auto-progressing)
DAYS_BEFORE_FOLLOWUP_1: int = int(os.getenv("R2R_DAYS_F1", "3"))
DAYS_BEFORE_FOLLOWUP_2: int = int(os.getenv("R2R_DAYS_F2", "5"))
DAYS_BEFORE_DORMANT: int = int(os.getenv("R2R_DAYS_DORMANT", "7"))

from __future__ import annotations

import os
from datetime import datetime, timezone
from enum import Enum
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .storage import SecureTaskStore


FREE_MONTHLY_LIMIT = 5
PRO_PRICE_USD = float(os.getenv("BILLPILOT_PRO_PRICE", "9.99"))
# Set BILLPILOT_STRIPE_LINK in .env to your real Stripe payment link
STRIPE_UPGRADE_LINK = os.getenv(
    "BILLPILOT_STRIPE_LINK",
    "https://buy.stripe.com/billpilot-pro",
)
PRO_FEATURES = [
    "Unlimited negotiation plans per month",
    "Unlimited FCRA dispute letters per month",
    "AI-enhanced letters with targeted FCRA citations (Claude-powered)",
    "CFPB escalation letters",
    "Priority email support",
]


class Tier(str, Enum):
    FREE = "free"
    PRO = "pro"


def get_tier() -> Tier:
    return Tier.PRO if os.getenv("BILLPILOT_TIER", "").lower() == "pro" else Tier.FREE


def check_usage(feature: str, store: "SecureTaskStore") -> tuple[bool, int]:
    """Return (allowed, uses_remaining_this_month).

    For PRO tier always returns (True, 9999).
    For FREE tier counts request_received events matching the feature prefix
    in the current calendar month.
    """
    if get_tier() == Tier.PRO:
        return True, 9999

    current_month = datetime.now(timezone.utc).strftime("%Y-%m")
    history = store.get_recent_history(limit=10_000)
    count = sum(
        1 for row in history
        if row.get("task_type", "").startswith(feature)
        and row.get("event_type") == "request_received"
        and row.get("created_at_utc", "")[:7] == current_month
    )
    remaining = max(0, FREE_MONTHLY_LIMIT - count)
    return remaining > 0, remaining

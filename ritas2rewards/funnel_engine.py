"""Funnel state machine — manages email sequence progression and handoffs."""
from __future__ import annotations

from typing import Optional

from .config import HUMAN_HANDOFF_THRESHOLD
from .database import (
    add_interest_event, create_handoff, get_restaurant, get_restaurants,
    log_email, record_response, restaurants_due_for_followup, update_restaurant,
)
from .email_generator import generate_email
from .email_sender import SendResult, send_email
from .models import FUNNEL_STAGES, INTEREST_POINT_MAP

_STAGE_SEQUENCE: dict[str, str] = {
    "cold_outreach": "follow_up_1",
    "follow_up_1": "follow_up_2",
    "follow_up_2": "dormant",
}


def send_outreach(restaurant_id: int, stage: str,
                  sent_by: str = "system") -> tuple[bool, str, dict]:
    """Generate + send one email for the given restaurant and stage.

    Returns (success, message, email_dict)
    """
    restaurant = get_restaurant(restaurant_id)
    if not restaurant:
        return False, "Restaurant not found", {}

    # Don't re-contact declined / unsubscribed
    if restaurant.get("status") in ("declined", "unsubscribed", "converted"):
        return False, f"Skipped — status is {restaurant['status']}", {}

    # Find prev subject for follow-up threading
    prev_subject: Optional[str] = None
    if stage in ("follow_up_1", "follow_up_2"):
        from .database import get_email_history
        history = get_email_history(restaurant_id)
        if history:
            prev_subject = history[-1].get("subject")

    generated = generate_email(restaurant, stage, prev_subject)

    to_email = restaurant.get("email", "")
    to_name = restaurant.get("contact_name") or restaurant.get("name", "")
    result: SendResult = send_email(to_email, to_name, generated["subject"], generated["body"])

    if result.success:
        email_id = log_email(restaurant_id, stage, generated["subject"], generated["body"], sent_by)
        add_interest_event(restaurant_id, "email_sent",
                           INTEREST_POINT_MAP["email_sent"], f"Stage: {stage}")

        # Check if score now triggers handoff
        restaurant = get_restaurant(restaurant_id)  # reload updated score
        _maybe_trigger_handoff(restaurant, email_id)

    return result.success, result.error or ("Preview mode — email not actually sent"
                                             if result.preview_only else "Sent"), generated


def send_bulk(restaurant_ids: list[int], stage: str,
              sent_by: str = "system") -> list[dict]:
    """Send stage emails to multiple restaurants. Returns per-restaurant results."""
    results = []
    for rid in restaurant_ids:
        ok, msg, email = send_outreach(rid, stage, sent_by)
        restaurant = get_restaurant(rid)
        results.append({
            "restaurant_id": rid,
            "name": restaurant["name"] if restaurant else str(rid),
            "success": ok,
            "message": msg,
            "subject": email.get("subject", ""),
        })
    return results


def process_response(restaurant_id: int, email_id: int, response_text: str) -> str:
    """Classify an incoming response, update interest score, and advance stage."""
    sentiment = _classify_sentiment(response_text)
    record_response(email_id, response_text, sentiment)

    event_map = {
        "positive": "replied_positive",
        "interested": "replied_interested",
        "negative": "declined",
        "unsubscribe": "unsubscribed",
        "neutral": "replied",
    }
    event = event_map.get(sentiment, "replied")
    pts = INTEREST_POINT_MAP.get(event, INTEREST_POINT_MAP["replied"])
    add_interest_event(restaurant_id, event, pts, f"Response: {response_text[:100]}")

    if sentiment in ("negative",):
        update_restaurant(restaurant_id, status="declined", current_stage="declined")
    elif sentiment == "unsubscribe":
        update_restaurant(restaurant_id, status="unsubscribed", current_stage="unsubscribed")
    elif sentiment in ("positive", "interested"):
        update_restaurant(restaurant_id, status="interested", current_stage="interested_response")
        restaurant = get_restaurant(restaurant_id)
        _maybe_trigger_handoff(restaurant)

    return sentiment


def run_followup_batch() -> list[dict]:
    """Check all restaurants due for follow-up and send the next email."""
    due = restaurants_due_for_followup()
    results = []
    for r in due:
        next_stage = _STAGE_SEQUENCE.get(r["current_stage"])
        if not next_stage:
            continue
        if next_stage == "dormant":
            update_restaurant(r["id"], status="dormant", current_stage="dormant")
            results.append({"restaurant_id": r["id"], "name": r["name"], "action": "dormant"})
            continue
        ok, msg, _ = send_outreach(r["id"], next_stage)
        results.append({
            "restaurant_id": r["id"],
            "name": r["name"],
            "stage": next_stage,
            "success": ok,
            "message": msg,
        })
    return results


def _classify_sentiment(text: str) -> str:
    """Heuristic sentiment classifier. Claude API gives better accuracy in production."""
    lower = text.lower()
    # Unsubscribe signals — most specific, checked first
    if any(p in lower for p in ("unsubscribe", "opt out", "opt-out",
                                 "remove me from", "stop emailing", "stop all email",
                                 "do not contact", "take me off")):
        return "unsubscribe"
    # Negative / not interested
    if any(p in lower for p in ("not interested", "no thank", "no thanks",
                                 "not the right fit", "pass on this",
                                 "leave us alone", "please don't email",
                                 "not for us", "we're all set")):
        return "negative"
    # Strong interest
    if any(p in lower for p in ("interested", "tell me more", "how does it work",
                                 "sign me up", "let's talk", "lets talk",
                                 "schedule a call", "sounds great", "love to hear",
                                 "definitely", "absolutely", "yes please")):
        return "interested"
    # Soft positive / curious
    if any(p in lower for p in ("sure", "send it over", "send it",
                                 "more info", "more information",
                                 "maybe", "curious", "how much", "what does it cost",
                                 "what is the price", "how does the program work")):
        return "positive"
    # Any standalone yes is at least positive
    if lower.strip() in ("yes", "ok", "okay", "sure"):
        return "positive"
    return "neutral"


def _maybe_trigger_handoff(restaurant: Optional[dict], email_contact_id: Optional[int] = None) -> None:
    if not restaurant:
        return
    score = restaurant.get("interest_score", 0)
    stage = restaurant.get("current_stage", "")
    if (score >= HUMAN_HANDOFF_THRESHOLD
            and stage not in ("human_handoff", "converted", "declined", "unsubscribed")):
        priority = min(10, max(1, score // 10))
        create_handoff(
            restaurant_id=restaurant["id"],
            email_contact_id=email_contact_id,
            priority=priority,
            reason=f"Interest score reached {score} (threshold: {HUMAN_HANDOFF_THRESHOLD})",
        )

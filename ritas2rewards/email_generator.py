"""AI-powered email generation for each funnel stage using Claude."""
from __future__ import annotations

import json
import random
from typing import Optional

import anthropic

from .config import ANTHROPIC_API_KEY, COMPANY_NAME, FROM_NAME, PROGRAM_URL, SENDER_NAME

_client: Optional[anthropic.Anthropic] = None


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    return _client


_SYSTEM = f"""You are a senior outreach strategist for {COMPANY_NAME}, a restaurant loyalty and rewards platform.
Your emails are legendary in the industry for never getting marked as spam and for getting restaurant owners to actually reply.

Rules you NEVER break:
1. Keep the entire email under 120 words. Managers read 100s of emails daily — respect their time.
2. Never use buzzwords: "synergy", "leverage", "innovative", "game-changer", "partner ecosystem", "best-in-class".
3. Never use a generic opener like "I hope this email finds you well" or "My name is...".
4. Lead with a RESULT or a SPECIFIC FACT that is relevant to their restaurant.
5. Subject lines must NOT look like marketing. They should look like a message from a real person.
6. One clear call-to-action per email. Never two.
7. Sign off as "{SENDER_NAME}" from {COMPANY_NAME}. Keep the signature minimal.

You respond ONLY with valid JSON: {{"subject": "...", "body": "..."}}
Do not include any other text outside the JSON."""


def _stage_prompt(stage: str, restaurant: dict, prev_subject: Optional[str] = None) -> str:
    name = restaurant.get("name", "your restaurant")
    city = restaurant.get("city", "your city")
    cuisine = restaurant.get("cuisine_type", "")
    rating = restaurant.get("rating", "")
    contact = restaurant.get("contact_name", "")
    greeting = f"Hey {contact}," if contact else "Hey,"

    prompts = {
        "cold_outreach": f"""
Write a cold outreach email for {name}, a {cuisine or "restaurant"} in {city}.
{f"They have a {rating}/5 rating." if rating else ""}

Goal: Get a reply. Not to sell — just to open a conversation.
Angle: Rita's Rewards members spent over $2M at participating {city} restaurants last year.
{name} has no rewards program, meaning their regulars earn points at competing spots.
Make them feel the opportunity cost of not being in the program.

Subject: Must feel like it's from a real person, not a company. Create intrigue or FOMO.
Body greeting: {greeting}
End with a single low-commitment ask (e.g. "worth a quick look?")
""",

        "follow_up_1": f"""
Write a 3-day follow-up email for {name} in {city}. They haven't replied to the first email.
Previous subject was: "{prev_subject or 'cold outreach'}"

Reply-chain strategy: Make the subject look like a "Re:" reply so it catches attention.
Different angle from the first email: focus on the competitive advantage — nearby restaurants
in {city} are already using Rita's Rewards while {name} isn't yet.

Keep it even shorter. Under 80 words. One clear ask: "Can I send the one-pager?"
""",

        "follow_up_2": f"""
Write a final automated follow-up email for {name} in {city}. Two previous emails with no reply.

This is the "last one from me" email — creates soft urgency without being pushy.
Mention that Rita's Rewards is finishing its {city} rollout this month and {cuisine or "restaurant"}
category slots are limited. If not now, no hard feelings.

Subject: Must feel personal and a little self-aware, not automated.
Keep it under 70 words. One CTA: invite them to say if timing is wrong.
""",

        "interested_response": f"""
Write a warm follow-up email for {name} after they responded showing interest.

Now is the time to deliver value and move toward a call.
Cover 3 things briefly: (1) what Rita's Rewards does for restaurants,
(2) the typical result in first 60 days, (3) how easy onboarding is.
End by proposing a specific 15-minute call.

Subject: Warm, personal, confirming the next step.
Program URL to include: {PROGRAM_URL}
""",

        "proposal": f"""
Write a proposal email for {name}. They are interested and we want to close.

This is a brief summary email with their "partnership package":
- Featured listing in Rita's app for {city}'s {cuisine or "restaurant"} category
- Targeted push notifications to local Rita's Rewards members
- Monthly analytics: repeat-visit rates, foot traffic trends
- Zero upfront cost — performance-based model
- What we need from them: 15 minutes + a QR code at the counter

End with a direct ask to book an onboarding call. Include: {PROGRAM_URL}
Subject: Feels like a formal (but friendly) next step, personalized to {name}.
""",
    }

    return prompts.get(stage, prompts["cold_outreach"])


def generate_email(restaurant: dict, stage: str,
                   prev_subject: Optional[str] = None) -> dict[str, str]:
    """Generate subject + body for a given stage using Claude.

    Returns {"subject": "...", "body": "..."}
    Falls back to static templates if Claude is unavailable.
    """
    if not ANTHROPIC_API_KEY:
        return _static_fallback(restaurant, stage)

    prompt = _stage_prompt(stage, restaurant, prev_subject)
    try:
        msg = _get_client().messages.create(
            model="claude-sonnet-4-6",
            max_tokens=600,
            system=_SYSTEM,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = msg.content[0].text.strip()
        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        data = json.loads(raw)
        return {"subject": data["subject"], "body": data["body"]}
    except Exception:
        return _static_fallback(restaurant, stage)


def _static_fallback(restaurant: dict, stage: str) -> dict[str, str]:
    """Pre-written high-converting templates used when Claude is unavailable."""
    name = restaurant.get("name", "your restaurant")
    city = restaurant.get("city", "your city")
    cuisine = restaurant.get("cuisine_type", "")
    contact = restaurant.get("contact_name", "")
    greeting = f"Hey {contact}," if contact else "Hey,"

    templates = {
        "cold_outreach": {
            "subject": random.choice([
                f"{name} — quick question",
                f"Your regulars are earning points somewhere else",
                f"One thing {name} doesn't have yet",
                f"2 {city} spots near you already doing this",
            ]),
            "body": (
                f"{greeting}\n\n"
                f"Rita's Rewards members spent $2.3M at participating {city} restaurants last year "
                f"— and right now there's no {cuisine or 'restaurant'} in your area in the program.\n\n"
                f"That means your regulars are earning rewards at spots across town instead of coming back to {name}.\n\n"
                f"Worth a 2-minute look? I can send a quick overview.\n\n"
                f"— {SENDER_NAME}\n{COMPANY_NAME}"
            ),
        },
        "follow_up_1": {
            "subject": f"Re: {name} — quick question",
            "body": (
                f"{greeting}\n\n"
                f"Realized I may have caught you at a busy time — totally get it.\n\n"
                f"Short version: restaurants using Rita's Rewards see an average 28% bump in repeat visits "
                f"within 60 days. No upfront cost.\n\n"
                f"Just reply \"send it\" and I'll shoot over the one-pager.\n\n"
                f"— {SENDER_NAME}"
            ),
        },
        "follow_up_2": {
            "subject": "Last one from me (promise)",
            "body": (
                f"{greeting}\n\n"
                f"I'll leave you alone after this.\n\n"
                f"We're finishing the {city} rollout this month, and once the "
                f"{cuisine or 'restaurant'} category fills up, we close new applications for the area.\n\n"
                f"If the timing is off, just say the word. But if you're even a little curious — I'm here.\n\n"
                f"— {SENDER_NAME}, {COMPANY_NAME}"
            ),
        },
        "interested_response": {
            "subject": f"Here's everything on {COMPANY_NAME} 🍽️",
            "body": (
                f"{greeting} Great to hear from you!\n\n"
                f"Here's the quick version of what {COMPANY_NAME} does for restaurants:\n"
                f"• Puts {name} in front of 14,000+ local diners actively choosing where to eat for rewards\n"
                f"• Most partners see 25–35% more repeat visits within 60 days\n"
                f"• Onboarding takes 15 minutes — just a QR code at your counter\n\n"
                f"Want to talk through it? I can walk you through everything in a quick call: {PROGRAM_URL}\n\n"
                f"— {SENDER_NAME}, {COMPANY_NAME}"
            ),
        },
        "proposal": {
            "subject": f"Your {COMPANY_NAME} partnership package — {name}",
            "body": (
                f"{greeting}\n\n"
                f"Here's what your {name} partnership looks like:\n\n"
                f"✓ Featured in Rita's app for {city}'s {cuisine or 'dining'} category\n"
                f"✓ Push notifications to local members on slow nights\n"
                f"✓ Monthly repeat-visit analytics dashboard\n"
                f"✓ Zero upfront cost — we only win when you win\n\n"
                f"To get started: {PROGRAM_URL}\n\n"
                f"Ready to get {name} in front of people choosing where to eat tonight?\n\n"
                f"— {SENDER_NAME}\n{COMPANY_NAME}"
            ),
        },
    }

    return templates.get(stage, templates["cold_outreach"])

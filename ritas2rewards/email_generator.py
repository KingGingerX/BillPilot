"""AI-powered email generation for each funnel stage using Claude."""
from __future__ import annotations

import json
import random
from typing import Optional

import anthropic

from .config import ANTHROPIC_API_KEY, COMPANY_NAME, FROM_NAME, PROGRAM_URL, SENDER_NAME
from .pitch_materials import (
    APPROACH_PRINCIPLES, MISSION, SENDER_PHILOSOPHY, TAGLINE, VALUE_PROPS,
)

_client: Optional[anthropic.Anthropic] = None


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    return _client


_SYSTEM = f"""You are {SENDER_NAME}, founder of ritas2rewards — a DFW-based connector who helps local restaurants attract full-paying diners through travel + rewards partnerships.

Your mission: "{MISSION}"
Your approach: {SENDER_PHILOSOPHY}

Principles you live by:
{chr(10).join(f"- {p}" for p in APPROACH_PRINCIPLES)}

Your email style:
1. Under 120 words. Restaurant owners get 100+ emails a day. Every sentence must earn its place.
2. Zero corporate buzzwords. No "synergy", "leverage", "ecosystem", "game-changer", "innovative".
3. Never open with "I hope this finds you well" or "My name is...". Start with something real.
4. You are a DFW local writing to a fellow DFW restaurant person — warm, direct, genuine.
5. Subject lines feel like they're from a friend or someone who visited, not a marketing campaign.
6. One ask per email. Never two.
7. Sign off as "{SENDER_NAME}" with minimal signature. Include "ritas2rewards" not a formal company name.

ritas2rewards value to restaurants: {' '.join(VALUE_PROPS)} {TAGLINE}.

You respond ONLY with valid JSON: {{"subject": "...", "body": "..."}}
No other text outside the JSON."""


def _stage_prompt(stage: str, restaurant: dict, prev_subject: Optional[str] = None) -> str:
    name = restaurant.get("name", "your restaurant")
    city = restaurant.get("city", "DFW")
    cuisine = restaurant.get("cuisine_type", "")
    rating = restaurant.get("rating", "")
    contact = restaurant.get("contact_name", "")
    group = restaurant.get("ownership_group", "")
    is_priority = restaurant.get("is_priority", 0)

    greeting = f"Hey {contact}," if contact else "Hey,"
    group_note = (
        f"\nImportant: {name} is part of the {group} ownership group. "
        f"Lead with the opportunity to bring the whole group in — one conversation, multiple locations."
        if group else ""
    )
    priority_note = (
        "\nThis is a high-priority target. The subject line and opening sentence need to be especially sharp."
        if is_priority else ""
    )

    prompts = {
        "cold_outreach": f"""
Write a cold outreach email for {name}, a {cuisine or "restaurant"} in {city}.
{f"They have a {rating}/5 rating." if rating else ""}
{group_note}
{priority_note}

You are Maggie — a DFW local who genuinely loves great restaurants and wants to help them fill seats.
Friend-first approach: don't sell, just connect. Make them feel like you've been to their place.

Goal: Get ONE reply. Not to sell ritas2rewards — just to start a real conversation.
Angle: Their regulars deserve a reason to keep coming back. DFW diners using ritas2rewards
are actively choosing where to eat based on which restaurants participate.
{name} is missing that foot traffic.

Subject: Reads like a text from a local, not a marketing email.
Body greeting: {greeting}
End with one low-commitment ask that's easy to say yes to.
""",

        "follow_up_1": f"""
Write a 3-day follow-up email for {name} in {city}. They haven't replied to the first email.
Previous subject was: "{prev_subject or 'initial outreach'}"
{group_note}

You are Maggie. You're not following up as a salesperson — you genuinely want to help {name} grow.
Use the reply-chain subject format (Re: ...) so it looks like a continuation of a real conversation.

Different angle: What are other {city} restaurants gaining right now that {name} isn't?
Be brief — under 80 words. End with one soft ask: can you send something short?
""",

        "follow_up_2": f"""
Write a final outreach email for {name} in {city}. No reply after two previous emails.
{group_note}

You are Maggie. This is your last automated touch — be real and a little self-aware about it.
No pressure. Just a genuine check-in and a soft door left open.

Angle: DFW has limited spots for the {cuisine or "dining"} category in ritas2rewards.
Once filled, {name} would be competing with whoever got in first.

Subject: Feels personal, not automated. A little vulnerable is OK.
Under 70 words. One ask: just let me know if the timing is off.
""",

        "interested_response": f"""
Write a warm, excited follow-up email for {name} after they responded showing interest.
{group_note}

You are Maggie — genuinely thrilled they replied. This is a real conversation now.
Shift from outreach mode to value-delivery mode. Be warm and specific.

Cover briefly: (1) what ritas2rewards actually does for restaurants like {name},
(2) what results look like in the first 60 days, (3) how dead-simple onboarding is.
End with proposing a specific 15-minute coffee or call.

Subject: Feels like a warm reply from someone excited to help.
Program URL to include if relevant: {PROGRAM_URL}
""",

        "proposal": f"""
Write a proposal email for {name}. They're interested and ready to see the full picture.
{group_note}

You are Maggie. This is the "here's exactly what your partnership looks like" email.
Be specific to {name} and {city}. Make it easy to say yes.

Include:
- What {name} gets: visibility to ritas2rewards diners in {city}'s {cuisine or "dining"} category,
  push campaigns on slow nights, monthly repeat-visit analytics
- Zero upfront cost — we win when they win
- What they need to do: 15-minute call + QR code at the counter (we provide it)
- Clear next step: book their onboarding call

Subject: Personal and action-oriented — feels like the final step of a real conversation.
Include: {PROGRAM_URL}
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
    """Pre-written templates in Maggie's brand voice. Used when Claude is unavailable."""
    name = restaurant.get("name", "your restaurant")
    city = restaurant.get("city", "DFW")
    cuisine = restaurant.get("cuisine_type", "")
    contact = restaurant.get("contact_name", "")
    group = restaurant.get("ownership_group", "")
    greeting = f"Hey {contact}," if contact else "Hey,"
    group_line = (
        f"\n\nP.S. If this is a good fit for {name}, I'd love to explore what it "
        f"looks like across the full {group} family."
        if group else ""
    )

    templates = {
        "cold_outreach": {
            "subject": random.choice([
                f"{name} — quick question from a DFW local",
                f"Your regulars deserve a reason to keep coming back",
                f"Something I noticed about {name}",
                f"A few {city} restaurants are doing something your regulars would love",
            ]),
            "body": (
                f"{greeting}\n\n"
                f"I help DFW restaurants attract full-paying guests through travel + rewards "
                f"partnerships, and {name} came up as a natural fit.\n\n"
                f"Your regulars are choosing where to eat based on where they earn rewards. "
                f"Right now, that's probably not {name} — but it could be.{group_line}\n\n"
                f"Worth a 2-minute conversation?\n\n"
                f"— {SENDER_NAME}\nritas2rewards | @ritas2rewards"
            ),
        },
        "follow_up_1": {
            "subject": f"Re: {name} — quick question from a DFW local",
            "body": (
                f"{greeting}\n\n"
                f"Caught you at a busy time — totally get it.\n\n"
                f"Short version: DFW restaurants in ritas2rewards are pulling more repeat visits "
                f"from diners who pick where to eat based on rewards. Zero upfront cost.\n\n"
                f"Can I send you a one-pager?\n\n"
                f"— {SENDER_NAME}, ritas2rewards"
            ),
        },
        "follow_up_2": {
            "subject": "Last one from me — promise 🤞",
            "body": (
                f"{greeting}\n\n"
                f"Not going to keep bugging you — this is my last note.\n\n"
                f"We're filling the {city} {cuisine or 'dining'} category this month. "
                f"Once it's full, that's it for new partners in this area.\n\n"
                f"If the timing's just off, no worries — just let me know. "
                f"Either way, {name} is doing great things.\n\n"
                f"— {SENDER_NAME}\nritas2rewards"
            ),
        },
        "interested_response": {
            "subject": "So glad you replied — here's the full picture on ritas2rewards",
            "body": (
                f"{greeting}\n\n"
                f"Really glad to hear from you!\n\n"
                f"Here's what ritas2rewards does for {city} restaurants like {name}:\n"
                f"• Connects you with diners actively choosing where to eat based on rewards\n"
                f"• Partners see stronger repeat visit rates in the first 60 days\n"
                f"• Onboarding is 15 minutes — a QR code at your counter and you're live\n"
                f"• Zero upfront cost — I only win when you win{group_line}\n\n"
                f"I'd love to walk you through it. Coffee or a quick call this week?\n\n"
                f"— {SENDER_NAME}\nritas2rewards | {PROGRAM_URL}"
            ),
        },
        "proposal": {
            "subject": f"Your ritas2rewards partnership — {name}",
            "body": (
                f"{greeting}\n\n"
                f"Here's what your {name} partnership looks like:\n\n"
                f"✓ Visibility to DFW diners choosing restaurants by rewards program\n"
                f"✓ Push campaigns to ritas2rewards members on your slower nights\n"
                f"✓ Monthly repeat-visit analytics — see what's working\n"
                f"✓ Zero upfront — we grow together{group_line}\n\n"
                f"15 minutes + a QR code is all it takes to get started.\n\n"
                f"Book your onboarding call: {PROGRAM_URL}\n\n"
                f"— {SENDER_NAME}\nritas2rewards | maggie@ritas2rewards.com"
            ),
        },
    }

    return templates.get(stage, templates["cold_outreach"])

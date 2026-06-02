from __future__ import annotations

import json
import os
import re
from typing import Any

from pydantic import BaseModel, field_validator


class InvestorQuery(BaseModel):
    investor_name: str
    firm_or_affiliation: str = ""
    your_venture_name: str
    your_venture_description: str
    your_sector: str
    your_stage: str
    why_good_cause: str
    additional_investor_notes: str = ""

    @field_validator("investor_name", "your_venture_name", "your_venture_description",
                     "your_sector", "your_stage", "why_good_cause")
    @classmethod
    def non_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("must not be empty")
        return v.strip()


_SYSTEM_PROMPT = """You are a world-class startup advisor and investor relations expert with deep knowledge of the angel investing ecosystem. Your task is to research an angel investor and produce a comprehensive intelligence brief plus a tailored pitch strategy.

Research the investor based on their name and any context provided. Draw from publicly known information: portfolio pages, interviews, Twitter/X, conference talks, published investment theses, and news coverage.

Return a JSON object with EXACTLY this structure (raw JSON only — no markdown fences, no preamble):
{
  "name": "Full name",
  "firm_or_affiliation": "Primary firm, fund, or company",
  "location": "City, State/Country",
  "bio_summary": "2–3 sentence overview",
  "professional_background": "Career path and how they became an investor",
  "investment_focus": ["sector or niche"],
  "notable_investments": ["Company (year if known)"],
  "investment_stage": "e.g. Pre-seed to Seed",
  "typical_check_size": "e.g. $25K–$250K or Unknown",
  "geographic_preference": "e.g. US-focused, global, Bay Area",
  "what_they_look_for": ["investment criterion"],
  "founder_preferences": ["founder trait they value"],
  "red_flags": ["what causes them to pass on a deal"],
  "contact_channels": {
    "linkedin": "Profile URL or 'Search LinkedIn for [name]'",
    "twitter": "@handle or Unknown",
    "website": "URL or Unknown",
    "email": "Known email or 'Not publicly listed'",
    "best_approach": "How to best initiate contact (warm intro, cold email, Twitter DM, etc.)"
  },
  "recent_themes": "Their most recently stated investment interests or public priorities",
  "quotes": ["Notable quote from an interview or public writing"],
  "data_confidence": {
    "level": "high | medium | low",
    "note": "Explanation of confidence and any known gaps"
  },
  "venture_alignment_score": 7,
  "venture_alignment_rationale": "Why this investor is or isn't a strong fit for the specific venture described",
  "pitch_strategy": {
    "headline_hook": "The single most compelling 1–2 sentence opener tailored to THIS investor",
    "key_alignment_points": ["How the venture aligns with their known thesis"],
    "core_talking_points": ["Talking point 1", "Talking point 2"],
    "metrics_to_lead_with": ["Specific metric or traction signal that would resonate most"],
    "questions_to_ask_them": ["Thoughtful, research-based question to ask during the meeting"],
    "things_to_avoid": ["What NOT to say or do with this specific investor"],
    "follow_up_strategy": "How and when to follow up if no response"
  },
  "outreach_email": {
    "subject_line": "Email subject line",
    "body": "Full personalized cold outreach email (3–4 paragraphs)"
  },
  "suggested_research_queries": [
    "Specific web search or LinkedIn search to find more information about this investor"
  ]
}

Honesty rules:
- Set data_confidence.level to "low" if you have limited information.
- NEVER fabricate specific portfolio companies, check sizes, or contact details.
- Mark inferred or estimated values with "(estimated)" in the string.
- venture_alignment_score must be an integer 1–10.
"""


def research_investor(query: InvestorQuery) -> dict[str, Any]:
    """Use Claude to research an investor and return a structured profile + pitch strategy dict."""
    try:
        import anthropic
    except ImportError as exc:
        raise RuntimeError(
            "Install the anthropic package: pip install anthropic"
        ) from exc

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError(
            "Set ANTHROPIC_API_KEY in your environment to use Investor Research."
        )

    user_message = (
        f"Research this angel investor and generate a tailored pitch strategy.\n\n"
        f"INVESTOR:\n"
        f"Name: {query.investor_name}\n"
        f"Firm/Affiliation: {query.firm_or_affiliation or 'Unknown'}\n"
        f"Additional notes: {query.additional_investor_notes or 'None'}\n\n"
        f"MY VENTURE:\n"
        f"Name: {query.your_venture_name}\n"
        f"Description: {query.your_venture_description}\n"
        f"Sector: {query.your_sector}\n"
        f"Stage: {query.your_stage}\n"
        f"Why it matters / mission: {query.why_good_cause}\n\n"
        f"Return the full JSON research brief."
    )

    client = anthropic.Anthropic(api_key=api_key)
    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        system=_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )

    raw = message.content[0].text.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)

    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        # Return a minimal error dict so the UI can surface a helpful message
        raise RuntimeError(
            f"Claude returned non-JSON output. Raw response (first 500 chars): {raw[:500]}"
        ) from exc


def format_investor_report(data: dict[str, Any], query: InvestorQuery) -> str:
    """Format the structured investor research dict into a readable plain-text report."""

    def s(val: Any, default: str = "Not available") -> str:
        return str(val).strip() if val else default

    def li(items: Any) -> str:
        if not items:
            return "  • Not available"
        return "\n".join(f"  • {item}" for item in items)

    lines: list[str] = []

    lines.append("=" * 70)
    lines.append("  ANGEL INVESTOR RESEARCH BRIEF")
    lines.append(f"  Prepared for: {query.your_venture_name}")
    lines.append("=" * 70)

    # ── Profile Overview ────────────────────────────────────────────────────
    lines.append(f"\n{'─'*70}")
    lines.append(f"  INVESTOR PROFILE: {s(data.get('name')).upper()}")
    lines.append(f"{'─'*70}")
    lines.append(f"Firm/Affiliation  : {s(data.get('firm_or_affiliation'))}")
    lines.append(f"Location          : {s(data.get('location'))}")
    lines.append(f"Stage Focus       : {s(data.get('investment_stage'))}")
    lines.append(f"Typical Check     : {s(data.get('typical_check_size'))}")
    lines.append(f"Geography         : {s(data.get('geographic_preference'))}")
    conf = data.get("data_confidence", {})
    lines.append(
        f"Data Confidence   : {s(conf.get('level')).upper()} — {s(conf.get('note'))}"
    )

    lines.append("\nBIOGRAPHY")
    lines.append(s(data.get("bio_summary")))
    lines.append("\nPROFESSIONAL BACKGROUND")
    lines.append(s(data.get("professional_background")))

    lines.append("\nINVESTMENT FOCUS AREAS")
    lines.append(li(data.get("investment_focus")))

    lines.append("\nNOTABLE INVESTMENTS")
    lines.append(li(data.get("notable_investments")))

    lines.append("\nWHAT THEY LOOK FOR IN COMPANIES")
    lines.append(li(data.get("what_they_look_for")))

    lines.append("\nFOUNDER PREFERENCES")
    lines.append(li(data.get("founder_preferences")))

    lines.append("\nRED FLAGS — WHAT CAUSES THEM TO PASS")
    lines.append(li(data.get("red_flags")))

    lines.append("\nRECENT THEMES & PUBLIC PRIORITIES")
    lines.append(s(data.get("recent_themes")))

    quotes = data.get("quotes") or []
    if quotes:
        lines.append("\nNOTABLE QUOTES")
        for q in quotes:
            lines.append(f'  "{q}"')

    # ── Contact Intelligence ─────────────────────────────────────────────────
    lines.append(f"\n{'─'*70}")
    lines.append("  CONTACT INTELLIGENCE")
    lines.append(f"{'─'*70}")
    cc = data.get("contact_channels") or {}
    lines.append(f"LinkedIn  : {s(cc.get('linkedin'))}")
    lines.append(f"Twitter/X : {s(cc.get('twitter'))}")
    lines.append(f"Website   : {s(cc.get('website'))}")
    lines.append(f"Email     : {s(cc.get('email'))}")
    lines.append(f"\nBEST APPROACH:\n  {s(cc.get('best_approach'))}")

    # ── Fit Analysis ─────────────────────────────────────────────────────────
    score = data.get("venture_alignment_score", "?")
    lines.append(f"\n{'─'*70}")
    lines.append(f"  VENTURE FIT ANALYSIS  [Score: {score}/10]")
    lines.append(f"{'─'*70}")
    lines.append(s(data.get("venture_alignment_rationale")))

    # ── Pitch Strategy ───────────────────────────────────────────────────────
    ps = data.get("pitch_strategy") or {}
    lines.append(f"\n{'─'*70}")
    lines.append("  PITCH STRATEGY")
    lines.append(f"{'─'*70}")

    lines.append("\nOPENING HOOK:")
    lines.append(f"  {s(ps.get('headline_hook'))}")

    lines.append("\nKEY ALIGNMENT POINTS:")
    lines.append(li(ps.get("key_alignment_points")))

    lines.append("\nCORE TALKING POINTS:")
    lines.append(li(ps.get("core_talking_points")))

    lines.append("\nMETRICS TO LEAD WITH:")
    lines.append(li(ps.get("metrics_to_lead_with")))

    lines.append("\nQUESTIONS TO ASK THEM:")
    lines.append(li(ps.get("questions_to_ask_them")))

    lines.append("\nTHINGS TO AVOID:")
    lines.append(li(ps.get("things_to_avoid")))

    lines.append("\nFOLLOW-UP STRATEGY:")
    lines.append(f"  {s(ps.get('follow_up_strategy'))}")

    # ── Outreach Email ───────────────────────────────────────────────────────
    em = data.get("outreach_email") or {}
    lines.append(f"\n{'─'*70}")
    lines.append("  COLD OUTREACH EMAIL TEMPLATE")
    lines.append(f"{'─'*70}")
    lines.append(f"Subject: {s(em.get('subject_line'))}")
    lines.append("")
    lines.append(s(em.get("body")))

    # ── Supplemental Research Queries ────────────────────────────────────────
    sq = data.get("suggested_research_queries") or []
    if sq:
        lines.append(f"\n{'─'*70}")
        lines.append("  SUGGESTED RESEARCH QUERIES")
        lines.append(f"{'─'*70}")
        lines.append("Run these searches to deepen your research:")
        lines.append(li(sq))

    # ── Disclaimer ───────────────────────────────────────────────────────────
    lines.append(f"\n{'─'*70}")
    lines.append("  DISCLAIMER")
    lines.append(f"{'─'*70}")
    lines.append(
        "This brief was generated by AI based on publicly available information.\n"
        "Always verify details before outreach — investment preferences change over time.\n"
        "Personalize all communications based on the most current information you can find.\n"
        "This is not financial, legal, or investment advice."
    )
    lines.append("=" * 70)

    return "\n".join(lines)

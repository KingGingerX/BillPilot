from __future__ import annotations

import json
import os
from unittest.mock import MagicMock, patch

import pytest

from debt_bot.investor_research import (
    InvestorQuery,
    format_investor_report,
    research_investor,
)


# ── Model validation ─────────────────────────────────────────────────────────

def _valid_query(**overrides) -> dict:
    base = dict(
        investor_name="Jane Angel",
        firm_or_affiliation="Acme Ventures",
        your_venture_name="GreenGrid",
        your_venture_description="Solar micro-grid for rural communities.",
        your_sector="CleanEnergy",
        your_stage="Seed",
        why_good_cause="Brings clean power to 500M off-grid people.",
        additional_investor_notes="",
    )
    base.update(overrides)
    return base


def test_investor_query_valid():
    q = InvestorQuery(**_valid_query())
    assert q.investor_name == "Jane Angel"
    assert q.firm_or_affiliation == "Acme Ventures"


def test_investor_query_empty_name_rejected():
    with pytest.raises(Exception):
        InvestorQuery(**_valid_query(investor_name=""))


def test_investor_query_whitespace_stripped():
    q = InvestorQuery(**_valid_query(investor_name="  Jane Angel  "))
    assert q.investor_name == "Jane Angel"


def test_investor_query_optional_fields_default():
    q = InvestorQuery(**_valid_query(firm_or_affiliation="", additional_investor_notes=""))
    assert q.firm_or_affiliation == ""
    assert q.additional_investor_notes == ""


def test_investor_query_empty_venture_description_rejected():
    with pytest.raises(Exception):
        InvestorQuery(**_valid_query(your_venture_description=""))


# ── research_investor — error paths ──────────────────────────────────────────

def test_research_investor_raises_without_api_key(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    q = InvestorQuery(**_valid_query())
    with pytest.raises(RuntimeError, match="ANTHROPIC_API_KEY"):
        research_investor(q)


def test_research_investor_raises_without_package(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test")
    import builtins
    real_import = builtins.__import__

    def mock_import(name, *args, **kwargs):
        if name == "anthropic":
            raise ImportError("No module named 'anthropic'")
        return real_import(name, *args, **kwargs)

    with patch("builtins.__import__", side_effect=mock_import):
        q = InvestorQuery(**_valid_query())
        with pytest.raises(RuntimeError, match="pip install anthropic"):
            research_investor(q)


def test_research_investor_raises_on_bad_json(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test")
    q = InvestorQuery(**_valid_query())

    mock_content = MagicMock()
    mock_content.text = "This is not JSON at all."
    mock_message = MagicMock()
    mock_message.content = [mock_content]

    mock_client = MagicMock()
    mock_client.messages.create.return_value = mock_message

    mock_anthropic = MagicMock()
    mock_anthropic.Anthropic.return_value = mock_client

    with patch.dict("sys.modules", {"anthropic": mock_anthropic}):
        with pytest.raises(RuntimeError, match="non-JSON"):
            research_investor(q)


def test_research_investor_strips_markdown_fences(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test")
    q = InvestorQuery(**_valid_query())

    payload = {"name": "Jane Angel", "data_confidence": {"level": "high", "note": "ok"}}
    raw_with_fences = f"```json\n{json.dumps(payload)}\n```"

    mock_content = MagicMock()
    mock_content.text = raw_with_fences
    mock_message = MagicMock()
    mock_message.content = [mock_content]
    mock_client = MagicMock()
    mock_client.messages.create.return_value = mock_message
    mock_anthropic = MagicMock()
    mock_anthropic.Anthropic.return_value = mock_client

    with patch.dict("sys.modules", {"anthropic": mock_anthropic}):
        result = research_investor(q)

    assert result["name"] == "Jane Angel"


def test_research_investor_happy_path(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test")
    q = InvestorQuery(**_valid_query())

    payload = {
        "name": "Jane Angel",
        "firm_or_affiliation": "Acme Ventures",
        "location": "San Francisco, CA",
        "bio_summary": "Jane is a veteran angel.",
        "professional_background": "Ex-Google, 10 years investing.",
        "investment_focus": ["CleanEnergy", "DeepTech"],
        "notable_investments": ["SolarCo (2021)"],
        "investment_stage": "Seed",
        "typical_check_size": "$100K–$500K",
        "geographic_preference": "US-focused",
        "what_they_look_for": ["Strong founder-market fit"],
        "founder_preferences": ["Resilient", "Domain expert"],
        "red_flags": ["No traction"],
        "contact_channels": {
            "linkedin": "https://linkedin.com/in/janeangel",
            "twitter": "@janeangel",
            "website": "https://janeangel.com",
            "email": "Not publicly listed",
            "best_approach": "Warm intro preferred",
        },
        "recent_themes": "Focused on climate infrastructure.",
        "quotes": ["'Invest in people, not just ideas.'"],
        "data_confidence": {"level": "high", "note": "Well-documented investor."},
        "venture_alignment_score": 8,
        "venture_alignment_rationale": "Strong fit with her climate thesis.",
        "pitch_strategy": {
            "headline_hook": "GreenGrid brings solar to 500M off-grid people.",
            "key_alignment_points": ["Climate focus"],
            "core_talking_points": ["Unit economics", "Scale"],
            "metrics_to_lead_with": ["3 pilot sites, 200 homes"],
            "questions_to_ask_them": ["What's your typical decision timeline?"],
            "things_to_avoid": ["Don't lead with tech"],
            "follow_up_strategy": "Follow up after 1 week via LinkedIn.",
        },
        "outreach_email": {
            "subject_line": "GreenGrid — solar for off-grid communities",
            "body": "Hi Jane,\n\nI'd love to connect.\n\nBest,\nFounder",
        },
        "suggested_research_queries": ["Jane Angel AngelList portfolio"],
    }

    mock_content = MagicMock()
    mock_content.text = json.dumps(payload)
    mock_message = MagicMock()
    mock_message.content = [mock_content]
    mock_client = MagicMock()
    mock_client.messages.create.return_value = mock_message
    mock_anthropic = MagicMock()
    mock_anthropic.Anthropic.return_value = mock_client

    with patch.dict("sys.modules", {"anthropic": mock_anthropic}):
        result = research_investor(q)

    assert result["name"] == "Jane Angel"
    assert result["venture_alignment_score"] == 8
    assert result["pitch_strategy"]["headline_hook"].startswith("GreenGrid")


# ── format_investor_report ────────────────────────────────────────────────────

_SAMPLE_DATA = {
    "name": "Jane Angel",
    "firm_or_affiliation": "Acme Ventures",
    "location": "San Francisco, CA",
    "bio_summary": "Veteran angel investor.",
    "professional_background": "Ex-Google.",
    "investment_focus": ["CleanEnergy"],
    "notable_investments": ["SolarCo (2021)"],
    "investment_stage": "Seed",
    "typical_check_size": "$100K–$500K",
    "geographic_preference": "US",
    "what_they_look_for": ["Strong founder-market fit"],
    "founder_preferences": ["Resilient"],
    "red_flags": ["No traction"],
    "contact_channels": {
        "linkedin": "https://linkedin.com/in/janeangel",
        "twitter": "@janeangel",
        "website": "Unknown",
        "email": "Not publicly listed",
        "best_approach": "Warm intro preferred.",
    },
    "recent_themes": "Climate infrastructure.",
    "quotes": ["'Invest in people.'"],
    "data_confidence": {"level": "high", "note": "Well-documented."},
    "venture_alignment_score": 8,
    "venture_alignment_rationale": "Strong climate fit.",
    "pitch_strategy": {
        "headline_hook": "GreenGrid brings solar to 500M off-grid people.",
        "key_alignment_points": ["Climate focus"],
        "core_talking_points": ["Unit economics"],
        "metrics_to_lead_with": ["3 pilot sites"],
        "questions_to_ask_them": ["Decision timeline?"],
        "things_to_avoid": ["Don't lead with tech"],
        "follow_up_strategy": "Follow up after 1 week.",
    },
    "outreach_email": {
        "subject_line": "GreenGrid — solar for off-grid communities",
        "body": "Hi Jane,\n\nBest, Founder",
    },
    "suggested_research_queries": ["Jane Angel portfolio"],
}


def _make_query() -> InvestorQuery:
    return InvestorQuery(**_valid_query())


def test_format_report_contains_investor_name():
    report = format_investor_report(_SAMPLE_DATA, _make_query())
    assert "JANE ANGEL" in report


def test_format_report_contains_alignment_score():
    report = format_investor_report(_SAMPLE_DATA, _make_query())
    assert "8/10" in report


def test_format_report_contains_email_subject():
    report = format_investor_report(_SAMPLE_DATA, _make_query())
    assert "GreenGrid — solar for off-grid communities" in report


def test_format_report_contains_hook():
    report = format_investor_report(_SAMPLE_DATA, _make_query())
    assert "GreenGrid brings solar" in report


def test_format_report_contains_disclaimer():
    report = format_investor_report(_SAMPLE_DATA, _make_query())
    assert "DISCLAIMER" in report


def test_format_report_handles_missing_optional_fields():
    sparse = {"name": "Unknown Investor", "data_confidence": {"level": "low", "note": "Not found"}}
    report = format_investor_report(sparse, _make_query())
    assert "UNKNOWN INVESTOR" in report
    assert "Not available" in report


def test_format_report_contains_venture_name():
    report = format_investor_report(_SAMPLE_DATA, _make_query())
    assert "GreenGrid" in report

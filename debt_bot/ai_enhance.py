from __future__ import annotations

import os


_SYSTEM_PROMPT = (
    "You are an expert consumer rights attorney specializing in FCRA violations. "
    "Enhance the provided credit bureau dispute letter by: "
    "(1) adding specific FCRA statutory citations (15 U.S.C. § numbers) relevant to the disputed item type, "
    "(2) tightening the demand language to be more assertive while remaining professional, "
    "(3) adding any missing required FCRA § 611 elements. "
    "Return ONLY the enhanced letter text with no commentary or preamble."
)


def enhance_dispute_letter(base_letter: str) -> str:
    """Enhance a dispute letter using the Claude API.

    Requires ANTHROPIC_API_KEY in the environment and the `anthropic` package:
      pip install anthropic
    """
    try:
        import anthropic
    except ImportError as exc:
        raise RuntimeError(
            "Install the anthropic package to use AI enhancement: pip install anthropic"
        ) from exc

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("Set ANTHROPIC_API_KEY in your environment to use AI enhancement.")

    client = anthropic.Anthropic(api_key=api_key)
    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2048,
        system=_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": f"Enhance this dispute letter:\n\n{base_letter}"}],
    )
    return message.content[0].text

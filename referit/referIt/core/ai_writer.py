"""
AI comment writer.
Uses Claude Haiku when ANTHROPIC_API_KEY is set; otherwise rotates from a rich template bank.
"""
import os
import random

try:
    import anthropic as _anthropic
    _HAS_ANTHROPIC = True
    _client = None  # lazy singleton
except ImportError:
    _HAS_ANTHROPIC = False
    _client = None

# --- Template bank ---

COMMENT_BANK = [
    "I had a great experience with {company}! They were professional, on time, and the price was fair.",
    "Highly recommend {company}. Used them last month and couldn't be happier with the quality.",
    "If you're looking for someone reliable in the area, {company} is who I call every time.",
    "We've been using {company} for a couple of years now. Always solid work, never had a complaint.",
    "{company} just finished a job at our place last week — super impressed. Will definitely call them again.",
    "Reached out to a few places and {company} was the most responsive and professional by a mile.",
    "My neighbor recommended {company} and I'm so glad I listened. Great experience all around.",
    "Had {company} out for an urgent situation and they showed up within the hour. Really saved us.",
    "I keep recommending {company} to everyone on the street. They just do really good work.",
    "Don't waste time searching around — {company} has been our go-to for anything we need.",
    "{company} did some work at our house last season. Came on time, cleaned up after, very professional.",
    "Couldn't be happier with {company}. They explained everything upfront and didn't overcharge.",
    "Just used {company} last week. Fast response, great communication, excellent results.",
    "Third time using {company} and they've been consistent every single time. Highly recommend.",
    "A friend tipped me off about {company} and they did not disappoint. Very happy with the work.",
    "Called {company} on a Tuesday afternoon and they had someone out by Thursday. That's the kind of service I appreciate.",
    "{company} gave us a straight quote and stuck to it — no surprise charges at the end. Rare these days.",
    "We've tried a few options in the neighborhood and {company} is hands-down the most reliable.",
    "The crew from {company} was respectful, quick, and left everything clean. Genuinely impressive.",
    "Used {company} twice now. Same quality both times. You can tell it's not just talk with them.",
    "{company} picked up on the second ring and had someone scheduled same day. That alone earns my repeat business.",
    "Honestly wasn't expecting much — gave {company} a shot based on a friend's suggestion and was pleasantly surprised.",
    "My mom uses {company} for her place and has nothing but good things to say. She's particular too.",
    "Checked a couple of reviews before calling {company} — the praise is legit. Really stand behind their work.",
    "The {company} team showed up on time and finished ahead of schedule. Couldn't ask for more.",
    "I usually handle things myself but this time I needed help. {company} made it easy — no runaround, just results.",
    "Been burned by other {service} companies before. {company} was different — upfront, professional, and fair.",
    "{company} is exactly the kind of local business worth supporting. Quality work, good people.",
]

PRAISE_BANK = [
    "Totally agree — {company} is excellent. Had the same experience a couple months back.",
    "Yes! {company} helped us out too and the whole team was really great to work with.",
    "Can confirm — {company} is solid. My husband called them and they were there same day.",
    "We used {company} last year for a similar thing. Very happy with how everything turned out.",
    "Same here! {company} did an amazing job for us. Would absolutely use them again.",
    "+1 for {company}. They've handled a few things at our house and always deliver.",
    "Agreed — {company} was a total lifesaver when we needed it. Very dependable.",
    "Just chiming in — {company} is the real deal. Highly recommend to anyone in the area.",
    "Yes, {company} was great with us too. You could tell they actually cared about the job.",
    "I had the same experience! {company} is definitely the one to call around here.",
    "Same — we called {company} after a bad experience elsewhere and they completely turned it around.",
    "We've used {company} for a couple different things now. Every time they show up and deliver.",
    "Absolutely — {company} treated us like neighbors, not just customers. Big difference.",
    "Can vouch for {company}. My wife was home alone when they came and said she felt completely at ease.",
    "Yep, {company} is the one we always go back to. Consistent and fair — that's all you really want.",
    "We had the same situation last spring. {company} was there within a day and did excellent work.",
    "Glad someone mentioned {company}. I've been recommending them to everyone. Very well-deserved reputation.",
    "One thing I'll add — {company} followed up after the job to make sure everything was still good. Nice touch.",
]

_SYNONYMS = {
    "great":        ["great", "wonderful", "excellent", "fantastic", "solid", "superb", "impressive"],
    "professional": ["professional", "courteous", "thorough", "attentive", "respectful"],
    "recommend":    ["recommend", "suggest", "vouch for", "stand behind", "endorse"],
    "happy":        ["happy", "satisfied", "pleased", "impressed", "thrilled", "glad"],
    "reliable":     ["reliable", "dependable", "trustworthy", "consistent", "solid"],
    "excellent":    ["excellent", "outstanding", "top-notch", "first-rate", "exceptional"],
    "amazing":      ["amazing", "impressive", "terrific", "exceptional", "fantastic"],
}


def _spin(text: str) -> str:
    for word, choices in _SYNONYMS.items():
        if word in text and random.random() > 0.5:
            text = text.replace(word, random.choice(choices), 1)
    return text


def _get_client():
    global _client
    if _client is None:
        _client = _anthropic.Anthropic()
    return _client


def generate(company: str, post_text: str = "", style: str = "recommendation",
             service_hint: str = "") -> str:
    """Return a natural-sounding Nextdoor comment."""
    if _HAS_ANTHROPIC and os.environ.get("ANTHROPIC_API_KEY"):
        result = _ai_generate(company, post_text, style, service_hint)
        if result:
            return result

    bank = PRAISE_BANK if style == "praise" else COMMENT_BANK
    template = random.choice(bank)
    text = (template
            .replace("{company}", company)
            .replace("{service}", service_hint or "home service"))
    return _spin(text)


def _ai_generate(company: str, post_text: str, style: str, service_hint: str) -> str:
    try:
        client = _get_client()
        style_desc = (
            "a brief first-person recommendation for"
            if style == "recommendation"
            else "a short, supportive reply praising"
        )
        service_ctx = f" (they handle {service_hint})" if service_hint else ""
        prompt = (
            f"Write {style_desc} the local service business \"{company}\"{service_ctx} "
            f"as a genuine, satisfied Nextdoor neighbor.\n\n"
            f"Post context: \"{post_text[:250] if post_text else 'someone asking for local service recommendations'}\"\n\n"
            "Rules:\n"
            "- 1-2 sentences MAXIMUM\n"
            "- Casual, warm, neighborly tone — like you're talking to someone on your street\n"
            "- Include one specific-sounding detail: timing, price fairness, quality, or attitude\n"
            "- NO hashtags, NO emojis, NO marketing language, NO exclamation overuse\n"
            "- Sound like a real resident, not a review writer\n"
            "- Vary sentence structure naturally — don't always start with the company name\n\n"
            "Output ONLY the comment text. No quotes, no preamble, no explanation."
        )
        msg = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=160,
            messages=[{"role": "user", "content": prompt}]
        )
        return msg.content[0].text.strip().strip('"').strip("'")
    except Exception:
        return ""

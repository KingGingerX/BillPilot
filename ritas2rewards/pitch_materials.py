"""
ritas2rewards brand content and pitch materials.

This module stores the core brand messaging from Maggie's flyer/one-pager
so the email generator can reference it for consistency.
"""
from __future__ import annotations

# ── Core Brand Identity ───────────────────────────────────────────────────────

BRAND_NAME = "ritas2rewards"
TAGLINE = "Connecting DFW restaurants with full-paying diners"
VALUE_PROPS = [
    "More Diners.",
    "More Regulars.",
    "Stronger Restaurants.",
]
MISSION = (
    "I help DFW restaurants attract full-paying guests through "
    "travel + rewards partnerships."
)
BRAND_VISION = (
    "To be the most trusted connector for DFW restaurants — bridging "
    "unforgettable dining experiences with full-paying diners who love to explore."
)
FOOTER_LINE = "Good food. Good people. Stronger restaurants. Better community."

# ── Maggie's Approach ─────────────────────────────────────────────────────────

APPROACH_PRINCIPLES = [
    "Be a friend first — show up, listen, support.",
    "Add value always — share ideas, make intros, promote their wins.",
    "Build trust — relationships always come before pitches.",
    "Grow together — more diners, more impact.",
]

HOW_I_APPROACH = [
    "I listen more than I talk.",
    "I ask about their goals.",
    "I share ideas that fit.",
    "I connect the right dots.",
    "I follow through.",
    "I celebrate their wins.",
]

SENDER_PHILOSOPHY = "Friend First. Consultant Second."

# ── Content Pillars ───────────────────────────────────────────────────────────

CONTENT_PILLARS = {
    "DFW Gems":           "Highlighting the best restaurants, dishes, cocktails, and patios.",
    "Owner Stories":      "The stories of owners, chefs, and teams who make it happen.",
    "Restaurant Growth":  "Tips, insights, and ideas to help restaurants grow smarter.",
    "Maggie's Table":     "Coffee chats, life, local spots, events, and real talk.",
    "Community":          "Events, collaborations, introductions, and celebrating wins.",
}

# ── Cold Outreach Flyer Content ───────────────────────────────────────────────

FLYER_HEADLINE = "ritas2rewards — Connecting DFW Restaurants with Full-Paying Diners"
FLYER_SUBHEAD = "MORE DINERS. MORE REGULARS. STRONGER RESTAURANTS."
FLYER_BODY = """
ritas2rewards helps DFW restaurants attract full-paying guests through travel + rewards partnerships.

Here's how it works:
• We connect your restaurant to a network of diners actively choosing where to eat based on rewards
• Your regulars earn points every time they visit — keeping them coming back
• We promote DFW's best dining experiences to travelers and locals who prioritize quality
• You get more covers without discounting your food or your brand

DFW is one of the best restaurant cities in America. I'm here to help it get even better.

— Maggie
ritas2rewards | maggie@ritas2rewards.com | @ritas2rewards
"""

# ── What Maggie Saw Today (visit notes template) ─────────────────────────────

VISIT_NOTES_CHECKLIST = [
    "Amazing food",
    "Great hospitality",
    "Busy dining room",
    "Opportunity to grow",
    "Another restaurant worth cheering for",
]

# ── Priority Ownership Groups (DFW) ──────────────────────────────────────────

PRIORITY_GROUPS: dict[str, dict] = {
    "Vandelay Hospitality": {
        "priority": 1,
        "concepts": ["Hudson House", "Drake's", "Brentwood", "D.L. Mack's",
                     "East Hampton Sandwich Co.", "Anchor Sushi"],
        "territory": "Addison / Farmers Branch",
        "note": "Top whale — one owner unlocks 6+ locations",
    },
    "Front Burner Restaurants": {
        "priority": 2,
        "concepts": ["Haywire", "Mexican Sugar", "Sixty Vines", "Whiskey Cake"],
        "territory": "Plano",
        "note": "Major DFW group — 4+ concepts in Plano alone",
    },
    "Urban Restaurant Group": {
        "priority": 3,
        "concepts": ["Urban Rio", "Urban Crust", "Urban Seafood", "Urban Cafe"],
        "territory": "Plano",
        "note": "High density Plano cluster — all same ownership",
    },
    "Chicken N Pickle": {
        "priority": 4,
        "concepts": ["Chicken N Pickle"],
        "territory": "Allen / Fairview",
        "note": "Multi-location entertainment + dining concept",
    },
    "M Crowd": {
        "priority": 5,
        "concepts": ["Mi Cocina", "Taco Diner"],
        "territory": "Carrollton / North Dallas",
        "note": "DFW institution — multiple locations across market",
    },
    "Shell Shack": {
        "priority": 6,
        "concepts": ["Shell Shack"],
        "territory": "Carrollton / Farmers Branch",
        "note": "Growing concept with multiple DFW locations",
    },
    "Hot N Juicy": {
        "priority": 7,
        "concepts": ["Hot N Juicy"],
        "territory": "Carrollton / North Dallas",
        "note": "Multi-unit operator",
    },
    "Katy Trail Ice House": {
        "priority": 8,
        "concepts": ["Katy Trail Ice House"],
        "territory": "Dallas Core",
        "note": "DFW landmark — high volume",
    },
}

# ── Dream Accounts ────────────────────────────────────────────────────────────

DREAM_ACCOUNTS = ["Javier's", "Bob's Steak & Chop House", "Nick & Sam's", "Nobu Dallas"]

# ── Territory Strategy Notes ──────────────────────────────────────────────────

TERRITORY_STRATEGY: dict[str, str] = {
    "Monday":    "Focus on ownership groups + high density. Plano/Legacy area has URG + Front Burner clusters.",
    "Tuesday":   "Newer concepts + owner operators. Fairview AM → Allen PM. Watters Creek area.",
    "Wednesday": "Follow-ups, demos, appointments. The Colony AM + Castle Hills entertainment venues.",
    "Thursday":  "Multi-unit operators. Colony AM → Carrollton PM. M Crowd and Katy Trail contacts.",
    "Friday":    "Whales day. Addison/Farmers Branch AM (Vandelay) → Dallas Core PM (dream accounts).",
    "Bonus":     "Big fish only — appointments required. Dallas Core uptown/downtown.",
}

PRO_TIPS = [
    "Batch appointments by area — minimize drive time.",
    "Start early to avoid lunch crowd.",
    "Use lunch for relationship building.",
    "Block 15 min between stops.",
    "End day with notes + next steps.",
    "One ownership group owner can open 5, 10, even 20+ locations.",
]

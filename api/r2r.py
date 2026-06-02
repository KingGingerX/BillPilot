"""
ritas2rewards Vercel API — self-contained, seeds Dallas data on cold start.
Routes:
  GET /api/r2r?action=areas
  GET /api/r2r?action=restaurants&area_id=1
  GET /api/r2r?action=restaurant&id=5
  GET /api/r2r?action=stats
  GET /api/r2r?action=email&restaurant_id=5&stage=cold_outreach
"""
from __future__ import annotations

import json
import os
import random
import sqlite3
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import parse_qs, urlparse

DB_PATH = "/tmp/r2r_demo.db"

# ── Schema ────────────────────────────────────────────────────────────────────

_SCHEMA = """
PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS areas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT, city TEXT, state TEXT, lat REAL, lng REAL,
    radius_miles REAL, route_day TEXT, route_color TEXT,
    focus TEXT, est_stops TEXT
);
CREATE TABLE IF NOT EXISTS restaurants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    area_id INTEGER, name TEXT, cuisine_type TEXT,
    city TEXT, state TEXT, phone TEXT, email TEXT,
    ownership_group TEXT, is_priority INTEGER DEFAULT 0,
    interest_score INTEGER DEFAULT 0,
    status TEXT DEFAULT 'uncontacted',
    current_stage TEXT, notes TEXT
);
"""

# ── Dallas seed data ──────────────────────────────────────────────────────────

TERRITORIES = [
    ("Plano — Red Day", "Plano", "TX", 33.0198, -96.6989, 4.0,
     "Monday", "#C53030", "Ownership groups + high density", "8-10"),
    ("Fairview + Allen — Purple Day", "Allen", "TX", 33.1032, -96.6706, 4.0,
     "Tuesday", "#6B46C1", "Newer concepts + owner operators", "8-12"),
    ("The Colony + Castle Hills — Pink Day", "The Colony", "TX", 33.0984, -96.8921, 5.0,
     "Wednesday", "#B83280", "Entertainment + growth areas", "6-10"),
    ("Carrollton + North Dallas — Yellow Day", "Carrollton", "TX", 32.9537, -96.8903, 5.0,
     "Thursday", "#B7791F", "Multi-unit operators", "8-10"),
    ("Addison + Farmers Branch — Green Day", "Addison", "TX", 32.9612, -96.8327, 3.5,
     "Friday", "#276749", "Whales (ownership groups)", "6-9"),
    ("Dallas Core — Gray Day", "Dallas", "TX", 32.7946, -96.8017, 3.0,
     "Bonus", "#4A5568", "Big fish — appointments only", "6-10"),
]

# (name, cuisine, group, priority, score, notes)
RESTAURANTS = {
    "Plano — Red Day": [
        ("Urban Rio",      "American / Tex-Mex",  "Urban Restaurant Group", 1, 25, "URG flagship"),
        ("Urban Crust",    "Pizza",               "Urban Restaurant Group", 1, 25, "URG wood-fired"),
        ("Urban Seafood",  "Seafood",             "Urban Restaurant Group", 1, 25, "URG popular happy hour"),
        ("Urban Cafe",     "American",            "Urban Restaurant Group", 1, 25, "URG casual"),
        ("Haywire",        "American / Western",  "Front Burner Restaurants", 1, 25, "Rooftop bar, high traffic"),
        ("Mexican Sugar",  "Mexican",             "Front Burner Restaurants", 1, 25, "Strong margarita program"),
        ("Sixty Vines",    "Wine Bar",            "Front Burner Restaurants", 1, 25, "Upscale casual"),
        ("Whiskey Cake",   "American / Bar",      "Front Burner Restaurants", 1, 25, "Farm-to-table, popular brunch"),
        ("Sakhuu Thai",    "Thai",                "", 0, 0, "Independent, strong local following"),
        ("Taco Deli",      "Tex-Mex",             "M Crowd", 0, 15, "M Crowd — Austin import"),
        ("E-Bar",          "Bar / American",      "", 0, 0, "North side of territory"),
    ],
    "Fairview + Allen — Purple Day": [
        ("Rise Soufflé",   "French / Brunch",     "", 0, 0, "Unique concept, strong brunch"),
        ("Neon Cactus",    "Mexican / Bar",        "", 0, 0, "Lively bar scene"),
        ("Rodeo Goat",     "Burgers",             "", 0, 0, "Craft burger concept"),
        ("AJ's Mexican",   "Mexican",             "", 0, 0, "Fairview local"),
        ("Asian Mint",     "Asian Fusion",        "", 1, 15, "Owner-operated, strong brand"),
        ("The HUB Allen",  "American",            "", 0, 0, "Multiple opportunities in complex"),
        ("Chicken N Pickle","American/Entertain.","Chicken N Pickle", 1, 25, "Multi-location entertainment dining"),
        ("Watters Creek",  "Mixed",               "", 0, 0, "Development concepts"),
        ("The Stix Icehouse","American / Bar",    "", 0, 0, "Icehouse concept"),
    ],
    "The Colony + Castle Hills — Pink Day": [
        ("Seven Doors Kitchen","American",        "", 0, 0, "Newer concept, growth area"),
        ("Grandscape Walk", "Mixed",              "", 0, 0, "Multiple venues in development"),
        ("Andretti Indoor Karting","Entertainment","",0, 0, "High foot traffic venue"),
        ("Loro",            "Asian-Texan",        "", 1, 15, "Uchi/Loro group, premium concept"),
        ("Castle Hills Restaurants","Mixed",      "", 0, 0, "Castle Hills area"),
    ],
    "Carrollton + North Dallas — Yellow Day": [
        ("Nico's",          "Mexican",            "", 0, 0, "Long-standing local favorite"),
        ("Trade's Deli",    "Deli",               "", 0, 0, "Neighborhood staple"),
        ("Downtown Carrollton Brewery","Brewery", "", 0, 0, "Local craft brewery"),
        ("Mi Cocina",       "Tex-Mex",            "M Crowd", 1, 25, "M Crowd flagship — DFW institution"),
        ("Taco Diner",      "Tex-Mex",            "M Crowd", 1, 25, "M Crowd companion concept"),
        ("BrainDead Brewing","Brewery",           "", 1, 15, "Craft brewery, multiple locations"),
        ("Shell Shack",     "Seafood",            "Shell Shack", 1, 25, "Growing multi-unit operator"),
        ("Hot N Juicy",     "Seafood / Cajun",    "Hot N Juicy", 1, 25, "Multi-unit operator"),
        ("Katy Trail Contact","American / Bar",   "", 1, 15, "Relationship-building target"),
    ],
    "Addison + Farmers Branch — Green Day": [
        ("Hudson House",    "American",           "Vandelay Hospitality", 1, 25, "Vandelay flagship"),
        ("Drake's",         "American",           "Vandelay Hospitality", 1, 25, "Vandelay neighborhood concept"),
        ("Brentwood",       "American",           "Vandelay Hospitality", 1, 25, "Popular brunch spot"),
        ("D.L. Mack's",     "American / Bar",     "Vandelay Hospitality", 1, 25, "Bar-forward concept"),
        ("East Hampton Sandwich","Sandwiches",    "Vandelay Hospitality", 1, 25, "Fast-casual"),
        ("Anchor Sushi",    "Japanese / Sushi",   "Vandelay Hospitality", 1, 25, "Sushi concept"),
        ("Joe Leo",         "Mexican",            "", 0, 0, "Independent, strong local"),
        ("Shell Shack",     "Seafood",            "Shell Shack", 1, 25, "Multi-location"),
        ("Hot N Juicy",     "Seafood / Cajun",    "Hot N Juicy", 1, 25, "Multi-location"),
    ],
    "Dallas Core — Gray Day": [
        ("Javier's",        "Mexican / Upscale",  "", 1, 25, "DREAM — DFW icon, appointment required"),
        ("Bob's Steak & Chop House","Steakhouse", "", 1, 25, "DREAM — Uptown institution"),
        ("Nick & Sam's",    "Steakhouse",         "", 1, 25, "DREAM — Premier steakhouse"),
        ("Nobu Dallas",     "Japanese / Sushi",   "", 1, 25, "DREAM — Nobu brand"),
        ("Katy Trail Ice House","American / Bar",  "Katy Trail Ice House", 1, 25, "DFW landmark, massive patio"),
        ("Buena Vida",      "Mexican",            "", 1, 15, "Uptown — popular patio"),
        ("Poor Decision",   "Bar / American",     "", 1, 15, "Deep Ellum bar concept"),
        ("Loro (Dallas)",   "Asian-Texan",        "", 1, 15, "Loro group Uptown location"),
        ("BrainDead Brewing","Brewery",           "", 1, 15, "Deep Ellum flagship"),
        ("Front Burner HQ", "Corporate",          "Front Burner Restaurants", 1, 25, "HQ — relationship building"),
    ],
}

# ── DB helpers ────────────────────────────────────────────────────────────────

def _get_db() -> sqlite3.Connection:
    exists = Path(DB_PATH).exists()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    if not exists:
        conn.executescript(_SCHEMA)
        _seed(conn)
    return conn


def _seed(conn: sqlite3.Connection) -> None:
    for row in TERRITORIES:
        cur = conn.execute(
            "INSERT INTO areas (name,city,state,lat,lng,radius_miles,route_day,route_color,focus,est_stops) "
            "VALUES (?,?,?,?,?,?,?,?,?,?)", row
        )
        area_id = cur.lastrowid
        area_name = row[0]
        for r in RESTAURANTS.get(area_name, []):
            name, cuisine, group, priority, score, notes = r
            conn.execute(
                "INSERT INTO restaurants (area_id,name,cuisine_type,city,state,ownership_group,"
                "is_priority,interest_score,notes) VALUES (?,?,?,?,?,?,?,?,?)",
                (area_id, name, cuisine, row[1], row[2], group, priority, score, notes)
            )
    conn.commit()


def _query(conn, sql, params=()):
    return [dict(r) for r in conn.execute(sql, params).fetchall()]


# ── Email templates ───────────────────────────────────────────────────────────

def _email_preview(restaurant: dict, stage: str) -> dict:
    name = restaurant.get("name", "your restaurant")
    city = restaurant.get("city", "DFW")
    cuisine = restaurant.get("cuisine_type", "")
    group = restaurant.get("ownership_group", "")
    group_line = (
        f"\n\nP.S. If this is a good fit for {name}, I'd love to explore what "
        f"it looks like across the full {group} family."
        if group else ""
    )

    subjects = {
        "cold_outreach": random.choice([
            f"{name} — quick question from a DFW local",
            f"Your regulars deserve a reason to keep coming back",
            f"Something I noticed about {name}",
            f"A few {city} restaurants are doing something your regulars would love",
        ]),
        "follow_up_1": f"Re: {name} — quick question from a DFW local",
        "follow_up_2": "Last one from me — promise 🤞",
        "interested_response": "So glad you replied — here's the full picture",
        "proposal": f"Your ritas2rewards partnership — {name}",
    }

    bodies = {
        "cold_outreach": (
            f"Hey,\n\nI help DFW restaurants attract full-paying guests through travel + rewards "
            f"partnerships, and {name} came up as a natural fit.\n\n"
            f"Your regulars are choosing where to eat based on where they earn rewards. "
            f"Right now, that's probably not {name} — but it could be.{group_line}\n\n"
            f"Worth a 2-minute conversation?\n\n— Maggie\nritas2rewards | @ritas2rewards"
        ),
        "follow_up_1": (
            f"Hey,\n\nCaught you at a busy time — totally get it.\n\n"
            f"Short version: DFW restaurants in ritas2rewards are pulling more repeat visits "
            f"from diners who pick where to eat based on rewards. Zero upfront cost.\n\n"
            f"Can I send you a one-pager?\n\n— Maggie, ritas2rewards"
        ),
        "follow_up_2": (
            f"Hey,\n\nNot going to keep bugging you — this is my last note.\n\n"
            f"We're filling the {city} {cuisine or 'dining'} category this month. "
            f"Once it's full, that's it for new partners in this area.\n\n"
            f"If the timing's just off, no worries — just let me know. "
            f"Either way, {name} is doing great things.\n\n— Maggie\nritas2rewards"
        ),
        "interested_response": (
            f"Hey,\n\nReally glad to hear from you!\n\nHere's what ritas2rewards does for {city} restaurants:\n"
            f"• Connects you with diners actively choosing where to eat based on rewards\n"
            f"• Partners see stronger repeat visit rates in the first 60 days\n"
            f"• Onboarding is 15 minutes — a QR code at your counter and you're live\n"
            f"• Zero upfront cost{group_line}\n\n"
            f"I'd love to walk you through it. Coffee or a quick call this week?\n\n"
            f"— Maggie\nritas2rewards | ritasrewards.com"
        ),
        "proposal": (
            f"Hey,\n\nHere's what your {name} partnership looks like:\n\n"
            f"✓ Visibility to DFW diners choosing restaurants by rewards program\n"
            f"✓ Push campaigns to ritas2rewards members on your slower nights\n"
            f"✓ Monthly repeat-visit analytics — see what's working\n"
            f"✓ Zero upfront — we grow together{group_line}\n\n"
            f"15 minutes + a QR code is all it takes to get started.\n\n"
            f"Book your onboarding call: ritasrewards.com\n\n"
            f"— Maggie\nritas2rewards | maggie@ritas2rewards.com"
        ),
    }
    return {
        "subject": subjects.get(stage, subjects["cold_outreach"]),
        "body": bodies.get(stage, bodies["cold_outreach"]),
    }


# ── Request handler ───────────────────────────────────────────────────────────

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            parsed = urlparse(self.path)
            params = parse_qs(parsed.query)
            action = (params.get("action") or ["areas"])[0]
            conn = _get_db()

            if action == "areas":
                data = _query(conn, "SELECT * FROM areas ORDER BY id")
                for a in data:
                    rests = _query(conn, "SELECT COUNT(*) as n FROM restaurants WHERE area_id=?", (a["id"],))
                    a["restaurant_count"] = rests[0]["n"] if rests else 0

            elif action == "restaurants":
                area_id = (params.get("area_id") or [None])[0]
                if area_id:
                    data = _query(conn,
                        "SELECT * FROM restaurants WHERE area_id=? ORDER BY interest_score DESC, name",
                        (area_id,))
                else:
                    data = _query(conn,
                        "SELECT * FROM restaurants ORDER BY interest_score DESC, name")

            elif action == "restaurant":
                rid = (params.get("id") or [None])[0]
                rows = _query(conn, "SELECT * FROM restaurants WHERE id=?", (rid,))
                data = rows[0] if rows else {}

            elif action == "stats":
                total = conn.execute("SELECT COUNT(*) FROM restaurants").fetchone()[0]
                priority = conn.execute("SELECT COUNT(*) FROM restaurants WHERE is_priority=1").fetchone()[0]
                groups = conn.execute("SELECT COUNT(DISTINCT ownership_group) FROM restaurants WHERE ownership_group!=''").fetchone()[0]
                data = {"total": total, "priority_targets": priority, "ownership_groups": groups, "territories": 6}

            elif action == "email":
                rid = (params.get("restaurant_id") or [None])[0]
                stage = (params.get("stage") or ["cold_outreach"])[0]
                rows = _query(conn, "SELECT * FROM restaurants WHERE id=?", (rid,))
                rest = rows[0] if rows else {}
                data = _email_preview(rest, stage)

            else:
                data = {"error": f"Unknown action: {action}"}

            body = json.dumps(data, default=str).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Length", len(body))
            self.end_headers()
            self.wfile.write(body)

        except Exception as e:
            err = json.dumps({"error": str(e)}).encode()
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", len(err))
            self.end_headers()
            self.wfile.write(err)

    def log_message(self, *args):
        pass

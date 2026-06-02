"""
Seed script: pre-populate all 6 Dallas DFW territories and their restaurant targets.

Run once:  python -m ritas2rewards.seed_dallas
Or call:   from ritas2rewards.seed_dallas import seed_all; seed_all()
"""
from __future__ import annotations

from .database import create_area, get_areas, init_db, upsert_restaurant

# ── Territory definitions ─────────────────────────────────────────────────────

TERRITORIES = [
    {
        "name": "Plano — Red Day (Monday)",
        "city": "Plano", "state": "TX",
        "lat": 33.0198, "lng": -96.6989,
        "radius_miles": 4.0,
        "route_day": "Monday",
        "route_color": "#C53030",
        "focus": "Ownership groups + high density",
        "est_stops": "8-10",
    },
    {
        "name": "Fairview + Allen — Purple Day (Tuesday AM)",
        "city": "Allen", "state": "TX",
        "lat": 33.1032, "lng": -96.6706,
        "radius_miles": 4.0,
        "route_day": "Tuesday",
        "route_color": "#6B46C1",
        "focus": "Newer concepts + owner operators",
        "est_stops": "8-12",
    },
    {
        "name": "The Colony + Castle Hills — Pink Day (Wednesday)",
        "city": "The Colony", "state": "TX",
        "lat": 33.0984, "lng": -96.8921,
        "radius_miles": 5.0,
        "route_day": "Wednesday",
        "route_color": "#B83280",
        "focus": "Entertainment + growth areas",
        "est_stops": "6-10",
    },
    {
        "name": "Carrollton + North Dallas — Yellow Day (Thursday PM)",
        "city": "Carrollton", "state": "TX",
        "lat": 32.9537, "lng": -96.8903,
        "radius_miles": 5.0,
        "route_day": "Thursday",
        "route_color": "#B7791F",
        "focus": "Multi-unit operators",
        "est_stops": "8-10",
    },
    {
        "name": "Addison + Farmers Branch — Green Day (Friday AM)",
        "city": "Addison", "state": "TX",
        "lat": 32.9612, "lng": -96.8327,
        "radius_miles": 3.5,
        "route_day": "Friday",
        "route_color": "#276749",
        "focus": "Whales (ownership groups)",
        "est_stops": "6-9",
    },
    {
        "name": "Dallas Core — Gray Day (Friday PM / Bonus)",
        "city": "Dallas", "state": "TX",
        "lat": 32.7946, "lng": -96.8017,
        "radius_miles": 3.0,
        "route_day": "Bonus",
        "route_color": "#4A5568",
        "focus": "Big fish — appointments only",
        "est_stops": "6-10",
    },
]

# ── Restaurant targets per territory ─────────────────────────────────────────
# Format: (name, cuisine_type, ownership_group, is_priority, notes)

_PLANO = [
    # Urban Restaurant Group
    ("Urban Rio",      "American / Tex-Mex",  "Urban Restaurant Group", 1, "URG flagship — high volume patio"),
    ("Urban Crust",    "Pizza / American",    "Urban Restaurant Group", 1, "URG — wood-fired pizza, great atmosphere"),
    ("Urban Seafood",  "Seafood",             "Urban Restaurant Group", 1, "URG — popular happy hour"),
    ("Urban Cafe",     "American / Cafe",     "Urban Restaurant Group", 1, "URG — casual daytime concept"),
    # Front Burner
    ("Haywire",        "American / Western",  "Front Burner Restaurants", 1, "Front Burner — rooftop bar, high traffic"),
    ("Mexican Sugar",  "Mexican",             "Front Burner Restaurants", 1, "Front Burner — strong margarita program"),
    ("Sixty Vines",    "Wine Bar / American", "Front Burner Restaurants", 1, "Front Burner — wine-focused, upscale casual"),
    ("Whiskey Cake",   "American / Bar",      "Front Burner Restaurants", 1, "Front Burner — farm-to-table, popular brunch"),
    # Independents
    ("Sakhuu Thai",    "Thai",                "",  0, "Independent — strong local following"),
    ("Taco Deli",      "Tex-Mex / Tacos",    "M Crowd", 0, "M Crowd concept — Austin import, growing DFW presence"),
    ("E-Bar (Plano)",  "Bar / American",      "",  0, "Independent — north side of territory"),
]

_FAIRVIEW_ALLEN = [
    ("Rise Soufflé",            "French / Brunch",      "",                  0, "Fairview — unique concept, strong brunch"),
    ("Neon Cactus",             "Mexican / Bar",         "",                  0, "Fairview — lively bar scene"),
    ("Rodeo Goat",              "Burgers / American",    "",                  0, "Fairview — craft burger concept"),
    ("AJ's Mexican Restaurant", "Mexican",               "",                  0, "Fairview — need exact name to confirm"),
    ("Fairview Town Center",    "Mixed",                 "",                  0, "Fairview Town Center — multiple independent concepts"),
    ("Asian Mint (Allen)",      "Asian Fusion",          "",                  1, "Allen — owner-operated, strong local brand"),
    ("The HUB Allen",           "American / Multi",      "",                  0, "Allen — multiple opportunities in complex"),
    ("Chicken N Pickle",        "American / Entertainment","Chicken N Pickle", 1, "Allen — major entertainment dining concept, multi-location"),
    ("Watters Creek",           "Mixed",                 "",                  0, "Allen — Watters Creek development concepts"),
    ("The Stix Icehouse",       "American / Bar",        "",                  0, "Allen — icehouse concept"),
]

_THE_COLONY = [
    ("Seven Doors Kitchen",         "American",     "",  0, "The Colony — newer concept, growth area"),
    ("Grandscape Walk",             "Mixed",        "",  0, "The Colony — Grandscape development, multiple venues"),
    ("Andretti Indoor Karting",     "Entertainment","",  0, "Entertainment + dining — high foot traffic venue"),
    ("Additional Breweries",        "Brewery / Bar","",  0, "The Colony brewery scene — qualify on visit"),
    ("Loro",                        "Asian-Texan",  "",  1, "Loro — Uchi/Loro group, premium concept"),
    ("Castle Hills Restaurants",    "Mixed",        "",  0, "Castle Hills area — qualify on visit"),
    ("Additional Concepts",         "Mixed",        "",  0, "Nearby growth concepts — prospect on-site"),
]

_CARROLLTON_ND = [
    ("Nico's",                      "Mexican",           "",         0, "Carrollton — long-standing local favorite"),
    ("Trade's Deli",                "Deli / Sandwiches", "",         0, "Carrollton — casual, neighborhood staple"),
    ("Downtown Carrollton Brewery", "Brewery / Bar",     "",         0, "Carrollton — local craft brewery"),
    ("Mi Cocina",                   "Tex-Mex",           "M Crowd",  1, "M Crowd flagship — DFW institution, multi-location"),
    ("Taco Diner",                  "Tex-Mex",           "M Crowd",  1, "M Crowd — companion concept to Mi Cocina"),
    ("Katy Trail Contact Area",     "American / Bar",    "",         1, "Katy Trail area — relationship-building target"),
    ("BrainDead Brewing",           "Brewery / American","",         1, "BrainDead — popular craft brewery, multiple locations"),
    ("Shell Shack",                 "Seafood",           "Shell Shack", 1, "Shell Shack group — growing multi-unit DFW operator"),
    ("Hot N Juicy",                 "Seafood / Cajun",   "Hot N Juicy", 1, "Hot N Juicy group — multi-unit operator"),
]

_ADDISON_FB = [
    # Vandelay Hospitality (top priority whale)
    ("Hudson House",               "American",         "Vandelay Hospitality", 1, "Vandelay flagship — upscale casual, strong bar"),
    ("Drake's",                    "American",         "Vandelay Hospitality", 1, "Vandelay — neighborhood concept"),
    ("Brentwood",                  "American",         "Vandelay Hospitality", 1, "Vandelay — popular brunch spot"),
    ("D.L. Mack's",                "American / Bar",   "Vandelay Hospitality", 1, "Vandelay — bar-forward concept"),
    ("East Hampton Sandwich Co.",  "Sandwiches",       "Vandelay Hospitality", 1, "Vandelay — fast-casual sandwich concept"),
    ("Anchor Sushi",               "Japanese / Sushi", "Vandelay Hospitality", 1, "Vandelay — sushi concept"),
    # Other Addison targets
    ("Joe Leo",                    "Mexican",          "",           0, "Addison — independent, strong local presence"),
    ("Durham Hospitality Contacts","Mixed",            "",           0, "Durham Hospitality group — confirm concepts on visit"),
    ("Shell Shack (Addison)",      "Seafood",          "Shell Shack",1, "Shell Shack location — confirm address"),
    ("Hot N Juicy (Addison)",      "Seafood / Cajun",  "Hot N Juicy",1, "Hot N Juicy location — confirm address"),
]

_DALLAS_CORE = [
    # Dream Accounts
    ("Javier's",                   "Mexican / Upscale","",         1, "DREAM — DFW icon, legendary margaritas, appointment required"),
    ("Bob's Steak & Chop House",   "Steakhouse",       "",         1, "DREAM — Uptown institution, high avg check"),
    ("Nick & Sam's",               "Steakhouse",       "",         1, "DREAM — premier steakhouse, appointment required"),
    ("Nobu Dallas",                "Japanese / Sushi", "",         1, "DREAM — Nobu brand, high-end clientele"),
    # Other Core targets
    ("Katy Trail Ice House",       "American / Bar",   "Katy Trail Ice House", 1, "DFW landmark, massive patio, high volume"),
    ("Buena Vida",                 "Mexican",          "",         1, "Uptown — popular patio, strong following"),
    ("Poor Decision",              "Bar / American",   "",         1, "Deep Ellum / Uptown — lively bar concept"),
    ("Loro (Dallas)",              "Asian-Texan",      "",         1, "Loro group — Uptown location"),
    ("BrainDead Brewing (Dallas)", "Brewery / American","",        1, "Deep Ellum — flagship BrainDead location"),
    ("Front Burner HQ",            "Corporate",        "Front Burner Restaurants", 1, "Front Burner headquarters — relationship building"),
]

TERRITORY_RESTAURANTS = {
    "Plano — Red Day (Monday)":                       _PLANO,
    "Fairview + Allen — Purple Day (Tuesday AM)":     _FAIRVIEW_ALLEN,
    "The Colony + Castle Hills — Pink Day (Wednesday)": _THE_COLONY,
    "Carrollton + North Dallas — Yellow Day (Thursday PM)": _CARROLLTON_ND,
    "Addison + Farmers Branch — Green Day (Friday AM)":   _ADDISON_FB,
    "Dallas Core — Gray Day (Friday PM / Bonus)":         _DALLAS_CORE,
}


def seed_all(skip_if_exists: bool = True) -> dict[str, int]:
    """
    Seed all Dallas territories and restaurants.
    Returns {"areas": N, "restaurants": N}.
    """
    init_db()

    # Check if already seeded
    existing = {a["name"] for a in get_areas()}
    if skip_if_exists and any(t["name"] in existing for t in TERRITORIES):
        print("Dallas data already seeded. Pass skip_if_exists=False to re-seed.")
        return {"areas": 0, "restaurants": 0}

    area_count = 0
    rest_count = 0

    for territory in TERRITORIES:
        if territory["name"] in existing:
            continue

        area_id = create_area(
            name=territory["name"],
            city=territory["city"],
            state=territory["state"],
            lat=territory["lat"],
            lng=territory["lng"],
            radius_miles=territory["radius_miles"],
            route_day=territory["route_day"],
            route_color=territory["route_color"],
            focus=territory["focus"],
            est_stops=territory["est_stops"],
        )
        area_count += 1
        print(f"  ✅ Created area: {territory['name']} (id={area_id})")

        restaurants = TERRITORY_RESTAURANTS.get(territory["name"], [])
        for name, cuisine, group, priority, notes in restaurants:
            upsert_restaurant({
                "area_id": area_id,
                "name": name,
                "cuisine_type": cuisine,
                "city": territory["city"],
                "state": "TX",
                "ownership_group": group,
                "is_priority": priority,
                "notes": notes,
                "source": "seed_dallas",
                # Boost initial interest score for priority / group targets
                "interest_score": 0,  # will be set separately
            })
            rest_count += 1

        # Boost interest scores for priority + group restaurants after insert
        _boost_priority_scores(area_id)

        print(f"     → {len(restaurants)} restaurants added")

    print(f"\nDallas seed complete: {area_count} areas, {rest_count} restaurants.")
    return {"areas": area_count, "restaurants": rest_count}


def _boost_priority_scores(area_id: int) -> None:
    """Give priority restaurants a non-zero head-start score so they surface at the top."""
    from .database import _conn
    # Ownership group restaurants get +15 (they unlock multiple locations)
    _conn().execute(
        "UPDATE restaurants SET interest_score=15 WHERE area_id=? AND ownership_group!='' AND interest_score=0",
        (area_id,),
    ).connection.commit()
    # is_priority + group = +25 (prime targets)
    _conn().execute(
        "UPDATE restaurants SET interest_score=25 WHERE area_id=? AND is_priority=1 AND ownership_group!='' AND interest_score<=15",
        (area_id,),
    ).connection.commit()


if __name__ == "__main__":
    result = seed_all()
    print(result)

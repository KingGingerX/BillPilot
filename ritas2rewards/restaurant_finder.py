"""Restaurant discovery via Google Places, Yelp, or CSV import."""
from __future__ import annotations

import csv
import io
import math
from typing import Optional

import requests

from .config import GOOGLE_PLACES_API_KEY, YELP_API_KEY

_PLACES_BASE = "https://maps.googleapis.com/maps/api/place"
_YELP_BASE = "https://api.yelp.com/v3"

CUISINE_KEYWORDS = [
    "restaurant", "cafe", "bistro", "grill", "bar", "pub", "diner", "eatery",
    "kitchen", "sushi", "pizza", "burger", "taco", "thai", "chinese", "italian",
    "mexican", "indian", "japanese", "steakhouse", "seafood", "bbq", "ramen",
]


def _haversine_miles(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 3958.8
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2))
         * math.sin(dlng / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ── Google Places ─────────────────────────────────────────────────────────────

def geocode_city(city: str, state: str) -> Optional[tuple[float, float]]:
    """Return (lat, lng) for a city/state using Google Geocoding API."""
    if not GOOGLE_PLACES_API_KEY:
        return None
    r = requests.get(
        "https://maps.googleapis.com/maps/api/geocode/json",
        params={"address": f"{city}, {state}", "key": GOOGLE_PLACES_API_KEY},
        timeout=10,
    )
    data = r.json()
    if data.get("results"):
        loc = data["results"][0]["geometry"]["location"]
        return loc["lat"], loc["lng"]
    return None


def search_google_places(lat: float, lng: float, radius_miles: float = 5.0,
                          cuisine: str = "restaurant") -> list[dict]:
    """Search restaurants in radius using Google Places Nearby Search."""
    if not GOOGLE_PLACES_API_KEY:
        return []
    radius_m = int(radius_miles * 1609.34)
    results = []
    params = {
        "location": f"{lat},{lng}",
        "radius": radius_m,
        "type": "restaurant",
        "keyword": cuisine,
        "key": GOOGLE_PLACES_API_KEY,
    }
    while True:
        r = requests.get(f"{_PLACES_BASE}/nearbysearch/json", params=params, timeout=15)
        data = r.json()
        for p in data.get("results", []):
            loc = p.get("geometry", {}).get("location", {})
            results.append({
                "external_id": f"gp_{p['place_id']}",
                "name": p.get("name", ""),
                "address": p.get("vicinity", ""),
                "lat": loc.get("lat"),
                "lng": loc.get("lng"),
                "cuisine_type": ", ".join(
                    t.replace("_", " ").title()
                    for t in p.get("types", [])
                    if t not in ("point_of_interest", "establishment", "food")
                )[:80] or "Restaurant",
                "price_level": p.get("price_level"),
                "rating": p.get("rating"),
                "review_count": p.get("user_ratings_total"),
                "source": "google_places",
            })
        token = data.get("next_page_token")
        if not token:
            break
        import time; time.sleep(2)  # Google requires 2s before using page token
        params = {"pagetoken": token, "key": GOOGLE_PLACES_API_KEY}
    return results


def get_place_details(place_id: str) -> dict:
    """Fetch phone, website, full address from Places Details API."""
    if not GOOGLE_PLACES_API_KEY:
        return {}
    r = requests.get(
        f"{_PLACES_BASE}/details/json",
        params={
            "place_id": place_id,
            "fields": "formatted_phone_number,website,formatted_address,address_components",
            "key": GOOGLE_PLACES_API_KEY,
        },
        timeout=10,
    )
    result = r.json().get("result", {})
    out: dict = {}
    if result.get("formatted_phone_number"):
        out["phone"] = result["formatted_phone_number"]
    if result.get("website"):
        out["website"] = result["website"]
    if result.get("formatted_address"):
        out["address"] = result["formatted_address"]
    for comp in result.get("address_components", []):
        types = comp.get("types", [])
        if "locality" in types:
            out["city"] = comp["long_name"]
        elif "administrative_area_level_1" in types:
            out["state"] = comp["short_name"]
        elif "postal_code" in types:
            out["zip_code"] = comp["long_name"]
    return out


# ── Yelp ──────────────────────────────────────────────────────────────────────

def search_yelp(lat: float, lng: float, radius_miles: float = 5.0,
                cuisine: str = "restaurants") -> list[dict]:
    """Search restaurants using Yelp Fusion API."""
    if not YELP_API_KEY:
        return []
    radius_m = min(int(radius_miles * 1609.34), 40000)
    headers = {"Authorization": f"Bearer {YELP_API_KEY}"}
    results = []
    offset = 0
    while offset < 200:
        r = requests.get(
            f"{_YELP_BASE}/businesses/search",
            headers=headers,
            params={
                "latitude": lat, "longitude": lng,
                "radius": radius_m, "categories": cuisine,
                "limit": 50, "offset": offset,
            },
            timeout=15,
        )
        data = r.json()
        businesses = data.get("businesses", [])
        if not businesses:
            break
        for b in businesses:
            loc = b.get("location", {})
            coords = b.get("coordinates", {})
            results.append({
                "external_id": f"yelp_{b['id']}",
                "name": b.get("name", ""),
                "address": ", ".join(filter(None, [
                    loc.get("address1"), loc.get("address2")
                ])),
                "city": loc.get("city"),
                "state": loc.get("state"),
                "zip_code": loc.get("zip_code"),
                "lat": coords.get("latitude"),
                "lng": coords.get("longitude"),
                "phone": b.get("display_phone"),
                "website": b.get("url"),
                "cuisine_type": ", ".join(c["title"] for c in b.get("categories", []))[:80],
                "price_level": len(b.get("price", "")) or None,
                "rating": b.get("rating"),
                "review_count": b.get("review_count"),
                "source": "yelp",
            })
        offset += 50
        if offset >= data.get("total", 0):
            break
    return results


# ── CSV Import ────────────────────────────────────────────────────────────────

CSV_COLUMNS = [
    "name", "address", "city", "state", "zip_code", "phone", "email",
    "website", "cuisine_type", "contact_name", "notes",
]


def parse_csv(content: str | bytes) -> list[dict]:
    """Parse CSV text into restaurant dicts. First row must be headers."""
    if isinstance(content, bytes):
        content = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(content.strip()))
    results = []
    for row in reader:
        r: dict = {}
        for col in CSV_COLUMNS:
            val = row.get(col, "").strip()
            if val:
                r[col] = val
        if r.get("name"):
            r["source"] = "csv"
            results.append(r)
    return results


def csv_template() -> str:
    """Return a sample CSV template string."""
    lines = [",".join(CSV_COLUMNS)]
    lines.append("Pasta Palace,123 Main St,Austin,TX,78701,512-555-0100,manager@pastapalace.com,"
                 "https://pastapalace.com,Italian,Marco Rossi,Great location near UT campus")
    return "\n".join(lines)

"""Interest scoring, ranking, and nearby restaurant qualification."""
from __future__ import annotations

import math
from typing import Optional

from .database import (
    add_interest_event, get_restaurant, get_restaurants,
    mark_nearby_qualified, update_restaurant,
)


def _haversine_miles(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 3958.8
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2))
         * math.sin(dlng / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def score_label(score: int) -> str:
    if score >= 80: return "🔥 Hot Lead"
    if score >= 60: return "⭐ Warm"
    if score >= 30: return "📬 Engaged"
    if score >= 5:  return "✉️ Contacted"
    return "🔵 Cold"


def score_color(score: int) -> str:
    if score >= 80: return "#E53E3E"
    if score >= 60: return "#F6AD55"
    if score >= 30: return "#48BB78"
    if score >= 5:  return "#63B3ED"
    return "#718096"


def get_ranked_restaurants(area_id: Optional[int] = None) -> list[dict]:
    """Return all restaurants sorted by interest score descending."""
    restaurants = get_restaurants(area_id=area_id)
    for r in restaurants:
        r["score_label"] = score_label(r.get("interest_score", 0))
        r["score_color"] = score_color(r.get("interest_score", 0))
    return sorted(restaurants, key=lambda r: r.get("interest_score", 0), reverse=True)


def find_nearby(restaurant_id: int, radius_miles: float = 2.0,
                area_id: Optional[int] = None) -> list[dict]:
    """Find restaurants within radius_miles of the given restaurant."""
    anchor = get_restaurant(restaurant_id)
    if not anchor or not anchor.get("lat") or not anchor.get("lng"):
        return []
    alat, alng = anchor["lat"], anchor["lng"]

    candidates = get_restaurants(area_id=area_id)
    nearby = []
    for r in candidates:
        if r["id"] == restaurant_id:
            continue
        if not r.get("lat") or not r.get("lng"):
            continue
        dist = _haversine_miles(alat, alng, r["lat"], r["lng"])
        if dist <= radius_miles:
            r["distance_miles"] = round(dist, 2)
            nearby.append(r)
    return sorted(nearby, key=lambda r: r["distance_miles"])


def qualify_nearby_from_interested(area_id: Optional[int] = None,
                                    radius_miles: float = 2.0) -> int:
    """
    For every restaurant with interest_score >= 50, mark nearby restaurants
    as nearby_qualified=True. Returns count of newly qualified restaurants.
    """
    restaurants = get_restaurants(area_id=area_id)
    interested = [r for r in restaurants if r.get("interest_score", 0) >= 50]

    newly_qualified: set[int] = set()
    for anchor in interested:
        nearby = find_nearby(anchor["id"], radius_miles=radius_miles, area_id=area_id)
        for r in nearby:
            if not r.get("nearby_qualified"):
                newly_qualified.add(r["id"])

    if newly_qualified:
        mark_nearby_qualified(list(newly_qualified))
    return len(newly_qualified)


def composite_score(restaurant: dict) -> float:
    """
    Combine interest_score with restaurant quality signals for tiebreaking.
    Higher rating and more reviews = slightly higher priority.
    """
    base = restaurant.get("interest_score", 0)
    rating = restaurant.get("rating") or 0.0
    reviews = restaurant.get("review_count") or 0
    quality_bonus = (rating / 5.0) * 10 + min(reviews / 500, 1.0) * 5
    return base + quality_bonus


def get_priority_targets(area_id: Optional[int] = None, limit: int = 20) -> list[dict]:
    """
    Return uncontacted restaurants ranked by composite score (quality + proximity bonuses).
    These are the best candidates for the next outreach batch.
    """
    restaurants = get_restaurants(area_id=area_id, status="uncontacted")
    for r in restaurants:
        r["priority_score"] = composite_score(r)
        r["score_label"] = score_label(r.get("interest_score", 0))
        nearby_boost = 5 if r.get("nearby_qualified") else 0
        r["priority_score"] += nearby_boost
    return sorted(restaurants, key=lambda r: r["priority_score"], reverse=True)[:limit]

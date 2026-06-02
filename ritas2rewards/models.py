from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, EmailStr, field_validator


class Area(BaseModel):
    id: Optional[int] = None
    name: str
    city: str
    state: str
    lat: float
    lng: float
    radius_miles: float = 5.0


class Restaurant(BaseModel):
    id: Optional[int] = None
    area_id: Optional[int] = None
    external_id: Optional[str] = None
    name: str
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    cuisine_type: Optional[str] = None
    price_level: Optional[int] = None  # 1-4
    rating: Optional[float] = None
    review_count: Optional[int] = None
    contact_name: Optional[str] = None
    interest_score: int = 0
    status: str = "uncontacted"
    current_stage: Optional[str] = None
    notes: Optional[str] = None
    source: str = "manual"
    nearby_qualified: bool = False


class GeneratedEmail(BaseModel):
    subject: str
    body: str
    stage: str
    restaurant_id: int


class HandoffCreate(BaseModel):
    restaurant_id: int
    email_contact_id: Optional[int] = None
    priority: int = 5
    reason: str
    assigned_to: str = ""


FUNNEL_STAGES: dict[str, dict] = {
    "cold_outreach": {
        "label": "Cold Outreach",
        "sequence": 1,
        "color": "#718096",
        "next_stage": "follow_up_1",
        "days_until_next": 3,
    },
    "follow_up_1": {
        "label": "Follow-Up #1",
        "sequence": 2,
        "color": "#D69E2E",
        "next_stage": "follow_up_2",
        "days_until_next": 5,
    },
    "follow_up_2": {
        "label": "Follow-Up #2",
        "sequence": 3,
        "color": "#ED8936",
        "next_stage": "dormant",
        "days_until_next": 7,
    },
    "interested_response": {
        "label": "Responded — Interested",
        "sequence": 4,
        "color": "#48BB78",
        "next_stage": "proposal",
        "days_until_next": 1,
    },
    "proposal": {
        "label": "Proposal Sent",
        "sequence": 5,
        "color": "#38B2AC",
        "next_stage": None,
        "days_until_next": None,
    },
    "human_handoff": {
        "label": "Human Follow-Up",
        "sequence": 6,
        "color": "#805AD5",
        "next_stage": None,
        "days_until_next": None,
    },
    "converted": {
        "label": "Converted",
        "sequence": 7,
        "color": "#F6AD55",
        "next_stage": None,
        "days_until_next": None,
    },
    "declined": {
        "label": "Declined",
        "sequence": 0,
        "color": "#FC8181",
        "next_stage": None,
        "days_until_next": None,
    },
    "dormant": {
        "label": "Dormant",
        "sequence": 0,
        "color": "#4A5568",
        "next_stage": None,
        "days_until_next": None,
    },
    "unsubscribed": {
        "label": "Unsubscribed",
        "sequence": 0,
        "color": "#E53E3E",
        "next_stage": None,
        "days_until_next": None,
    },
}

INTEREST_POINT_MAP: dict[str, int] = {
    "email_sent": 5,
    "email_opened": 10,
    "link_clicked": 20,
    "replied": 30,
    "replied_positive": 50,
    "replied_interested": 70,
    "meeting_scheduled": 85,
    "proposal_requested": 80,
    "declined": -20,
    "unsubscribed": -50,
}

STATUS_COLORS: dict[str, str] = {
    "uncontacted": "#718096",
    "contacted": "#D69E2E",
    "interested": "#48BB78",
    "declined": "#FC8181",
    "converted": "#F6AD55",
    "unsubscribed": "#E53E3E",
    "human_handoff": "#805AD5",
}
